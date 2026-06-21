import TrackPlayer, { State } from 'react-native-track-player'
import { updateWidget } from '@/utils/nativeModules/musicWidget'
import BackgroundTimer from 'react-native-background-timer'
import { defaultUrl } from '@/config'
// import { action as playerAction } from '@/store/modules/player'
import settingState from '@/store/setting/state'
import { playerLog } from '@/utils/playerLog'


const list: LX.Player.Track[] = []

const defaultUserAgent = 'Mozilla/5.0 (Linux; Android 10; Pixel 3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.79 Mobile Safari/537.36'
const wyStreamHeaders = {
  Referer: 'https://music.163.com/',
  Origin: 'https://music.163.com',
}
const httpRxp = /^(https?:\/\/.+|\/.+)/
const wyMediaUrlRxp = /^https?:\/\/(?:[^/]+\.)?music\.126\.net\//

export const state = {
  isPlaying: false,
  prevDuration: -1,
}

const formatMusicInfo = (musicInfo: LX.Player.PlayMusic) => {
  return 'progress' in musicInfo ? {
    id: musicInfo.id,
    pic: musicInfo.metadata.musicInfo.meta.picUrl,
    name: musicInfo.metadata.musicInfo.name,
    singer: musicInfo.metadata.musicInfo.singer,
    album: musicInfo.metadata.musicInfo.meta.albumName,
  } : {
    id: musicInfo.id,
    pic: musicInfo.meta.picUrl,
    name: musicInfo.name,
    singer: musicInfo.singer,
    album: musicInfo.meta.albumName,
  }
}

const getTrackSource = (musicInfo: LX.Player.PlayMusic) => {
  return 'progress' in musicInfo ? musicInfo.metadata.musicInfo.source : musicInfo.source
}

const biliMediaUrlRxp = /^https?:\/\/(?:[^/]+\.)?bilivideo\.com\//

const getTrackHeaders = (musicInfo: LX.Player.PlayMusic, url?: string) => {
  playerLog.info('getTrackHeaders called, url:', url?.substring(0, 100))
  if (!url || !/^https?:\/\//.test(url) || wyMediaUrlRxp.test(url)) return undefined
  const source = getTrackSource(musicInfo)
  playerLog.info('getTrackHeaders source:', source)
  if (source === 'wy') return wyStreamHeaders
  if (source === 'bilibili') {
    const id = 'progress' in musicInfo ? musicInfo.metadata.musicInfo.id : musicInfo.id
    playerLog.info('getTrackHeaders musicInfo.id:', id)
    const bvidMatch = id?.match(/BV[a-zA-Z0-9]+/)
    const bvid = bvidMatch ? bvidMatch[0] : ''
    playerLog.info('getTrackHeaders extracted bvid:', bvid)
    const headers = {
      Referer: `https://www.bilibili.com/video/${bvid}`,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.90 Safari/537.36 Edg/89.0.774.63',
    }
    playerLog.info('getTrackHeaders returning headers:', headers)
    return headers
  }
  return undefined
}

const getTrackUserAgent = (musicInfo: LX.Player.PlayMusic, url?: string) => {
  if (!url || !/^https?:\/\//.test(url)) return undefined
  if (getTrackSource(musicInfo) === 'wy' && wyMediaUrlRxp.test(url)) return ''
  return defaultUserAgent
}

const buildTrackExtra = (musicInfo: LX.Player.PlayMusic, url?: string) => {
  const headers = getTrackHeaders(musicInfo, url)
  const source = getTrackSource(musicInfo)
  const result: any = {}
  
  if (source === 'bilibili') {
    // 对于 bilibili，我们同时设置 headers 和 userAgent
    if (headers) {
      result.headers = headers
    }
    result.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.90 Safari/537.36 Edg/89.0.774.63'
  } else {
    if (headers) {
      result.headers = headers
    } else {
      const userAgent = getTrackUserAgent(musicInfo, url)
      if (userAgent != null) {
        result.userAgent = userAgent
      }
    }
  }
  
  return result
}

const buildTracks = (musicInfo: LX.Player.PlayMusic, url?: LX.Player.Track['url'], duration?: LX.Player.Track['duration']): LX.Player.Track[] => {
  playerLog.info('buildTracks called, url:', url?.substring(0, 100))
  const mInfo = formatMusicInfo(musicInfo)
  playerLog.info('formatMusicInfo result:', JSON.stringify(mInfo).substring(0, 200))
  const track = [] as LX.Player.Track[]
  const album = mInfo.album || undefined
  const artwork = mInfo.pic && httpRxp.test(mInfo.pic) ? mInfo.pic : undefined
  const extra = typeof url === 'string' ? buildTrackExtra(musicInfo, url) : {}
  playerLog.info('buildTracks extra:', JSON.stringify(extra))
  if (url) {
    const trackItem = {
      id: `${mInfo.id}__//${Math.random()}__//${url}`,
      url,
      title: mInfo.name || 'Unknow',
      artist: mInfo.singer || 'Unknow',
      album,
      artwork,
      ...extra,
      musicId: mInfo.id,
      // original: { ...musicInfo },
      duration,
    }
    playerLog.info('trackItem created with headers:', !!trackItem.headers)
    track.push(trackItem)
  }
  track.push({
    id: `${mInfo.id}__//${Math.random()}__//default`,
    url: defaultUrl,
    title: mInfo.name || 'Unknow',
    artist: mInfo.singer || 'Unknow',
    album,
    artwork,
    musicId: mInfo.id,
    // original: { ...musicInfo },
    duration: 0,
  })
  return track
  // console.log('buildTrack', musicInfo.name, url)
}

// const buildTrack = (musicInfo: LX.Player.PlayMusic, url: LX.Player.Track['url'], duration?: LX.Player.Track['duration']): LX.Player.Track => {
//   const mInfo = formatMusicInfo(musicInfo)
//   const isShowNotificationImage = settingState.setting['player.isShowNotificationImage']
//   const album = mInfo.album || undefined
//   const artwork = isShowNotificationImage && mInfo.pic && httpRxp.test(mInfo.pic) ? mInfo.pic : undefined
//   return url
//     ? {
//         id: `${mInfo.id}__//${Math.random()}__//${url}`,
//         url,
//         title: mInfo.name || 'Unknow',
//         artist: mInfo.singer || 'Unknow',
//         album,
//         artwork,
//         userAgent: defaultUserAgent,
//         musicId: `${mInfo.id}`,
//         original: { ...musicInfo },
//         duration,
//       }
//     : {
//         id: `${mInfo.id}__//${Math.random()}__//default`,
//         url: defaultUrl,
//         title: mInfo.name || 'Unknow',
//         artist: mInfo.singer || 'Unknow',
//         album,
//         artwork,
//         musicId: `${mInfo.id}`,
//         original: { ...musicInfo },
//         duration: 0,
//       }
// }

export const isTempTrack = (trackId: string) => /\/\/default$/.test(trackId)


export const getCurrentTrackId = async () => {
  const currentTrackIndex = await TrackPlayer.getCurrentTrack()
  return list[currentTrackIndex]?.id
}
export const getCurrentTrack = async () => {
  const currentTrackIndex = await TrackPlayer.getCurrentTrack()
  return list[currentTrackIndex]
}

export const updateMetaData = async (musicInfo: LX.Player.MusicInfo, isPlay: boolean, lyric?: string, force = false) => {
  if (!force && isPlay == state.isPlaying) {
    const duration = await TrackPlayer.getDuration()
    if (state.prevDuration != duration) {
      state.prevDuration = duration
      const trackInfo = await getCurrentTrack()
      if (trackInfo && musicInfo) {
        delayUpdateMusicInfo(musicInfo, lyric)
      }
    }
  } else {
    const [duration, trackInfo] = await Promise.all([TrackPlayer.getDuration(), getCurrentTrack()])
    state.prevDuration = duration
    if (trackInfo && musicInfo) {
      delayUpdateMusicInfo(musicInfo, lyric)
    }
  }
}

export const initTrackInfo = async (musicInfo: LX.Player.PlayMusic, mInfo: LX.Player.MusicInfo) => {
  const tracks = buildTracks(musicInfo)
  playerLog.info('Adding tracks to player (initTrackInfo):', JSON.stringify(tracks[0], null, 2))
  await TrackPlayer.add(tracks).then(() => list.push(...tracks))
  const queue = await TrackPlayer.getQueue() as LX.Player.Track[]
  playerLog.info('Queue after add:', queue.length)
  await TrackPlayer.skip(queue.findIndex(t => t.id == tracks[0].id))
  delayUpdateMusicInfo(mInfo)
}


const handlePlayMusic = async (musicInfo: LX.Player.PlayMusic, url: string, time: number) => {
  // console.log(tracks, time)
  const tracks = buildTracks(musicInfo, url)
  const track = tracks[0]
  playerLog.info('Adding tracks to player (handlePlayMusic):', JSON.stringify(track, null, 2))
  // await updateMusicInfo(track)
  const currentTrackIndex = await TrackPlayer.getCurrentTrack()
  await TrackPlayer.add(tracks).then(() => list.push(...tracks))
  const queue = await TrackPlayer.getQueue() as LX.Player.Track[]
  playerLog.info('Queue after add:', queue.length)
  await TrackPlayer.skip(queue.findIndex(t => t.id == track.id))

  if (currentTrackIndex == null) {
    if (!isTempTrack(track.id as string)) {
      if (time) await TrackPlayer.seekTo(time)
      if (global.lx.restorePlayInfo) {
        await TrackPlayer.pause()
        // let startupAutoPlay = settingState.setting['player.startupAutoPlay']
        global.lx.restorePlayInfo = null

        // TODO startupAutoPlay
        // if (startupAutoPlay) store.dispatch(playerAction.playMusic())
      } else {
        await TrackPlayer.play()
      }
    }
  } else {
    await TrackPlayer.pause()
    if (!isTempTrack(track.id as string)) {
      await TrackPlayer.seekTo(time)
      await TrackPlayer.play()
    }
  }

  if (queue.length > 2) {
    void TrackPlayer.remove(Array(queue.length - 2).fill(null).map((_, i) => i)).then(() => list.splice(0, list.length - 2))
  }
}
let playPromise = Promise.resolve()
let actionId = Math.random()
export const playMusic = (musicInfo: LX.Player.PlayMusic, url: string, time: number) => {
  const id = actionId = Math.random()
  void playPromise.finally(() => {
    if (id != actionId) return
    playPromise = handlePlayMusic(musicInfo, url, time)
  })
}

// let musicId = null
// let duration = 0
let prevArtwork: string | undefined
const updateMetaInfo = async (mInfo: LX.Player.MusicInfo, lyric?: string) => {
  console.log('updateMetaInfo', lyric)
  state.isPlaying = await TrackPlayer.getState() == State.Playing
  let artwork = mInfo.pic ?? prevArtwork
  if (mInfo.pic) prevArtwork = mInfo.pic
  let mainTitle: string
  let artistText: string
  if (!state.isPlaying || lyric == null) {
    mainTitle = mInfo.name ?? 'Unknow'
    artistText = mInfo.singer ?? 'Unknow'
  } else {
    mainTitle = lyric
    artistText = `${mInfo.name}${mInfo.singer ? ` - ${mInfo.singer}` : ''}`
  }
  await TrackPlayer.updateNowPlayingMetadata({
    title: mainTitle,
    artist: artistText,
    album: undefined, // Do not set subText to avoid duplicate song name in status bar
    artwork,
    duration: state.prevDuration || 0,
  }, state.isPlaying)

  const realSongName = mInfo.name ?? 'Unknow'
  const realSinger = mInfo.singer ?? ''
  const realAlbum = mInfo.album ?? ''
  void TrackPlayer.updateNowPlayingTitles(
    (state.prevDuration || 0) * 1000,
    realSongName,
    realSinger,
    realAlbum,
  )

  // Update home screen widget
  const widgetTitle = mInfo.name ?? 'LX-X Music'
  const widgetArtist = mInfo.singer ? `${mInfo.singer}${mInfo.album ? ` · ${mInfo.album}` : ''}` : '未在播放'
  void updateWidget(widgetTitle, widgetArtist, state.isPlaying, artwork).catch(() => { })
}


// 解决快速切歌导致的通知栏歌曲信息与当前播放歌曲对不上的问题
const debounceUpdateMetaInfoTools = {
  updateMetaPromise: Promise.resolve(),
  musicInfo: null as LX.Player.MusicInfo | null,
  debounce(fn: (musicInfo: LX.Player.MusicInfo, lyric?: string) => void | Promise<void>) {
    // let delayTimer = null
    let isDelayRun = false
    let timer: number | null = null
    let _musicInfo: LX.Player.MusicInfo | null = null
    let _lyric: string | undefined
    return (musicInfo: LX.Player.MusicInfo, lyric?: string) => {
      // console.log('debounceUpdateMetaInfoTools', musicInfo)
      if (timer) {
        BackgroundTimer.clearTimeout(timer)
        timer = null
      }
      // if (delayTimer) {
      //   BackgroundTimer.clearTimeout(delayTimer)
      //   delayTimer = null
      // }
      if (isDelayRun) {
        _musicInfo = musicInfo
        _lyric = lyric
        timer = BackgroundTimer.setTimeout(() => {
          timer = null
          let musicInfo = _musicInfo
          let lyric = _lyric
          _musicInfo = null
          _lyric = undefined
          if (!musicInfo) return
          // isDelayRun = false
          void fn(musicInfo, lyric)
        }, 500)
      } else {
        isDelayRun = true
        void fn(musicInfo, lyric)
        BackgroundTimer.setTimeout(() => {
          // delayTimer = null
          isDelayRun = false
        }, 500)
      }
    }
  },
  init() {
    return this.debounce(async (musicInfo: LX.Player.MusicInfo, lyric?: string) => {
      this.musicInfo = musicInfo
      return this.updateMetaPromise.then(() => {
        // console.log('run')
        if (this.musicInfo?.id === musicInfo.id) {
          this.updateMetaPromise = updateMetaInfo(musicInfo, lyric)
        }
      })
    })
  },
}

export const delayUpdateMusicInfo = debounceUpdateMetaInfoTools.init()

// export const delayUpdateMusicInfo = ((fn, delay = 800) => {
//   let delayTimer = null
//   let isDelayRun = false
//   let timer = null
//   let _track = null
//   return track => {
//     _track = track
//     if (timer) {
//       BackgroundTimer.clearTimeout(timer)
//       timer = null
//     }
//     if (isDelayRun) {
//       if (delayTimer) {
//         BackgroundTimer.clearTimeout(delayTimer)
//         delayTimer = null
//       }
//       timer = BackgroundTimer.setTimeout(() => {
//         timer = null
//         let track = _track
//         _track = null
//         isDelayRun = false
//         fn(track)
//       }, delay)
//     } else {
//       isDelayRun = true
//       fn(track)
//       delayTimer = BackgroundTimer.setTimeout(() => {
//         delayTimer = null
//         isDelayRun = false
//       }, 500)
//     }
//   }
// })(track => {
//   console.log('+++++delayUpdateMusicPic+++++', track.artwork)
//   updateMetaInfo(track)
// })
