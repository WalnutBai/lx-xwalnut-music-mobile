import { httpFetch } from '../../request'
import { getMusicInfosByList } from './musicInfo'

const artistApi = {
  /**
   * 获取歌手详情
   * @param {string} singerid - 歌手ID
   * @returns {Object} 歌手详情信息
   */
  async getDetail(singerid) {
    if (!singerid || singerid == 0) throw new Error('歌手不存在')
    
    const requestObj = httpFetch(`http://mobiles.kugou.com/api/v5/singer/info?singerid=${singerid}`)
    let { body, statusCode } = await requestObj.promise
    if (statusCode !== 200) throw new Error('获取歌手信息失败')
    
    console.log('[KuGou] getDetail 返回数据:', JSON.stringify(body.data).substring(0, 500))
    
    return {
      artist: {
        id: singerid,
        name: body.data.singername,
        picUrl: body.data.imgurl ? body.data.imgurl.replace('{size}', '480') : '',
        briefDesc: body.data.intro || '',
        albumSize: body.data.albumcount || body.data.album_count || 0,
        songNum: body.data.songcount || body.data.song_count || 0,
        source: 'kg',
      }
    }
  },

  /**
   * 获取歌手歌曲列表
   * @param {string} singerid - 歌手ID
   * @param {string} sort - 排序方式 ('hot' | 'time')
   * @param {number} limit - 每页数量
   * @param {number} offset - 偏移量
   * @returns {Object} 歌曲列表
   */
  async getSongs(singerid, sort = 'hot', limit = 30, offset = 0) {
    if (!singerid || singerid == 0) throw new Error('歌手不存在')
    
    const page = Math.floor(offset / limit) + 1
    const requestObj = httpFetch(
      `http://mobiles.kugou.com/api/v5/singer/song?singerid=${singerid}&page=${page}&pagesize=${limit}`
    )
    let { body, statusCode } = await requestObj.promise
    if (statusCode !== 200) throw new Error('获取歌手歌曲列表失败')
    
    let listData = await getMusicInfosByList(body.data.info || [])
    const total = body.data.total || 0
    const hasMore = (offset + limit) < total
    
    return {
      list: listData,
      hasMore,
      total,
    }
  },

  /**
   * 获取歌手专辑列表
   * @param {string} singerid - 歌手ID
   * @param {number} limit - 每页数量
   * @param {number} offset - 偏移量
   * @returns {Object} 专辑列表
   */
  async getAlbums(singerid, limit = 30, offset = 0) {
    if (!singerid || singerid == 0) throw new Error('歌手不存在')
    
    const page = Math.floor(offset / limit) + 1
    const requestObj = httpFetch(
      `http://mobiles.kugou.com/api/v5/singer/album?singerid=${singerid}&page=${page}&pagesize=${limit}`
    )
    let { body, statusCode } = await requestObj.promise
    if (statusCode !== 200) throw new Error('获取歌手专辑列表失败')
    
    const albums = (body.data.info || []).map(album => ({
      id: album.albumid,
      name: album.albumname || '',
      picUrl: album.imgurl ? album.imgurl.replace('{size}', '480') : '',
      img: album.imgurl ? album.imgurl.replace('{size}', '480') : '',
      publishTime: album.publishtime || '',
      size: album.songcount || album.count || 0,
      source: 'kg',
    }))
    
    const total = body.data.total || 0
    const hasMore = (offset + limit) < total
    
    return {
      hotAlbums: albums,
      hasMore,
      total,
    }
  },

  /**
   * 获取相似歌手（暂不支持）
   * @returns {Object} 空的相似歌手列表
   */
  async getSimilar() {
    return { artists: [] }
  },
}

export default artistApi
