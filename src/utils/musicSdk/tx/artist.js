import { httpFetch } from '../../request'
import { formatPlayTime, sizeFormate } from '../../index'
import { formatSingerName } from '../utils'
import { signRequest } from './utils'
import { txLog } from '@/utils/txLog'
import settingState from '@/store/setting/state'

function getUinFromCookie() {
  const cookie = settingState.setting['common.tx_cookie'] || ''
  txLog.info('=== getUinFromCookie ===', { hasCookie: !!cookie, cookieLength: cookie.length, cookiePreview: cookie.slice(0, 100) })
  
  if (!cookie) return '0'
  
  // 尝试从Cookie中提取uin（QQ音乐通常需要 o 前缀）
  const uinMatch = cookie.match(/uin=o?(\d+)/)
  if (uinMatch) {
    const uin = 'o' + uinMatch[1]
    txLog.info('=== getUinFromCookie 提取到uin ===', { uin })
    return uin
  }
  
  const wxuinMatch = cookie.match(/wxuin=(\d+)/)
  if (wxuinMatch) {
    const uin = 'o' + wxuinMatch[1]
    txLog.info('=== getUinFromCookie 提取到wxuin ===', { uin })
    return uin
  }
  
  const pUinMatch = cookie.match(/p_uin=o?(\d+)/)
  if (pUinMatch) {
    const uin = 'o' + pUinMatch[1]
    txLog.info('=== getUinFromCookie 提取到p_uin ===', { uin })
    return uin
  }
  
  txLog.warn('=== getUinFromCookie 未提取到uin ===', {})
  return '0'
}

const artistApi = {
  successCode: 0,

  async getDetail(artistMid, retryNum = 0) {
    if (!artistMid || artistMid === 'undefined' || artistMid === '') {
      txLog.error('=== txApi.getDetail 参数为空 ===', { artistMid, retryNum })
      return Promise.reject(new Error('歌手ID为空'))
    }
    
    if (retryNum > 2) {
      txLog.error('=== txApi.getDetail 重试次数超限 ===', { artistMid, retryNum })
      return Promise.reject(new Error('获取歌手详情失败'))
    }

    const uin = getUinFromCookie()
    txLog.info('=== txApi.getDetail 开始 ===', { artistMid, retryNum, uin })

    const requestData = {
      comm: {
        ct: '11',
        cv: '14090508',
        v: '14090508',
        tmeAppID: 'qqmusic',
        phonetype: 'EBG-AN10',
        deviceScore: '553.47',
        devicelevel: '50',
        newdevicelevel: '20',
        rom: 'HuaWei/EMOTION/EmotionUI_14.2.0',
        os_ver: '12',
        OpenUDID: '0',
        OpenUDID2: '0',
        QIMEI36: '0',
        udid: '0',
        chid: '0',
        aid: '0',
        oaid: '0',
        taid: '0',
        tid: '0',
        wid: '0',
        uid: '0',
        sid: '0',
        modeSwitch: '6',
        teenMode: '0',
        ui_mode: '2',
        nettype: '1020',
        v4ip: '',
      },
      req: {
        module: 'music.UnifiedHomepage.UnifiedHomepageSrv',
        method: 'GetHomepageHeader',
        param: {
          SingerMid: artistMid,
        },
      },
    }

    txLog.info('=== txApi.getDetail 请求参数 ===', {
      artistMid,
      module: requestData.req.module,
      method: requestData.req.method,
      uid: requestData.comm.uid,
    })

    const request = signRequest(requestData)

    try {
      const { body } = await request

      txLog.info('=== txApi.getDetail 原始响应 ===', {
        artistMid,
        bodyCode: body?.code,
        reqCode: body?.req?.code,
        reqSubcode: body?.req?.subcode,
        bodyPreview: JSON.stringify(body).slice(0, 200),
      })

      txLog.info('=== txApi.getDetail 响应分析 ===', {
        artistMid,
        bodyCode: body?.code,
        reqCode: body?.req?.code,
        hasBody: !!body,
        hasReq: !!body?.req,
        reqKeys: body?.req ? Object.keys(body.req) : [],
        dataKeys: body?.req?.data ? Object.keys(body.req.data) : [],
        fullResponseSlice: JSON.stringify(body).slice(0, 500),
      })

      if (!body || !body.req || body.code != this.successCode || body.req.code != this.successCode) {
        txLog.warn('=== txApi.getDetail 获取失败，准备重试 ===', {
          artistMid,
          bodyCode: body?.code,
          reqCode: body?.req?.code,
          retryNum: retryNum + 1,
        })
        return this.getDetail(artistMid, ++retryNum)
      }

      const data = body.req.data
      txLog.info('=== txApi.getDetail 获取成功 ===', {
        artistMid,
        dataKeys: data ? Object.keys(data) : [],
        hasInfo: !!data?.Info,
        hasBaseInfo: !!data?.Info?.BaseInfo,
        baseInfoKeys: data?.Info?.BaseInfo ? Object.keys(data.Info.BaseInfo) : [],
      })

      const baseInfo = data.Info?.BaseInfo || {}
      const singerInfo = data.singer || {}
      
      const artistName = baseInfo.Name || singerInfo.name || data.singer_name || ''
      const artistPicUrl = baseInfo.Avatar || singerInfo.pic || data.singer_pic || ''
      let artistDesc = baseInfo.Desc || data.singer_desc || ''
      
      if (!artistDesc) {
        artistDesc = await this.getSingerDesc(artistMid).catch(() => '')
      }
      
      let formattedPicUrl = ''
      if (artistPicUrl) {
        if (artistPicUrl.startsWith('http')) {
          formattedPicUrl = artistPicUrl
        } else if (artistPicUrl.startsWith('/')) {
          formattedPicUrl = 'https://y.gtimg.cn' + artistPicUrl
        } else if (artistPicUrl.match(/^[A-Za-z0-9]+$/)) {
          formattedPicUrl = `https://y.gtimg.cn/music/photo_new/T001R500x500M000${artistPicUrl}.jpg`
        } else {
          formattedPicUrl = artistPicUrl
        }
      }

      txLog.info('=== txApi.getDetail 解析结果 ===', {
        artistMid,
        artistName,
        artistPicUrl: formattedPicUrl,
        artistDesc: artistDesc.slice(0, 50),
        albumSize: data.album_num || baseInfo.AlbumCount || 0,
        songNum: data.song_num || baseInfo.SongCount || 0,
      })

      return {
        artist: {
          id: baseInfo.EncryptedUin || singerInfo.id || data.singer_id || artistMid,
          mid: singerInfo.mid || data.singer_mid || artistMid,
          name: artistName,
          picUrl: formattedPicUrl,
          alias: data.singer_alias ? data.singer_alias.split('|') : [],
          albumSize: data.album_num || baseInfo.AlbumCount || 0,
          songNum: data.song_num || baseInfo.SongCount || 0,
          briefDesc: artistDesc,
          source: 'tx',
        },
      }
    } catch (error) {
      txLog.error('=== txApi.getDetail 出错 ===', {
        artistMid,
        error: error.message,
        stack: error.stack,
        retryNum: retryNum + 1,
      })
      return this.getDetail(artistMid, ++retryNum)
    }
  },

  async getSongs(artistMid, order = 'hot', limit = 100, offset = 0, retryNum = 0) {
    if (!artistMid || artistMid === 'undefined' || artistMid === '') {
      txLog.error('=== txApi.getSongs 参数为空 ===', { artistMid, retryNum })
      return Promise.reject(new Error('歌手ID为空'))
    }
    
    if (retryNum > 2) {
      txLog.error('=== txApi.getSongs 重试次数超限 ===', { artistMid, retryNum })
      return Promise.reject(new Error('获取歌手歌曲失败'))
    }

    const uin = getUinFromCookie()
    txLog.info('=== txApi.getSongs 开始 ===', { artistMid, order, limit, offset, retryNum, uin })

    const requestData = {
      comm: {
        ct: '11',
        cv: '14090508',
        v: '14090508',
        tmeAppID: 'qqmusic',
        phonetype: 'EBG-AN10',
        deviceScore: '553.47',
        devicelevel: '50',
        newdevicelevel: '20',
        rom: 'HuaWei/EMOTION/EmotionUI_14.2.0',
        os_ver: '12',
        OpenUDID: '0',
        OpenUDID2: '0',
        QIMEI36: '0',
        udid: '0',
        chid: '0',
        aid: '0',
        oaid: '0',
        taid: '0',
        tid: '0',
        wid: '0',
        uid: '0',
        sid: '0',
        modeSwitch: '6',
        teenMode: '0',
        ui_mode: '2',
        nettype: '1020',
        v4ip: '',
      },
      req: {
        module: 'musichall.song_list_server',
        method: 'GetSingerSongList',
        param: {
          singerMid: artistMid,
          begin: offset,
          num: limit,
          order: order === 'hot' ? 1 : 2,
        },
      },
    }

    txLog.info('=== txApi.getSongs 请求参数 ===', {
      artistMid,
      module: requestData.req.module,
      method: requestData.req.method,
      uid: requestData.comm.uid,
    })

    const request = signRequest(requestData)

    try {
      const { body } = await request

      txLog.info('=== txApi.getSongs 原始响应 ===', {
        artistMid,
        bodyCode: body?.code,
        reqCode: body?.req?.code,
        reqSubcode: body?.req?.subcode,
        bodyPreview: JSON.stringify(body).slice(0, 200),
      })

      txLog.info('=== txApi.getSongs 响应分析 ===', {
        artistMid,
        bodyCode: body?.code,
        reqCode: body?.req?.code,
        hasBody: !!body,
        hasReq: !!body?.req,
        reqKeys: body?.req ? Object.keys(body.req) : [],
        dataKeys: body?.req?.data ? Object.keys(body.req.data) : [],
        fullResponseSlice: JSON.stringify(body).slice(0, 500),
      })

      if (!body || !body.req || body.code != this.successCode || body.req.code != this.successCode) {
        txLog.warn('=== txApi.getSongs 获取失败，准备重试 ===', {
          artistMid,
          bodyCode: body?.code,
          reqCode: body?.req?.code,
          retryNum: retryNum + 1,
        })
        return this.getSongs(artistMid, order, limit, offset, ++retryNum)
      }

      const data = body.req.data
      const list = this.handleSongResult(data.songList || data.list || [])
      const total = data.totalNum || data.total_num || 0

      txLog.info('=== txApi.getSongs 获取成功 ===', {
        artistMid,
        songCount: list.length,
        total,
        hasMore: offset + limit < total,
      })

      return {
        list,
        total,
        hasMore: offset + limit < total,
      }
    } catch (error) {
      txLog.error('=== txApi.getSongs 出错 ===', {
        artistMid,
        error: error.message,
        stack: error.stack,
        retryNum: retryNum + 1,
      })
      return this.getSongs(artistMid, order, limit, offset, ++retryNum)
    }
  },

  async getAlbums(artistMid, limit = 100, offset = 0, retryNum = 0) {
    if (!artistMid || artistMid === 'undefined' || artistMid === '') {
      txLog.error('=== txApi.getAlbums 参数为空 ===', { artistMid, retryNum })
      return Promise.reject(new Error('歌手ID为空'))
    }
    
    if (retryNum > 2) {
      txLog.error('=== txApi.getAlbums 重试次数超限 ===', { artistMid, retryNum })
      return Promise.reject(new Error('获取歌手专辑失败'))
    }

    const uin = getUinFromCookie()
    txLog.info('=== txApi.getAlbums 开始 ===', { artistMid, limit, offset, retryNum, uin })

    const requestData = {
      comm: {
        ct: '11',
        cv: '14090508',
        v: '14090508',
        tmeAppID: 'qqmusic',
        phonetype: 'EBG-AN10',
        deviceScore: '553.47',
        devicelevel: '50',
        newdevicelevel: '20',
        rom: 'HuaWei/EMOTION/EmotionUI_14.2.0',
        os_ver: '12',
        OpenUDID: '0',
        OpenUDID2: '0',
        QIMEI36: '0',
        udid: '0',
        chid: '0',
        aid: '0',
        oaid: '0',
        taid: '0',
        tid: '0',
        wid: '0',
        uid: '0',
        sid: '0',
        modeSwitch: '6',
        teenMode: '0',
        ui_mode: '2',
        nettype: '1020',
        v4ip: '',
      },
      req: {
        module: 'music.musichallAlbum.AlbumListServer',
        method: 'GetAlbumList',
        param: {
          singerMid: artistMid,
          begin: offset,
          num: limit,
        },
      },
    }

    txLog.info('=== txApi.getAlbums 请求参数 ===', {
      artistMid,
      module: requestData.req.module,
      method: requestData.req.method,
      uid: requestData.comm.uid,
    })

    const request = signRequest(requestData)

    try {
      const { body } = await request

      txLog.info('=== txApi.getAlbums 原始响应 ===', {
        artistMid,
        bodyCode: body?.code,
        reqCode: body?.req?.code,
        reqSubcode: body?.req?.subcode,
        bodyPreview: JSON.stringify(body).slice(0, 200),
      })

      txLog.info('=== txApi.getAlbums 响应分析 ===', {
        artistMid,
        bodyCode: body?.code,
        reqCode: body?.req?.code,
        hasBody: !!body,
        hasReq: !!body?.req,
        reqKeys: body?.req ? Object.keys(body.req) : [],
        dataKeys: body?.req?.data ? Object.keys(body.req.data) : [],
        fullResponseSlice: JSON.stringify(body).slice(0, 500),
      })

      if (!body || !body.req || body.code != this.successCode || body.req.code != this.successCode) {
        txLog.warn('=== txApi.getAlbums 获取失败，准备重试 ===', {
          artistMid,
          bodyCode: body?.code,
          reqCode: body?.req?.code,
          retryNum: retryNum + 1,
        })
        return this.getAlbums(artistMid, limit, offset, ++retryNum)
      }

      const data = body.req.data
      // 修复：API返回的是 albumList，不是 list
      const albumList = data.albumList || data.list || []
      let hotAlbums = this.handleAlbumResult(albumList)
      // 修复：API返回的是 total，不是 totalNum 或 total_num
      const total = data.total || data.totalNum || data.total_num || albumList.length

      // 获取每个专辑的真实歌曲数量
      if (hotAlbums.length > 0) {
        const sizeResults = await Promise.all(
          hotAlbums.map(item => this.getAlbumSongCount(item.mid).catch(() => item.size || 0))
        )
        hotAlbums = hotAlbums.map((item, index) => ({
          ...item,
          size: sizeResults[index] || item.size || 0,
        }))
      }

      txLog.info('=== txApi.getAlbums 获取成功 ===', {
        artistMid,
        albumCount: hotAlbums.length,
        total,
        hasMore: offset + limit < total,
        rawAlbumCount: albumList.length,
        songCounts: hotAlbums.slice(0, 5).map(a => ({ name: a.name, size: a.size })),
      })

      return {
        hotAlbums,
        hasMore: offset + limit < total,
      }
    } catch (error) {
      txLog.error('=== txApi.getAlbums 出错 ===', {
        artistMid,
        error: error.message,
        stack: error.stack,
        retryNum: retryNum + 1,
      })
      return this.getAlbums(artistMid, limit, offset, ++retryNum)
    }
  },

  handleSongResult(rawList) {
    if (!rawList || !Array.isArray(rawList)) return []

    const list = []
    rawList.forEach((item) => {
      const songInfo = item.songInfo || item
      
      if (!songInfo.file?.media_mid) {
        txLog.info('=== handleSongResult 跳过无media_mid的歌曲 ===', {
          title: songInfo.title,
          hasFile: !!songInfo.file,
          mediaMid: songInfo.file?.media_mid,
        })
        return
      }

      let types = []
      let _types = {}
      const file = songInfo.file
      if (file.size_128mp3 != 0) {
        let size = sizeFormate(file.size_128mp3)
        types.push({ type: '128k', size })
        _types['128k'] = { size }
      }
      if (file.size_320mp3 !== 0) {
        let size = sizeFormate(file.size_320mp3)
        types.push({ type: '320k', size })
        _types['320k'] = { size }
      }
      if (file.size_flac !== 0) {
        let size = sizeFormate(file.size_flac)
        types.push({ type: 'flac', size })
        _types.flac = { size }
      }
      if (file.size_hires !== 0) {
        let size = sizeFormate(file.size_hires)
        types.push({ type: 'hires', size })
        _types.hires = { size }
      }
      if (file.size_new?.[1] !== 0) {
        let size = sizeFormate(file.size_new[1])
        types.push({ type: 'atmos', size })
        _types.atmos = { size }
      }
      if (file.size_new?.[2] !== 0) {
        let size = sizeFormate(file.size_new[2])
        types.push({ type: 'atmos_plus', size })
        _types.atmos_plus = { size }
      }
      if (file.size_new?.[0] !== 0) {
        let size = sizeFormate(file.size_new[0])
        types.push({ type: 'master', size })
        _types.master = { size }
      }

      let albumId = ''
      let albumName = ''
      if (songInfo.album) {
        albumName = songInfo.album.name
        albumId = songInfo.album.mid
      }

      const processedSongmid = songInfo.mid || songInfo.id
      const processedMeta = {
        songId: songInfo.id,
        id: songInfo.id,
        mid: songInfo.mid,
        songmid: processedSongmid,
        strMediaMid: songInfo.file.media_mid,
        albumName,
        albumId,
        albumMid: songInfo.album?.mid ?? '',
        vid: songInfo.mv?.vid || '',
        picUrl: albumId === '' || albumId === '空'
          ? songInfo.singer?.length
            ? `https://y.gtimg.cn/music/photo_new/T001R500x500M000${songInfo.singer[0]?.mid}.jpg`
            : ''
          : `https://y.gtimg.cn/music/photo_new/T002R500x500M000${albumId}.jpg`,
        qualitys: types,
        _qualitys: _types,
      }

      txLog.info('=== handleSongResult 处理歌曲 ===', {
        title: songInfo.title,
        songmid: processedSongmid,
        strMediaMid: songInfo.file.media_mid,
        hasMeta: !!processedMeta,
      })

      list.push({
        id: String(songInfo.id),
        singer: formatSingerName(songInfo.singer, 'name'),
        name: songInfo.title,
        albumName,
        albumId,
        source: 'tx',
        interval: formatPlayTime(songInfo.interval),
        songId: songInfo.id,
        albumMid: songInfo.album?.mid ?? '',
        strMediaMid: songInfo.file.media_mid,
        songmid: processedSongmid,
        img: albumId === '' || albumId === '空'
          ? songInfo.singer?.length
            ? `https://y.gtimg.cn/music/photo_new/T001R500x500M000${songInfo.singer[0]?.mid}.jpg`
            : ''
          : `https://y.gtimg.cn/music/photo_new/T002R500x500M000${albumId}.jpg`,
        types,
        _types,
        typeUrl: {},
        vid: songInfo.mv?.vid || '',
        meta: processedMeta,
      })
    })

    txLog.info('=== handleSongResult 完成 ===', {
      inputCount: rawList.length,
      outputCount: list.length,
    })

    return list
  },

  handleAlbumResult(rawList) {
    if (!rawList || !Array.isArray(rawList)) return []

    return rawList.map((item) => ({
      id: item.albumID || item.id || item.albumMid,
      mid: item.albumMid || item.mid,
      name: item.albumName || item.name,
      picUrl: item.albumMid || item.mid 
        ? `https://y.gtimg.cn/music/photo_new/T002R180x180M000${item.albumMid || item.mid}.jpg` 
        : '',
      artistName: item.singerName || item.singer_name || '',
      artistId: item.singerMid || item.singer_id || '',
      size: item.totalNum || item.song_num || item.songNum || item.total || item.num || 0,
      publishTime: item.publishDate || item.time_public || '',
      source: 'tx',
    }))
  },

  getSingerDesc(artistMid, retryNum = 0) {
    if (retryNum > 2) {
      txLog.warn('=== getSingerDesc 重试次数超限 ===', { artistMid, retryNum })
      return Promise.resolve('')
    }
    txLog.info('=== getSingerDesc 开始 ===', { artistMid, retryNum })
    const request = signRequest({
      comm: {
        ct: '11',
        cv: '14090508',
        v: '14090508',
        tmeAppID: 'qqmusic',
        phonetype: 'EBG-AN10',
        deviceScore: '553.47',
        devicelevel: '50',
        newdevicelevel: '20',
        rom: 'HuaWei/EMOTION/EmotionUI_14.2.0',
        os_ver: '12',
        OpenUDID: '0',
        OpenUDID2: '0',
        QIMEI36: '0',
        udid: '0',
        chid: '0',
        aid: '0',
        oaid: '0',
        taid: '0',
        tid: '0',
        wid: '0',
        uid: '0',
        sid: '0',
        modeSwitch: '6',
        teenMode: '0',
        ui_mode: '2',
        nettype: '1020',
        v4ip: '',
      },
      req: {
        module: 'music.musichallSinger.SingerInfoInter',
        method: 'GetSingerDetail',
        param: {
          singer_mids: [artistMid],
          groups: 1,
          wikis: 1,
        },
      },
    })
    return request.then(({ body }) => {
      const bodyCode = body?.code
      const reqCode = body?.req?.code
      
      if (!body || !body.req || bodyCode != this.successCode || reqCode != this.successCode) {
        txLog.warn('=== getSingerDesc 获取失败 ===', {
          artistMid,
          bodyCode,
          reqCode,
          retryNum: retryNum + 1,
        })
        return this.getSingerDesc(artistMid, ++retryNum)
      }
      const singerList = body.req.data?.singerlist || body.req.data?.singer_list || []
      let desc = ''
      if (singerList.length > 0) {
        const singer = singerList[0]
        desc = singer.wiki_content || singer.wiki || singer.ex_info?.desc || singer.exInfo?.desc || singer.desc || ''
      }
      txLog.info('=== getSingerDesc 获取成功 ===', {
        artistMid,
        desc: desc.slice(0, 50),
        hasSingerList: singerList.length > 0,
      })
      return desc
    }).catch(err => {
      txLog.error('=== getSingerDesc 出错 ===', {
        artistMid,
        error: err.message,
        stack: err.stack,
        retryNum: retryNum + 1,
      })
      return this.getSingerDesc(artistMid, ++retryNum)
    })
  },

  getAlbumSongCount(albumMid, retryNum = 0) {
    if (retryNum > 2) {
      txLog.warn('=== getAlbumSongCount 重试次数超限 ===', { albumMid, retryNum })
      return Promise.resolve(0)
    }
    txLog.info('=== getAlbumSongCount 开始 ===', { albumMid, retryNum })
    const request = signRequest({
      comm: {
        ct: '11',
        cv: '14090508',
        v: '14090508',
        tmeAppID: 'qqmusic',
        phonetype: 'EBG-AN10',
        deviceScore: '553.47',
        devicelevel: '50',
        newdevicelevel: '20',
        rom: 'HuaWei/EMOTION/EmotionUI_14.2.0',
        os_ver: '12',
        OpenUDID: '0',
        OpenUDID2: '0',
        QIMEI36: '0',
        udid: '0',
        chid: '0',
        aid: '0',
        oaid: '0',
        taid: '0',
        tid: '0',
        wid: '0',
        uid: '0',
        sid: '0',
        modeSwitch: '6',
        teenMode: '0',
        ui_mode: '2',
        nettype: '1020',
        v4ip: '',
      },
      req: {
        module: 'music.musichallAlbum.AlbumSongList',
        method: 'GetAlbumSongList',
        param: {
          albumMid,
          begin: 0,
          num: 1,
        },
      },
    })
    return request.then(({ body }) => {
      const bodyCode = body?.code
      const reqCode = body?.req?.code
      
      if (!body || !body.req || bodyCode != this.successCode || reqCode != this.successCode) {
        txLog.warn('=== getAlbumSongCount 获取失败 ===', {
          albumMid,
          bodyCode,
          reqCode,
          retryNum: retryNum + 1,
        })
        
        if (reqCode === 104400 || reqCode === 500003) {
          txLog.warn('=== getAlbumSongCount 需要登录或参数错误，跳过重试 ===', { albumMid, reqCode })
          return 0
        }
        
        return this.getAlbumSongCount(albumMid, ++retryNum)
      }
      const totalNum = body.req.data?.totalNum || body.req.data?.total_num || 0
      txLog.info('=== getAlbumSongCount 获取成功 ===', {
        albumMid,
        totalNum,
        dataKeys: body.req.data ? Object.keys(body.req.data) : [],
      })
      return totalNum
    }).catch(err => {
      txLog.error('=== getAlbumSongCount 出错 ===', {
        albumMid,
        error: err.message,
        stack: err.stack,
        retryNum: retryNum + 1,
      })
      return this.getAlbumSongCount(albumMid, ++retryNum)
    })
  },
}

export const getDetail = (...args) => artistApi.getDetail(...args)
export const getSongs = (...args) => artistApi.getSongs(...args)
export const getAlbums = (...args) => artistApi.getAlbums(...args)

export default artistApi
