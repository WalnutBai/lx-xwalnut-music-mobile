import { httpFetch } from '../../request'
import { decodeName, formatPlayTime, dateFormat, formatPlayCount } from '../../index'
import { formatSingerName } from '../utils'
import { getBatchMusicQualityInfo } from './quality_detail'
import { zzcSign } from './utils/crypto'
import dailyRec from './dailyRec'
import { log } from '@/utils/log'
import settingState from '@/store/setting/state'

export default {
  _requestObj_tags: null,
  _requestObj_hotTags: null,
  _requestObj_list: null,
  limit_list: 36,
  limit_song: 100000,
  successCode: 0,
  sortList: [
    {
      name: '最热',
      id: 5,
    },
    {
      name: '最新',
      id: 2,
    },
  ],
  regExps: {
    hotTagHtml: /class="c_bg_link js_tag_item" data-id="\w+">.+?<\/a>/g,
    hotTag: /data-id="(\w+)">(.+?)<\/a>/,
    listDetailLink: /\/playlist\/(\d+)/,
    listDetailLink2: /id=(\d+)/,
  },
  tagsUrl:
    'https://u.y.qq.com/cgi-bin/musicu.fcg?loginUin=0&hostUin=0&format=json&inCharset=utf-8&outCharset=utf-8&notice=0&platform=wk_v15.json&needNewCode=0&data=%7B%22tags%22%3A%7B%22method%22%3A%22get_all_categories%22%2C%22param%22%3A%7B%22qq%22%3A%22%22%7D%2C%22module%22%3A%22playlist.PlaylistAllCategoriesServer%22%7D%7D',
  hotTagUrl: 'https://c.y.qq.com/node/pc/wk_v15/category_playlist.html',
  getListUrl(sortId, id, page) {
    if (id) {
      id = parseInt(id)
      return `https://u.y.qq.com/cgi-bin/musicu.fcg?loginUin=0&hostUin=0&format=json&inCharset=utf-8&outCharset=utf-8&notice=0&platform=wk_v15.json&needNewCode=0&data=${encodeURIComponent(
        JSON.stringify({
          comm: { cv: 1602, ct: 20 },
          playlist: {
            method: 'get_category_content',
            param: {
              titleid: id,
              caller: '0',
              category_id: id,
              size: this.limit_list,
              page: page - 1,
              use_page: 1,
            },
            module: 'playlist.PlayListCategoryServer',
          },
        })
      )}`
    }
    return `https://u.y.qq.com/cgi-bin/musicu.fcg?loginUin=0&hostUin=0&format=json&inCharset=utf-8&outCharset=utf-8&notice=0&platform=wk_v15.json&needNewCode=0&data=${encodeURIComponent(
      JSON.stringify({
        comm: { cv: 1602, ct: 20 },
        playlist: {
          method: 'get_playlist_by_tag',
          param: {
            id: 10000000,
            sin: this.limit_list * (page - 1),
            size: this.limit_list,
            order: sortId,
            cur_page: page,
          },
          module: 'playlist.PlayListPlazaServer',
        },
      })
    )}`
  },
  getListDetailUrl(id) {
    return `https://c.y.qq.com/qzone/fcg-bin/fcg_ucc_getcdinfo_byids_cp.fcg?type=1&json=1&utf8=1&onlysong=0&new_format=1&disstid=${id}&loginUin=0&hostUin=0&format=json&inCharset=utf8&outCharset=utf-8&notice=0&platform=yqq.json&needNewCode=0`
  },

  // http://nplserver.kuwo.cn/pl.svc?op=getlistinfo&pid=2849349915&pn=0&rn=100&encode=utf8&keyset=pl2012&identity=kuwo&pcmp4=1&vipver=MUSIC_9.0.5.0_W1&newver=1
  // 获取标签
  getTag(tryNum = 0) {
    if (this._requestObj_tags) this._requestObj_tags.cancelHttp()
    if (tryNum > 2) return Promise.reject(new Error('try max num'))
    this._requestObj_tags = httpFetch(this.tagsUrl)
    return this._requestObj_tags.promise.then(({ body }) => {
      if (body.code !== this.successCode) return this.getTag(++tryNum)
      return this.filterTagInfo(body.tags.data.v_group)
    })
  },
  // 获取标签
  getHotTag(tryNum = 0) {
    if (this._requestObj_hotTags) this._requestObj_hotTags.cancelHttp()
    if (tryNum > 2) return Promise.reject(new Error('try max num'))
    this._requestObj_hotTags = httpFetch(this.hotTagUrl)
    return this._requestObj_hotTags.promise.then(({ statusCode, body }) => {
      if (statusCode !== 200) return this.getHotTag(++tryNum)
      return this.filterInfoHotTag(body)
    })
  },
  filterInfoHotTag(html) {
    let hotTag = html.match(this.regExps.hotTagHtml)
    const hotTags = []
    if (!hotTag) return hotTags

    hotTag.forEach((tagHtml) => {
      let result = tagHtml.match(this.regExps.hotTag)
      if (!result) return
      hotTags.push({
        id: parseInt(result[1]),
        name: result[2],
        source: 'tx',
      })
    })
    return hotTags
  },
  filterTagInfo(rawList) {
    return rawList.map((type) => ({
      name: type.group_name,
      list: type.v_item.map((item) => ({
        parent_id: type.group_id,
        parent_name: type.group_name,
        id: item.id,
        name: item.name,
        source: 'tx',
      })),
    }))
  },

  // 获取列表数据
  getList(sortId, tagId, page, tryNum = 0) {
    if (this._requestObj_list) this._requestObj_list.cancelHttp()
    if (tryNum > 2) return Promise.reject(new Error('try max num'))
    this._requestObj_list = httpFetch(this.getListUrl(sortId, tagId, page))
    // console.log(this.getListUrl(sortId, tagId, page))
    return this._requestObj_list.promise.then(({ body }) => {
      if (body.code !== this.successCode) {
        return this.getList(sortId, tagId, page, ++tryNum)
      }
      return tagId
        ? this.filterList2(body.playlist.data, page)
        : this.filterList(body.playlist.data, page)
    })
  },

  filterList(data, page) {
    return {
      list: data.v_playlist.map((item) => ({
        play_count: formatPlayCount(item.access_num),
        id: String(item.tid),
        author: item.creator_info.nick,
        name: item.title,
        time: item.modify_time ? dateFormat(item.modify_time * 1000, 'Y-M-D') : '',
        img: item.cover_url_medium,
        // grade: item.favorcnt / 10,
        total: item.song_ids?.length,
        desc: decodeName(item.desc).replace(/<br>/g, '\n'),
        source: 'tx',
      })),
      total: data.total,
      page,
      limit: this.limit_list,
      source: 'tx',
    }
  },
  filterList2({ content }, page) {
    // console.log(content.v_item)
    return {
      list: content.v_item.map(({ basic }) => ({
        play_count: formatPlayCount(basic.play_cnt),
        id: String(basic.tid),
        author: basic.creator.nick,
        name: basic.title,
        // time: basic.publish_time,
        img: basic.cover.medium_url || basic.cover.default_url,
        // grade: basic.favorcnt / 10,
        desc: decodeName(basic.desc).replace(/<br>/g, '\n'),
        source: 'tx',
      })),
      total: content.total_cnt,
      page,
      limit: this.limit_list,
      source: 'tx',
    }
  },

  async handleParseId(link, retryNum = 0) {
    if (retryNum > 2) return Promise.reject(new Error('link try max num'))

    const requestObj_listDetailLink = httpFetch(link)
    const {
      headers: { location },
      statusCode,
    } = await requestObj_listDetailLink.promise
    // console.log(headers)
    if (statusCode > 400) return this.handleParseId(link, ++retryNum)
    return location == null ? link : location
  },

  async getListId(id) {
    if (/[?&:/]/.test(id)) {
      if (!this.regExps.listDetailLink.test(id)) {
        id = await this.handleParseId(id)
      }
      let result = this.regExps.listDetailLink.exec(id)
      if (!result) {
        result = this.regExps.listDetailLink2.exec(id)
        if (!result) throw new Error('failed')
      }
      id = result[1]
      // console.log(id)
    }
    return id
  },
  // 获取歌曲列表内的音乐 - 使用新的签名API（支持官方歌单）
  async getListDetailNew(id, tryNum = 0) {
    log.info(`[TX SongList] getListDetailNew 开始`, { id, tryNum })
    
    if (tryNum > 2) {
      log.error(`[TX SongList] getListDetailNew 重试次数超限`, { id, tryNum })
      return Promise.reject(new Error('try max num'))
    }

    id = await this.getListId(id)

    const payload = {
      comm: { ct: 24, cv: 1800 },
      req_0: {
        module: 'music.srfDissInfo.DissInfo',
        method: 'CgiGetDiss',
        param: {
          disstid: parseInt(id),
          dirid: 0,
          tag: true,
          song_begin: 0,
          song_num: 999999,
          userinfo: true,
          orderlist: true,
          onlysonglist: false,
        },
      },
    }

    log.info(`[TX SongList] getListDetailNew 构建payload完成`, { disstid: payload.req_0.param.disstid })

    // 使用 musicu.fcg 不需要签名
    const url = `https://u.y.qq.com/cgi-bin/musicu.fcg?loginUin=0&hostUin=0&format=json&inCharset=utf-8&outCharset=utf-8&notice=0&platform=wk_v15.json&needNewCode=0&data=${encodeURIComponent(JSON.stringify(payload))}`

    log.info(`[TX SongList] getListDetailNew URL:`, url.substring(0, 200))

    // 获取Cookie
    const cookie = settingState.setting['common.tx_cookie']
    log.info(`[TX SongList] getListDetailNew Cookie状态:`, cookie ? `已设置 (长度:${cookie.length})` : '未设置')

    const requestObj_listDetail = httpFetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://y.qq.com/',
        'Cookie': cookie || '',
      },
    })

    const { body, statusCode } = await requestObj_listDetail.promise
    log.info(`[TX SongList] getListDetailNew 响应`, { statusCode, bodyCode: body?.code, req0Code: body?.req_0?.code })

    if (!body || !body.req_0) {
      log.error(`[TX SongList] getListDetailNew 响应体无效`, { body: JSON.stringify(body)?.substring(0, 200) })
      return this.getListDetailNew(id, ++tryNum)
    }

    const retCode = body.req_0.data?.retCode
    log.info(`[TX SongList] getListDetailNew retCode`, { retCode })
    
    // retCode 为 undefined 或 0 表示成功，否则失败
    if (retCode !== undefined && retCode !== 0 && tryNum < 2) {
      log.warn(`[TX SongList] getListDetailNew retCode非0，重试`, { retCode, tryNum })
      return this.getListDetailNew(id, ++tryNum)
    }

    const data = body.req_0.data
    if (!data || !data.songlist) {
      log.error(`[TX SongList] getListDetailNew 没有歌曲列表`, { dataKeys: data ? Object.keys(data) : [] })
      return Promise.reject(new Error('获取歌单详情失败'))
    }

    log.info(`[TX SongList] getListDetailNew 成功`, { songCount: data.songlist.length, dissname: data.dissinfo?.dissname })

    // 如果 dissinfo 中没有歌单名，尝试从旧接口获取
    let dissname = data.dissinfo?.dissname || ''
    let logo = data.dissinfo?.logo || ''
    let desc = data.dissinfo?.desc ? decodeName(data.dissinfo.desc).replace(/<br>/g, '\n') : ''
    let nickname = data.dissinfo?.nickname || ''
    let visitnum = data.dissinfo?.visitnum || 0

    if (!dissname) {
      try {
        log.info(`[TX SongList] getListDetailNew dissname为空，尝试旧接口`)
        const oldUrl = this.getListDetailUrl(id)
        const { body: oldBody } = await httpFetch(oldUrl, {
          headers: { Origin: 'https://y.qq.com', Referer: `https://y.qq.com/n/yqq/playsquare/${id}.html` },
        }).promise
        if (oldBody?.cdlist?.[0]) {
          const cdlist = oldBody.cdlist[0]
          dissname = cdlist.dissname || ''
          logo = cdlist.logo || ''
          desc = cdlist.desc ? decodeName(cdlist.desc).replace(/<br>/g, '\n') : ''
          nickname = cdlist.nickname || ''
          visitnum = cdlist.visitnum || 0
          log.info(`[TX SongList] 旧接口获取到歌单名`, { dissname })
        }
      } catch (e) {
        log.warn(`[TX SongList] 旧接口获取歌单名失败`, { error: e.message })
      }
    }

    return {
      list: await this.filterListDetailNew(data.songlist),
      page: 1,
      limit: data.songlist.length + 1,
      total: data.songlist.length,
      source: 'tx',
      info: {
        name: dissname,
        img: logo,
        desc,
        author: nickname,
        play_count: visitnum ? formatPlayCount(visitnum) : '',
      },
    }
  },

  async filterListDetailNew(rawList) {
    const qualityInfoRequest = getBatchMusicQualityInfo(rawList)
    let qualityInfoMap = {}

    try {
      qualityInfoMap = await qualityInfoRequest.promise
    } catch (error) {
      console.error('Failed to fetch quality info:', error)
    }

    return rawList.map((item) => {
      const { types = [], _types = {} } = qualityInfoMap[item.id] || {}

      return {
        singer: formatSingerName(item.singer, 'name'),
        name: item.name,
        albumName: item.album.name,
        albumId: item.album.mid,
        source: 'tx',
        interval: formatPlayTime(item.interval),
        songId: item.id,
        albumMid: item.album.mid,
        strMediaMid: item.file?.media_mid || '',
        songmid: item.mid,
        img:
          item.album.name === '' || item.album.name === '空'
            ? item.singer?.length
              ? `https://y.gtimg.cn/music/photo_new/T001R500x500M000${item.singer[0].mid}.jpg`
              : ''
            : `https://y.gtimg.cn/music/photo_new/T002R500x500M000${item.album.mid}.jpg`,
        lrc: null,
        otherSource: null,
        types,
        _types,
        typeUrl: {},
        vid: item.mv?.vid || '',
      }
    })
  },

  // 获取歌曲列表内的音乐
  async getListDetail(id, tryNum = 0) {
    log.info(`[TX SongList] getListDetail 开始`, { id, tryNum })
    
    if (tryNum > 2) {
      log.error(`[TX SongList] getListDetail 重试次数超限`, { id, tryNum })
      return Promise.reject(new Error('try max num'))
    }

    id = await this.getListId(id)
    log.info(`[TX SongList] getListDetail 获取到真实ID`, { id })

    // 特殊处理：猜你喜欢（id: 99）
    if (id === '99') {
      log.info(`[TX SongList] getListDetail 检测到猜你喜欢，使用特殊接口`)
      try {
        // 直接调用原始API获取tracks
        const cookie = settingState.setting['common.tx_cookie']
        const payload = {
          comm: { cv: 1602, ct: 20 },
          req_0: {
            module: 'music.radioProxy.MbTrackRadioSvr',
            method: 'get_radio_track',
            param: { id: 99, num: 5, from: 0, scene: 0, song_ids: [] },
          },
        }
        const url = `https://u.y.qq.com/cgi-bin/musicu.fcg?loginUin=0&hostUin=0&format=json&inCharset=utf-8&outCharset=utf-8&notice=0&platform=wk_v15.json&needNewCode=0&data=${encodeURIComponent(JSON.stringify(payload))}`
        
        const { body } = await httpFetch(url, {
          headers: {
            'Cookie': cookie || '',
          },
        }).promise
        
        const tracks = body?.req_0?.data?.tracks || []
        log.info(`[TX SongList] getListDetail 猜你喜欢获取到tracks`, { count: tracks.length })
        
        if (tracks.length === 0) {
          throw new Error('猜你喜欢返回歌曲列表为空')
        }
        
        // 使用与 filterListDetailNew 相同的格式
        const list = await this.filterListDetailNew(tracks)
        log.info(`[TX SongList] getListDetail 猜你喜欢格式化完成`, { songCount: list.length })
        
        return {
          list,
          page: 1,
          limit: list.length + 1,
          total: list.length,
          source: 'tx',
          info: {
            name: '猜你喜欢',
            img: 'https://y.gtimg.cn/mediastyle/y/img/cover_qzone_130.jpg',
            desc: '根据你的喜好推荐的歌曲',
            author: '',
            play_count: '',
          },
        }
      } catch (error) {
        log.error(`[TX SongList] getListDetail 猜你喜欢获取失败`, { error: error.message })
        throw error
      }
    }

    // 使用 musicu.fcg 接口
    log.info(`[TX SongList] getListDetail 使用 musicu.fcg 接口`)
    try {
      const result = await this.getListDetailNew(id)
      log.info(`[TX SongList] getListDetail 获取成功`, { songCount: result.list.length })
      return result
    } catch (error) {
      log.error(`[TX SongList] getListDetail 获取失败`, { error: error.message })
      return this.getListDetail(id, ++tryNum)
    }
  },
  async filterListDetail(rawList) {
    const qualityInfoRequest = getBatchMusicQualityInfo(rawList)
    let qualityInfoMap = {}

    try {
      qualityInfoMap = await qualityInfoRequest.promise
    } catch (error) {
      console.error('Failed to fetch quality info:', error)
    }

    return rawList.map((item) => {
      const { types = [], _types = {} } = qualityInfoMap[item.id] || {}

      return {
        singer: formatSingerName(item.singer, 'name'),
        name: item.title,
        albumName: item.album.name,
        albumId: item.album.mid,
        source: 'tx',
        interval: formatPlayTime(item.interval),
        songId: item.id,
        albumMid: item.album.mid,
        strMediaMid: item.file.media_mid,
        songmid: item.mid,
        img:
          item.album.name === '' || item.album.name === '空'
            ? item.singer?.length
              ? `https://y.gtimg.cn/music/photo_new/T001R500x500M000${item.singer[0].mid}.jpg`
              : ''
            : `https://y.gtimg.cn/music/photo_new/T002R500x500M000${item.album.mid}.jpg`,
        lrc: null,
        otherSource: null,
        types,
        _types,
        typeUrl: {},
        vid: item.mv?.vid || '',
      }
    })
  },
  getTags() {
    return Promise.all([this.getTag(), this.getHotTag()]).then(([tags, hotTag]) => ({
      tags,
      hotTag,
      source: 'tx',
    }))
  },

  async getDetailPageUrl(id) {
    id = await this.getListId(id)

    return `https://y.qq.com/n/ryqq/playlist/${id}`
  },

  search(text, page, limit = 20, retryNum = 0) {
    if (retryNum > 5) throw new Error('max retry')
    return httpFetch(
      `http://c.y.qq.com/soso/fcgi-bin/client_music_search_songlist?page_no=${
        page - 1
      }&num_per_page=${limit}&format=json&query=${encodeURIComponent(
        text
      )}&remoteplace=txt.yqq.playlist&inCharset=utf8&outCharset=utf-8`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; MSIE 9.0; Windows NT 6.1; WOW64; Trident/5.0)',
          Referer: 'http://y.qq.com/portal/search.html',
        },
      }
    ).promise.then(({ body }) => {
      if (body.code != 0) return this.search(text, page, limit, ++retryNum)
      // console.log(body.data.list)
      return {
        list: body.data.list.map((item) => {
          return {
            play_count: formatPlayCount(item.listennum),
            id: String(item.dissid),
            author: decodeName(item.creator.name),
            name: decodeName(item.dissname),
            time: dateFormat(item.createtime, 'Y-M-D'),
            img: item.imgurl,
            // grade: item.favorcnt / 10,
            total: item.song_count,
            desc: decodeName(decodeName(item.introduction)).replace(/<br>/g, '\n'),
            source: 'tx',
          }
        }),
        limit,
        total: body.data.sum,
        source: 'tx',
      }
    })
  },
}
