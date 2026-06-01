import { findMusic } from '@/utils/musicSdk'
import { getWebDAVConfig, updateWebDAVMusicMeta, getWebDAVDownloadUrl, saveWebDAVConfig } from '@/core/webdavMusic/drive'
import { downloadFile, existsFile, mkdir } from '@/utils/fs'
import { toast, clipboardWriteText, requestStoragePermission } from '@/utils/tools'
import settingState from '@/store/setting/state'
import { btoa } from 'react-native-quick-base64'
import { updateListMusics } from '@/core/list'
import { webDAVLog } from '@/core/webdavMusic/logger'
import { readPic, readMetadata } from '@/utils/localMediaMetadata'

export const handleWebDAVDownload = async (musicInfo: LX.WebDAV.MusicInfo): Promise<string | null> => {
  // 先请求存储权限
  const hasPermission = await requestStoragePermission()
  if (!hasPermission) {
    toast('请授予存储权限后重试', 'long')
    return null
  }

  const downloadUrl = getWebDAVDownloadUrl(musicInfo)
  const downloadDir = settingState.setting['download.path'] || '/storage/emulated/0/Music/LX-N Music'
  const fileName = musicInfo.meta.fileName
  const filePath = `${downloadDir}/${fileName}`

  try {
    await mkdir(downloadDir)
    
    const username = settingState.setting['sync.webdav.username']
    const password = settingState.setting['sync.webdav.password']
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Linux; Android 10; Pixel 3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.79 Mobile Safari/537.36',
    }
    if (username && password) {
      headers['Authorization'] = 'Basic ' + btoa(`${username}:${password}`)
    }

    webDAVLog.info('handleWebDAVDownload: downloading file', { downloadUrl, filePath })
    await downloadFile(downloadUrl, filePath, { headers }).promise
    webDAVLog.info('handleWebDAVDownload: download completed')
    
    // 读取文件元数据（包括专辑名称等信息）
    const fileMetadata = await readMetadata(filePath).catch(() => null)
    webDAVLog.info('handleWebDAVDownload: read file metadata', { metadata: fileMetadata })
    
    const updates: Record<string, any> = { filePath }
    
    // 如果文件中有专辑信息，更新到配置
    if (fileMetadata) {
      if (fileMetadata.albumName) {
        updates.albumName = fileMetadata.albumName
        webDAVLog.info('handleWebDAVDownload: found album name in file', { albumName: fileMetadata.albumName })
      }
      if (fileMetadata.name && !musicInfo.name) {
        updates.name = fileMetadata.name
        webDAVLog.info('handleWebDAVDownload: found song name in file', { name: fileMetadata.name })
      }
      if (fileMetadata.singer && !musicInfo.singer) {
        updates.singer = fileMetadata.singer
        webDAVLog.info('handleWebDAVDownload: found singer in file', { singer: fileMetadata.singer })
      }
    }
    
    // 更新配置中的文件路径和元数据
    await updateWebDAVMusicMeta(musicInfo.id, updates)
    
    // 提取并更新封面
    const picPath = await readPic(filePath).catch(() => null)
    let newPicUrl: string | null = null
    if (picPath) {
      newPicUrl = picPath.startsWith('/') ? `file://${picPath}` : picPath
      await updateWebDAVMusicMeta(musicInfo.id, { picUrl: newPicUrl })
      webDAVLog.info('handleWebDAVDownload: saved embedded cover to meta', { picUrl: newPicUrl })
    } else {
      webDAVLog.info('handleWebDAVDownload: no embedded cover found in file')
    }
    
    // 触发 UI 刷新
    global.app_event.picUpdated()
    
    toast(`下载成功：${fileName}`)
    return newPicUrl
  } catch (error: any) {
    webDAVLog.error('handleWebDAVDownload: download failed', { error: error.message })
    toast(`下载失败：${error.message}`, 'long')
    return null
  }
}

export const handleFetchWebDAVPicFromOnline = async (
  musicInfo: LX.WebDAV.MusicInfo,
  listId?: string
) => {
  try {
    toast('正在从在线音源搜索同名歌曲...')
    webDAVLog.info('handleFetchWebDAVPicFromOnline: searching for', {
      musicId: musicInfo.id,
      name: musicInfo.name,
      singer: musicInfo.singer
    })

    // 使用 findMusic 搜索同名歌曲
    const searchResult = await findMusic({
      name: musicInfo.name,
      singer: musicInfo.singer,
      albumName: musicInfo.meta.albumName,
      interval: musicInfo.interval,
      source: musicInfo.source,
    })

    webDAVLog.info('handleFetchWebDAVPicFromOnline: search result count', {
      count: searchResult.length,
      results: searchResult
    })

    if (searchResult.length === 0) {
      toast('未找到匹配的歌曲')
      return null
    }

    // 取第一个结果的封面
    const matchedSong = searchResult[0]
    const newPicUrl = matchedSong.img || matchedSong.meta?.picUrl

    if (!newPicUrl) {
      webDAVLog.warn('handleFetchWebDAVPicFromOnline: matched song has no cover', matchedSong)
      toast('找到的歌曲没有封面')
      return null
    }

    webDAVLog.info('handleFetchWebDAVPicFromOnline: found cover', {
      source: matchedSong.source,
      name: matchedSong.name,
      singer: matchedSong.singer,
      picUrl: newPicUrl
    })

    await updateWebDAVMusicMeta(musicInfo.id, { picUrl: newPicUrl })

    if (listId) {
      await updateListMusics([{
        id: listId,
        musicInfo: { ...musicInfo, meta: { ...musicInfo.meta, picUrl: newPicUrl } }
      }])
    }

    global.app_event.picUpdated()

    toast('封面获取成功！')
    return newPicUrl
  } catch (error: any) {
    webDAVLog.error('handleFetchWebDAVPicFromOnline: failed', { error: error.message, error })
    const errorMessage = error.message || String(error)
    if (errorMessage.includes('timeout')) {
      toast('搜索超时，请重试', 'long')
    } else {
      toast(`获取封面失败：${errorMessage}`, 'long')
    }
    throw error
  }
}

export const handleWebDAVRemove = async (
  musicInfo: LX.WebDAV.MusicInfo
) => {
  try {
    const config = await getWebDAVConfig()
    const songIndex = config.songs.findIndex(song => song.id === musicInfo.id)
    
    if (songIndex === -1) {
      toast('未找到该歌曲')
      return
    }

    config.songs.splice(songIndex, 1)
    
    const { saveWebDAVConfig } = await import('@/core/webdavMusic/drive')
    await saveWebDAVConfig(config)
    
    toast('已从列表移除')
  } catch (error: any) {
    webDAVLog.error('handleWebDAVRemove: failed', { error: error.message })
    toast(`移除失败：${error.message}`, 'long')
  }
}

export const handleWebDAVCopyName = (musicInfo: LX.WebDAV.MusicInfo) => {
  const name = musicInfo.name || musicInfo.meta.fileName
  clipboardWriteText(name)
  toast('已复制歌曲名称')
}

import { addListMusics, setFetchingListStatus } from '@/core/list'
import { LIST_IDS } from '@/config/constant'
import BackgroundTimer from 'react-native-background-timer'
import { buildLocalMusicInfoByFilePath, buildLocalMusicInfo } from '../Mylist/MyList/listAction'

// 批量下载函数 - 下载所有 WebDAV 歌曲
export const handleWebDAVBatchDownload = async (
  songs: LX.WebDAV.MusicInfo[], 
  onProgress?: (current: number, total: number, currentSong: string) => void
): Promise<string[]> => {
  // 先请求存储权限
  const hasPermission = await requestStoragePermission()
  if (!hasPermission) {
    toast('请授予存储权限后重试', 'long')
    return []
  }

  const downloadDir = settingState.setting['download.path'] || '/storage/emulated/0/Music/LX-N Music'
  const downloadedPaths: string[] = []
  
  webDAVLog.info('handleWebDAVBatchDownload: starting batch download', { songCount: songs.length })
  
  try {
    await mkdir(downloadDir)
    
    const username = settingState.setting['sync.webdav.username']
    const password = settingState.setting['sync.webdav.password']
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Linux; Android 10; Pixel 3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.79 Mobile Safari/537.36',
    }
    if (username && password) {
      headers['Authorization'] = 'Basic ' + btoa(`${username}:${password}`)
    }
    
    let currentIndex = 0
    for (const musicInfo of songs) {
      currentIndex++
      const fileName = musicInfo.meta.fileName
      const filePath = `${downloadDir}/${fileName}`
      
      if (onProgress) {
        onProgress(currentIndex, songs.length, fileName)
      }
      
      // 检查文件是否存在
      const fileExists = await existsFile(filePath)
      
      // 如果配置中有 filePath 但文件不存在，清除 filePath 以便重新下载
      if (musicInfo.meta.filePath && !fileExists) {
        webDAVLog.info('handleWebDAVBatchDownload: file was deleted, clearing old filePath', { oldPath: musicInfo.meta.filePath })
        await updateWebDAVMusicMeta(musicInfo.id, { filePath: undefined })
      }
      
      // 如果文件已存在，跳过下载
      if (fileExists) {
        webDAVLog.info('handleWebDAVBatchDownload: file already exists, skipping', { filePath })
        downloadedPaths.push(filePath)
        
        // 更新文件路径到配置中
        await updateWebDAVMusicMeta(musicInfo.id, { filePath })
        continue
      }
      
      try {
        const downloadUrl = getWebDAVDownloadUrl(musicInfo)
        webDAVLog.info('handleWebDAVBatchDownload: downloading', { currentIndex, fileName, downloadUrl })
        
        await downloadFile(downloadUrl, filePath, { headers }).promise
        
        // 读取文件元数据
        const fileMetadata = await readMetadata(filePath).catch(() => null)
        
        const updates: Record<string, any> = { filePath }
        
        if (fileMetadata) {
          if (fileMetadata.albumName) updates.albumName = fileMetadata.albumName
          if (fileMetadata.name && !musicInfo.name) updates.name = fileMetadata.name
          if (fileMetadata.singer && !musicInfo.singer) updates.singer = fileMetadata.singer
        }
        
        // 更新配置中的文件路径和元数据
        await updateWebDAVMusicMeta(musicInfo.id, updates)
        
        // 提取并更新封面
        const picPath = await readPic(filePath).catch(() => null)
        if (picPath) {
          const newPicUrl = picPath.startsWith('/') ? `file://${picPath}` : picPath
          await updateWebDAVMusicMeta(musicInfo.id, { picUrl: newPicUrl })
        }
        
        downloadedPaths.push(filePath)
        webDAVLog.info('handleWebDAVBatchDownload: download completed', { currentIndex, fileName, filePath })
      } catch (error: any) {
        webDAVLog.error('handleWebDAVBatchDownload: download failed', { fileName, error: error.message })
        // 单个下载失败不中断整个流程
      }
    }
    
    webDAVLog.info('handleWebDAVBatchDownload: batch download completed', { downloadedCount: downloadedPaths.length })
    return downloadedPaths
  } catch (error: any) {
    webDAVLog.error('handleWebDAVBatchDownload: batch download failed', { error: error.message })
    throw error
  }
}

// 批量下载并导入到本地列表的完整流程
export const handleWebDAVDownloadAndImport = async (
  songs: LX.WebDAV.MusicInfo[],
  setLoadingText: (text: string) => void
): Promise<void> => {
  if (songs.length === 0) {
    toast('没有可下载的歌曲')
    return
  }
  
  setLoadingText(`正在下载 0/${songs.length}...`)
  webDAVLog.info('handleWebDAVDownloadAndImport: starting process', { songCount: songs.length })
  
  try {
    // 1. 批量下载文件
    const downloadedPaths = await handleWebDAVBatchDownload(songs, (current, total, fileName) => {
      setLoadingText(`正在下载 ${current}/${total}...\n${fileName}`)
    })
    
    if (downloadedPaths.length === 0) {
      toast('没有成功下载任何歌曲')
      return
    }
    
    webDAVLog.info('handleWebDAVDownloadAndImport: download completed', { downloadedCount: downloadedPaths.length })
    
    // 2. 准备文件对象用于添加到列表
    const files = downloadedPaths.map(path => {
      const name = path.split('/').pop() || ''
      return { path, name } as any
    })
    
    // 3. 快速添加到下载列表
    setLoadingText('正在添加到列表...')
    await addListMusics(
      LIST_IDS.DOWNLOAD,
      files.map(buildLocalMusicInfoByFilePath),
      settingState.setting['list.addMusicLocationType']
    )
    
    // 4. 显示提示并开始标签读取
    toast(global.i18n.t('list_select_local_file_temp_add_tip', { total: files.length }), 'long')
    
    setLoadingText('正在读取音乐标签...')
    
    // 5. 开始标签读取流程（复用本地导入的逻辑）
    const createLocalMusicInfos = async (
      filePaths: string[],
      errorPath: string[]
    ): Promise<LX.Music.MusicInfoLocal[]> => {
      const list: LX.Music.MusicInfoLocal[] = []
      filePaths = [...filePaths]
      while (filePaths.length) {
        const tasks = [
          filePaths.shift(),
          filePaths.shift(),
          filePaths.shift(),
          filePaths.shift(),
          filePaths.shift(),
        ].filter(Boolean) as string[]

        await Promise.all(
          tasks.map(async (path) => {
            const info = await readMetadata(path)
            const picPath = await readPic(path).catch(() => null)
            return { path, info, picPath }
          }),
        ).then((res) => {
          for (const { path, info, picPath } of res) {
            if (!info) {
              errorPath.push(path)
              continue
            }
            const musicInfo = buildLocalMusicInfo(path, info, picPath)
            list.push(musicInfo)
          }
        })
      }
      return list
    }
    
    const createThrottleAddMusics = (
      add: (listId: string, musicInfos: LX.Music.MusicInfoLocal[]) => Promise<void>,
      remove: (listId: string, errorPath: string[]) => Promise<void>,
      listId: string
    ) => {
      let timer: number | null = null
      let _musicInfos: LX.Music.MusicInfoLocal[] = []
      let _errorPath: string[] = []
      return (musicInfos: LX.Music.MusicInfoLocal[], errorPath?: string[]) => {
        if (musicInfos.length) _musicInfos = [..._musicInfos, ...musicInfos]
        if (errorPath) _errorPath = [..._errorPath, ...errorPath]
        if (timer) return
        timer = BackgroundTimer.setTimeout(async () => {
          timer = null
          let musicInfos = _musicInfos
          _musicInfos = []
          let errorPath = _errorPath
          _errorPath = []
          if (musicInfos.length) await add(listId, musicInfos)
          if (errorPath.length) await remove(listId, errorPath)
        }, 100)
      }
    }
    
    const handleUpdateMusics = async (
      filePaths: string[],
      throttleUpdateMusics: (musicInfos: LX.Music.MusicInfoLocal[], errorPath?: string[]) => void,
      index: number = -1,
      total: number = 0,
      errorPath: string[] = []
    ) => {
      if (!total) total = filePaths.length
      const paths = filePaths.slice(index + 1, index + 11)
      const musicInfos = await createLocalMusicInfos(paths, errorPath)
      if (musicInfos.length) {
        throttleUpdateMusics(musicInfos)
        // 立即更新列表以刷新显示
        await updateListMusics(musicInfos.map((info) => ({ id: LIST_IDS.DOWNLOAD, musicInfo: info })))
      }
      setLoadingText(`正在读取标签 ${Math.min(index + 11, total)}/${total}...`)
      index += 10
      if (filePaths.length - 1 > index)
        await handleUpdateMusics(filePaths, throttleUpdateMusics, index, total, errorPath)
      else {
        if (errorPath.length) {
          toast(
            global.i18n.t('list_select_local_file_result_failed_tip', {
              total,
              success: total - errorPath.length,
              failed: errorPath.length,
            }),
            'long'
          )
        } else {
          toast(global.i18n.t('list_select_local_file_result_tip', { total }), 'long')
        }
        throttleUpdateMusics([], errorPath)
        setLoadingText('')
      }
    }
    
    const throttleUpdateMusics = createThrottleAddMusics(
      async (listId, musicInfos) => {
        return updateListMusics(musicInfos.map((info) => ({ id: listId, musicInfo: info })))
      },
      async (listId, errorPath) => {
        return Promise.resolve()
      },
      LIST_IDS.DOWNLOAD
    )
    
    await handleUpdateMusics(downloadedPaths, throttleUpdateMusics)
    
    webDAVLog.info('handleWebDAVDownloadAndImport: all processes completed')
    
  } catch (error: any) {
    webDAVLog.error('handleWebDAVDownloadAndImport: process failed', { error: error.message })
    toast(`导入失败：${error.message}`, 'long')
    setLoadingText('')
  }
}
