/**
 * KuGou Music daily recommendation API
 * Includes: song recommendations, daily recommendations, new songs
 */
import { httpFetch } from '../../request'
import settingState from '@/store/setting/state'
import { log } from '@/utils/log'
import { stringMd5 } from 'react-native-quick-md5'
import { formatPlayTime } from '../../index'

const SIGN_SALT = 'OIlwieks28dk2k092lksi2UIkp'

// Signing function
function signAndroidParams(params, data = '') {
  const sortedKeys = Object.keys(params).sort()
  const paramsString = sortedKeys.map(key => {
    const value = typeof params[key] === 'object' ? JSON.stringify(params[key]) : params[key]
    return `${key}=${value}`
  }).join('')
  const signStr = `${SIGN_SALT}${paramsString}${data}${SIGN_SALT}`
  return stringMd5(signStr)
}

// Common request headers
const buildHeaders = () => ({
  'User-Agent': 'Android15-1070-11083-46-0-DiscoveryDRADProtocol-wifi',
  'kg-rc': '1',
  'kg-thash': '5d816a0',
  'kg-rec': '1',
  'kg-rf': 'B9EDA08A64250DEFFBCADDEE00F8F25F',
})

// Get device info from authentication Cookie
const getDeviceInfo = () => {
  const cookie = settingState.setting['common.kg_cookie'] || ''
  log.info('[KG DailyRec] Cookie状态:', cookie ? `已设置 (长度:${cookie.length})` : '未设置')
  const cookieObj = {}
  cookie.split(';').forEach(pair => {
    const [k, ...v] = pair.trim().split('=')
    if (k) cookieObj[k.trim()] = v.join('=').trim()
  })
  const device = {
    dfid: cookieObj.dfid || '',
    mid: cookieObj.mid || '',
    userid: cookieObj.userid || '',
    token: cookieObj.token || '',
    cookieStr: cookie,
  }
  log.info('[KG DailyRec] 设备信息:', { dfid: device.dfid ? '已设置' : '空', mid: device.mid ? '已设置' : '空', userid: device.userid || '空' })
  return device
}

// Transform song to app format
const transformSong = (item, index) => {
  try {
    const hash = item.hash || item.audio_info?.hash || ''
    const audioId = item.audio_id || item.audio_info?.audio_id || 0
    const songname = item.songname || item.audio_info?.songname || item.name || ''
    const singername = item.author_name || item.singername || item.audio_info?.singername || ''
    const albumName = item.album_name || item.audio_info?.album_name || ''
    const albumId = item.album_id || item.audio_info?.album_id || ''
    const duration = item.timelength || item.duration || item.audio_info?.duration || 0
    let img = item.sizable_cover || item.image || item.audio_info?.image || 
              item.album_sizable_cover || item.album_info?.sizable_cover ||
              item.trans_param?.union_cover || ''
    if (!img && hash) {
      img = `https://imge.kugou.com/stdmusic/{size}/${hash.substring(0, 8)}.jpg`
    }
    const mixsongid = item.mixsongid || item.audio_info?.mixsongid || 0

    return {
      id: `kg__${hash}`,
      name: songname,
      singer: singername,
      source: 'kg',
      interval: duration ? formatPlayTime(duration) : '',
      img: img ? img.replace('{size}', '400') : '',
      albumName,
      albumId: String(albumId),
      songmid: String(audioId),
      hash,
      mixSongId: mixsongid,
      types: [{ type: '128k', size: null }],
      _types: { '128k': { size: null } },
      typeUrl: {},
      meta: {
        songId: String(audioId),
        albumName,
        albumId: String(albumId),
        picUrl: img ? img.replace('{size}', '400') : '',
        qualitys: [{ type: '128k', size: null }],
        _qualitys: { '128k': { size: null } },
        hash,
        mixsongid,
      },
    }
  } catch (e) {
    log.error(`[KG DailyRec] transformSong[${index}] 失败`, e.message)
    return null
  }
}

const transformSongList = (rawList, sourceName = 'unknown') => {
  if (!rawList || !Array.isArray(rawList)) return []
  log.info(`[KG DailyRec] transformSongList ${sourceName}`, { count: rawList.length })
  return rawList.map((item, i) => transformSong(item, i)).filter(Boolean)
}

export default {
  /**
   * Song recommendations (personalized)
   */
  async getRecommendSongs(retryNum = 0) {
    if (retryNum > 2) return Promise.reject(new Error('try max num'))

    try {
      const device = getDeviceInfo()
      log.info('[KG DailyRec] getRecommendSongs 开始')

      const clienttime = Math.floor(Date.now() / 1000)
      const paramsMap = {
        dfid: device.dfid,
        mid: device.mid,
        uuid: '-',
        appid: '1005',
        clientver: '20489',
        clienttime,
        platform: 'ios',
        userid: Number(device.userid) || 0,
      }
      const sig = signAndroidParams(paramsMap, '')

      const url = `https://gateway.kugou.com/everyday_song_recommend`
      log.info('[KG DailyRec] getRecommendSongs URL:', url)

      const { body, statusCode } = await httpFetch(url, {
        method: 'POST',
        headers: {
          ...buildHeaders(),
          'x-router': 'everydayrec.service.kugou.com',
          dfid: device.dfid,
          mid: device.mid,
          clienttime: String(clienttime),
          Cookie: device.cookieStr || `mid=${device.mid}`,
        },
        params: { ...paramsMap, signature: sig },
      }).promise

      log.info('[KG DailyRec] getRecommendSongs 响应', { statusCode, status: body?.status, error_code: body?.error_code })

      if (body?.status !== 1 && body?.error_code !== 0) {
        throw new Error(`API错误: ${body?.error_code} ${body?.error || ''}`)
      }

      const songs = body?.data?.song_list || body?.data?.songs || body?.data?.list || []
      log.info('[KG DailyRec] getRecommendSongs 成功', { count: songs.length })
      return transformSongList(songs, 'recommend')
    } catch (e) {
      log.error('[KG DailyRec] getRecommendSongs 失败', e.message)
      if (retryNum < 2) return this.getRecommendSongs(retryNum + 1)
      throw e
    }
  },

  /**
   * Daily recommendations
   */
  async getEverydayRecommend(retryNum = 0) {
    if (retryNum > 2) return Promise.reject(new Error('try max num'))

    try {
      const device = getDeviceInfo()
      log.info('[KG DailyRec] getEverydayRecommend 开始')

      const clienttime = Math.floor(Date.now() / 1000)
      const defaultParams = {
        dfid: device.dfid,
        mid: device.mid,
        uuid: '-',
        appid: '1005',
        clientver: '20489',
        clienttime,
      }
      const paramsMap = { ...defaultParams, platform: 'ios' }
      const sig = signAndroidParams(paramsMap, '')

      const url = `https://gateway.kugou.com/everyday_song_recommend`
      log.info('[KG DailyRec] getEverydayRecommend URL:', url)

      const { body, statusCode } = await httpFetch(url, {
        method: 'POST',
        headers: {
          ...buildHeaders(),
          'x-router': 'everydayrec.service.kugou.com',
          'Content-Type': 'application/json',
          dfid: device.dfid,
          mid: device.mid,
          clienttime: String(clienttime),
          Cookie: `mid=${device.mid}`,
        },
        params: { ...paramsMap, signature: sig },
      }).promise

      log.info('[KG DailyRec] getEverydayRecommend 响应', { statusCode, status: body?.status })

      if (body?.status !== 1 && body?.error_code !== 0) {
        throw new Error(`API错误: ${body?.error_code} ${body?.error || ''}`)
      }

      const songs = body?.data?.song_list || body?.data?.songs || body?.data?.list || []
      log.info('[KG DailyRec] getEverydayRecommend 成功', { count: songs.length })
      return transformSongList(songs, 'everyday')
    } catch (e) {
      log.error('[KG DailyRec] getEverydayRecommend 失败', e.message)
      if (retryNum < 2) return this.getEverydayRecommend(retryNum + 1)
      throw e
    }
  },

  /**
   * New song express
   */
  async getNewSongs(retryNum = 0) {
    if (retryNum > 2) return Promise.reject(new Error('try max num'))

    try {
      const device = getDeviceInfo()
      log.info('[KG DailyRec] getNewSongs 开始')

      const clienttime = Math.floor(Date.now() / 1000)
      const paramsMap = {
        dfid: device.dfid,
        mid: device.mid,
        uuid: '-',
        appid: '1005',
        clientver: '20489',
        clienttime,
        token: device.token,
        userid: Number(device.userid) || 0,
      }
      const dataMap = { rank_id: 21608, userid: Number(device.userid) || 0, page: 1, pagesize: 30, tags: [] }
      const dataStr = JSON.stringify(dataMap)
      const sig = signAndroidParams(paramsMap, dataStr)

      const url = `https://gateway.kugou.com/musicadservice/container/v1/newsong_publish`
      log.info('[KG DailyRec] getNewSongs URL:', url)

      const { body, statusCode } = await httpFetch(url, {
        method: 'POST',
        headers: {
          ...buildHeaders(),
          'Content-Type': 'application/json',
          dfid: device.dfid,
          mid: device.mid,
          clienttime: String(clienttime),
          Cookie: `mid=${device.mid}`,
        },
        params: { ...paramsMap, signature: sig },
        body: dataMap,
      }).promise

      log.info('[KG DailyRec] getNewSongs 响应', { statusCode, status: body?.status, error_code: body?.error_code })

      if (body?.status !== 1 && body?.error_code !== 0) {
        throw new Error(`API错误: ${body?.error_code} ${body?.error || ''}`)
      }

      const songs = Array.isArray(body?.data) ? body.data : (body?.data?.songs || body?.data?.song_list || [])
      log.info('[KG DailyRec] getNewSongs 成功', { count: songs.length })
      return transformSongList(songs, 'newsong')
    } catch (e) {
      log.error('[KG DailyRec] getNewSongs 失败', e.message)
      if (retryNum < 2) return this.getNewSongs(retryNum + 1)
      throw e
    }
  },
}
