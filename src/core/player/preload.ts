import { getMusicUrl } from '@/core/music'
import { getNextPlayMusicInfo } from '@/core/player/player'
import { getList } from '@/core/player/playInfo'
import playerState from '@/store/player/state'
import settingState from '@/store/setting/state'
import { preloadLog } from '@/utils/preloadLog'

let isPreloading = false

const preloadNextMusic = async () => {
  if (isPreloading) return
  if (!settingState.setting['player.isEnableAudioPreload']) return
  
  const currentMusicInfo = playerState.playMusicInfo.musicInfo
  if (!currentMusicInfo) {
    preloadLog.info('No current music info, skipping preload')
    return
  }
  
  isPreloading = true
  preloadLog.info('========== Preload Start ==========')
  
  try {
    const nextPlayMusicInfo = await getNextPlayMusicInfo()
    if (!nextPlayMusicInfo) {
      preloadLog.info('No next song to preload')
      return
    }
    
    const musicInfo = nextPlayMusicInfo.musicInfo
    if ('progress' in musicInfo) {
      preloadLog.info('Skipping download item, not preloading')
      return
    }
    
    preloadLog.info(`Target: "${musicInfo.name}" - "${musicInfo.singer}" (source: ${musicInfo.source}, id: ${musicInfo.id})`)
    
    let success = false
    let currentInfo = musicInfo
    let tryCount = 0
    const maxTries = 5
    
    while (!success && tryCount < maxTries) {
      try {
        preloadLog.info(`Attempt ${tryCount + 1}/${maxTries} for "${currentInfo.name}" from "${currentInfo.source}"`)
        
        const url = await getMusicUrl({
          musicInfo: currentInfo,
          isRefresh: false,
          allowToggleSource: true,
          onToggleSource: (mInfo) => {
            if (mInfo) {
              preloadLog.info(`Source toggled to "${mInfo.source}" for "${mInfo.name}"`)
              currentInfo = mInfo
            }
          },
        })
        
        success = true
        preloadLog.info(`Success! URL cached for "${currentInfo.name}" (length: ${url?.length || 0})`)
      } catch (err: any) {
        preloadLog.error(`Failed attempt ${tryCount + 1} for "${currentInfo.name}": ${err?.message || err}`)
        
        if (tryCount < maxTries - 1) {
          const nextInfo = await getNextPlayMusicInfo()
          if (nextInfo && 'progress' in nextInfo.musicInfo === false) {
            preloadLog.info(`Fallback to next song: "${nextInfo.musicInfo.name}"`)
            currentInfo = nextInfo.musicInfo
          } else {
            preloadLog.info('No more songs available for fallback')
            break
          }
        }
      }
      
      tryCount++
    }
    
    if (!success) {
      preloadLog.warn(`All ${tryCount} attempts failed, no URL cached`)
    }
  } catch (err: any) {
    preloadLog.error(`Unexpected error: ${err?.message || err}`)
  } finally {
    isPreloading = false
    preloadLog.info('========== Preload End ==========')
  }
}

export const startPreload = () => {
  if (!settingState.setting['player.isEnableAudioPreload']) return
  preloadLog.init()
  void preloadNextMusic()
}

export const stopPreload = () => {
  isPreloading = false
}
