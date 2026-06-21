import { httpFetch } from '../../request'
import axios from 'axios'
import settingState from '@/store/setting/state'
import { stringMd5 } from 'react-native-quick-md5'

const SIGN_SALT = 'OIlwieks28dk2k092lksi2UIkp'

// 签名函数
function signAndroidParams(params, data = '') {
  const sortedKeys = Object.keys(params).sort()
  const paramsString = sortedKeys.map(key => {
    const value = typeof params[key] === 'object' ? JSON.stringify(params[key]) : params[key]
    return `${key}=${value}`
  }).join('')
  const signStr = `${SIGN_SALT}${paramsString}${data}${SIGN_SALT}`
  return stringMd5(signStr)
}

// 获取设备信息
function getDeviceInfo() {
  const cookie = settingState.setting['common.kg_cookie'] || ''
  const cookieObj = {}
  cookie.split(';').forEach(pair => {
    const [k, ...v] = pair.trim().split('=')
    if (k) cookieObj[k.trim()] = v.join('=').trim()
  })
  return {
    dfid: cookieObj.dfid || '',
    mid: cookieObj.mid || '',
    userid: cookieObj.userid || '',
    token: cookieObj.token || '',
  }
}

// 通用请求头
const buildHeaders = () => ({
  'User-Agent': 'Android15-1070-11083-46-0-DiscoveryDRADProtocol-wifi',
  'kg-rc': '1',
  'kg-thash': '5d816a0',
  'kg-rec': '1',
  'kg-rf': 'B9EDA08A64250DEFFBCADDEE00F8F25F',
})

/**
 * 根据歌曲hash获取MV信息
 * @param {string} hash - 歌曲hash
 * @returns {Promise<Object>} MV信息
 */
const getMvInfo = async (hash) => {
  console.log('[MV] getMvInfo 开始, hash:', hash)
  
  const device = getDeviceInfo()
  const clienttime = Math.floor(Date.now() / 1000)
  
  const paramsMap = {
    dfid: device.dfid,
    mid: device.mid,
    uuid: '-',
    appid: '1005',
    clientver: '20489',
    clienttime,
  }
  
  const dataMap = {
    data: [{ album_audio_id: hash }],
    fields: '',
  }
  
  const dataStr = JSON.stringify(dataMap)
  const sig = signAndroidParams(paramsMap, dataStr)
  
  console.log('[MV] getMvInfo 请求参数:', { ...paramsMap, signature: sig })
  
  try {
    const { body, statusCode } = await httpFetch('https://openapi.kugou.com/kmr/v1/audio/mv', {
      method: 'POST',
      headers: {
        ...buildHeaders(),
        'Content-Type': 'application/json',
        'x-router': 'openapi.kugou.com',
        'KG-TID': '38',
        dfid: device.dfid,
        mid: device.mid,
        clienttime: String(clienttime),
        Cookie: `mid=${device.mid}`,
      },
      params: { ...paramsMap, signature: sig },
      body: dataMap,
    }).promise
    
    console.log('[MV] getMvInfo 响应 statusCode:', statusCode, 'body:', body)
    
    if (!body || body.error_code !== 0 || !body.data) {
      console.error('[MV] getMvInfo 失败: error_code=', body?.error_code, 'message=', body?.message)
      return Promise.reject(new Error(body?.message || '获取MV信息失败'))
    }
    
    const mvData = body.data[0]
    console.log('[MV] getMvInfo mvData:', mvData)
    
    // 检查返回的数据结构
    // 如果 mvData 是数组，直接返回（包含多个MV）
    if (Array.isArray(mvData) && mvData.length > 0) {
      console.log('[MV] getMvInfo 成功, mvList:', mvData.length, '个MV')
      return mvData
    }
    
    // 如果 mvData 有 video_info 字段
    if (mvData && mvData.video_info) {
      console.log('[MV] getMvInfo 成功, video_info:', mvData.video_info)
      return mvData
    }
    
    console.error('[MV] getMvInfo 无MV数据, mvData:', mvData)
    return Promise.reject(new Error('该歌曲暂无MV'))
  } catch (err) {
    console.error('[MV] getMvInfo 请求异常:', err.message || err)
    throw err
  }
}

/**
 * 通过搜索API获取MV信息
 * @param {string} songName - 歌曲名
 * @param {string} singerName - 歌手名
 * @returns {Promise<Object>} MV信息
 */
const searchMv = async (songName, singerName) => {
  console.log('[MV] searchMv 开始, songName:', songName, 'singerName:', singerName)
  
  const device = getDeviceInfo()
  const clienttime = Math.floor(Date.now() / 1000)
  const keyword = `${singerName} ${songName}`
  
  const paramsMap = {
    dfid: device.dfid,
    mid: device.mid,
    uuid: '-',
    appid: '1005',
    clientver: '20489',
    clienttime,
    keyword,
    page: 1,
    pagesize: 5,
    platform: 'AndroidFilter',
  }
  
  const sig = signAndroidParams(paramsMap)
  
  try {
    const { body } = await httpFetch('https://complexsearch.kugou.com/v1/search/mv', {
      method: 'GET',
      headers: {
        ...buildHeaders(),
        'x-router': 'complexsearch.kugou.com',
        dfid: device.dfid,
        mid: device.mid,
        clienttime: String(clienttime),
        Cookie: `mid=${device.mid}`,
      },
      params: { ...paramsMap, signature: sig },
    }).promise
    
    console.log('[MV] searchMv 响应:', body)
    
    if (body && body.error_code === 0 && body.data && body.data.lists && body.data.lists.length > 0) {
      // 返回第一个匹配的MV
      return body.data.lists[0]
    }
    
    return null
  } catch (err) {
    console.error('[MV] searchMv 异常:', err.message || err)
    return null
  }
}

/**
 * 获取MV播放链接
 * @param {string} songId - 歌曲ID (album_audio_id)
 * @param {string} songName - 歌曲名（可选，用于搜索）
 * @param {string} singerName - 歌手名（可选，用于搜索）
 * @returns {Promise<Object>} 包含url的对象
 */
export const getMvUrl = async (songId, songName, singerName) => {
  try {
    console.log('[MV] getMvUrl 开始, songId:', songId, 'songName:', songName, 'singerName:', singerName)
    
    // 首先尝试通过API获取MV信息
    let mvInfo = null
    try {
      mvInfo = await getMvInfo(songId)
    } catch (e) {
      console.log('[MV] getMvInfo 失败，尝试搜索MV')
    }
    
    let videoId = null
    
    // 如果API返回了MV列表（数组格式）
    if (Array.isArray(mvInfo) && mvInfo.length > 0) {
      // 选择第一个官方MV（非UGC内容）
      const officialMv = mvInfo.find(mv => mv.is_ugc === 0 && mv.is_other === 0) || mvInfo[0]
      console.log('[MV] 选择MV:', officialMv.mv_name, 'video_id:', officialMv.video_id)
      videoId = officialMv.video_id
    }
    // 如果API返回了MV信息（video_info格式）
    else if (mvInfo && mvInfo.video_info && mvInfo.video_info.length > 0) {
      const videoInfo = mvInfo.video_info[mvInfo.video_info.length - 1]
      if (videoInfo && videoInfo.hash) {
        videoId = videoInfo.hash
      }
    }
    
    // 如果没有获取到MV信息，尝试通过搜索获取
    if (!videoId && songName && singerName) {
      console.log('[MV] 尝试通过搜索获取MV')
      const searchResult = await searchMv(songName, singerName)
      
      if (searchResult && searchResult.videoid) {
        console.log('[MV] 搜索到MV:', searchResult)
        videoId = searchResult.videoid
      }
    }
    
    if (!videoId) {
      console.error('[MV] 暂无MV')
      return Promise.reject(new Error('该歌曲暂无MV'))
    }
    
    console.log('[MV] getMvUrl 获取播放链接, videoId:', videoId)
    
    // 第一步：通过 video_detail 获取视频 hash
    const device = getDeviceInfo()
    const clienttime = Math.floor(Date.now() / 1000)
    const dfid = device.dfid || '-'
    const mid = device.mid || '-'
    const uuid = stringMd5(`${dfid}${mid}`)
    
    const SIGN_PARAMS_KEY_SALT = 'OIlwieks28dk2k092lksi2UIkp'
    const detailKey = stringMd5(`1005${SIGN_PARAMS_KEY_SALT}20489${clienttime}`)
    
    const detailDataMap = {
      appid: 1005,
      clientver: 20489,
      clienttime,
      mid,
      uuid,
      dfid,
      token: device.token || '',
      key: detailKey,
      show_resolution: 1,
      data: [{ video_id: videoId }],
    }
    
    const detailDataStr = JSON.stringify(detailDataMap)
    const detailSig = signAndroidParams({}, detailDataStr)
    
    console.log('[MV] getMvUrl 获取视频详情, videoId:', videoId)
    
    const { body: detailBody } = await httpFetch('https://gateway.kugou.com/v1/video', {
      method: 'POST',
      headers: {
        ...buildHeaders(),
        'Content-Type': 'application/json',
        'x-router': 'kmr.service.kugou.com',
        dfid,
        mid,
        clienttime: String(clienttime),
        Cookie: `mid=${mid}`,
      },
      params: { signature: detailSig },
      body: detailDataMap,
    }).promise
    
    console.log('[MV] getMvUrl 视频详情响应:', detailBody?.status, detailBody?.error_code)
    
    // 从详情中提取视频 hash
    let videoHash = null
    if (detailBody?.data?.[0]) {
      const detail = detailBody.data[0]
      videoHash = detail.hd_hash || detail.sd_hash || detail.ld_hash || null
      console.log('[MV] getMvUrl 视频 hash:', videoHash)
    }
    
    if (!videoHash) {
      console.error('[MV] getMvUrl 无法获取视频 hash')
      return Promise.reject(new Error('获取MV播放链接失败'))
    }
    
    // 第二步：使用 video_url API (trackermv) 获取完整 MV 播放链接
    const SIGN_KEY_SALT = '57ae12eb6890223e355ccfcb74edf70d'
    const key = stringMd5(`${videoHash}${SIGN_KEY_SALT}1005${mid}${device.userid || 0}`)
    
    const urlParams = {
      backupdomain: 1,
      cmd: 123,
      ext: 'mp4',
      ismp3: 0,
      hash: videoHash,
      pid: 1,
      type: 1,
      dfid,
      mid,
      uuid: '-',
      appid: 1005,
      clientver: 20489,
      clienttime,
      key,
    }
    if (device.token) urlParams.token = device.token
    if (device.userid && device.userid !== '0') urlParams.userid = Number(device.userid)
    
    // 签名需要包含查询参数（按key排序拼接）
    const urlSig = signAndroidParams(urlParams, '')
    urlParams.signature = urlSig
    
    console.log('[MV] getMvUrl 签名参数:', { hash: videoHash, mid, userid: device.userid, key, signature: urlSig })
    
    // 手动构建查询字符串，确保参数按key排序
    const sortedKeys = Object.keys(urlParams).sort()
    const queryParts = sortedKeys.map(k => `${encodeURIComponent(k)}=${encodeURIComponent(urlParams[k])}`)
    const queryStr = queryParts.join('&')
    
    const trackermvUrl = `https://trackermv.kugou.com/v2/interface/index?${queryStr}`
    console.log('[MV] getMvUrl 请求URL:', trackermvUrl)
    
    // 使用axios发送请求（与测试脚本一致）
    const urlResponse = await axios({
      url: trackermvUrl,
      method: 'GET',
      headers: {
        'User-Agent': 'Android15-1070-11083-46-0-DiscoveryDRADProtocol-wifi',
        'x-router': 'trackermv.kugou.com',
        dfid,
        mid,
        clienttime: String(clienttime),
        Cookie: `mid=${mid}`,
      },
    })
    
    const urlBody = urlResponse.data
    
    console.log('[MV] getMvUrl 播放链接响应:', urlBody?.status, urlBody?.data ? '有数据' : '无数据')
    
    if (urlBody?.status === 1 && urlBody?.data) {
      const videoData = urlBody.data[videoHash.toLowerCase()] || urlBody.data[videoHash]
      if (videoData?.downurl) {
        console.log('[MV] getMvUrl 成功, url:', videoData.downurl)
        return { url: videoData.downurl }
      }
      if (videoData?.backupdownurl?.length) {
        console.log('[MV] getMvUrl 成功(备用), url:', videoData.backupdownurl[0])
        return { url: videoData.backupdownurl[0] }
      }
    }
    
    console.error('[MV] getMvUrl 无播放链接, urlBody:', urlBody)
    return Promise.reject(new Error('获取MV播放链接失败'))
  } catch (err) {
    console.error('[MV] getMvUrl 异常:', err.message || err)
    return Promise.reject(err)
  }
}
