// import { requestStoragePermission } from '@/utils/common'
import {
  temporaryDirectoryPath,
  existsFile,
  appendFile,
  unlink,
  writeFile,
  readFile,
  stat,
} from '@/utils/fs'
import RNFS from 'react-native-fs'

const logPath = temporaryDirectoryPath + '/error.log'
const sourceTestLogPath = temporaryDirectoryPath + '/source_test.log'
const MAX_LOG_SIZE = 5 * 1024 * 1024 
const READ_LIMIT = 1 * 1024 * 1024   

const trimLogFile = async () => {
  try {
    const info = await stat(logPath)
    if (info.size > MAX_LOG_SIZE) {
      await unlink(logPath)
      await writeFile(logPath, '')
    }
  } catch { /* ignore */ }
}

const logTools = {
  tempLog: [] as Array<{ time: string; type: 'LOG' | 'WARN' | 'ERROR'; text: string }> | null,
  writeLog(msg: string) {
    console.log(msg)
    void appendFile(logPath, '\n----lx log----\n' + msg)
    void trimLogFile()
  },
  async initLogFile() {
    try {
      let isExists = await existsFile(logPath)
      // console.log(isExists)
      if (!isExists) await writeFile(logPath, '')
      if (this.tempLog?.length)
        this.writeLog(
          this.tempLog.map((m) => `${m.time} ${m.type} ${m.text}`).join('\n----lx log----\n')
        )
      this.tempLog = null
    } catch (err) {
      console.log(err)
    }
  },
}

export const init = async () => {
  return logTools.initLogFile()
}

export const getLogs = async () => {
  try {
    const info = await stat(logPath)
    if (info.size > READ_LIMIT) {
      // 大文件只读取最后 1MB，避免 OOM
      const position = Math.max(0, info.size - READ_LIMIT)
      return await RNFS.read(logPath, READ_LIMIT, position, 'utf8')
    }
  } catch { /* ignore */ }
  return readFile(logPath)
}

export const clearLogs = async () => {
  return unlink(logPath).then(async () => writeFile(logPath, ''))
}

export const log = {
  info(...msgs: any[]) {
    // console.info(...msgs)
    const msg = msgs
      .map((m) =>
        typeof m == 'string' ? m : m instanceof Error ? (m.stack ?? m.message) : JSON.stringify(m)
      )
      .join(' ')
    if (msg.startsWith('%c')) return
    const time = new Date().toLocaleString()
    if (logTools.tempLog) {
      logTools.tempLog.push({ type: 'LOG', time, text: msg })
    } else logTools.writeLog(`${time} LOG ${msg}`)
  },
  warn(...msgs: any[]) {
    // console.warn(...msgs)
    const msg = msgs
      .map((m) =>
        typeof m == 'string' ? m : m instanceof Error ? (m.stack ?? m.message) : JSON.stringify(m)
      )
      .join(' ')
    const time = new Date().toLocaleString()
    if (logTools.tempLog) {
      logTools.tempLog.push({ type: 'WARN', time, text: msg })
    } else logTools.writeLog(`${time} WARN ${msg}`)
  },
  error(...msgs: any[]) {
    const msg = msgs
      .map((m) =>
        typeof m == 'string' ? m : m instanceof Error ? (m.stack ?? m.message) : JSON.stringify(m)
      )
      .join(' ')
    const time = new Date().toLocaleString()
    if (logTools.tempLog) {
      logTools.tempLog.push({ type: 'ERROR', time, text: msg })
    } else {
      logTools.writeLog(`${time} ERROR ${msg}`)
    }
  },
}

export const getSourceTestLogs = async () => {
  return readFile(sourceTestLogPath)
}

export const clearSourceTestLogs = async () => {
  return unlink(sourceTestLogPath).then(async () => writeFile(sourceTestLogPath, ''))
}

export const sourceTestLog = {
  info(...msgs: any[]) {
    const msg = msgs
      .map((m) =>
        typeof m == 'string' ? m : m instanceof Error ? (m.stack ?? m.message) : JSON.stringify(m)
      )
      .join(' ')
    if (msg.startsWith('%c')) return
    const time = new Date().toLocaleString()
    void appendFile(sourceTestLogPath, `\n----lx source test log----\n${time} LOG ${msg}`)
  },
}

/*
if (process.env.NODE_ENV !== 'development') {
  const logPath = externalDirectoryPath + '/debug.log'

  let tempLog = []

  const log = window.console.log
  const error = window.console.error
  const warn = window.console.warn

  const writeLog = msg => appendFile(logPath, '\n' + msg)

  window.console.log = (...msgs) => {
    log(...msgs)
    const msg = msgs.map(m => typeof m == 'string' ? m : JSON.stringify(m)).join(' ')
    if (msg.startsWith('%c')) return
    const time = new Date().toLocaleString()
    if (tempLog) {
      tempLog({ type: 'LOG', time, text: msg })
    } else writeLog(`${time} LOG ${msg}`)
  }
  window.console.error = (...msgs) => {
    error(...msgs)
    const msg = msgs.map(m => typeof m == 'string' ? m : JSON.stringify(m)).join(' ')
    const time = new Date().toLocaleString()
    if (tempLog) {
      tempLog({ type: 'ERROR', time, text: msg })
    } else writeLog(`${time} ERROR ${msg}`)
  }
  window.console.warn = (...msgs) => {
    warn(...msgs)
    const msg = msgs.map(m => typeof m == 'string' ? m : JSON.stringify(m)).join(' ')
    const time = new Date().toLocaleString()
    if (tempLog) {
      tempLog({ type: 'WARN', time, text: msg })
    } else writeLog(`${time} WARN ${msg}`)
  }

  const init = async() => {
    try {
      let result = await requestStoragePermission()
      if (!result) return
      let isExists = await existsFile(logPath)
      console.log(logPath, isExists)
      if (!isExists) await writeFile(logPath, '')
      writeLog(tempLog(m => `${m.time} ${m.type} ${m.text}`).join('\n'))
      tempLog = null
    } catch (err) {
      console.error(err)
    }
  }


  init()
}

 */
