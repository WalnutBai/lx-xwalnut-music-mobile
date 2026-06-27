import { log } from '@/utils/log'
import settingState from '@/store/setting/state'

export const preloadLog = {
  isEnabled: false,

  init() {
    const settingValue = settingState.setting['player.isEnableAudioPreload']
    this.isEnabled = settingValue !== undefined ? settingValue : false
  },

  updateEnabled(enabled: boolean) {
    this.isEnabled = enabled
  },

  info(...msgs: any[]) {
    if (!this.isEnabled) return
    if (!global.lx.isEnableLog) return
    const msg = msgs
      .map((m) =>
        typeof m == 'string' ? m : m instanceof Error ? (m.stack ?? m.message) : JSON.stringify(m)
      )
      .join(' ')
    log.info('[Preload] ' + msg)
  },

  warn(...msgs: any[]) {
    if (!this.isEnabled) return
    if (!global.lx.isEnableLog) return
    const msg = msgs
      .map((m) =>
        typeof m == 'string' ? m : m instanceof Error ? (m.stack ?? m.message) : JSON.stringify(m)
      )
      .join(' ')
    log.warn('[Preload] ' + msg)
  },

  error(...msgs: any[]) {
    if (!this.isEnabled) return
    if (!global.lx.isEnableLog) return
    const msg = msgs
      .map((m) =>
        typeof m == 'string' ? m : m instanceof Error ? (m.stack ?? m.message) : JSON.stringify(m)
      )
      .join(' ')
    log.error('[Preload] ' + msg)
  },
}

export default preloadLog
