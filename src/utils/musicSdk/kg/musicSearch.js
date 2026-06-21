import { httpFetch } from '../../request'
import { decodeName, formatPlayTime } from '../../index'
import { formatSingerName } from '../utils'
import { getBatchMusicQualityInfo } from './quality_detail'

export default {
  limit: 30,
  total: 0,
  page: 0,
  allPage: 1,
  musicSearch(str, page, limit) {
    const searchRequest = httpFetch(
      `https://songsearch.kugou.com/song_search_v2?keyword=${encodeURIComponent(
        str
      )}&page=${page}&pagesize=${limit}&userid=0&clientver=&platform=WebFilter&filter=2&iscorrection=1&privilege_filter=0&area_code=1`
    )
    return searchRequest.promise.then(({ body }) => body)
  },
  async handleResult(rawData) {
    let ids = new Set()
    const items = []

    rawData.forEach((item) => {
      const key = item.Audioid + item.FileHash
      if (!ids.has(key)) {
        ids.add(key)
        items.push(item)
      }

      for (const childItem of item.Grp || []) {
        const childKey = childItem.Audioid + childItem.FileHash
        if (!ids.has(childKey)) {
          ids.add(childKey)
          items.push(childItem)
        }
      }
    })

    const hashList = items.map((item) => item.FileHash)

    let qualityInfoMap = {}
    try {
      const qualityInfoRequest = getBatchMusicQualityInfo(hashList)
      qualityInfoMap = await qualityInfoRequest.promise
    } catch (error) {
      console.error('Failed to fetch quality info:', error)
    }

    return items.map((item) => {
      const { types = [], _types = {} } = qualityInfoMap[item.FileHash] || {}

      return {
        singer: decodeName(formatSingerName(item.Singers, 'name')),
        name: decodeName(item.SongName),
        albumName: decodeName(item.AlbumName),
        albumId: item.AlbumID,
        songmid: item.Audioid,
        songId: item.Audioid,
        source: 'kg',
        interval: formatPlayTime(item.Duration),
        _interval: item.Duration,
        img: item.Image ? item.Image.replace('{size}', '480') : null,
        lrc: null,
        otherSource: null,
        hash: item.FileHash,
        mixSongId: item.MixSongID || 0,
        types,
        _types,
        typeUrl: {},
        meta: {
          songId: item.Audioid,
          albumName: decodeName(item.AlbumName),
          albumId: item.AlbumID,
          picUrl: item.Image ? item.Image.replace('{size}', '480') : null,
          qualitys: types,
          _qualitys: _types,
          hash: item.FileHash,
        },
      }
    })
  },
  search(str, page = 1, limit, retryNum = 0) {
    if (++retryNum > 3) return Promise.reject(new Error('try max num'))
    if (limit == null) limit = this.limit

    return this.musicSearch(str, page, limit).then(async (result) => {
      if (!result || result.error_code !== 0) return this.search(str, page, limit, retryNum)

      let list = await this.handleResult(result.data.lists)

      if (list == null) return this.search(str, page, limit, retryNum)

      this.total = result.data.total
      this.page = page
      this.allPage = Math.ceil(this.total / limit)

      return Promise.resolve({
        list,
        allPage: this.allPage,
        limit,
        total: this.total,
        source: 'kg',
      })
    })
  },
  // 获取单个歌手详情
  async getSingerDetail(singerid) {
    try {
      const requestObj = httpFetch(`http://mobiles.kugou.com/api/v5/singer/info?singerid=${singerid}`)
      const { body, statusCode } = await requestObj.promise
      if (statusCode !== 200 || !body || !body.data) return null
      
      return {
        id: singerid,
        name: body.data.singername || '',
        picUrl: body.data.imgurl ? body.data.imgurl.replace('{size}', '480') : '',
        albumSize: body.data.albumcount || body.data.album_count || 0,
        songNum: body.data.songcount || body.data.song_count || 0,
        source: 'kg',
      }
    } catch (err) {
      return null
    }
  },
  
  async searchSinger(keyword, page = 1, limit = 10) {
    try {
      // 使用歌曲搜索，从结果中提取歌手ID
      const requestObj = httpFetch(
        `https://songsearch.kugou.com/song_search_v2?keyword=${encodeURIComponent(keyword)}&page=${page}&pagesize=30&userid=0&platform=WebFilter&filter=2&iscorrection=1&area_code=1`
      )
      const { body } = await requestObj.promise

      if (!body || body.error_code !== 0 || !body.data || !body.data.lists) {
        return { list: [] }
      }

      // 从歌曲中提取歌手ID
      const singerIds = new Set()
      for (const song of body.data.lists) {
        if (song.Singers && song.Singers.length > 0) {
          for (const s of song.Singers) {
            if (s.id) singerIds.add(s.id)
          }
        }
      }

      // 批量获取歌手详情（最多获取limit个）
      const idsToFetch = [...singerIds].slice(0, limit)
      const detailPromises = idsToFetch.map(id => this.getSingerDetail(id))
      const results = await Promise.all(detailPromises)
      
      // 过滤掉失败的结果
      const list = results.filter(item => item !== null && item.name)
      
      return { list }
    } catch (err) {
      console.error('[KuGou] searchSinger error:', err)
      return { list: [] }
    }
  },
  // 获取单个专辑详情
  async getAlbumDetail(albumid) {
    try {
      const requestObj = httpFetch(
        `http://mobiles.kugou.com/api/v3/album/song?version=9108&albumid=${albumid}&plat=0&pagesize=1&area_code=0&page=1&with_res_tag=0`
      )
      const { body } = await requestObj.promise
      
      if (!body) return null
      
      // 直接检查 body 的结构
      console.log('[KuGou] getAlbumDetail 专辑ID:', albumid, 'body keys:', Object.keys(body), 'has total:', 'total' in body, 'has data:', 'data' in body)
      
      // 如果 body 直接有 total 字段
      if (body.total !== undefined) {
        return { id: albumid, size: body.total }
      }
      
      // 如果 body.data 存在
      const data = body.data
      if (!data) return null
      
      // data 可能是数组
      if (Array.isArray(data)) {
        return { id: albumid, size: body.total || data.length || 0 }
      }
      
      // data 可能有 info 或 songs 字段
      if (data.info && Array.isArray(data.info)) {
        return { id: albumid, size: data.total || data.info.length || 0 }
      }
      if (data.songs && Array.isArray(data.songs)) {
        return { id: albumid, size: data.total || data.songs.length || 0 }
      }
      
      // 打印 data 的结构
      console.log('[KuGou] getAlbumDetail 专辑ID:', albumid, 'data keys:', Object.keys(data))
      
      return null
    } catch (err) {
      console.error('[KuGou] getAlbumDetail 错误:', err.message)
      return null
    }
  },
  
  async searchAlbum(keyword, page = 1, limit = 30) {
    try {
      console.log('[KuGou] searchAlbum 开始搜索:', keyword)
      const requestObj = httpFetch(
        `https://songsearch.kugou.com/song_search_v2?keyword=${encodeURIComponent(keyword)}&page=${page}&pagesize=${limit}&userid=0&platform=WebFilter&filter=4&iscorrection=1&area_code=1`
      )
      const { body } = await requestObj.promise
      console.log('[KuGou] searchAlbum 搜索响应:', { errorCode: body?.error_code, hasData: !!body?.data, listLength: body?.data?.lists?.length })

      if (!body || body.error_code !== 0 || !body.data || !body.data.lists) {
        return { list: [], total: 0, allPage: 0 }
      }

      // 打印第一条数据的字段
      if (body.data.lists.length > 0) {
        console.log('[KuGou] searchAlbum 第一条数据字段:', Object.keys(body.data.lists[0]))
      }

      // 提取专辑基本信息并去重（使用字符串ID）
      const albumMap = new Map()
      for (const item of body.data.lists) {
        const id = String(item.AlbumID || item.albumid || '')
        if (!id || id === '0' || albumMap.has(id)) continue
        
        const img = (item.Image || item.img || item.AlbumImage || item.album_sizable_cover || '').replace('{size}', '480')
        albumMap.set(id, {
          id,
          name: item.AlbumName || item.albumname || item.album_name || '',
          picUrl: img,
          img,
          artist: item.SingerName || item.singername || item.author_name || '',
          publishTime: item.PublishDate || item.publish_date || '',
          size: 0,
          source: 'kg',
        })
      }
      const albums = [...albumMap.values()].filter(item => item.name)
      
      console.log('[KuGou] searchAlbum 专辑数量:', albums.length)

      // 批量获取专辑详情（获取歌曲数量）
      const albumsToFetch = albums.slice(0, 30)
      console.log('[KuGou] searchAlbum 获取详情的专辑:', albumsToFetch.map(a => a.id))
      const detailPromises = albumsToFetch.map(album => this.getAlbumDetail(album.id))
      const details = await Promise.all(detailPromises)
      console.log('[KuGou] searchAlbum 详情结果:', details)
      
      // 更新专辑的歌曲数量
      const detailMap = new Map()
      for (const detail of details) {
        if (detail) detailMap.set(detail.id, detail.size)
      }
      for (const album of albums) {
        if (detailMap.has(album.id)) {
          album.size = detailMap.get(album.id)
        }
      }
      
      console.log('[KuGou] searchAlbum 最终结果前3个:', albums.slice(0, 3).map(a => ({ id: a.id, name: a.name, size: a.size })))

      return {
        list: albums,
        total: body.data.total || albums.length,
        allPage: Math.ceil((body.data.total || albums.length) / limit),
      }
    } catch (err) {
      console.error('[KuGou] searchAlbum error:', err)
      return { list: [], total: 0, allPage: 0 }
    }
  },
}
