import { httpFetch } from '../../request'
import settingState from "@/store/setting/state"
import { log } from '@/utils/log'
import { formatPlayTime, sizeFormate } from '../../index'
import { formatSingerName } from '@/utils/musicSdk/utils'

// 构建comm参数（使用wk_v15.json平台）
const buildComm = () => {
  return {
    cv: 1602,
    ct: 20,
  }
}

// 转换歌曲数据为应用内部格式（新格式，包含meta字段）
const transformSong = (item, index) => {
  try {
    const singer = formatSingerName(item.singer, 'name')
    const albumName = item.album?.name || ''
    const albumMid = item.album?.mid || ''
    
    let img = ''
    if (albumName && albumName !== '空') {
      img = `https://y.gtimg.cn/music/photo_new/T002R500x500M000${albumMid}.jpg`
    } else if (item.singer?.length) {
      img = `https://y.gtimg.cn/music/photo_new/T001R500x500M000${item.singer[0].mid}.jpg`
    }
    
    // 构建音质信息（默认假设128k可用，实际播放时会通过API获取）
    const qualitys = [{ type: '128k', size: null }]
    const _qualitys = { '128k': { size: null } }
    
    // 如果有文件信息，尝试解析音质
    const file = item.file
    if (file) {
      if (file.size_128mp3 !== 0) {
        qualitys[0] = { type: '128k', size: sizeFormate(file.size_128mp3) }
        _qualitys['128k'] = { size: sizeFormate(file.size_128mp3) }
      }
      if (file.size_320mp3 !== 0) {
        qualitys.push({ type: '320k', size: sizeFormate(file.size_320mp3) })
        _qualitys['320k'] = { size: sizeFormate(file.size_320mp3) }
      }
      if (file.size_flac !== 0) {
        qualitys.push({ type: 'flac', size: sizeFormate(file.size_flac) })
        _qualitys.flac = { size: sizeFormate(file.size_flac) }
      }
    }
    
    const song = {
      id: 'tx_' + item.mid,
      name: item.title || item.name || '',
      singer,
      source: 'tx',
      interval: item.interval != null ? formatPlayTime(item.interval) : '',
      meta: {
        songId: item.mid,
        albumName,
        albumId: albumMid,
        picUrl: img,
        qualitys,
        _qualitys,
        strMediaMid: file?.media_mid || '',
        id: item.id,
        albumMid,
        vid: item.mv?.vid || '',
      },
    }
    
    log.info(`[TX DailyRec] transformSong[${index}] 转换完成`, { name: song.name, singer: song.singer, songmid: song.meta.songId })
    return song
  } catch (error) {
    log.error(`[TX DailyRec] transformSong[${index}] 转换失败`, error.message, JSON.stringify(item).substring(0, 200))
    return null
  }
}

// 转换歌曲列表
const transformSongList = (rawList, sourceName = 'unknown') => {
  log.info(`[TX DailyRec] transformSongList 开始转换 ${sourceName}`, { rawListLength: rawList?.length || 0 })
  
  if (!rawList || !Array.isArray(rawList)) {
    log.warn('[TX DailyRec] transformSongList rawList无效', { type: typeof rawList, isArray: Array.isArray(rawList) })
    return []
  }
  
  if (rawList.length === 0) {
    log.warn(`[TX DailyRec] transformSongList ${sourceName} 原始列表为空`)
    return []
  }
  
  // 打印第一个元素的结构用于调试
  if (rawList.length > 0) {
    const firstItem = rawList[0]
    log.info(`[TX DailyRec] transformSongList ${sourceName} 第一个元素结构:`, {
      keys: Object.keys(firstItem || {}),
      hasSinger: !!firstItem?.singer,
      hasAlbum: !!firstItem?.album,
      name: firstItem?.name || firstItem?.title || 'unknown',
      singerType: Array.isArray(firstItem?.singer) ? 'array' : typeof firstItem?.singer,
    })
  }
  
  const result = rawList
    .map((item, index) => transformSong(item, index))
    .filter(Boolean)
  
  log.info(`[TX DailyRec] transformSongList ${sourceName} 转换完成`, { 
    inputLength: rawList.length, 
    outputLength: result.length 
  })
  
  return result
}

export default {
  _requestObj: null,

  async getHomeFeed(page = 1, direction = 0, sNum = 0, vCache = [], retryNum = 0) {
    if (retryNum > 2) return Promise.reject(new Error('try max num'))

    try {
      log.info('[TX DailyRec] getHomeFeed 开始请求', { page, direction, sNum })
      
      const payload = {
        comm: buildComm(),
        req_0: {
          module: 'music.recommend.RecommendFeed',
          method: 'get_recommend_feed',
          param: {
            direction,
            page,
            s_num: sNum,
            v_cache: vCache,
          },
        },
      }

      const url = `https://u.y.qq.com/cgi-bin/musicu.fcg?loginUin=0&hostUin=0&format=json&inCharset=utf-8&outCharset=utf-8&notice=0&platform=wk_v15.json&needNewCode=0&data=${encodeURIComponent(JSON.stringify(payload))}`

      log.info('[TX DailyRec] getHomeFeed URL:', url.substring(0, 200))
      log.info('[TX DailyRec] getHomeFeed payload:', JSON.stringify(payload))
      
      // 获取Cookie
      const cookie = settingState.setting['common.tx_cookie']
      log.info('[TX DailyRec] getHomeFeed Cookie状态:', cookie ? `已设置 (长度:${cookie.length})` : '未设置')
      
      const { body, statusCode } = await httpFetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://y.qq.com/',
          'Cookie': cookie || '',
        },
      }).promise

      log.info('[TX DailyRec] getHomeFeed 响应状态', { statusCode, bodyCode: body?.code })
      log.info('[TX DailyRec] getHomeFeed 响应体:', JSON.stringify(body)?.substring(0, 500))

      if (statusCode !== 200) {
        throw new Error(`HTTP错误: ${statusCode}`)
      }
      
      if (body.code === 1000) {
        throw new Error('QQ音乐Cookie已过期，请重新获取')
      }

      if (body.code !== 0) {
        throw new Error(`API错误: code=${body.code}`)
      }

      const data = body.req_0?.data
      if (!data) {
        log.error('[TX DailyRec] getHomeFeed 返回数据为空', { body: JSON.stringify(body)?.substring(0, 300) })
        throw new Error('返回数据为空')
      }
      
      log.info('[TX DailyRec] getHomeFeed 解析成功', { dataKeys: Object.keys(data) })
      
      // 解析 v_shelf 中的歌单卡片
      const vShelf = data.v_shelf || []
      const playlists = []
      
      vShelf.forEach((shelf, shelfIndex) => {
        log.info(`[TX DailyRec] getHomeFeed shelf[${shelfIndex}]`, { 
          title_template: shelf.title_template,
          title_content: shelf.title_content,
          nicheCount: shelf.v_niche?.length || 0
        })
        
        const vNiche = shelf.v_niche || []
        vNiche.forEach((niche, nicheIndex) => {
          const vCard = niche.v_card || []
          vCard.forEach((card, cardIndex) => {
            // type: 500 是真正的歌单（每日30首、百万收藏、新歌推荐等）
            // type: 700 是"猜你喜欢"入口，也作为特殊歌单处理
            if (card.type === 500 || card.type === 700) {
              const playlist = {
                id: String(card.id),
                name: card.title,
                cover: card.cover || 'https://y.gtimg.cn/mediastyle/y/img/cover_qzone_130.jpg',
                playCount: card.cnt || 0,
                source: 'tx',
                cardType: card.type, // 保留卡片类型用于区分
              }
              playlists.push(playlist)
              log.info(`[TX DailyRec] getHomeFeed 发现歌单`, { 
                name: playlist.name, 
                id: playlist.id, 
                type: card.type 
              })
            }
          })
        })
      })
      
      log.info('[TX DailyRec] getHomeFeed 解析完成', { playlistsCount: playlists.length })
      return { list: playlists, source: 'tx' }
    } catch (error) {
      log.error(`[TX DailyRec] getHomeFeed 失败:`, error.message, error.stack)
      return this.getHomeFeed(page, direction, sNum, vCache, retryNum + 1)
    }
  },

  async getGuessRecommend(retryNum = 0) {
    if (retryNum > 2) return Promise.reject(new Error('try max num'))

    try {
      log.info('[TX DailyRec] getGuessRecommend 开始请求')
      const cookie = settingState.setting['common.tx_cookie']
      log.info('[TX DailyRec] getGuessRecommend cookie状态:', cookie ? `已设置 (长度:${cookie.length})` : '未设置')
      
      const payload = {
        comm: buildComm(),
        req_0: {
          module: 'music.radioProxy.MbTrackRadioSvr',
          method: 'get_radio_track',
          param: {
            id: 99,
            num: 5,
            from: 0,
            scene: 0,
            song_ids: [],
          },
        },
      }

      const url = `https://u.y.qq.com/cgi-bin/musicu.fcg?loginUin=0&hostUin=0&format=json&inCharset=utf-8&outCharset=utf-8&notice=0&platform=wk_v15.json&needNewCode=0&data=${encodeURIComponent(JSON.stringify(payload))}`

      log.info('[TX DailyRec] getGuessRecommend URL:', url.substring(0, 200))
      log.info('[TX DailyRec] getGuessRecommend payload:', JSON.stringify(payload))
      
      const { body, statusCode } = await httpFetch(url, {
        headers: {
          'Cookie': cookie || '',
        },
      }).promise

      log.info('[TX DailyRec] getGuessRecommend 响应状态', { statusCode, bodyCode: body?.code })
      log.info('[TX DailyRec] getGuessRecommend 响应体:', JSON.stringify(body)?.substring(0, 800))

      if (statusCode !== 200) {
        throw new Error(`HTTP错误: ${statusCode}`)
      }
      
      if (body.code === 1000) {
        throw new Error('QQ音乐Cookie已过期，请重新获取')
      }

      if (body.code !== 0) {
        throw new Error(`API错误: code=${body.code}`)
      }

      const reqData = body.req_0?.data
      log.info('[TX DailyRec] getGuessRecommend req_0.data状态', { 
        exists: !!reqData, 
        hasTracks: !!reqData?.tracks,
        tracksLength: reqData?.tracks?.length || 0,
        dataKeys: Object.keys(reqData || {})
      })
      
      const tracks = reqData?.tracks || []
      log.info('[TX DailyRec] getGuessRecommend tracks数量:', tracks.length)
      
      if (tracks.length === 0) {
        log.warn('[TX DailyRec] getGuessRecommend tracks为空，尝试其他字段...')
        // 尝试其他可能的字段
        const altTracks = reqData?.songlist || reqData?.songs || reqData?.list || []
        log.info('[TX DailyRec] getGuessRecommend 备选字段tracks数量:', altTracks.length)
        if (altTracks.length > 0) {
          const list = transformSongList(altTracks, 'getGuessRecommend-alt')
          return { list, source: 'tx' }
        }
        throw new Error('返回歌曲列表为空')
      }
      
      const list = transformSongList(tracks, 'getGuessRecommend')
      log.info('[TX DailyRec] getGuessRecommend 转换完成', { listLength: list.length })
      return { list, source: 'tx' }
    } catch (error) {
      log.error(`[TX DailyRec] getGuessRecommend 失败:`, error.message, error.stack)
      return this.getGuessRecommend(retryNum + 1)
    }
  },

  async getRadarRecommend(page = 1, retryNum = 0) {
    if (retryNum > 2) return Promise.reject(new Error('try max num'))

    try {
      log.info('[TX DailyRec] getRadarRecommend 开始请求', { page })
      
      const payload = {
        comm: buildComm(),
        req_0: {
          module: 'music.recommend.TrackRelationServer',
          method: 'GetRadarSong',
          param: {
            Page: page,
            ReqType: 0,
            FavSongs: [],
            EntranceSongs: [],
          },
        },
      }

      const url = `https://u.y.qq.com/cgi-bin/musicu.fcg?loginUin=0&hostUin=0&format=json&inCharset=utf-8&outCharset=utf-8&notice=0&platform=wk_v15.json&needNewCode=0&data=${encodeURIComponent(JSON.stringify(payload))}`

      log.info('[TX DailyRec] getRadarRecommend URL:', url.substring(0, 200))
      
      const { body, statusCode } = await httpFetch(url).promise

      log.info('[TX DailyRec] getRadarRecommend 响应状态', { statusCode, bodyCode: body?.code })
      log.info('[TX DailyRec] getRadarRecommend 响应体:', JSON.stringify(body)?.substring(0, 800))

      if (statusCode !== 200) {
        throw new Error(`HTTP错误: ${statusCode}`)
      }
      
      if (body.code === 1000) {
        throw new Error('QQ音乐Cookie已过期，请重新获取')
      }

      if (body.code !== 0) {
        throw new Error(`API错误: code=${body.code}`)
      }

      const reqData = body.req_0?.data
      log.info('[TX DailyRec] getRadarRecommend req_0.data状态', { 
        exists: !!reqData,
        dataKeys: Object.keys(reqData || {})
      })
      
      // 尝试不同的数据路径
      let songs = []
      if (reqData?.VecSongs?.length) {
        songs = reqData.VecSongs.map(item => item.Track)
        log.info('[TX DailyRec] getRadarRecommend VecSongs数量:', reqData.VecSongs.length)
      } else if (reqData?.songs?.length) {
        songs = reqData.songs
        log.info('[TX DailyRec] getRadarRecommend songs数量:', reqData.songs.length)
      } else if (reqData?.songlist?.length) {
        songs = reqData.songlist
        log.info('[TX DailyRec] getRadarRecommend songlist数量:', reqData.songlist.length)
      }
      
      log.info('[TX DailyRec] getRadarRecommend 解析后songs数量:', songs.length)
      
      if (songs.length === 0) {
        log.warn('[TX DailyRec] getRadarRecommend songs为空')
        throw new Error('返回歌曲列表为空')
      }
      
      const list = transformSongList(songs, 'getRadarRecommend')
      log.info('[TX DailyRec] getRadarRecommend 转换完成', { listLength: list.length })
      return {
        list,
        hasMore: reqData?.HasMore || false,
        recommendSongIds: reqData?.RecommendSongIds || [],
        baseSongIds: reqData?.BaseSongIds || [],
      }
    } catch (error) {
      log.error(`[TX DailyRec] getRadarRecommend 失败:`, error.message, error.stack)
      return this.getRadarRecommend(page, retryNum + 1)
    }
  },

  async getRecommendSonglist(page = 1, num = 25, retryNum = 0) {
    if (retryNum > 2) return Promise.reject(new Error('try max num'))

    try {
      log.info('[TX DailyRec] getRecommendSonglist 开始请求', { page, num })
      
      const payload = {
        comm: buildComm(),
        req_0: {
          module: 'music.playlist.PlaylistSquare',
          method: 'GetRecommendFeed',
          param: {
            From: num * (page - 1),
            Size: num,
          },
        },
      }

      const url = `https://u.y.qq.com/cgi-bin/musicu.fcg?loginUin=0&hostUin=0&format=json&inCharset=utf-8&outCharset=utf-8&notice=0&platform=wk_v15.json&needNewCode=0&data=${encodeURIComponent(JSON.stringify(payload))}`

      log.info('[TX DailyRec] getRecommendSonglist URL:', url.substring(0, 200))
      
      const { body, statusCode } = await httpFetch(url).promise

      log.info('[TX DailyRec] getRecommendSonglist 响应状态', { statusCode, bodyCode: body?.code })
      log.info('[TX DailyRec] getRecommendSonglist 响应体:', JSON.stringify(body)?.substring(0, 1000))

      if (statusCode !== 200) {
        throw new Error(`HTTP错误: ${statusCode}`)
      }
      
      if (body.code === 1000) {
        throw new Error('QQ音乐Cookie已过期，请重新获取')
      }

      if (body.code !== 0) {
        throw new Error(`API错误: code=${body.code}`)
      }

      const data = body.req_0?.data || {}
      log.info('[TX DailyRec] getRecommendSonglist data状态', { 
        exists: !!data,
        dataKeys: Object.keys(data)
      })
      
      // 尝试解析新的数据格式
      let songlists = []
      
      // 格式1: 新版格式
      if (data.List?.length) {
        log.info('[TX DailyRec] getRecommendSonglist 使用格式1 (List)')
        songlists = data.List.map((item, index) => {
          try {
            const playlist = item.Playlist || item
            const basic = playlist.basic || playlist
            return {
              id: basic.id || basic.tid,
              title: basic.title || basic.name || '',
              picurl: basic.cover?.default_url || basic.cover?.url || '',
              songnum: basic.song_cnt || 0,
              listennum: basic.play_cnt || 0,
              creator_nick: basic.creator?.nick || '',
              desc: '',
              time: '',
              source: 'tx',
            }
          } catch (e) {
            log.error(`[TX DailyRec] getRecommendSonglist List[${index}] 解析失败`, e.message)
            return null
          }
        }).filter(Boolean)
      }
      
      // 格式2: 旧版格式
      if (!songlists.length && data.v_playlist?.length) {
        log.info('[TX DailyRec] getRecommendSonglist 使用格式2 (v_playlist)')
        songlists = data.v_playlist.map(item => ({
          id: String(item.tid),
          title: item.title || item.name || '',
          picurl: item.cover_url_medium || item.coverUrl || '',
          songnum: item.song_cnt || 0,
          listennum: item.access_num || 0,
          creator_nick: item.creator_info?.nick || '',
          desc: '',
          time: '',
          source: 'tx',
        }))
      }

      log.info('[TX DailyRec] getRecommendSonglist 解析完成', { songlistsLength: songlists.length })
      if (songlists.length > 0) {
        log.info('[TX DailyRec] getRecommendSonglist 第一个歌单:', JSON.stringify(songlists[0]))
      }
      return {
        songlists,
        hasMore: data.HasMore || false,
        fromLimit: data.FromLimit || 0,
        msg: data.Msg || '',
      }
    } catch (error) {
      log.error(`[TX DailyRec] getRecommendSonglist 失败:`, error.message, error.stack)
      return this.getRecommendSonglist(page, num, retryNum + 1)
    }
  },

  async getRecommendNewsong(retryNum = 0) {
    if (retryNum > 2) return Promise.reject(new Error('try max num'))

    try {
      log.info('[TX DailyRec] getRecommendNewsong 开始请求')
      
      const payload = {
        comm: buildComm(),
        req_0: {
          module: 'newsong.NewSongServer',
          method: 'get_new_song_info',
          param: { type: 5 },
        },
      }

      const url = `https://u.y.qq.com/cgi-bin/musicu.fcg?loginUin=0&hostUin=0&format=json&inCharset=utf-8&outCharset=utf-8&notice=0&platform=wk_v15.json&needNewCode=0&data=${encodeURIComponent(JSON.stringify(payload))}`

      log.info('[TX DailyRec] getRecommendNewsong URL:', url.substring(0, 200))
      
      const { body, statusCode } = await httpFetch(url).promise

      log.info('[TX DailyRec] getRecommendNewsong 响应状态', { statusCode, bodyCode: body?.code })
      log.info('[TX DailyRec] getRecommendNewsong 响应体:', JSON.stringify(body)?.substring(0, 1000))

      if (statusCode !== 200) {
        throw new Error(`HTTP错误: ${statusCode}`)
      }
      
      if (body.code === 1000) {
        throw new Error('QQ音乐Cookie已过期，请重新获取')
      }

      if (body.code !== 0) {
        throw new Error(`API错误: code=${body.code}`)
      }

      const reqData = body.req_0?.data
      log.info('[TX DailyRec] getRecommendNewsong req_0.data状态', { 
        exists: !!reqData,
        dataKeys: Object.keys(reqData || {})
      })
      
      // 尝试不同的数据路径
      let songlist = reqData?.songlist || []
      if (!songlist.length && reqData?.songs?.length) {
        songlist = reqData.songs
        log.info('[TX DailyRec] getRecommendNewsong 使用songs字段')
      }
      
      log.info('[TX DailyRec] getRecommendNewsong songlist数量:', songlist.length)
      
      if (songlist.length === 0) {
        log.warn('[TX DailyRec] getRecommendNewsong songlist为空')
        throw new Error('返回歌曲列表为空')
      }
      
      // 打印第一个元素的结构
      log.info('[TX DailyRec] getRecommendNewsong 第一个元素:', JSON.stringify(songlist[0])?.substring(0, 300))
      
      const list = transformSongList(songlist, 'getRecommendNewsong')
      log.info('[TX DailyRec] getRecommendNewsong 转换完成', { listLength: list.length })
      return {
        list,
        lan: reqData?.lan || '',
        retMsg: reqData?.ret_msg || '',
        type: reqData?.type || 0,
        lanlist: reqData?.lanlist || [],
        songTags: reqData?.songTagInfoList || [],
      }
    } catch (error) {
      log.error(`[TX DailyRec] getRecommendNewsong 失败:`, error.message, error.stack)
      return this.getRecommendNewsong(retryNum + 1)
    }
  },

  async getSimilarSongs(songMid, limit = 30, retryNum = 0) {
    if (retryNum > 2) return Promise.reject(new Error('try max num'))

    try {
      log.info('[TX DailyRec] getSimilarSongs 开始请求', { songMid, limit })
      
      const cookie = settingState.setting['common.tx_cookie']
      log.info('[TX DailyRec] getSimilarSongs cookie状态:', cookie ? `已设置 (长度:${cookie.length})` : '未设置')
      
      const payload = {
        comm: buildComm(),
        req_0: {
          module: 'music.recommend.TrackRelationServer',
          method: 'GetSimilarSongs',
          param: {
            songid: parseInt(songMid, 10) || songMid,
          },
        },
      }

      const url = `https://u.y.qq.com/cgi-bin/musicu.fcg?loginUin=0&hostUin=0&format=json&inCharset=utf-8&outCharset=utf-8&notice=0&platform=wk_v15.json&needNewCode=0&data=${encodeURIComponent(JSON.stringify(payload))}`

      log.info('[TX DailyRec] getSimilarSongs URL:', url.substring(0, 200))
      
      const { body, statusCode } = await httpFetch(url, {
        headers: {
          'Cookie': cookie || '',
        },
      }).promise

      log.info('[TX DailyRec] getSimilarSongs 响应状态', { statusCode, bodyCode: body?.code })
      log.info('[TX DailyRec] getSimilarSongs 响应体:', JSON.stringify(body)?.substring(0, 1000))

      if (statusCode !== 200) {
        throw new Error(`HTTP错误: ${statusCode}`)
      }
      
      if (body.code === 1000) {
        throw new Error('QQ音乐Cookie已过期，请重新获取')
      }

      if (body.code !== 0) {
        throw new Error(`API错误: code=${body.code}`)
      }

      const reqData = body.req_0?.data
      log.info('[TX DailyRec] getSimilarSongs req_0.data状态', { 
        exists: !!reqData,
        dataKeys: Object.keys(reqData || {})
      })
      
      // 尝试不同的数据路径
      let songlist = reqData?.songlist || []
      if (!songlist.length && reqData?.songs?.length) {
        songlist = reqData.songs
        log.info('[TX DailyRec] getSimilarSongs 使用songs字段')
      }
      
      // QQ音乐API返回的是嵌套结构: data.song[].song[]
      if (!songlist.length && reqData?.song?.length) {
        songlist = reqData.song.flatMap(item => item.song || [])
        log.info('[TX DailyRec] getSimilarSongs 使用嵌套song字段')
      }
      
      // QQ音乐GetSimilarSongs API返回的是 vecSong[].track 结构
      if (!songlist.length && reqData?.vecSong?.length) {
        songlist = reqData.vecSong.map(item => item.track || item)
        log.info('[TX DailyRec] getSimilarSongs 使用vecSong字段')
      }
      
      log.info('[TX DailyRec] getSimilarSongs songlist数量:', songlist.length)
      
      if (songlist.length === 0) {
        log.warn('[TX DailyRec] getSimilarSongs songlist为空')
        throw new Error('返回歌曲列表为空')
      }
      
      const list = transformSongList(songlist, 'getSimilarSongs')
      log.info('[TX DailyRec] getSimilarSongs 转换完成', { listLength: list.length })
      return list
    } catch (error) {
      log.error(`[TX DailyRec] getSimilarSongs 失败:`, error.message, error.stack)
      return this.getSimilarSongs(songMid, limit, retryNum + 1)
    }
  },
}