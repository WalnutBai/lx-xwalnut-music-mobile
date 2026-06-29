import musicSdk, { findMusic } from '@/utils/musicSdk'
import {
  // getOtherSource as getOtherSourceFromStore,
  // saveOtherSource as saveOtherSourceFromStore,
  getMusicUrl as getStoreMusicUrl,
  getPlayerLyric,
  getLyric as getStoreLyric,
} from '@/utils/data'
import { langS2T, toNewMusicInfo, toOldMusicInfo } from '@/utils'
import { assertApiSupport } from '@/utils/tools'
import settingState from '@/store/setting/state'
import { requestMsg } from '@/utils/message'
import BackgroundTimer from 'react-native-background-timer'
import { apis } from '@/utils/musicSdk/api-source'
import wySdk from '@/utils/musicSdk/wy'
import { log } from '@/utils/log'
import { state as userApiState } from '@/store/userApi'

const isEnableUserApiLog = () => global.lx.isEnableUserApiLog

const userApiLog = {
  info: (...msgs: any[]) => {
    if (!global.lx.isEnableLog) return
    if (!isEnableUserApiLog()) return
    log.info(...msgs)
  },
  error: (...msgs: any[]) => {
    if (!global.lx.isEnableLog) return
    if (!isEnableUserApiLog()) return
    log.error(...msgs)
  },
}

const getOtherSourcePromises = new Map()
export const existTimeExp = /\[\d{1,2}:.*\d{1,4}\]/
const otherSourceCache = new Map<
  LX.Music.MusicInfo | LX.Download.ListItem,
  LX.Music.MusicInfoOnline[]
>()

const cleanFileName = (name: string): string => {
  if (!name) return name
  let cleaned = name
    .replace(/\s*\(cover\)\s*/gi, ' ')
    .replace(/\s*\(MP3_\d+K\)\s*/gi, ' ')
    .replace(/\s*\(\d+K\)\s*/gi, ' ')
    .replace(/\s*\(HQ\)\s*/gi, ' ')
    .replace(/\s*\(SQ\)\s*/gi, ' ')
    .replace(/\s*\(无损\)\s*/gi, ' ')
    .replace(/\s*\(高清\)\s*/gi, ' ')
    .replace(/\s*\(原版\)\s*/gi, ' ')
    .replace(/\s*\(纯人声\)\s*/gi, ' ')
    .replace(/\s*\(伴奏\)\s*/gi, ' ')
    .replace(/\s*\(instrumental\)\s*/gi, ' ')
    .replace(/\s*\(live\)\s*/gi, ' ')
    .replace(/\s*\(remix\)\s*/gi, ' ')
    .replace(/\s*\(edit\)\s*/gi, ' ')
    .replace(/\s*\(radio\)\s*/gi, ' ')
    .replace(/\s*-\s*Remastered\s*/gi, ' ')
    .replace(/\s*-\s*Remix\s*/gi, ' ')
    .replace(/\s*-\s*Live\s*/gi, ' ')
    .replace(/\s*-\s*Acoustic\s*/gi, ' ')
    .replace(/\s+\d{4}\s*/g, ' ')
    .replace(/\s*\[\d+\]\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned || name
}

export const getOtherSource = async (
  musicInfo: LX.Music.MusicInfo | LX.Download.ListItem,
  isRefresh = false
): Promise<LX.Music.MusicInfoOnline[]> => {
  const originalName = 'progress' in musicInfo ? musicInfo.metadata.musicInfo.name : musicInfo.name
  const originalSinger = 'progress' in musicInfo ? musicInfo.metadata.musicInfo.singer : musicInfo.singer
  
  const cleanedName = cleanFileName(originalName)
  const cleanedSinger = cleanFileName(originalSinger)
  
  userApiLog.info(`[在线匹配源] ========== 开始搜索 ==========`)
  userApiLog.info(`[在线匹配源] 原始歌曲名: "${originalName}"`)
  userApiLog.info(`[在线匹配源] 原始歌手名: "${originalSinger}"`)
  userApiLog.info(`[在线匹配源] 清理后歌曲名: "${cleanedName}"`)
  userApiLog.info(`[在线匹配源] 清理后歌手名: "${cleanedSinger}"`)
  
  // if (!isRefresh) {
  //   const cachedInfo = await getOtherSourceFromStore(musicInfo.id)
  //   if (cachedInfo.length) return cachedInfo
  // }
  if (otherSourceCache.has(musicInfo)) {
    userApiLog.info(`[在线匹配源] 命中缓存 - 直接返回缓存结果`)
    const cachedResult = otherSourceCache.get(musicInfo)!
    userApiLog.info(`[在线匹配源] 缓存结果数量: ${cachedResult.length}`)
    return cachedResult
  }
  let key: string
  let searchMusicInfo: {
    name: string
    singer: string
    source: string
    albumName: string
    interval: string
  }
  if ('progress' in musicInfo) {
    key = `local_${musicInfo.id}`
    searchMusicInfo = {
      name: cleanedName,
      singer: cleanedSinger,
      source: musicInfo.metadata.musicInfo.source,
      albumName: musicInfo.metadata.musicInfo.meta.albumName,
      interval: musicInfo.metadata.musicInfo.interval ?? '',
    }
  } else {
    key = musicInfo.id?.startsWith(`${musicInfo.source}_`)
      ? musicInfo.id
      : `${musicInfo.source}_${musicInfo.id}`
    searchMusicInfo = {
      name: cleanedName,
      singer: cleanedSinger,
      source: musicInfo.source,
      albumName: musicInfo.meta.albumName,
      interval: musicInfo.interval ?? '',
    }
  }
  userApiLog.info(`[在线匹配源] 搜索key: "${key}"`)
  userApiLog.info(`[在线匹配源] 搜索参数:`, JSON.stringify(searchMusicInfo, null, 2))
  
  if (getOtherSourcePromises.has(key)) {
    userApiLog.info(`[在线匹配源] 已有相同查询在进行中，等待结果`)
    return getOtherSourcePromises.get(key)
  }

  userApiLog.info(`[在线匹配源] 开始调用 findMusic 进行搜索`)

  const promise = new Promise<LX.Music.MusicInfoOnline[]>((resolve, reject) => {
    let timeout: null | number = BackgroundTimer.setTimeout(() => {
      timeout = null
      userApiLog.error(`[在线匹配源] 搜索超时 (12秒)`)
      userApiLog.error(`[在线匹配源] 超时详情 - 歌曲: ${originalName} - 歌手: ${originalSinger}`)
      reject(new Error('find music timeout'))
    }, 12_000)
    findMusic(searchMusicInfo)
      .then((otherSource) => {
        userApiLog.info(`[在线匹配源] findMusic 返回结果，原始数量: ${otherSource.length}`)
        
        if (otherSourceCache.size > 10) {
          userApiLog.info(`[在线匹配源] 缓存数量超过10，清空缓存`)
          otherSourceCache.clear()
        }
        
        const source = otherSource.map(toNewMusicInfo) as LX.Music.MusicInfoOnline[]
        otherSourceCache.set(musicInfo, source)
        
        userApiLog.info(`[在线匹配源] 搜索完成 ==========`)
        userApiLog.info(`[在线匹配源] 最终找到结果: ${source.length} 个`)
        
        if (source.length > 0) {
          userApiLog.info(`[在线匹配源] 搜索结果详情:`)
          source.forEach((item, index) => {
            userApiLog.info(`[在线匹配源]   ${index + 1}. ${item.source} - "${item.name}" - "${item.singer}"`)
          })
        }
        
        resolve(source)
      })
      .catch((err) => {
        userApiLog.error(`[在线匹配源] 搜索失败 ==========`)
        userApiLog.error(`[在线匹配源] 失败详情 - 歌曲: ${originalName} - 歌手: ${originalSinger}`)
        userApiLog.error(`[在线匹配源] 错误信息: ${err?.message || err}`)
        userApiLog.error(`[在线匹配源] 错误堆栈: ${err?.stack || '无'}`)
        reject(err)
      })
      .finally(() => {
        if (timeout) BackgroundTimer.clearTimeout(timeout)
      })
  })
    .then((otherSource) => {
      // if (otherSource.length) void saveOtherSourceFromStore(musicInfo.id, otherSource)
      return otherSource
    })
    .finally(() => {
      if (getOtherSourcePromises.has(key)) {
        getOtherSourcePromises.delete(key)
        userApiLog.info(`[在线匹配源] 移除查询promise, key: "${key}"`)
      }
    })
  getOtherSourcePromises.set(key, promise)
  return promise
}

export const buildLyricInfo = async (
  lyricInfo: MakeOptional<LX.Player.LyricInfo, 'rawlrcInfo'>
): Promise<LX.Player.LyricInfo> => {
  if (!settingState.setting['player.isS2t']) {
    // @ts-expect-error
    if (lyricInfo.rawlrcInfo) return lyricInfo
    return { ...lyricInfo, rawlrcInfo: { ...lyricInfo } }
  }

  if (settingState.setting['player.isS2t']) {
    const tasks = [
      lyricInfo.lyric ? langS2T(lyricInfo.lyric) : Promise.resolve(''),
      lyricInfo.tlyric ? langS2T(lyricInfo.tlyric) : Promise.resolve(''),
      lyricInfo.rlyric ? langS2T(lyricInfo.rlyric) : Promise.resolve(''),
      lyricInfo.lxlyric ? langS2T(lyricInfo.lxlyric) : Promise.resolve(''),
    ]
    if (lyricInfo.rawlrcInfo) {
      tasks.push(lyricInfo.lyric ? langS2T(lyricInfo.lyric) : Promise.resolve(''))
      tasks.push(lyricInfo.tlyric ? langS2T(lyricInfo.tlyric) : Promise.resolve(''))
      tasks.push(lyricInfo.rlyric ? langS2T(lyricInfo.rlyric) : Promise.resolve(''))
      tasks.push(lyricInfo.lxlyric ? langS2T(lyricInfo.lxlyric) : Promise.resolve(''))
    }
    return Promise.all(tasks).then(
      ([lyric, tlyric, rlyric, lxlyric, lyric_raw, tlyric_raw, rlyric_raw, lxlyric_raw]) => {
        const rawlrcInfo = lyric_raw
          ? {
              lyric: lyric_raw,
              tlyric: tlyric_raw,
              rlyric: rlyric_raw,
              lxlyric: lxlyric_raw,
            }
          : {
              lyric,
              tlyric,
              rlyric,
              lxlyric,
            }
        return {
          lyric,
          tlyric,
          rlyric,
          lxlyric,
          rawlrcInfo,
        }
      }
    )
  }

  // @ts-expect-error
  return lyricInfo.rawlrcInfo ? lyricInfo : { ...lyricInfo, rawlrcInfo: { ...lyricInfo } }
}

export const getCachedLyricInfo = async (
  musicInfo: LX.Music.MusicInfo
): Promise<LX.Player.LyricInfo | null> => {
  const playerLyricInfo = await getPlayerLyric(musicInfo)
  if (playerLyricInfo?.lyric && playerLyricInfo.rawlrcInfo?.lyric !== playerLyricInfo.lyric) {
  return playerLyricInfo
  }
  
  let lrcInfo = await getStoreLyric(musicInfo)
  // lrcInfo = {}
  if (existTimeExp.test(lrcInfo.lyric) && lrcInfo.tlyric != null) {
    // if (musicInfo.lrc.startsWith('\ufeff[id:$00000000]')) {
    //   let str = musicInfo.lrc.replace('\ufeff[id:$00000000]\n', '')
    //   commit('setLrc', { musicInfo, lyric: str, tlyric: musicInfo.tlrc, lxlyric: musicInfo.tlrc })
    // } else if (musicInfo.lrc.startsWith('[id:$00000000]')) {
    //   let str = musicInfo.lrc.replace('[id:$00000000]\n', '')
    //   commit('setLrc', { musicInfo, lyric: str, tlyric: musicInfo.tlrc, lxlyric: musicInfo.tlrc })
    // }

    // if (lrcInfo.lxlyric == null) {
    //   switch (musicInfo.source) {
    //     case 'kg':
    //     case 'kw':
    //     case 'mg':
    //       break
    //     default:
    //       return lrcInfo
    //   }
    // } else
    if (lrcInfo.rlyric == null) {
      if (!['wy', 'kg'].includes(musicInfo.source)) return lrcInfo
    } else return lrcInfo
  }
  return null
}

export const getOnlineOtherSourceMusicUrlByLocal = async (
  musicInfo: LX.Music.MusicInfoLocal,
  isRefresh: boolean
): Promise<{
  url: string
  quality: LX.Quality
  isFromCache: boolean
}> => {
  if (!(await global.lx.apiInitPromise[0])) throw new Error('source init failed')

  const quality = '128k'

  const cachedUrl = await getStoreMusicUrl(musicInfo, quality)
  if (cachedUrl && !isRefresh) return { url: cachedUrl, quality, isFromCache: true }

  let reqPromise
  try {
    reqPromise = apis('local').getMusicUrl(toOldMusicInfo(musicInfo), null).promise
  } catch (err: any) {
    reqPromise = Promise.reject(err)
  }

  return reqPromise.then(({ url }: { url: string }) => {
    return { url, quality, isFromCache: false }
  })
}

export const getOnlineOtherSourceLyricByLocal = async (
  musicInfo: LX.Music.MusicInfoLocal,
  isRefresh: boolean
): Promise<{
  lyricInfo: LX.Music.LyricInfo
  isFromCache: boolean
}> => {
  if (!(await global.lx.apiInitPromise[0])) {
    userApiLog.error('[在线匹配歌词] API 未初始化')
    throw new Error('source init failed')
  }

  userApiLog.info(`[在线匹配歌词] ========== 开始匹配 ==========`)
  userApiLog.info(`[在线匹配歌词] 原始信息 - 歌曲: "${musicInfo.name}" - 歌手: "${musicInfo.singer}"`)
  userApiLog.info(`[在线匹配歌词] 音乐ID: "${musicInfo.id}"`)
  userApiLog.info(`[在线匹配歌词] 来源: "${musicInfo.source}"`)
  userApiLog.info(`[在线匹配歌词] 是否刷新: ${isRefresh}`)

  const lyricInfo = await getCachedLyricInfo(musicInfo)
  if (lyricInfo && !isRefresh) {
    userApiLog.info(`[在线匹配歌词] 命中缓存，直接返回`)
    userApiLog.info(`[在线匹配歌词] 缓存歌词长度: ${lyricInfo.lyric?.length || 0}`)
    return { lyricInfo, isFromCache: true }
  }

  const cleanedName = cleanFileName(musicInfo.name)
  const cleanedSinger = cleanFileName(musicInfo.singer)
  userApiLog.info(`[在线匹配歌词] 清理后歌曲名: "${cleanedName}"`)
  userApiLog.info(`[在线匹配歌词] 清理后歌手名: "${cleanedSinger}"`)

  const oldMusicInfo = toOldMusicInfo({
    ...musicInfo,
    name: cleanedName,
    singer: cleanedSinger,
  })
  userApiLog.info(`[在线匹配歌词] 转换后的搜索参数:`, JSON.stringify(oldMusicInfo, null, 2))
  
  let reqPromise
  try {
    userApiLog.info(`[在线匹配歌词] 调用 apis('local').getLyric()`)
    reqPromise = apis('local').getLyric(oldMusicInfo).promise
  } catch (err: any) {
    userApiLog.error(`[在线匹配歌词] API 调用失败 - 错误: ${err?.message || err}`)
    reqPromise = Promise.reject(err)
  }

  return reqPromise.then((lyricInfo: LX.Music.LyricInfo) => {
    const hasLyric = lyricInfo?.lyric?.length > 0
    userApiLog.info(`[在线匹配歌词] 匹配完成 ==========`)
    userApiLog.info(`[在线匹配歌词] 是否成功: ${hasLyric}`)
    userApiLog.info(`[在线匹配歌词] 歌词长度: ${lyricInfo?.lyric?.length || 0}`)
    userApiLog.info(`[在线匹配歌词] 歌词预览: ${lyricInfo?.lyric?.substring(0, 100) || ''}...`)
    return { lyricInfo, isFromCache: false }
  }).catch((err) => {
    userApiLog.error(`[在线匹配歌词] 匹配失败 ==========`)
    userApiLog.error(`[在线匹配歌词] 错误信息: ${err?.message || err}`)
    throw err
  })
}

export const getOnlineOtherSourcePicByLocal = async (
  musicInfo: LX.Music.MusicInfoLocal
): Promise<{
  url: string
}> => {
  if (!(await global.lx.apiInitPromise[0])) {
    userApiLog.error('[在线匹配封面] API 未初始化')
    throw new Error('source init failed')
  }

  userApiLog.info(`[在线匹配封面] ========== 开始匹配 ==========`)
  userApiLog.info(`[在线匹配封面] 原始信息 - 歌曲: "${musicInfo.name}" - 歌手: "${musicInfo.singer}"`)
  userApiLog.info(`[在线匹配封面] 音乐ID: "${musicInfo.id}"`)
  userApiLog.info(`[在线匹配封面] 来源: "${musicInfo.source}"`)

  const cleanedName = cleanFileName(musicInfo.name)
  const cleanedSinger = cleanFileName(musicInfo.singer)
  userApiLog.info(`[在线匹配封面] 清理后歌曲名: "${cleanedName}"`)
  userApiLog.info(`[在线匹配封面] 清理后歌手名: "${cleanedSinger}"`)

  const oldMusicInfo = toOldMusicInfo({
    ...musicInfo,
    name: cleanedName,
    singer: cleanedSinger,
  })
  userApiLog.info(`[在线匹配封面] 转换后的搜索参数:`, JSON.stringify(oldMusicInfo, null, 2))

  let reqPromise
  try {
    userApiLog.info(`[在线匹配封面] 调用 apis('local').getPic()`)
    reqPromise = apis('local').getPic(oldMusicInfo).promise
  } catch (err: any) {
    userApiLog.error(`[在线匹配封面] API 调用失败 - 错误: ${err?.message || err}`)
    reqPromise = Promise.reject(err)
  }

  return reqPromise.then((url: string) => {
    const hasUrl = !!url && url.length > 0
    userApiLog.info(`[在线匹配封面] 匹配完成 - 歌曲: ${musicInfo.name} - 是否成功: ${hasUrl} - URL: ${url || '空'}`)
    return { url }
  }).catch((err) => {
    userApiLog.error(`[在线匹配封面] 匹配失败 - 歌曲: ${musicInfo.name} - 错误: ${err?.message || err}`)
    throw err
  })
}

export const TRY_QUALITYS_LIST = ['master', 'atmos_plus', 'atmos', 'hires', 'flac', '320k'] as const
type TryQualityType = (typeof TRY_QUALITYS_LIST)[number]
export const QUALITY_RANK: readonly LX.Quality[] = ['master', 'atmos_plus', 'atmos', 'hires', 'flac', '320k', '192k', '128k'];

export const getPlayQuality = (
  preferredQuality: LX.Quality,
  musicInfo: LX.Music.MusicInfoOnline
): LX.Quality => {
  const availableQualities = musicInfo.meta._qualitys;

  const validPreferredQuality = QUALITY_RANK.includes(preferredQuality)
    ? preferredQuality
    : '128k';

  const startIndex = QUALITY_RANK.indexOf(validPreferredQuality);

  const searchIndex = startIndex === -1 ? 0 : startIndex;

  for (let i = searchIndex; i < QUALITY_RANK.length; i++) {
    const quality = QUALITY_RANK[i];
    if (availableQualities[quality]) {
      return quality;
    }
  }

  return '128k';
}

export const getOnlineOtherSourceMusicUrl = async ({
  musicInfos,
  quality,
  onToggleSource,
  isRefresh,
  retryedSource = [],
}: {
  musicInfos: LX.Music.MusicInfoOnline[]
  quality?: LX.Quality
  onToggleSource: (musicInfo?: LX.Music.MusicInfoOnline) => void
  isRefresh: boolean
  retryedSource?: LX.OnlineSource[]
}): Promise<{
  url: string
  musicInfo: LX.Music.MusicInfoOnline
  quality: LX.Quality
  isFromCache: boolean
}> => {
  if (!(await global.lx.apiInitPromise[0])) {
    userApiLog.error('[换源播放] API 未初始化，无法获取播放地址')
    throw new Error('source init failed')
  }

  const musicName = musicInfos[0]?.name || '未知歌曲'
  const musicSinger = musicInfos[0]?.singer || '未知歌手'
  userApiLog.info(`[换源播放] ========== 开始尝试换源获取播放地址 ==========`)
  userApiLog.info(`[换源播放] 目标歌曲: "${musicName}" - "${musicSinger}"`)
  userApiLog.info(`[换源播放] 可用音源列表: ${musicInfos.map(m => m.source).join(', ')}`)
  userApiLog.info(`[换源播放] 已尝试过的音源: ${retryedSource.length > 0 ? retryedSource.join(', ') : '无'}`)
  userApiLog.info(`[换源播放] 请求音质: ${quality || '自动选择'}`)
  userApiLog.info(`[换源播放] 是否刷新缓存: ${isRefresh}`)

  let musicInfo: LX.Music.MusicInfoOnline | null = null
  let itemQuality: LX.Quality | null = null
  let tryCount = 0

  while ((musicInfo = musicInfos.shift()!)) {
    tryCount++
    userApiLog.info(`[换源播放] 第 ${tryCount} 次尝试 - 音源: "${musicInfo.source}"`)
    userApiLog.info(`[换源播放]   歌曲名: "${musicInfo.name}"`)
    userApiLog.info(`[换源播放]   歌手名: "${musicInfo.singer}"`)
    userApiLog.info(`[换源播放]   时长: ${musicInfo.interval || '未知'}`)

    if (retryedSource.includes(musicInfo.source)) {
      userApiLog.info(`[换源播放]   跳过 - 该音源已尝试过`)
      continue
    }
    retryedSource.push(musicInfo.source)

    if (!assertApiSupport(musicInfo.source)) {
      userApiLog.info(`[换源播放]   跳过 - 该音源API不支持当前平台`)
      continue
    }

    const preferredQuality = quality ?? settingState.setting['player.playQuality']
    itemQuality = getPlayQuality(preferredQuality, musicInfo)
    userApiLog.info(`[换源播放]   用户偏好音质: ${preferredQuality}`)
    userApiLog.info(`[换源播放]   实际选择音质: ${itemQuality}`)
    userApiLog.info(`[换源播放]   支持的音质: ${Object.keys(musicInfo.meta._qualitys ?? {}).join(', ')}`)

    if (preferredQuality !== itemQuality) {
      userApiLog.info(`[换源播放]   音质降级: ${preferredQuality} -> ${itemQuality}`)
    }

    userApiLog.info(`[换源播放]   选择该音源进行尝试`)
    onToggleSource(musicInfo)
    break
  }

  if (!musicInfo) {
    userApiLog.error(`[换源播放] ========== 换源失败 ==========`)
    userApiLog.error(`[换源播放] 所有音源均已尝试，无法获取播放地址`)
    userApiLog.error(`[换源播放] 歌曲: "${musicName}" - "${musicSinger}"`)
    userApiLog.error(`[换源播放] 尝试过的音源: ${retryedSource.join(', ')}`)
    throw new Error(global.i18n.t('toggle_source_failed'))
  }

  if (!itemQuality) {
    userApiLog.error(`[换源播放] ========== 换源失败 ==========`)
    userApiLog.error(`[换源播放] 无法确定可用音质`)
    throw new Error(global.i18n.t('toggle_source_failed'))
  }

  const cachedUrl = await getStoreMusicUrl(musicInfo, itemQuality)
  if (cachedUrl && !isRefresh) {
    userApiLog.info(`[换源播放]   命中缓存，直接返回播放地址`)
    userApiLog.info(`[换源播放] ========== 换源成功 ==========`)
    userApiLog.info(`[换源播放] 最终音源: "${musicInfo.source}"`)
    userApiLog.info(`[换源播放] 音质: ${itemQuality}`)
    return { url: cachedUrl, musicInfo, quality: itemQuality, isFromCache: true }
  }

  const tryGetMusicUrlWithFallback = async (qualities: LX.Quality[]): Promise<{ url: string; type: LX.Quality }> => {
    if (qualities.length === 0) {
      throw new Error('no available quality')
    }

    const currentQuality = qualities[0]
    userApiLog.info(`[换源播放]   尝试音质: ${currentQuality}`)

    let reqPromise
    try {
      reqPromise = musicSdk[musicInfo.source].getMusicUrl(
        toOldMusicInfo(musicInfo),
        currentQuality
      ).promise
    } catch (err: any) {
      userApiLog.error(`[换源播放]   API调用失败: ${err?.message || err}`)
      reqPromise = Promise.reject(err)
    }

    return reqPromise
      .then((result: { url: string; type: LX.Quality }) => {
        userApiLog.info(`[换源播放]   请求成功，获取到播放地址`)
        userApiLog.info(`[换源播放]   播放地址长度: ${result.url.length} 字符`)
        userApiLog.info(`[换源播放]   实际音质: ${result.type}`)
        return result
      })
      .catch((err: any) => {
        if (err.message == requestMsg.tooManyRequests) {
          userApiLog.error(`[换源播放]   请求失败 - 请求过于频繁`)
          throw err
        }
        userApiLog.error(`[换源播放]   音质 ${currentQuality} 请求失败: ${err?.message || err}`)
        
        if (qualities.length > 1) {
          userApiLog.info(`[换源播放]   尝试更低音质...`)
          return tryGetMusicUrlWithFallback(qualities.slice(1))
        }
        
        throw err
      })
  }

  const availableQualities = Object.keys(musicInfo.meta._qualitys ?? {}) as LX.Quality[]
  const sortedQualities = availableQualities
    .filter(q => QUALITY_RANK.includes(q))
    .sort((a, b) => QUALITY_RANK.indexOf(a) - QUALITY_RANK.indexOf(b))

  const startIndex = sortedQualities.indexOf(itemQuality)
  const fallbackQualities = startIndex >= 0 
    ? sortedQualities.slice(startIndex) 
    : sortedQualities

  userApiLog.info(`[换源播放]   未命中缓存，发起网络请求获取播放地址`)

  return tryGetMusicUrlWithFallback(fallbackQualities)
    .then(({ url, type }) => {
      userApiLog.info(`[换源播放] ========== 换源成功 ==========`)
      userApiLog.info(`[换源播放] 最终音源: "${musicInfo.source}"`)
      userApiLog.info(`[换源播放] 歌曲: "${musicInfo.name}" - "${musicInfo.singer}"`)
      userApiLog.info(`[换源播放] 音质: ${type}`)
      return { musicInfo, url, quality: type, isFromCache: false }
    })
    .catch((err: any) => {
      if (err.message == requestMsg.tooManyRequests) {
        throw err
      }
      userApiLog.error(`[换源播放]   该音源所有音质均尝试失败`)
      userApiLog.info(`[换源播放]   尝试下一个音源...`)
      return getOnlineOtherSourceMusicUrl({
        musicInfos,
        quality,
        onToggleSource,
        isRefresh,
        retryedSource,
      })
    })
}

export const getUserDefinedSourceList = (
  excludeSourceId?: string
): Array<{ id: string; name: string }> => {
  const currentSource = settingState.setting['common.apiSource']

  const builtinSources = (musicSdk as any).sources
    .filter((source: any) => source.id !== excludeSourceId)
    .map((source: any) => ({ id: source.id, name: source.name }))

  const userSources = userApiState.list
    .filter(api => api.id !== excludeSourceId)
    .map(api => ({ id: api.id, name: api.name }))

  if (/^user_api/.test(currentSource)) {
    const otherUserSources = userSources.filter(s => s.id !== currentSource)
    return [...otherUserSources, ...builtinSources]
  }

  return [...userSources, ...builtinSources.filter((s: any) => s.id !== currentSource)]
}

export const tryUserDefinedSourceToggle = async ({
  musicInfo,
  isRefresh,
  maxRetry,
  onToggleSource,
}: {
  musicInfo: LX.Music.MusicInfoOnline
  isRefresh: boolean
  maxRetry: number
  onToggleSource: (musicInfo?: LX.Music.MusicInfoOnline) => void
}): Promise<{
  url: string
  musicInfo: LX.Music.MusicInfoOnline
  quality: LX.Quality
  isFromCache: boolean
}> => {
  const sourceList = getUserDefinedSourceList(musicInfo.source)
  const preferredQuality = settingState.setting['player.playQuality']
  const platformSdk = (musicSdk as any)[musicInfo.source]
  const originalApiSource = settingState.setting['common.apiSource']

  console.log('[播放策略] [切换音源] ========== 开始切换插件 ==========')
  console.log('[播放策略] [切换音源] 当前平台:', musicInfo.source, '| 当前API源:', originalApiSource)
  console.log('[播放策略] [切换音源] 可用插件列表:', sourceList.map(s => `${s.name}(${s.id})`).join(', ') || '无')
  console.log('[播放策略] [切换音源] 最大尝试次数:', maxRetry)

  let triedCount = 0
  const PLUGIN_TIMEOUT_MS = 8000

  const tryWithApiSource = async (apiSourceId: string): Promise<string | null> => {
    if (apiSourceId !== originalApiSource) {
      settingState.setting['common.apiSource'] = apiSourceId
      if (/^user_api/.test(apiSourceId)) {
        try {
          const { setApiSource } = await import('@/core/apiSource')
          setApiSource(apiSourceId)
          await global.lx.apiInitPromise[0]
        } catch {
          settingState.setting['common.apiSource'] = originalApiSource
          return null
        }
      } else {
        settingState.setting['common.apiSource'] = apiSourceId
      }
    }

    try {
      const oldMusicInfo = toOldMusicInfo(musicInfo)
      const result = await platformSdk.getMusicUrl(oldMusicInfo, preferredQuality).promise
      return result?.url ?? null
    } catch (err: any) {
      console.log(`[播放策略] [切换音源]   getMusicUrl 错误: ${err?.message || err}`)
      return null
    }
  }

  const tryWithApiSourceWithTimeout = async (apiSourceId: string): Promise<string | null> => {
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), PLUGIN_TIMEOUT_MS))
    return Promise.race([tryWithApiSource(apiSourceId), timeout])
  }

  for (const source of sourceList) {
    if (triedCount >= maxRetry) break
    if (global.lx.isPlayedStop) break

    triedCount++
    console.log(`[播放策略] [切换音源] >>> 第 ${triedCount} 次尝试 - 插件: "${source.name}" (${source.id})`)

    try {
      const url = await tryWithApiSourceWithTimeout(source.id)

      if (url) {
        settingState.setting['common.apiSource'] = originalApiSource
        console.log(`[播放策略] [切换音源] ========== 切换插件成功! ==========`)
        console.log(`[播放策略] [切换音源] 成功插件: "${source.name}" (${source.id})`)
        onToggleSource(musicInfo)
        return {
          url,
          musicInfo,
          quality: preferredQuality,
          isFromCache: false,
        }
      }
      console.log(`[播放策略] [切换音源]   插件 "${source.name}" 超时或未返回播放地址`)
    } catch (err: any) {
      console.log(`[播放策略] [切换音源]   插件 "${source.name}" 请求失败: ${err?.message || err}`)
    }
  }

  settingState.setting['common.apiSource'] = originalApiSource
  console.log('[播放策略] [切换音源] ========== 所有插件均尝试失败 ==========')
  throw new Error(global.i18n.t('toggle_source_failed'))
}

/**
 * Get online music URL
 */
export const handleGetOnlineMusicUrl = async ({
  musicInfo,
  quality,
  onToggleSource,
  isRefresh,
  allowToggleSource,
}: {
  musicInfo: LX.Music.MusicInfoOnline
  quality?: LX.Quality
  isRefresh: boolean
  allowToggleSource: boolean
  onToggleSource: (musicInfo?: LX.Music.MusicInfoOnline) => void
}): Promise<{
  url: string
  musicInfo: LX.Music.MusicInfoOnline
  quality: LX.Quality
  isFromCache: boolean
}> => {
  if (!(await global.lx.apiInitPromise[0])) {
    userApiLog.error(`[在线播放] API 未初始化，无法获取播放地址`)
    throw new Error('source init failed')
  }

  userApiLog.info(`[在线播放] ========== 开始获取播放地址 ==========`)
  userApiLog.info(`[在线播放] 歌曲: "${musicInfo.name}" - "${musicInfo.singer}"`)
  userApiLog.info(`[在线播放] 音源: "${musicInfo.source}"`)
  userApiLog.info(`[在线播放] 音乐ID: "${musicInfo.id}"`)
  userApiLog.info(`[在线播放] 时长: ${musicInfo.interval || '未知'}`)
  
  if (musicInfo.source === 'tx') {
    if (!musicInfo.meta.songmid || musicInfo.meta.songmid === undefined) {
      const fallbackSongmid = musicInfo.songmid || musicInfo.meta.songId || musicInfo.meta.id || musicInfo.id
      userApiLog.info(`[在线播放] === 修复 TX songmid ===`, {
        currentSongmid: musicInfo.meta.songmid,
        fallbackSongmid,
        musicInfoSongmid: musicInfo.songmid,
        metaSongId: musicInfo.meta.songId,
        metaId: musicInfo.meta.id,
        musicId: musicInfo.id,
      })
      musicInfo.meta.songmid = String(fallbackSongmid)
    }
  }

  userApiLog.info(`[在线播放] === 音乐元信息诊断 ===`)
  userApiLog.info(`[在线播放]   songId: ${musicInfo.meta.songId}`)
  userApiLog.info(`[在线播放]   songmid: ${musicInfo.meta.songmid}`)
  userApiLog.info(`[在线播放]   meta.mid: ${musicInfo.meta.mid}`)
  userApiLog.info(`[在线播放]   meta 完整 keys: ${JSON.stringify(Object.keys(musicInfo.meta ?? {}))}`)
  userApiLog.info(`[在线播放]   strMediaMid: ${musicInfo.meta.strMediaMid}`)
  userApiLog.info(`[在线播放]   albumId: ${musicInfo.meta.albumId}`)
  userApiLog.info(`[在线播放]   albumMid: ${musicInfo.meta.albumMid}`)
  userApiLog.info(`[在线播放]   vid: ${musicInfo.meta.vid || '(空)'}`)
  userApiLog.info(`[在线播放]   支持音质列表: ${JSON.stringify(Object.keys(musicInfo.meta._qualitys ?? {}))}`)

  const preferredQuality = quality ?? settingState.setting['player.playQuality']
  const targetQuality = getPlayQuality(preferredQuality, musicInfo)
  userApiLog.info(`[在线播放] 用户偏好音质: ${preferredQuality}`)
  userApiLog.info(`[在线播放] 实际选择音质: ${targetQuality}`)
  userApiLog.info(`[在线播放] 支持的音质: ${Object.keys(musicInfo.meta._qualitys ?? {}).join(', ')}`)
  if (preferredQuality !== targetQuality) {
    userApiLog.info(`[在线播放] 音质降级: ${preferredQuality} -> ${targetQuality}`)
  }
  userApiLog.info(`[在线播放] 是否刷新缓存: ${isRefresh}`)
  userApiLog.info(`[在线播放] 是否允许换源: ${allowToggleSource}`)

  const cachedUrl = await getStoreMusicUrl(musicInfo, targetQuality)
  if (cachedUrl && !isRefresh) {
    userApiLog.info(`[在线播放] 命中缓存，直接返回播放地址`)
    userApiLog.info(`[在线播放] ========== 获取成功 ==========`)
    return { url: cachedUrl, musicInfo, quality: targetQuality, isFromCache: true }
  }

  const tryGetMusicUrlWithFallback = async (qualities: LX.Quality[]): Promise<{ url: string; type: LX.Quality }> => {
    if (qualities.length === 0) {
      throw new Error('no available quality')
    }

    const currentQuality = qualities[0]
    userApiLog.info(`[在线播放]   尝试音质: ${currentQuality}`)

    const oldMusicInfo = toOldMusicInfo(musicInfo)
    userApiLog.info(`[在线播放]   转换后的旧格式数据: songmid=${oldMusicInfo.songmid}, strMediaMid=${oldMusicInfo.strMediaMid}, vid=${oldMusicInfo.vid || '(空)'}`)

    let reqPromise
    try {
      reqPromise = musicSdk[musicInfo.source].getMusicUrl(
        oldMusicInfo,
        currentQuality
      ).promise
    } catch (err: any) {
      userApiLog.error(`[在线播放]   API调用失败: ${err?.message || err}`)
      reqPromise = Promise.reject(err)
    }

    return reqPromise
      .then((result: { url: string; type: LX.Quality }) => {
        userApiLog.info(`[在线播放]   请求成功，获取到播放地址`)
        userApiLog.info(`[在线播放]   播放地址长度: ${result.url.length} 字符`)
        userApiLog.info(`[在线播放]   播放地址: ${result.url}`)
        userApiLog.info(`[在线播放]   实际音质: ${result.type}`)
        
        if (!result.url || result.url.length < 10) {
          userApiLog.warn(`[在线播放]   警告: 播放地址可能无效`)
        }
        return result
      })
      .catch((err: any) => {
        if (err.message == requestMsg.tooManyRequests) {
          userApiLog.error(`[在线播放]   请求失败 - 请求过于频繁`)
          throw err
        }
        userApiLog.error(`[在线播放]   音质 ${currentQuality} 请求失败: ${err?.message || err}`)
        
        if (qualities.length > 1) {
          userApiLog.info(`[在线播放]   尝试更低音质...`)
          return tryGetMusicUrlWithFallback(qualities.slice(1))
        }
        
        throw err
      })
  }

  const availableQualities = Object.keys(musicInfo.meta._qualitys ?? {}) as LX.Quality[]
  const sortedQualities = availableQualities
    .filter(q => QUALITY_RANK.includes(q))
    .sort((a, b) => QUALITY_RANK.indexOf(a) - QUALITY_RANK.indexOf(b))

  const startIndex = sortedQualities.indexOf(targetQuality)
  const fallbackQualities = startIndex >= 0 
    ? sortedQualities.slice(startIndex) 
    : sortedQualities

  userApiLog.info(`[在线播放] 未命中缓存或需要刷新，发起网络请求`)

  return tryGetMusicUrlWithFallback(fallbackQualities)
    .then(({ url, type }) => {
      userApiLog.info(`[在线播放] ========== 获取成功 ==========`)
      return { musicInfo, url, quality: type, isFromCache: false }
    })
    .catch(async (err: any) => {
      userApiLog.error(`[在线播放] 当前音源所有音质均尝试失败`)

      if (!allowToggleSource) {
        userApiLog.error(`[在线播放] ========== 获取失败 ==========`)
        userApiLog.error(`[在线播放] 不允许换源，直接抛出错误`)
        throw err
      }

      if (err.message == requestMsg.tooManyRequests) {
        userApiLog.error(`[在线播放] ========== 获取失败 ==========`)
        userApiLog.error(`[在线播放] 请求过于频繁，无法继续`)
        throw err
      }

      userApiLog.info(`[在线播放] 尝试切换到其他音源...`)
      onToggleSource()

      return getOtherSource(musicInfo).then((otherSource) => {
        userApiLog.info(`[在线播放] 搜索到 ${otherSource.length} 个其他音源`)
        if (otherSource.length > 0) {
          userApiLog.info(`[在线播放] 搜索到的音源列表:`)
          otherSource.forEach((item, index) => {
            userApiLog.info(`[在线播放]   ${index + 1}. ${item.source} - "${item.name}" - "${item.singer}"`)
          })
          return getOnlineOtherSourceMusicUrl({
            musicInfos: [...otherSource],
            onToggleSource,
            quality,
            isRefresh,
            retryedSource: [musicInfo.source],
          })
        }
        userApiLog.error(`[在线播放] ========== 获取失败 ==========`)
        userApiLog.error(`[在线播放] 未找到其他可用音源`)
        throw err
      })
    })
}

export const getOnlineOtherSourcePicUrl = async ({
  musicInfos,
  onToggleSource,
  isRefresh,
  retryedSource = [],
}: {
  musicInfos: LX.Music.MusicInfoOnline[]
  onToggleSource: (musicInfo?: LX.Music.MusicInfoOnline) => void
  isRefresh: boolean
  retryedSource?: LX.OnlineSource[]
}): Promise<{
  url: string
  musicInfo: LX.Music.MusicInfoOnline
  isFromCache: boolean
}> => {
  let musicInfo: LX.Music.MusicInfoOnline | null = null

  while ((musicInfo = musicInfos.shift()!)) {
    if (retryedSource.includes(musicInfo.source)) continue
    retryedSource.push(musicInfo.source)
    // if (!assertApiSupport(musicInfo.source)) continue
    console.log(
      'try toggle to: ',
      musicInfo.source,
      musicInfo.name,
      musicInfo.singer,
      musicInfo.interval
    )
    onToggleSource(musicInfo)
    break
  }
  if (!musicInfo) throw new Error(global.i18n.t('toggle_source_failed'))

  if (musicInfo.meta.picUrl && !isRefresh)
    return { musicInfo, url: musicInfo.meta.picUrl, isFromCache: true }

  let reqPromise
  try {
    reqPromise = musicSdk[musicInfo.source].getPic(toOldMusicInfo(musicInfo))
  } catch (err: any) {
    reqPromise = Promise.reject(err)
  }
  // retryedSource.includes(musicInfo.source)
  return reqPromise
    .then((url: string) => {
      return { musicInfo, url, isFromCache: false }
    })
    .catch((err: any) => {
      console.log(err)
      return getOnlineOtherSourcePicUrl({ musicInfos, onToggleSource, isRefresh, retryedSource })
    })
}

/**
 * Get online song cover
 */
export const handleGetOnlinePicUrl = async ({
  musicInfo,
  isRefresh,
  onToggleSource,
  allowToggleSource,
}: {
  musicInfo: LX.Music.MusicInfoOnline
  onToggleSource: (musicInfo?: LX.Music.MusicInfoOnline) => void
  isRefresh: boolean
  allowToggleSource: boolean
}): Promise<{
  url: string
  musicInfo: LX.Music.MusicInfoOnline
  isFromCache: boolean
}> => {
  // console.log(musicInfo.source)
  let reqPromise
  try {
    reqPromise = musicSdk[musicInfo.source].getPic(toOldMusicInfo(musicInfo))
  } catch (err) {
    reqPromise = Promise.reject(err)
  }
  return reqPromise
    .then((url: string) => {
      return { musicInfo, url, isFromCache: false }
    })
    .catch(async (err: any) => {
      console.log(err)
      if (!allowToggleSource) throw err
      onToggleSource()

      return getOtherSource(musicInfo).then((otherSource) => {
        // console.log('find otherSource', otherSource.length)
        if (otherSource.length) {
          return getOnlineOtherSourcePicUrl({
            musicInfos: [...otherSource],
            onToggleSource,
            isRefresh,
            retryedSource: [musicInfo.source],
          })
        }
        throw err
      })
    })
}

export const getOnlineOtherSourceLyricInfo = async ({
  musicInfos,
  onToggleSource,
  isRefresh,
  retryedSource = [],
}: {
  musicInfos: LX.Music.MusicInfoOnline[]
  onToggleSource: (musicInfo?: LX.Music.MusicInfoOnline) => void
  isRefresh: boolean
  retryedSource?: LX.OnlineSource[]
}): Promise<{
  lyricInfo: LX.Music.LyricInfo | LX.Player.LyricInfo
  musicInfo: LX.Music.MusicInfoOnline
  isFromCache: boolean
}> => {
  let musicInfo: LX.Music.MusicInfoOnline | null = null

  while ((musicInfo = musicInfos.shift()!)) {
    if (retryedSource.includes(musicInfo.source)) continue
    retryedSource.push(musicInfo.source)
    // if (!assertApiSupport(musicInfo.source)) continue
    console.log(
      'try toggle to: ',
      musicInfo.source,
      musicInfo.name,
      musicInfo.singer,
      musicInfo.interval
    )
    onToggleSource(musicInfo)
    break
  }
  if (!musicInfo) throw new Error(global.i18n.t('toggle_source_failed'))

  if (!isRefresh) {
    const lyricInfo = await getCachedLyricInfo(musicInfo)
    if (lyricInfo) return { musicInfo, lyricInfo, isFromCache: true }
  }

  let reqPromise
  try {
    // TODO: remove any type
    reqPromise = (musicSdk[musicInfo.source].getLyric(toOldMusicInfo(musicInfo)) as any).promise
  } catch (err: any) {
    reqPromise = Promise.reject(err)
  }
  // retryedSource.includes(musicInfo.source)
  return reqPromise
    .then(async (lyricInfo: LX.Music.LyricInfo) => {
      return existTimeExp.test(lyricInfo.lyric)
        ? {
            lyricInfo,
            musicInfo,
            isFromCache: false,
          }
        : Promise.reject(new Error('failed'))
    })
    .catch((err: any) => {
      console.log(err)
      return getOnlineOtherSourceLyricInfo({ musicInfos, onToggleSource, isRefresh, retryedSource })
    })
}

/**
 * Get online lyric info
 */
export const handleGetOnlineLyricInfo = async ({
  musicInfo,
  onToggleSource,
  isRefresh,
  allowToggleSource,
}: {
  musicInfo: LX.Music.MusicInfoOnline
  onToggleSource: (musicInfo?: LX.Music.MusicInfoOnline) => void
  isRefresh: boolean
  allowToggleSource: boolean
}): Promise<{
  musicInfo: LX.Music.MusicInfoOnline
  lyricInfo: LX.Music.LyricInfo | LX.Player.LyricInfo
  isFromCache: boolean
}> => {
  // console.log(musicInfo.source)
  let reqPromise
  try {
    // TODO: remove any type
    reqPromise = (musicSdk[musicInfo.source].getLyric(toOldMusicInfo(musicInfo)) as any).promise
  } catch (err) {
    reqPromise = Promise.reject(err)
  }
  return reqPromise
    .then(async (lyricInfo: LX.Music.LyricInfo) => {
      return existTimeExp.test(lyricInfo.lyric)
        ? {
            musicInfo,
            lyricInfo,
            isFromCache: false,
          }
        : Promise.reject(new Error('failed'))
    })
    .catch(async (err: any) => {
      console.log(err)
      if (!allowToggleSource) throw err

      onToggleSource()

      return getOtherSource(musicInfo).then((otherSource) => {
        // console.log('find otherSource', otherSource.length)
        if (otherSource.length) {
          return getOnlineOtherSourceLyricInfo({
            musicInfos: [...otherSource],
            onToggleSource,
            isRefresh,
            retryedSource: [musicInfo.source],
          })
        }
        throw err
      })
    })
}
