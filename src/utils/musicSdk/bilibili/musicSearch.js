import { httpFetch } from '../../request'
import { log } from '@/utils/log'

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
const headers = {
  "user-agent": UA,
  accept: "*/*",
  "accept-language": "zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6",
}

const searchHeaders = {
  "user-agent": UA,
  accept: "application/json, text/plain, */*",
  origin: "https://search.bilibili.com",
  "sec-fetch-site": "same-site",
  "sec-fetch-mode": "cors",
  "sec-fetch-dest": "empty",
  referer: "https://search.bilibili.com/",
  "accept-language": "zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6",
}

let cookie = null
async function getCookie() {
  log.info('[Bilibili Search] getCookie - cookie缓存状态: ' + (cookie ? '已缓存' : '未缓存'))
  if (!cookie) {
    try {
      log.info('[Bilibili Search] getCookie - 开始请求指纹接口')
      const requestObj = httpFetch("https://api.bilibili.com/x/frontend/finger/spi", {
        headers: { "User-Agent": UA },
      })
      const { body } = await requestObj.promise
      log.info('[Bilibili Search] getCookie - 响应body类型: ' + typeof body)
      log.info('[Bilibili Search] getCookie - 响应body: ' + JSON.stringify(body))
      cookie = body?.data
      log.info('[Bilibili Search] getCookie - cookie获取成功: ' + JSON.stringify(cookie))
    } catch (error) {
      log.error('[Bilibili Search] Cookie获取失败: ' + error.message)
      log.error('[Bilibili Search] Cookie获取失败堆栈: ' + (error.stack || '无'))
      cookie = { b_3: '', b_4: '' }
    }
  }
  return cookie
}

function getCookieString() {
  if (!cookie) return ""
  const cookieStr = `buvid3=${cookie.b_3};buvid4=${cookie.b_4}`
  log.info('[Bilibili Search] getCookieString: ' + cookieStr)
  return cookieStr
}

function durationToSec(duration) {
  if (typeof duration === "number") {
    return duration
  }
  if (typeof duration === "string") {
    const dur = duration.split(":")
    return dur.reduce(function (prev, curr) {
      return 60 * prev + +curr
    }, 0)
  }
  return 0
}

function formatPlayTime(seconds) {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

function generateSongId(bvid, aid) {
  const hash = bvid ? bvid : aid
  return `bilibili_${hash}`
}

function generateAlbumId(album) {
  if (!album) return ""
  return `album_bilibili_${album}`
}

function decodeHtmlEntities(str) {
  if (!str) return str
  const entities = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&#x27;': "'",
    '&#x2F;': '/',
  }
  return str.replace(/&[#\w]+;/g, match => entities[match] || match)
}

function formatMedia(result) {
  const title = decodeHtmlEntities(result.title?.replace(/(\<em(.*?)\>)|(\<\/em\>)/g, "") || "")
  return {
    id: result.cid ?? result.bvid ?? result.aid,
    aid: result.aid,
    bvid: result.bvid,
    cid: result.cid,
    artist: result.author ?? result.owner?.name,
    title,
    album: result.bvid ?? result.aid,
    pic: result.pic?.startsWith("//") ? `http:${result.pic}` : result.pic,
    duration: durationToSec(result.duration),
    tags: result.tag?.split(","),
  }
}

const musicSearchModule = {
  limit: 20,
  total: 0,
  page: 0,
  allPage: 1,

  handleResult(searchResults, page, limit) {
    log.info('[Bilibili Search] handleResult - 原始结果数量: ' + searchResults.length + ', page: ' + page + ', limit: ' + limit)
    this.total = searchResults.length
    this.allPage = Math.ceil(this.total / limit)
    this.page = page

    const startIndex = (page - 1) * limit
    const endIndex = startIndex + limit
    const pageResults = searchResults.slice(startIndex, endIndex)
    log.info('[Bilibili Search] handleResult - 分页结果数量: ' + pageResults.length)

    const list = pageResults.map((item, index) => {
      const musicInfo = {
        name: item.title || '未知歌曲',
        singer: item.artist || '未知歌手',
        source: 'bilibili',
        songmid: generateSongId(item.bvid, item.aid),
        albumId: generateAlbumId(item.bvid || item.aid),
        interval: formatPlayTime(item.duration || 0),
        albumName: item.album || '未知专辑',
        lrc: null,
        img: item.pic,
        otherSource: null,
        types: [{ type: '128k', size: 'UNKNOWN' }],
        _types: { '128k': { size: 'UNKNOWN' } },
        typeUrl: {},
        _bilibiliData: {
          bvid: item.bvid,
          aid: item.aid,
          cid: item.cid,
        },
      }
      log.info('[Bilibili Search] handleResult [' + index + ']: songmid=' + musicInfo.songmid + ', bvid=' + item.bvid + ', aid=' + item.aid + ', cid=' + item.cid + ', name=' + musicInfo.name)
      return musicInfo
    })

    return list
  },

  async search(keyword, page = 1, limit, retryNum = 0) {
    log.info('[Bilibili Search] ========== search 开始 ==========')
    log.info('[Bilibili Search] keyword: ' + keyword + ', page: ' + page + ', limit: ' + limit + ', retryNum: ' + retryNum)
    
    if (retryNum > 2) {
      log.error('[Bilibili Search] 重试次数超过上限，放弃搜索')
      return Promise.reject(new Error('搜索失败，请稍后重试'))
    }

    if (limit == null) limit = this.limit

    try {
      log.info('[Bilibili Search] 开始获取Cookie')
      await getCookie()
      log.info('[Bilibili Search] Cookie获取完成')

      const params = {
        context: "",
        page,
        order: "",
        page_size: limit,
        keyword,
        duration: "",
        tids_1: "",
        tids_2: "",
        __refresh__: true,
        _extra: "",
        highlight: 1,
        single_column: 0,
        platform: "pc",
        from_source: "",
        search_type: "video",
        dynamic_offset: 0,
      }
      log.info('[Bilibili Search] 搜索参数: ' + JSON.stringify(params))

      const requestHeaders = { ...searchHeaders, cookie: getCookieString() }
      log.info('[Bilibili Search] 请求头: ' + JSON.stringify(requestHeaders))

      const requestObj = httpFetch("https://api.bilibili.com/x/web-interface/search/type", {
        headers: requestHeaders,
        params,
      })
      log.info('[Bilibili Search] httpFetch 创建成功，等待响应')

      const response = await requestObj.promise
      log.info('[Bilibili Search] 响应获取成功')
      log.info('[Bilibili Search] 响应类型: ' + typeof response)
      log.info('[Bilibili Search] 响应键: ' + JSON.stringify(response ? Object.keys(response) : 'null'))
      
      let data = response.body
      log.info('[Bilibili Search] response.body 类型: ' + typeof data)

      if (typeof data === 'string') {
        log.info('[Bilibili Search] response.body 是字符串，长度: ' + data.length)
        log.info('[Bilibili Search] response.body 前200字符: ' + data.substring(0, 200))
        try {
          data = JSON.parse(data)
          log.info('[Bilibili Search] JSON解析成功')
        } catch (parseError) {
          log.error('[Bilibili Search] JSON解析失败: ' + parseError.message)
          log.error('[Bilibili Search] JSON解析失败堆栈: ' + (parseError.stack || '无'))
          log.error('[Bilibili Search] 原始字符串: ' + data)
          return Promise.resolve({ list: [], allPage: 0, total: 0, limit, source: 'bilibili' })
        }
      } else {
        log.info('[Bilibili Search] response.body 已经是对象')
      }

      log.info('[Bilibili Search] data 类型: ' + typeof data)
      log.info('[Bilibili Search] data 是否为 null: ' + (data == null))
      
      if (data) {
        log.info('[Bilibili Search] data.code: ' + data.code + ', data.message: ' + data.message)
        log.info('[Bilibili Search] data.data 是否存在: ' + (data.data != null))
        if (data.data) {
          log.info('[Bilibili Search] data.data 键: ' + JSON.stringify(Object.keys(data.data)))
          log.info('[Bilibili Search] data.data.result 是否存在: ' + (data.data.result != null))
          log.info('[Bilibili Search] data.data.result 类型: ' + (Array.isArray(data.data.result) ? 'array' : typeof data.data.result))
          log.info('[Bilibili Search] data.data.result 长度: ' + (data.data.result ? data.data.result.length : 0))
          log.info('[Bilibili Search] data.data.numResults: ' + data.data.numResults)
          log.info('[Bilibili Search] data.data.numPages: ' + data.data.numPages)
        }
      }

      if (data.code !== 0 && data.code !== undefined) {
        log.error('[Bilibili Search] API错误: code=' + data.code + ', message=' + data.message)
        return Promise.resolve({ list: [], allPage: 0, total: 0, limit, source: 'bilibili' })
      }

      if (!data?.data?.result) {
        log.info('[Bilibili Search] data.data.result 为空，返回空列表')
        return Promise.resolve({ list: [], allPage: 0, total: 0, limit, source: 'bilibili' })
      }

      log.info('[Bilibili Search] 开始格式化搜索结果，原始数量: ' + data.data.result.length)
      
      let searchResults
      try {
        searchResults = data.data.result.map(formatMedia)
        log.info('[Bilibili Search] formatMedia 完成，结果数量: ' + searchResults.length)
        if (searchResults.length > 0) {
          log.info('[Bilibili Search] 第一个结果: ' + JSON.stringify(searchResults[0]))
        }
      } catch (formatErr) {
        log.error('[Bilibili Search] formatMedia 失败: ' + (formatErr?.message || formatErr))
        log.error('[Bilibili Search] formatMedia 堆栈: ' + (formatErr?.stack || '无'))
        return Promise.resolve({ list: [], allPage: 0, total: 0, limit, source: 'bilibili' })
      }
      
      let list
      try {
        list = this.handleResult(searchResults, page, limit)
        log.info('[Bilibili Search] handleResult 完成，list数量: ' + list.length)
      } catch (handleErr) {
        log.error('[Bilibili Search] handleResult 失败: ' + (handleErr?.message || handleErr))
        log.error('[Bilibili Search] handleResult 堆栈: ' + (handleErr?.stack || '无'))
        return Promise.resolve({ list: [], allPage: 0, total: 0, limit, source: 'bilibili' })
      }

      const result = {
        list,
        allPage: this.allPage,
        total: this.total,
        limit,
        source: 'bilibili',
      }
      log.info('[Bilibili Search] ========== search 成功结束 ==========')
      log.info('[Bilibili Search] 返回结果: list数量=' + result.list.length + ', allPage=' + result.allPage + ', total=' + result.total)
      return Promise.resolve(result)
    } catch (error) {
      log.error('[Bilibili Search] ========== search 异常 ==========')
      log.error('[Bilibili Search] 错误消息: ' + (error?.message || error))
      log.error('[Bilibili Search] 错误堆栈: ' + (error?.stack || '无'))
      log.error('[Bilibili Search] 错误类型: ' + typeof error)
      if (error.message?.includes('ECONNREFUSED') || error.message?.includes('ETIMEDOUT') || error.message?.includes('Network')) {
        log.info('[Bilibili Search] 网络错误，重试 (retryNum=' + (retryNum + 1) + ')')
        return this.search(keyword, page, limit, retryNum + 1)
      }
      return Promise.resolve({ list: [], allPage: 0, total: 0, limit, source: 'bilibili' })
    }
  },
}

export default musicSearchModule