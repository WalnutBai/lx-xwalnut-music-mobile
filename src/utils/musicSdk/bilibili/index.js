import { httpFetch } from '../../request'
import musicSearch from './musicSearch'
import { log } from '@/utils/log'

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.90 Safari/537.36"
const headers = {
  "user-agent": UA,
  accept: "*/*",
  "accept-language": "zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6",
}

async function getCid(bvid, aid) {
  log.info('[Bilibili] getCid 开始 - bvid: ' + bvid + ', aid: ' + aid)
  const params = bvid ? { bvid } : { aid }
  try {
    const requestObj = httpFetch("https://api.bilibili.com/x/web-interface/view", { headers, params })
    const { body } = await requestObj.promise
    log.info('[Bilibili] getCid - 原始响应类型: ' + typeof body)
    const data = typeof body === 'string' ? JSON.parse(body) : body
    log.info('[Bilibili] getCid - 响应code: ' + data?.code + ', message: ' + data?.message)
    log.info('[Bilibili] getCid - 获取到cid: ' + data?.data?.cid)
    return data
  } catch (err) {
    log.error('[Bilibili] getCid 失败: ' + (err?.message || err))
    log.error('[Bilibili] getCid 错误堆栈: ' + (err?.stack || '无'))
    throw err
  }
}

async function getBilibiliMusicUrl(musicInfo, type) {
  log.info('[Bilibili] ========== getBilibiliMusicUrl 开始 ==========')
  log.info('[Bilibili] 传入 type: ' + type)
  log.info('[Bilibili] 传入 musicInfo 类型: ' + (typeof musicInfo))
  log.info('[Bilibili] musicInfo 是否为 null/undefined: ' + (musicInfo == null))
  
  if (musicInfo) {
    log.info('[Bilibili] musicInfo 所有键: ' + JSON.stringify(Object.keys(musicInfo)))
    log.info('[Bilibili] musicInfo.songmid: ' + JSON.stringify(musicInfo.songmid))
    log.info('[Bilibili] musicInfo.id: ' + JSON.stringify(musicInfo.id))
    log.info('[Bilibili] musicInfo.name: ' + JSON.stringify(musicInfo.name))
    log.info('[Bilibili] musicInfo.singer: ' + JSON.stringify(musicInfo.singer))
    log.info('[Bilibili] musicInfo.source: ' + JSON.stringify(musicInfo.source))
    log.info('[Bilibili] musicInfo.bvid: ' + JSON.stringify(musicInfo.bvid))
    log.info('[Bilibili] musicInfo.aid: ' + JSON.stringify(musicInfo.aid))
    log.info('[Bilibili] musicInfo._bilibiliData: ' + JSON.stringify(musicInfo._bilibiliData))
    log.info('[Bilibili] musicInfo.interval: ' + JSON.stringify(musicInfo.interval))
  }

  let bilibiliData = musicInfo?._bilibiliData
  let bvid = musicInfo?.bvid || bilibiliData?.bvid
  let aid = musicInfo?.aid || bilibiliData?.aid
  let cid = bilibiliData?.cid

  log.info('[Bilibili] 初步解析 - bvid: ' + bvid + ', aid: ' + aid + ', cid: ' + cid)
  
  if (!bvid && !aid) {
    log.info('[Bilibili] bvid和aid都为空，尝试从songmid/id解析')
    const songmid = musicInfo?.songmid || musicInfo?.id
    log.info('[Bilibili] songmid/id 值: ' + JSON.stringify(songmid))
    if (songmid) {
      const match = songmid.match(/^bilibili[_]?(.*)$/)
      log.info('[Bilibili] 正则匹配结果: ' + JSON.stringify(match))
      if (match) {
        const id = match[1]
        log.info('[Bilibili] 提取到的id: ' + id + ', 是否以BV开头: ' + id.startsWith('BV'))
        if (id.startsWith('BV')) {
          bvid = id
        } else {
          aid = id
        }
        log.info('[Bilibili] 解析后 - bvid: ' + bvid + ', aid: ' + aid)
      } else {
        log.error('[Bilibili] 正则匹配失败，songmid格式不匹配')
      }
    } else {
      log.error('[Bilibili] songmid和id都为空，无法解析')
    }
  }
  
  log.info('[Bilibili] 最终解析 - bvid: ' + bvid + ', aid: ' + aid + ', cid: ' + cid)
  
  if (!cid) {
    log.info('[Bilibili] cid为空，开始获取cid')
    try {
      const cidRes = await getCid(bvid, aid)
      log.info('[Bilibili] getCid 返回数据结构: ' + JSON.stringify(Object.keys(cidRes || {})))
      log.info('[Bilibili] getCid data 结构: ' + JSON.stringify(cidRes?.data ? Object.keys(cidRes.data) : '无data'))
      cid = cidRes?.data?.cid
      log.info('[Bilibili] 获取到的cid值: ' + cid)
      if (!cid) {
        log.error('[Bilibili] 获取cid失败 - cid为空')
        log.error('[Bilibili] cidRes.data: ' + JSON.stringify(cidRes?.data))
      }
    } catch (err) {
      log.error('[Bilibili] 获取cid异常: ' + (err?.message || err))
      log.error('[Bilibili] 错误堆栈: ' + (err?.stack || '无'))
      throw err
    }
  }
  
  const params = {
    ...(bvid ? { bvid } : { aid }),
    cid,
    fnval: 16,
  }
  log.info('[Bilibili] playurl请求参数: ' + JSON.stringify(params))

  let requestObj
  try {
    requestObj = httpFetch("https://api.bilibili.com/x/player/playurl", {
      headers,
      params,
    })
    log.info('[Bilibili] playurl httpFetch 创建成功')
  } catch (err) {
    log.error('[Bilibili] playurl httpFetch 创建失败: ' + (err?.message || err))
    throw err
  }

  let responseBody
  try {
    const response = await requestObj.promise
    log.info('[Bilibili] playurl 响应获取成功')
    log.info('[Bilibili] playurl 响应类型: ' + typeof response)
    log.info('[Bilibili] playurl 响应键: ' + JSON.stringify(response ? Object.keys(response) : 'null'))
    responseBody = response.body
    log.info('[Bilibili] playurl responseBody 类型: ' + typeof responseBody)
  } catch (err) {
    log.error('[Bilibili] playurl 请求失败: ' + (err?.message || err))
    log.error('[Bilibili] 错误堆栈: ' + (err?.stack || '无'))
    throw err
  }

  let data
  try {
    if (typeof responseBody === 'string') {
      log.info('[Bilibili] responseBody 是字符串，长度: ' + responseBody.length)
      log.info('[Bilibili] responseBody 前200字符: ' + responseBody.substring(0, 200))
      data = JSON.parse(responseBody)
      log.info('[Bilibili] JSON解析成功')
    } else {
      log.info('[Bilibili] responseBody 已经是对象')
      data = responseBody
    }
    log.info('[Bilibili] data 类型: ' + typeof data)
    log.info('[Bilibili] data 是否为 null: ' + (data == null))
  } catch (err) {
    log.error('[Bilibili] 解析响应数据失败: ' + (err?.message || err))
    log.error('[Bilibili] 原始 responseBody: ' + JSON.stringify(responseBody))
    throw err
  }

  if (!data) {
    log.error('[Bilibili] data 为空 (null/undefined)')
    throw new Error("响应数据为空")
  }
  
  log.info('[Bilibili] data.code: ' + data.code + ', data.message: ' + data.message)
  
  if (data.code !== undefined && data.code !== 0) {
    log.error('[Bilibili] API返回错误 - code: ' + data.code + ', message: ' + data.message)
    throw new Error("API错误: " + (data.message || '未知错误'))
  }
  
  log.info('[Bilibili] data.data 是否存在: ' + (data.data != null))
  if (!data.data) {
    log.error('[Bilibili] data.data 为空')
    log.error('[Bilibili] data 完整内容: ' + JSON.stringify(data))
    throw new Error("无数据返回")
  }
  
  log.info('[Bilibili] data.data 键: ' + JSON.stringify(Object.keys(data.data)))
  log.info('[Bilibili] data.data.dash 是否存在: ' + (data.data.dash != null))
  log.info('[Bilibili] data.data.durl 是否存在: ' + (data.data.durl != null))

  let url = ''
  
  if (data.data?.dash?.audio && Array.isArray(data.data.dash.audio) && data.data.dash.audio.length > 0) {
    const audios = data.data.dash.audio
    log.info('[Bilibili] dash模式 - 音频数量: ' + audios.length)
    audios.forEach((audio, idx) => {
      log.info('[Bilibili] dash音频[' + idx + ']: id=' + audio.id + ', bandwidth=' + audio.bandwidth + ', baseUrl存在=' + (audio.baseUrl != null) + ', base_url存在=' + (audio.base_url != null) + ', url长度=' + ((audio.baseUrl || audio.base_url || '').length))
    })
    
    audios.sort((a, b) => a.bandwidth - b.bandwidth)
    log.info('[Bilibili] 按bandwidth排序后: ' + JSON.stringify(audios.map(a => ({ id: a.id, bandwidth: a.bandwidth }))))
    const len = audios.length
    
    // 找到最合适的音频（优先选择包含 mcdn 域名的）
    const findBestUrl = (audioList) => {
      for (const audio of audioList) {
        const candidateUrl = audio.baseUrl || audio.base_url
        if (candidateUrl) {
          // 优先选择 mcdn 域名
          if (candidateUrl.includes('mcdn.bilivideo')) {
            log.info('[Bilibili] 优先选择 mcdn 域名: ' + candidateUrl.substring(0, 100))
            return candidateUrl
          }
        }
      }
      // 如果没有 mcdn 域名，返回第一个可用的
      for (const audio of audioList) {
        const candidateUrl = audio.baseUrl || audio.base_url
        if (candidateUrl) {
          log.info('[Bilibili] 使用第一个可用的 URL: ' + candidateUrl.substring(0, 100))
          return candidateUrl
        }
      }
      return null
    }
    
    log.info('[Bilibili] 选择音质 type: ' + type + ', len: ' + len)
    let selectedAudios = []
    switch (type) {
      case '128k':
        selectedAudios = [audios[0]]
        break
      case '320k':
        selectedAudios = [audios[Math.min(1, len - 1)]]
        break
      case 'flac':
      case 'flac24bit':
        selectedAudios = [audios[len - 1]]
        break
      default:
        selectedAudios = [audios[len - 1]]
    }
    
    // 尝试选中的音质，如果不行则尝试所有音质
    url = findBestUrl(selectedAudios) || findBestUrl(audios)
    log.info('[Bilibili] 选择的URL是否为空: ' + (!url) + ', URL长度: ' + (url ? url.length : 0))
    if (url) {
      log.info('[Bilibili] URL前100字符: ' + url.substring(0, 100))
    }
  } else if (data.data?.durl && Array.isArray(data.data.durl) && data.data.durl.length > 0) {
    log.info('[Bilibili] durl模式 - durl数量: ' + data.data.durl.length)
    url = data.data.durl[0].url
    log.info('[Bilibili] durl[0].url 是否存在: ' + (url != null) + ', 长度: ' + (url ? url.length : 0))
  } else {
    log.error('[Bilibili] 既没有dash.audio也没有durl')
    log.error('[Bilibili] dash: ' + JSON.stringify(data.data?.dash ? Object.keys(data.data.dash) : '不存在'))
    log.error('[Bilibili] durl: ' + JSON.stringify(data.data?.durl))
  }

  if (!url) {
    log.error('[Bilibili] 无法获取音频链接 - url为空')
    throw new Error("无法获取音频链接")
  }

  log.info('[Bilibili] 成功获取URL，长度: ' + url.length)

  let host = "upos-sz-mirror08c.bilivideo.com"
  try {
    const protoEndIndex = url.indexOf('://')
    if (protoEndIndex >= 0) {
      const pathStartIndex = url.indexOf('/', protoEndIndex + 3)
      if (pathStartIndex >= 0) {
        host = url.substring(protoEndIndex + 3, pathStartIndex)
      } else {
        host = url.substring(protoEndIndex + 3)
      }
    }
    log.info('[Bilibili] 提取host: ' + host)
  } catch (e) {
    log.error('[Bilibili] 提取host失败: ' + (e?.message || e))
  }

  const _headers = {
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.90 Safari/537.36 Edg/89.0.774.63",
    accept: "*/*",
    host: host,
    "accept-encoding": "gzip, deflate, br",
    connection: "keep-alive",
    referer: `https://www.bilibili.com/video/${bvid || bilibiliData?.bvid || aid || bilibiliData?.aid || ''}`,
  }

  const result = { url, headers: _headers }
  log.info('[Bilibili] ========== getBilibiliMusicUrl 结束 ==========')
  log.info('[Bilibili] 返回结果 url: ' + (result.url ? result.url.substring(0, 80) + '...' : '空'))
  log.info('[Bilibili] 返回结果 url 类型: ' + typeof result.url)
  log.info('[Bilibili] 返回结果 headers.host: ' + result.headers.host)
  log.info('[Bilibili] 返回结果 headers.referer: ' + result.headers.referer)
  return result
}

const bilibili = {
  musicSearch,

  getMusicUrl(songInfo, type) {
    log.info('[Bilibili] ========== getMusicUrl 被调用 ==========')
    log.info('[Bilibili] getMusicUrl type: ' + type)
    log.info('[Bilibili] getMusicUrl songInfo 类型: ' + typeof songInfo)
    log.info('[Bilibili] getMusicUrl songInfo 是否为 null: ' + (songInfo == null))
    
    if (songInfo) {
      log.info('[Bilibili] getMusicUrl songInfo 键: ' + JSON.stringify(Object.keys(songInfo)))
      log.info('[Bilibili] getMusicUrl songInfo.songmid: ' + JSON.stringify(songInfo.songmid))
      log.info('[Bilibili] getMusicUrl songInfo.id: ' + JSON.stringify(songInfo.id))
      log.info('[Bilibili] getMusicUrl songInfo.name: ' + JSON.stringify(songInfo.name))
      log.info('[Bilibili] getMusicUrl songInfo.singer: ' + JSON.stringify(songInfo.singer))
      log.info('[Bilibili] getMusicUrl songInfo.source: ' + JSON.stringify(songInfo.source))
      log.info('[Bilibili] getMusicUrl songInfo.bvid: ' + JSON.stringify(songInfo.bvid))
      log.info('[Bilibili] getMusicUrl songInfo.aid: ' + JSON.stringify(songInfo.aid))
      log.info('[Bilibili] getMusicUrl songInfo._bilibiliData: ' + JSON.stringify(songInfo._bilibiliData))
      log.info('[Bilibili] getMusicUrl songInfo.interval: ' + JSON.stringify(songInfo.interval))
    }

    const requestObj = new Object()
    requestObj.promise = getBilibiliMusicUrl(songInfo, type)
      .then(result => {
        log.info('[Bilibili] getMusicUrl .then - result 类型: ' + typeof result)
        log.info('[Bilibili] getMusicUrl .then - result 是否为 null: ' + (result == null))
        if (result) {
          log.info('[Bilibili] getMusicUrl .then - result 键: ' + JSON.stringify(Object.keys(result)))
          log.info('[Bilibili] getMusicUrl .then - result.url 类型: ' + typeof result.url)
          log.info('[Bilibili] getMusicUrl .then - result.url 是否为 null: ' + (result.url == null))
          log.info('[Bilibili] getMusicUrl .then - result.url 值: ' + (result.url ? result.url.substring(0, 80) + '...' : '空'))
          log.info('[Bilibili] getMusicUrl .then - result.headers 是否存在: ' + (result.headers != null))
        }
        const finalResult = { url: result?.url, type }
        log.info('[Bilibili] getMusicUrl .then - 最终返回: url类型=' + typeof finalResult.url + ', url是否为空=' + (finalResult.url == null) + ', type=' + finalResult.type)
        return finalResult
      })
      .catch(err => {
        log.error('[Bilibili] getMusicUrl .catch - 错误: ' + (err?.message || err))
        log.error('[Bilibili] getMusicUrl .catch - 错误堆栈: ' + (err?.stack || '无'))
        log.error('[Bilibili] getMusicUrl .catch - 错误类型: ' + typeof err)
        throw err
      })
    return requestObj
  },

  getPic(songInfo) {
    log.info('[Bilibili] getPic 被调用 - songInfo.name: ' + (songInfo?.name || '未知'))
    const requestObj = new Object()
    requestObj.promise = Promise.resolve(songInfo?.img || '')
    return requestObj
  },

  getLyric(songInfo) {
    log.info('[Bilibili] getLyric 被调用 - songInfo.name: ' + (songInfo?.name || '未知'))
    const requestObj = new Object()
    requestObj.promise = Promise.resolve({ lyric: null })
    return requestObj
  },
}

export default bilibili