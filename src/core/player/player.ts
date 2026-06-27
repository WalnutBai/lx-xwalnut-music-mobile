import {
  isInitialized,
  initial as playerInitial,
  isEmpty,
  setPause,
  setPlay,
  setResource,
  setStop, initTrackInfo,
} from '@/plugins/player'
import { setStatusText } from '@/core/player/playStatus'
import playerState from '@/store/player/state'
import settingState from '@/store/setting/state'
import { getList, setPlayMusicInfo, setMusicInfo, setPlayListId } from '@/core/player/playInfo'
import { clearPlayedList, addPlayedList, removePlayedList } from '@/core/player/playedList'
import { clearTempPlayeList, removeTempPlayList } from '@/core/player/tempPlayList'
import { getMusicUrl, getPicPath, getLyricInfo } from '@/core/music'
import { requestMsg } from '@/utils/message'
import { getRandom } from '@/utils/common'
import { filterList } from './utils'
import { startPreload } from './preload'
import { preloadLog } from '@/utils/preloadLog'
import BackgroundTimer from 'react-native-background-timer'
import {
  checkIgnoringBatteryOptimization,
  checkNotificationPermission,
  debounceBackgroundTimer,
} from '@/utils/tools'
import { LIST_IDS } from '@/config/constant'
import { addListMusics, removeListMusics } from '@/core/list'
import { addDislikeInfo } from '@/core/dislikeList'
import { webDAVLog } from '@/core/webdavMusic/logger'

// import { checkMusicFileAvailable } from '@renderer/utils/music'

const createDelayNextTimeout = (delay: number) => {
  let timeout: number | null
  const clearDelayNextTimeout = () => {
    // console.log(this.timeout)
    if (timeout) {
      BackgroundTimer.clearTimeout(timeout)
      timeout = null
    }
  }

  const addDelayNextTimeout = () => {
    clearDelayNextTimeout()
    timeout = BackgroundTimer.setTimeout(() => {
      timeout = null
      if (global.lx.isPlayedStop) return
      console.log('delay next timeout timeout', delay)
      void playNext(true)
    }, delay)
  }

  return {
    clearDelayNextTimeout,
    addDelayNextTimeout,
  }
}
const { addDelayNextTimeout, clearDelayNextTimeout } = createDelayNextTimeout(5000)
const { addDelayNextTimeout: addLoadTimeout, clearDelayNextTimeout: clearLoadTimeout } =
  createDelayNextTimeout(30000)

const createGettingUrlId = (musicInfo: LX.Music.MusicInfo | LX.Download.ListItem) => {
  const tInfo =
    'progress' in musicInfo
      ? musicInfo.metadata.musicInfo.meta.toggleMusicInfo
      : musicInfo.meta.toggleMusicInfo
  return `${musicInfo.id}_${tInfo?.id ?? ''}`
}
/**
 * Check if music info has changed
 */
const diffCurrentMusicInfo = (curMusicInfo: LX.Music.MusicInfo | LX.Download.ListItem): boolean => {
  // return curMusicInfo !== playerState.playMusicInfo.musicInfo || playerState.isPlay
  return (
    createGettingUrlId(curMusicInfo) != global.lx.gettingUrlId ||
    curMusicInfo.id != playerState.playMusicInfo.musicInfo?.id ||
    playerState.isPlay
  )
}

let cancelDelayRetry: (() => void) | null = null
const delayRetry = async (
  musicInfo: LX.Music.MusicInfo | LX.Download.ListItem,
  isRefresh = false
): Promise<string | null> => {
  // if (cancelDelayRetry) cancelDelayRetry()
  return new Promise<string | null>((resolve, reject) => {
    const time = getRandom(2, 6)
    setStatusText(global.i18n.t('player__getting_url_delay_retry', { time }))
    const tiemout = setTimeout(() => {
      getMusicPlayUrl(musicInfo, isRefresh, true)
        .then((result) => {
          cancelDelayRetry = null
          resolve(result)
        })
        .catch(async (err: any) => {
          cancelDelayRetry = null
          reject(err)
        })
    }, time * 1000)
    cancelDelayRetry = () => {
      clearTimeout(tiemout)
      cancelDelayRetry = null
      resolve(null)
    }
  })
}
const getMusicPlayUrl = async (
  musicInfo: LX.Music.MusicInfo | LX.Download.ListItem,
  isRefresh = false,
  isRetryed = false
): Promise<string | null> => {
  // this.musicInfo.url = await getMusicPlayUrl(targetSong, type)
  setStatusText(global.i18n.t('player__getting_url'))
  addLoadTimeout()

  const currentMusicInfo = 'progress' in musicInfo ? musicInfo.metadata.musicInfo : musicInfo
  const isWebDAVMusic = 'webdav' in currentMusicInfo.meta && (currentMusicInfo.meta as any).webdav === true
  
  if (isWebDAVMusic) {
    const webdavPath = settingState.setting['webdav.downloadPath']
    let configuredDownloadDir = ''
    if (webdavPath && typeof webdavPath === 'string' && webdavPath.trim()) {
      configuredDownloadDir = webdavPath.trim()
    } else {
      const { getWebDAVPrivateDirectory } = await import('@/utils/fs')
      configuredDownloadDir = getWebDAVPrivateDirectory()
    }
    const fileName = currentMusicInfo.meta.fileName
    
    const existingFilePath = currentMusicInfo.meta.filePath
    let filePathToCheck = existingFilePath || `${configuredDownloadDir}/${fileName}`
    
    const { existsFile } = await import('@/utils/fs')
    let fileExists = await existsFile(filePathToCheck)
    
    if (!fileExists && existingFilePath) {
      const alternativePath = `${configuredDownloadDir}/${fileName}`
      filePathToCheck = alternativePath
      fileExists = await existsFile(filePathToCheck)
    }
    
    if (!fileExists) {
      setStatusText('正在下载歌曲...')
      webDAVLog?.info('getMusicPlayUrl: WebDAV file not found, starting download', { musicId: currentMusicInfo.id, expectedPath: filePathToCheck })
    }
  }

  // const type = getPlayType(settingState.setting['player.isPlayHighQuality'], musicInfo)
  let toggleMusicInfo = currentMusicInfo.meta.toggleMusicInfo

  return (
    toggleMusicInfo
      ? getMusicUrl({
          musicInfo: toggleMusicInfo,
          isRefresh,
          allowToggleSource: false,
        })
      : Promise.reject(new Error('not found'))
  )
    .catch(async () => {
      return getMusicUrl({
        musicInfo,
        isRefresh,
        onToggleSource(mInfo) {
          if (diffCurrentMusicInfo(musicInfo)) return
          setStatusText(global.i18n.t('toggle_source_try'))
        },
      })
    })
    .then((url) => {
      if (global.lx.isPlayedStop || diffCurrentMusicInfo(musicInfo)) return null

      return url
    })
    .catch(async (err) => {
      // console.log('err', err.message)
      if (
        global.lx.isPlayedStop ||
        diffCurrentMusicInfo(musicInfo) ||
        err.message == requestMsg.cancelRequest
      )
        return null

      if (err.message == requestMsg.tooManyRequests) return delayRetry(musicInfo, isRefresh)

      if (!isRetryed) return getMusicPlayUrl(musicInfo, isRefresh, true)

      throw err
    })
}

export const setMusicUrl = (
  musicInfo: LX.Music.MusicInfo | LX.Download.ListItem,
  isRefresh?: boolean
) => {
  // addLoadTimeout()
  if (!diffCurrentMusicInfo(musicInfo)) return
  if (cancelDelayRetry) cancelDelayRetry()
  global.lx.gettingUrlId = createGettingUrlId(musicInfo)
  void getMusicPlayUrl(musicInfo, isRefresh)
    .then((url) => {
      if (!url) return
      const currentMusicInfo = playerState.playMusicInfo.musicInfo
      if (musicInfo.id === currentMusicInfo?.id) {
        global.lx.gettingUrlId = ''
        clearLoadTimeout()
        setStatusText('')
        
        const isWebDAVMusic = 'webdav' in currentMusicInfo.meta && (currentMusicInfo.meta as any).webdav === true
        if (isWebDAVMusic) {
          void setStop().then(() => {
            setResource(currentMusicInfo, url, playerState.progress.nowPlayTime)
          })
        } else {
          setResource(currentMusicInfo, url, playerState.progress.nowPlayTime)
        }
        
        preloadLog.info(`Current song URL ready, triggering preload`)
        startPreload()
      }
    })
    .catch((err: any) => {
      console.log(err)
      setStatusText(err.message as string)
      global.app_event.error()
      void playNext(true)
    })
    .finally(() => {
      if (musicInfo.id === playerState.playMusicInfo.musicInfo?.id && global.lx.gettingUrlId) {
        global.lx.gettingUrlId = ''
        clearLoadTimeout()
      }
    })
}

const handleRestorePlay = async (restorePlayInfo: LX.Player.SavedPlayInfo) => {
  const musicInfo = playerState.playMusicInfo.musicInfo
  if (!musicInfo) return

  setTimeout(() => {
    global.app_event.setProgress(
      settingState.setting['player.isSavePlayTime'] ? restorePlayInfo.time : 0,
      restorePlayInfo.maxTime
    )
  })

  const playMusicInfo = playerState.playMusicInfo

  void initTrackInfo(musicInfo, playerState.musicInfo)

  void getPicPath({ musicInfo, listId: playMusicInfo.listId }).then((url: string) => {
    if (
      musicInfo.id != playMusicInfo.musicInfo?.id ||
      playerState.musicInfo.pic == url ||
      playerState.loadErrorPicUrl == url
    )
      return
    setMusicInfo({ pic: url })
    global.app_event.picUpdated()
  })

  void getLyricInfo({ musicInfo })
    .then((lyricInfo) => {
      if (musicInfo.id != playMusicInfo.musicInfo?.id) return
      setMusicInfo({
        lrc: lyricInfo.lyric,
        tlrc: lyricInfo.tlyric,
        lxlrc: lyricInfo.lxlyric,
        rlrc: lyricInfo.rlyric,
        rawlrc: lyricInfo.rawlrcInfo.lyric,
      })
      global.app_event.lyricUpdated()
    })
    .catch((err) => {
      console.log(err)
      if (musicInfo.id != playMusicInfo.musicInfo?.id) return
      setStatusText(global.i18n.t('lyric__load_error'))
    })

  if (settingState.setting['player.togglePlayMethod'] == 'random' && !playMusicInfo.isTempPlay)
    addPlayedList(playMusicInfo as LX.Player.PlayMusicInfo)
}

const debouncePlay = debounceBackgroundTimer((musicInfo: LX.Player.PlayMusic) => {
  setMusicUrl(musicInfo)

  void getPicPath({ musicInfo, listId: playerState.playMusicInfo.listId }).then((url: string) => {
    if (
      musicInfo.id != playerState.playMusicInfo.musicInfo?.id ||
      playerState.musicInfo.pic == url ||
      playerState.loadErrorPicUrl == url
    )
      return
    setMusicInfo({ pic: url })
    global.app_event.picUpdated()
  })

  void getLyricInfo({ musicInfo })
    .then((lyricInfo) => {
      if (musicInfo.id != playerState.playMusicInfo.musicInfo?.id) return
      setMusicInfo({
        lrc: lyricInfo.lyric,
        tlrc: lyricInfo.tlyric,
        lxlrc: lyricInfo.lxlyric,
        rlrc: lyricInfo.rlyric,
        rawlrc: lyricInfo.rawlrcInfo.lyric,
      })
      global.app_event.lyricUpdated()
    })
    .catch((err) => {
      console.log(err)
      if (musicInfo.id != playerState.playMusicInfo.musicInfo?.id) return
      setStatusText(global.i18n.t('lyric__load_error'))
    })
}, 200)

export const handlePlay = async () => {
  if (!isInitialized()) {
    await checkNotificationPermission()
    void checkIgnoringBatteryOptimization()
    await playerInitial({
      volume: settingState.setting['player.volume'],
      playRate: settingState.setting['player.playbackRate'],
      cacheSize: settingState.setting['player.cacheSize']
        ? parseInt(settingState.setting['player.cacheSize'])
        : 0,
      isHandleAudioFocus: settingState.setting['player.isHandleAudioFocus'],
      isEnableAudioOffload: settingState.setting['player.isEnableAudioOffload'],
    })
  }

  global.lx.playerError = false
  global.lx.isPlayedStop &&= false
  resetRandomNextMusicInfo()

  if (global.lx.restorePlayInfo) {
    void handleRestorePlay(global.lx.restorePlayInfo)
    global.lx.restorePlayInfo = null
    return
  }

  const playMusicInfo = playerState.playMusicInfo
  const musicInfo = playMusicInfo.musicInfo

  if (!musicInfo) return

  await setStop()
  global.app_event.pause()

  clearDelayNextTimeout()
  clearLoadTimeout()

  if (settingState.setting['player.togglePlayMethod'] == 'random' && !playMusicInfo.isTempPlay)
    addPlayedList(playMusicInfo as LX.Player.PlayMusicInfo)

  debouncePlay(musicInfo)
}

/**
 * Play song in list
 * @param listId list id
 * @param index song position to play
 */
export const playList = async (listId: string, index: number) => {
  const prevListId = playerState.playInfo.playerListId
  setPlayListId(listId)
  setPlayMusicInfo(listId, getList(listId)[index])
  if (settingState.setting['player.isAutoCleanPlayedList'] || prevListId != listId)
    clearPlayedList()
  clearTempPlayeList()
  await handlePlay()
}

const handleToggleStop = async () => {
  await stop()
  setTimeout(() => {
    setPlayMusicInfo(null, null)
  })
}

const randomNextMusicInfo = {
  info: null as LX.Player.PlayMusicInfo | null,
  // index: -1,
}
export const resetRandomNextMusicInfo = () => {
  if (randomNextMusicInfo.info) {
    randomNextMusicInfo.info = null
    // randomNextMusicInfo.index = -1
  }
}

export const getNextPlayMusicInfo = async (): Promise<LX.Player.PlayMusicInfo | null> => {
  if (playerState.tempPlayList.length) {
  const playMusicInfo = playerState.tempPlayList[0]
  return playMusicInfo
  }

  if (playerState.playMusicInfo.musicInfo == null) return null

  if (randomNextMusicInfo.info) return randomNextMusicInfo.info

  const playMusicInfo = playerState.playMusicInfo
  const playInfo = playerState.playInfo
  // console.log(playInfo.playerListId)
  const currentListId = playInfo.playerListId
  if (!currentListId) return null
  const currentList = getList(currentListId)

  const playedList = playerState.playedList
  if (playedList.length) {
    let currentId: string
    if (playMusicInfo.isTempPlay) {
      const musicInfo = currentList[playInfo.playerPlayIndex]
      if (musicInfo) currentId = musicInfo.id
    } else {
      currentId = playMusicInfo.musicInfo!.id
    }
    let index
    for (
      index = playedList.findIndex((m) => m.musicInfo.id === currentId) + 1;
      index < playedList.length;
      index++
    ) {
      const playMusicInfo = playedList[index]
      const currentId = playMusicInfo.musicInfo.id
      if (playMusicInfo.listId == currentListId && !currentList.some((m) => m.id === currentId)) {
        removePlayedList(index)
        continue
      }
      break
    }

    if (index < playedList.length) return playedList[index]
  }
  let { filteredList, playerIndex } = await filterList({
    listId: currentListId,
    list: currentList,
    playedList,
    playerMusicInfo: currentList[playInfo.playerPlayIndex],
    isNext: true,
  })

  if (!filteredList.length) return null
  // let currentIndex: number = filteredList.indexOf(currentList[playInfo.playerPlayIndex])
  if (playerIndex == -1 && filteredList.length) playerIndex = 0
  let nextIndex = playerIndex

  let togglePlayMethod = settingState.setting['player.togglePlayMethod']
  switch (togglePlayMethod) {
    case 'listLoop':
    case 'heartbeat':
      nextIndex = playerIndex === filteredList.length - 1 ? 0 : playerIndex + 1
      break
    case 'random':
      nextIndex = getRandom(0, filteredList.length)
      break
    case 'list':
      nextIndex = playerIndex === filteredList.length - 1 ? -1 : playerIndex + 1
      break
    case 'singleLoop':
      break
    default:
      return null
  }
  if (nextIndex < 0) return null

  const nextPlayMusicInfo = {
    musicInfo: filteredList[nextIndex],
    listId: currentListId,
    isTempPlay: false,
  }

  if (togglePlayMethod == 'random') {
    randomNextMusicInfo.info = nextPlayMusicInfo
    // randomNextMusicInfo.index = nextIndex
  }
  return nextPlayMusicInfo
}

const handlePlayNext = async (playMusicInfo: LX.Player.PlayMusicInfo) => {
  setPlayMusicInfo(playMusicInfo.listId, playMusicInfo.musicInfo, playMusicInfo.isTempPlay)
  await handlePlay()
}
/**
 * Play next song
 * @param isAutoToggle whether auto toggle
 * @returns
 */
export const playNext = async (isAutoToggle = false): Promise<void> => {
  if (playerState.tempPlayList.length) {
    const playMusicInfo = playerState.tempPlayList[0]
    return playMusicInfo
  }

  if (playerState.playMusicInfo.musicInfo == null) return null

  if (randomNextMusicInfo.info) {
    const randomInfo = randomNextMusicInfo.info
    randomNextMusicInfo.info = null
    await handlePlayNext(randomInfo)
    return
  }

  const playMusicInfo = playerState.playMusicInfo
  const playInfo = playerState.playInfo
  const currentListId = playInfo.playerListId
  if (!currentListId) return handleToggleStop()
  const currentList = getList(currentListId)

  const playedList = playerState.playedList

  if (playedList.length) {
    let currentId: string
    if (playMusicInfo.isTempPlay) {
      const musicInfo = currentList[playInfo.playerPlayIndex]
      if (musicInfo) currentId = musicInfo.id
    } else {
      currentId = playMusicInfo.musicInfo.id
    }
    let index
    for (
      index = playedList.findIndex((m) => m.musicInfo.id === currentId) + 1;
      index < playedList.length;
      index++
    ) {
      const playMusicInfo = playedList[index]
      const currentId = playMusicInfo.musicInfo.id
      if (playMusicInfo.listId == currentListId && !currentList.some((m) => m.id === currentId)) {
        removePlayedList(index)
        continue
      }
      break
    }

    if (index < playedList.length) {
      await handlePlayNext(playedList[index])
      return
    }
  }
  if (randomNextMusicInfo.info) {
    await handlePlayNext(randomNextMusicInfo.info)
    return
  }
  let { filteredList, playerIndex } = await filterList({
    listId: currentListId,
    list: currentList,
    playedList,
    playerMusicInfo: currentList[playInfo.playerPlayIndex],
    isNext: true,
  })

  if (!filteredList.length) {
    if (currentList.length > 0) {
      const nextIndex = (playInfo.playerPlayIndex + 1) % currentList.length
      await handlePlayNext({
        musicInfo: currentList[nextIndex],
        listId: currentListId,
        isTempPlay: false,
      })
      return
    }
    return handleToggleStop()
  }
  if (playerIndex == -1 && filteredList.length) playerIndex = 0
  let nextIndex = playerIndex

  let togglePlayMethod = settingState.setting['player.togglePlayMethod']
  if (!isAutoToggle) {
    switch (togglePlayMethod) {
      case 'list':
      case 'singleLoop':
      case 'none':
      case 'heartbeat':
        togglePlayMethod = 'listLoop' as any
    }
  }
  switch (togglePlayMethod) {
    case 'listLoop':
    case 'heartbeat':
      nextIndex = playerIndex === filteredList.length - 1 ? 0 : playerIndex + 1
      break
    case 'random':
      nextIndex = getRandom(0, filteredList.length)
      break
    case 'list':
      nextIndex = playerIndex === filteredList.length - 1 ? -1 : playerIndex + 1
      break
    case 'singleLoop':
      break
    default:
      nextIndex = -1
      return
  }
  if (nextIndex < 0) return

  await handlePlayNext({
    musicInfo: filteredList[nextIndex],
    listId: currentListId,
    isTempPlay: false,
  })
}

/**
 * Play previous song
 */
export const playPrev = async (isAutoToggle = false): Promise<void> => {
  const playMusicInfo = playerState.playMusicInfo
  if (playMusicInfo.musicInfo == null) return handleToggleStop()
  const playInfo = playerState.playInfo

  const currentListId = playInfo.playerListId
  if (!currentListId) return handleToggleStop()
  const currentList = getList(currentListId)

  const playedList = playerState.playedList
  if (playedList.length) {
    let currentId: string
    if (playMusicInfo.isTempPlay) {
      const musicInfo = currentList[playInfo.playerPlayIndex]
      if (musicInfo) currentId = musicInfo.id
    } else {
      currentId = playMusicInfo.musicInfo.id
    }
    let index
    for (
      index = playedList.findIndex((m) => m.musicInfo.id === currentId) - 1;
      index > -1;
      index--
    ) {
      const playMusicInfo = playedList[index]
      const currentId = playMusicInfo.musicInfo.id
      if (playMusicInfo.listId == currentListId && !currentList.some((m) => m.id === currentId)) {
        removePlayedList(index)
        continue
      }
      break
    }

    if (index > -1) {
      await handlePlayNext(playedList[index])
      return
    }
  }

  let { filteredList, playerIndex } = await filterList({
    listId: currentListId,
    list: currentList,
    playedList,
    playerMusicInfo: currentList[playInfo.playerPlayIndex],
    isNext: false,
  })
  if (!filteredList.length) return handleToggleStop()

  // let currentIndex = filteredList.indexOf(currentList[playInfo.playerPlayIndex])
  if (playerIndex == -1 && filteredList.length) playerIndex = 0
  let nextIndex = playerIndex
  if (!playMusicInfo.isTempPlay) {
    let togglePlayMethod = settingState.setting['player.togglePlayMethod']
    if (!isAutoToggle) {
      switch (togglePlayMethod) {
        case 'list':
        case 'singleLoop':
        case 'none':
        case 'heartbeat':
          togglePlayMethod = 'listLoop' as any
      }
    }
    switch (togglePlayMethod) {
      case 'random':
        nextIndex = getRandom(0, filteredList.length)
        break
      case 'listLoop':
      case 'list':
      case 'heartbeat':
        nextIndex = playerIndex === 0 ? filteredList.length - 1 : playerIndex - 1
        break
      case 'singleLoop':
        break
      default:
        nextIndex = -1
        return
    }
    if (nextIndex < 0) return
  }

  await handlePlayNext({
    musicInfo: filteredList[nextIndex],
    listId: currentListId,
    isTempPlay: false,
  })
}

/**
 * Resume playback
 */
export const play = () => {
  if (playerState.playMusicInfo.musicInfo == null) return
  if (isEmpty()) {
    if (createGettingUrlId(playerState.playMusicInfo.musicInfo) != global.lx.gettingUrlId)
      setMusicUrl(playerState.playMusicInfo.musicInfo)
    return
  }
  void setPlay()
}

/**
 * Pause playback
 */
export const pause = async () => {
  await setPause()
}

/**
 * Stop playback
 */
export const stop = async () => {
  await setStop()
  setTimeout(() => {
    global.app_event.stop()
  })
}

/**
 * Toggle play/pause
 */
export const togglePlay = () => {
  global.lx.isPlayedStop &&= false
  if (playerState.isPlay) {
    void pause()
  } else {
    play()
  }
}

/**
 * Collect current playing song
 */
export const collectMusic = () => {
  if (!playerState.playMusicInfo.musicInfo) return
  void addListMusics(
    LIST_IDS.LOVE,
    [
      'progress' in playerState.playMusicInfo.musicInfo
        ? playerState.playMusicInfo.musicInfo.metadata.musicInfo
        : playerState.playMusicInfo.musicInfo,
    ],
    settingState.setting['list.addMusicLocationType']
  )
}

/**
 * Uncollect current playing song
 */
export const uncollectMusic = () => {
  if (!playerState.playMusicInfo.musicInfo) return
  void removeListMusics(LIST_IDS.LOVE, [
    'progress' in playerState.playMusicInfo.musicInfo
      ? playerState.playMusicInfo.musicInfo.metadata.musicInfo.id
      : playerState.playMusicInfo.musicInfo.id,
  ])
}

/**
 * Dislike current playing song
 */
export const dislikeMusic = async () => {
  if (!playerState.playMusicInfo.musicInfo) return
  const minfo =
    'progress' in playerState.playMusicInfo.musicInfo
      ? playerState.playMusicInfo.musicInfo.metadata.musicInfo
      : playerState.playMusicInfo.musicInfo
  await addDislikeInfo([{ name: minfo.name, singer: minfo.singer }])
  await playNext(true)
}
