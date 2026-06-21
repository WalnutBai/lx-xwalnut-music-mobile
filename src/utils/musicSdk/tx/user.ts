/**
 * QQ音乐用户API模块
 * 基于 QQMusicApi-source 项目实现
 * 用于获取用户歌单、收藏歌单、收藏音乐等信息
 */

import { httpFetch } from '../../request'
import settingState from '@/store/setting/state'
import { txLog } from '@/utils/txLog'
import { zzcSign } from './utils/crypto'
import { log as errorLog } from '@/utils/log'
import getMusicInfo from './musicInfo'

const TX_API_HOST = 'c.y.qq.com'
const TX_MUSIC_U_FCG = 'https://u.y.qq.com/cgi-bin/musics.fcg'

export default {
  /**
   * 从Cookie中提取uin
   */
  extractUin(cookie: string): string | null {
    if (!cookie) return null;
    
    // 尝试匹配 uin= 或 oAq- 格式
    const uinMatch = cookie.match(/(?:^|;)\s*uin=(\d+|o[A-Za-z0-9_-]+)/);
    if (uinMatch) {
      return uinMatch[1];
    }

    // 尝试从伪装的uin中提取
    const fakeUinMatch = cookie.match(/euin=([A-Za-z0-9_*]+)/);
    if (fakeUinMatch) {
      // 这是伪装uin，需要找真正的uin
      const realUinMatch = cookie.match(/(?:^|;)\s*uin=(\d+)/);
      if (realUinMatch) {
        return realUinMatch[1];
      }
    }

    txLog.warn('无法从Cookie中提取uin');
    return null;
  },

  /**
   * 获取用户信息
   */
  async getUserInfo(retryNum = 0): Promise<any> {
    const maxRetries = 3;
    const retryDelay = 200;
    const cookie = settingState.setting['common.tx_cookie'];

    txLog.info('=== getUserInfo 开始 ===');

    if (!cookie) {
      txLog.error('未设置QQ音乐Cookie');
      throw new Error('未设置QQ音乐Cookie');
    }

    try {
      const uin = this.extractUin(cookie);
      if (!uin) {
        throw new Error('Cookie中未找到uin');
      }

      const bodyData = `cid=205360838&userid=${uin}&reqfrom=1`;

      const requestObj = httpFetch(`https://${TX_API_HOST}/rsc/fcgi-bin/fcg_get_profile_homepage.fcg`, {
        method: 'POST',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://y.qq.com/',
          'Cookie': cookie,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
        },
        body: bodyData,
      });

      const { body, statusCode } = await requestObj.promise;

      if (statusCode !== 200) {
        throw new Error('获取用户信息失败');
      }

      if (body.code === 1000) {
        throw new Error('QQ音乐Cookie已过期，请重新获取');
      }

      txLog.info('获取用户信息成功');

      return {
        name: body.data?.nick || body.data?.name || 'QQ音乐用户',
        avatar: body.data?.avatarUrl || body.data?.avatar || '',
        uin: uin,
      };
    } catch (error: any) {
      if (retryNum < maxRetries) {
        txLog.warn('获取用户信息失败, 重试次数:', retryNum + 1);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        return this.getUserInfo(retryNum + 1);
      } else {
        txLog.error('获取用户信息失败 (重试次数已达上限)', error.message);
        throw error;
      }
    }
  },

  /**
   * 获取用户创建的歌单
   * 包括自建歌单和"我喜欢"收藏音乐
   */
  async getUserPlaylists(retryNum = 0): Promise<any> {
    const maxRetries = 3;
    const retryDelay = 200;
    const cookie = settingState.setting['common.tx_cookie'];

    txLog.info('=== getUserPlaylists 开始 ===');

    if (!cookie) {
      txLog.error('未设置QQ音乐Cookie');
      throw new Error('未设置QQ音乐Cookie');
    }

    try {
      const uin = this.extractUin(cookie);
      if (!uin) {
        throw new Error('Cookie中未找到uin');
      }

      // 构建请求体
      const bodyData = `hostUin=0&hostuin=${uin}&sin=0&size=200&g_tk=5381&loginUin=${uin}&format=json&inCharset=utf8&outCharset=utf-8&notice=0&platform=yqq.json&needNewCode=0`;

      const requestObj = httpFetch(`https://${TX_API_HOST}/rsc/fcgi-bin/fcg_user_created_diss`, {
        method: 'POST',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://y.qq.com/portal/profile.html',
          'Cookie': cookie,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
        },
        body: bodyData,
      });

      const { body } = await requestObj.promise;

      txLog.debug('自建歌单响应:', JSON.stringify(body).substring(0, 500));

      if (body.code === 1000) {
        throw new Error('QQ音乐Cookie已过期，请重新获取')
      }

      // 检查是否有 diss_list
      let dissList = body.data?.diss_list || body.data?.disslist;

      if (!dissList) {
        // 如果返回的是用户主页信息格式（只有 hostname）
        if (body.data?.hostname) {
          txLog.warn('获取歌单返回用户主页格式, 用户没有创建歌单');
          dissList = [];
        } else {
          throw new Error('获取用户歌单失败');
        }
      }

      txLog.info('获取自建歌单成功, 数量:', dissList.length);

      // 需要过滤的歌单类型
      // dirid: 201 = 我喜欢(保留显示), 202 = 本地歌单, 205 = QZone背景音乐, 206 = 本地上传
      const excludeDirids = [202, 205, 206];
      const filteredCreatedList = dissList.filter((diss: any) => !excludeDirids.includes(diss.dirid));

      txLog.info('过滤后的自建歌单数量:', filteredCreatedList.length);

      // 转换自建歌单为统一格式
      const createdPlaylists = filteredCreatedList.map((diss: any) => {
        let cover = diss.disslogo || diss.diss_cover || diss.cover || '';
        // 修复"我喜欢"歌单封面问题
        if (diss.dirid === 201) {
          cover = cover && cover !== '?n=1' ? cover : 'https://y.gtimg.cn/mediastyle/yqq/img/icon_favorite.png';
        }
        return {
          id: String(diss.dissid || diss.tid || diss.id),
          tid: diss.dissid || diss.tid || diss.id,
          dirid: diss.dirid,
          name: diss.dissname || diss.diss_name || diss.title || '未知歌单',
          cover: cover,
          songCount: diss.song_cnt || diss.songCount || 0,
          desc: diss.dissdesc || diss.desc || '',
          isFavorites: diss.dirid === 201,
          isCollected: false,
        };
      });

      txLog.info('自建歌单数量:', createdPlaylists.length);

      return createdPlaylists;
    } catch (error: any) {
      if (retryNum < maxRetries) {
        txLog.warn('获取用户歌单失败, 重试次数:', retryNum + 1);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        return this.getUserPlaylists(retryNum + 1);
      } else {
        txLog.error('获取用户歌单失败 (重试次数已达上限)', error.message);
        throw error;
      }
    }
  },

  /**
   * 获取歌单详情（包含歌曲列表）
   */
  async getPlaylistDetail(disstid: string, retryNum = 0): Promise<any> {
    const maxRetries = 3;
    const retryDelay = 200;
    const cookie = settingState.setting['common.tx_cookie'];

    txLog.info('=== getPlaylistDetail 开始 === disstid:', disstid);

    if (!cookie) {
      throw new Error('未设置QQ音乐Cookie');
    }

    try {
      const bodyData = `type=1&utf8=1&disstid=${disstid}&loginUin=0&hostUin=0&format=json&inCharset=utf8`;

      const requestObj = httpFetch(`https://${TX_API_HOST}/qzone/fcg-bin/fcg_ucc_getcdinfo_byids_cp.fcg`, {
        method: 'POST',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://y.qq.com/n/yqq/playlist',
          'Cookie': cookie,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
        },
        body: bodyData,
      });

      const { body } = await requestObj.promise;

      txLog.debug('歌单详情响应:', JSON.stringify(body).substring(0, 500));

      if (!body.cdlist || !body.cdlist[0]) {
        throw new Error('获取歌单详情失败');
      }

      const playlist = body.cdlist[0];

      txLog.info('获取歌单详情成功:', {
        name: playlist.dissname || playlist.title,
        songCount: playlist.songlist?.length || 0,
      });

      // 转换为统一格式
      return {
        id: playlist.dissid || disstid,
        name: playlist.dissname || playlist.title || '未知歌单',
        cover: playlist.logo || playlist.cover || '',
        desc: playlist.desc || '',
        creator: {
          name: playlist.nick || playlist.creator?.name || '',
          avatar: playlist.creator?.avatar || '',
        },
        songs: (playlist.songlist || []).map((song: any) => ({
          id: song.songid || song.id,
          name: song.title || song.songname || song.name || '',
          artists: (song.singer || []).map((s: any) => ({
            id: s.id || '',
            name: s.name || '',
          })),
          album: {
            id: song.albumid || song.album?.id || '',
            name: song.albumname || song.album?.name || '',
          },
          strMediaMid: song.strMediaMid || song.media_mid || '',
          songmid: song.songmid || song.mid || '',
          interval: song.interval || 0,
        })),
      };
    } catch (error: any) {
      if (retryNum < maxRetries) {
        txLog.warn('获取歌单详情失败, 重试次数:', retryNum + 1);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        return this.getPlaylistDetail(disstid, retryNum + 1);
      } else {
        txLog.error('获取歌单详情失败 (重试次数已达上限)', error.message);
        throw error;
      }
    }
  },

  /**
   * 向歌单添加歌曲
   * 使用新的 zzc 签名 API
   * dirid: 201=我喜欢, 202=本地歌单, 205=QZone背景音乐, 206=本地上传, 0=用户自建歌单
   */
  async addSongToPlaylist(listId: string, songMids: string[], retryNum = 0): Promise<any> {
    const maxRetries = 3
    const retryDelay = 200
    const cookie = settingState.setting['common.tx_cookie']

    txLog.info('=== addSongToPlaylist 开始 ===', {
      listId,
      songMids,
      songCount: songMids.length,
    })

    if (!cookie) {
      txLog.error('未设置QQ音乐Cookie')
      throw new Error('未设置QQ音乐Cookie，请先在设置中配置QQ Cookie')
    }

    // 检查歌曲 mid 格式
    const invalidMids = songMids.filter(mid => !mid)
    if (invalidMids.length > 0) {
      txLog.error('部分歌曲 mid 为空', {
        invalidCount: invalidMids.length,
      })
      throw new Error('部分歌曲 mid 为空')
    }

    try {
      const uin = this.extractUin(cookie)
      if (!uin) {
        txLog.error('Cookie中未找到uin')
        throw new Error('Cookie中未找到uin，请检查Cookie是否正确')
      }

      // 获取歌单列表来确定 dirid
      let dirid = 0 // 默认使用 0（用户自建歌单的 dirid）
      let tid = parseInt(listId) || 0

      try {
        const playlists = await this.getUserPlaylists()
        const targetPlaylist = playlists.find(
          (p: any) => String(p.id) === String(listId) || String(p.tid) === String(listId),
        )
        if (targetPlaylist) {
          // 使用歌单自己的 dirid
          // 用户自建歌单: dirid = 0 或 undefined
          // 系统目录歌单: dirid = 201(我喜欢)
          dirid = targetPlaylist.dirid || 0
          tid = targetPlaylist.tid || parseInt(listId) || 0
          txLog.info('找到目标歌单，确定 dirid', {
            name: targetPlaylist.name,
            tid: targetPlaylist.tid,
            id: targetPlaylist.id,
            dirid: targetPlaylist.dirid,
            useDirid: dirid,
          })
        } else {
          txLog.warn('未找到目标歌单，使用默认 dirid=0', { listId })
        }
      } catch (err) {
        txLog.warn('获取歌单列表失败，使用默认 dirid=0', err)
      }

      // 构建歌曲信息列表 (song_id, song_type)
      // songMids 可能是字符串 mid (如 "0039MnYb0qxYhV")，需要获取正确的数字 songId
      // song_type: 13 = 歌曲
      txLog.info('开始获取歌曲详情以获取正确的 songId', { songMids })

      const songInfo: { songId: number; songType: number }[] = []
      const failedMids: string[] = []

      for (const mid of songMids) {
        try {
          // 使用正则判断是否为纯数字 songId（避免 parseInt 截断问题）
          if (/^\d+$/.test(mid.trim())) {
            // 传入的是数字 songId，直接使用
            const parsedId = parseInt(mid)
            songInfo.push({ songId: parsedId, songType: 13 })
            txLog.info('使用传入的 songId', { mid, songId: parsedId })
          } else {
            // 传入的是字符串 mid，需要获取 songId
            txLog.info('传入的是 mid，需要获取 songId', { mid })
            const musicInfo = await getMusicInfo(mid)
            if (musicInfo && musicInfo.songId) {
              songInfo.push({ songId: musicInfo.songId, songType: 13 })
              txLog.info('从 mid 获取到 songId', { mid, songId: musicInfo.songId, name: musicInfo.name })
            } else {
              // 如果 getMusicInfo 返回 null，尝试使用备用方法
              // 某些歌曲可能没有 media_mid，但仍然可以通过其他方式获取
              txLog.warn('getMusicInfo 返回空，尝试备用方法', { mid })
              // 尝试使用搜索 API 获取歌曲信息
              try {
                const searchResult = await this.searchSong(mid)
                if (searchResult && searchResult.length > 0) {
                  const foundSong = searchResult[0]
                  if (foundSong.songId) {
                    songInfo.push({ songId: foundSong.songId, songType: 13 })
                    txLog.info('通过搜索获取到 songId', { mid, songId: foundSong.songId, name: foundSong.name })
                  } else {
                    txLog.error('搜索结果中没有 songId', { mid })
                    failedMids.push(mid)
                  }
                } else {
                  txLog.error('无法获取歌曲 songId', { mid })
                  errorLog.error(`[QQ音乐] 无法获取歌曲 songId: ${mid}`)
                  failedMids.push(mid)
                }
              } catch (searchErr: any) {
                txLog.error('搜索歌曲失败', { mid, error: searchErr.message })
                failedMids.push(mid)
              }
            }
          }
        } catch (err: any) {
          txLog.error('获取歌曲详情失败', { mid, error: err.message })
          errorLog.error(`[QQ音乐] 获取歌曲详情失败: ${mid}, 错误: ${err.message}`)
          failedMids.push(mid)
        }
      }

      if (songInfo.length === 0) {
        txLog.error('没有有效的歌曲可以添加', { failedMids })
        errorLog.error(`[QQ音乐] 没有有效的歌曲可以添加`)
        throw new Error('没有有效的歌曲可以添加')
      }

      if (failedMids.length > 0) {
        txLog.warn('部分歌曲获取 songId 失败', { failedMids, successCount: songInfo.length })
      }

      // 构建请求体（按照QQMusicApi-new的格式）
      const payload = {
        comm: {
          ct: 24,
          cv: 1800,
        },
        req_0: {
          module: 'music.musicasset.PlaylistDetailWrite',
          method: 'AddSonglist',
          param: {
            dirId: dirid,
            tid: tid,
            bFmtUtf8: true,
            v_songInfo: songInfo,
          },
        },
      }

      // 计算签名
      const sign = await zzcSign(JSON.stringify(payload))

      txLog.info('请求参数', {
        uin,
        listId,
        dirid,
        tid,
        songCount: songMids.length,
        apiUrl: TX_MUSIC_U_FCG,
        signLength: sign.length,
      })

      // 使用新的签名 API (与 utils/index.js 中的 signRequest 保持一致)
      const requestObj = httpFetch(
        `${TX_MUSIC_U_FCG}?sign=${sign}`,
        {
          method: 'POST',
          headers: {
            'User-Agent': 'QQMusic 14090508(android 12)',
            Referer: 'https://y.qq.com/',
            Cookie: cookie,
          },
          body: payload,
        },
      )

      const { body, statusCode } = await requestObj.promise

      txLog.info('API响应', {
        statusCode,
        code: body?.code,
        retCode: body?.req_0?.data?.retCode,
        response: JSON.stringify(body).substring(0, 500),
      })

      if (statusCode !== 200) {
        txLog.error('HTTP请求失败', { statusCode })
        errorLog.error(`[QQ音乐] HTTP请求失败，状态码: ${statusCode}`)
        throw new Error(`HTTP请求失败，状态码: ${statusCode}`)
      }

      // 检查响应中的 retCode
      const retCode = body?.req_0?.data?.retCode
      if (retCode === 1000 || retCode === 1001) {
        txLog.error('未登录或登录已过期')
        errorLog.error('[QQ音乐] 未登录或登录已过期，请更新QQ Cookie')
        throw new Error('QQ音乐登录已过期，请重新登录QQ音乐')
      }

      if (retCode !== 0 && retCode !== undefined) {
        const errorMsg = body?.req_0?.data?.retMsg || `添加歌曲失败，错误码: ${retCode}`
        txLog.error('添加歌曲失败', {
          retCode,
          msg: body?.req_0?.data?.retMsg,
          dirid,
          listId,
          songMids,
        })
        errorLog.error(`[QQ音乐] 添加歌曲失败: ${errorMsg}, 歌单ID: ${listId}, 歌曲数量: ${songMids.length}`)
        throw new Error(`${errorMsg}，可能是Cookie已失效，请重新登录QQ音乐`)
      }

      if (retCode === undefined) {
        errorLog.error(`[QQ音乐] 添加歌曲失败: 返回数据异常, 歌单ID: ${listId}`)
        throw new Error('添加歌曲失败，可能是Cookie已失效，请重新登录QQ音乐')
      }

      txLog.info('添加歌曲成功', {
        dirid,
        songCount: songMids.length,
      })
      errorLog.info(`[QQ音乐] 添加歌曲成功，歌单ID: ${listId}, 歌曲数量: ${songMids.length}`)

      return {
        success: true,
        message: '添加成功',
      }
    } catch (error: any) {
      txLog.error('添加歌曲异常', {
        error: error.message,
        stack: error.stack,
        listId,
        songMids,
        retryNum,
      })
      errorLog.error(`[QQ音乐] 添加歌曲异常: ${error.message}, 歌单ID: ${listId}`)

      if (retryNum < maxRetries) {
        txLog.warn('添加歌曲失败, 重试次数:', retryNum + 1)
        await new Promise(resolve => setTimeout(resolve, retryDelay))
        return this.addSongToPlaylist(listId, songMids, retryNum + 1)
      } else {
        txLog.error('添加歌曲失败 (重试次数已达上限)', error.message)
        errorLog.error(`[QQ音乐] 添加歌曲失败 (重试次数已达上限): ${error.message}`)
        throw error
      }
    }
  },

  /**
   * 获取"我喜欢"收藏音乐
   */
  async getFavoritesMusic(page = 1, pageSize = 30, retryNum = 0): Promise<any> {
    const maxRetries = 3;
    const retryDelay = 200;
    const cookie = settingState.setting['common.tx_cookie'];

    txLog.info('=== getFavoritesMusic 开始 === page:', page);

    if (!cookie) {
      txLog.error('未设置QQ音乐Cookie');
      throw new Error('未设置QQ音乐Cookie');
    }

    try {
      const uin = this.extractUin(cookie);
      if (!uin) {
        throw new Error('Cookie中未找到uin');
      }

      // 先获取歌单列表找到"我喜欢"的歌单ID
      const playlists = await this.getUserPlaylists();
      const favoritesPlaylist = playlists.find((p: any) => p.isFavorites);

      if (!favoritesPlaylist) {
        txLog.warn('未找到"我喜欢"歌单');
        return {
          list: [],
          total: 0,
          page,
          pageSize,
          hasMore: false,
        };
      }

      // 获取"我喜欢"歌单的详情
      const detail = await this.getPlaylistDetail(favoritesPlaylist.id);

      // 分页处理
      const startIndex = (page - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const pagedList = detail.songs.slice(startIndex, endIndex);

      return {
        list: pagedList,
        total: detail.songs.length,
        page,
        pageSize,
        hasMore: endIndex < detail.songs.length,
      };
    } catch (error: any) {
      if (retryNum < maxRetries) {
        txLog.warn('获取收藏音乐失败, 重试次数:', retryNum + 1);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        return this.getFavoritesMusic(page, pageSize, retryNum + 1);
      } else {
        txLog.error('获取收藏音乐失败 (重试次数已达上限)', error.message);
        throw error;
      }
    }
  },

  /**
   * 从Cookie中提取euin（加密UIN）
   */
  extractEuin(cookie: string): string | null {
    if (!cookie) return null
    const euinMatch = cookie.match(/euin=([^;]+)/)
    return euinMatch ? euinMatch[1] : null
  },

  /**
   * 发送签名请求
   */
  async sendSignedRequest(payload: any): Promise<any> {
    const cookie = settingState.setting['common.tx_cookie']
    const sign = await zzcSign(JSON.stringify(payload))

    const requestObj = httpFetch(
      `${TX_MUSIC_U_FCG}?sign=${sign}`,
      {
        method: 'POST',
        headers: {
          'User-Agent': 'QQMusic 14090508(android 12)',
          Referer: 'https://y.qq.com/',
          Cookie: cookie,
        },
        body: payload,
      },
    )

    const { body, statusCode } = await requestObj.promise

    if (statusCode !== 200) {
      throw new Error(`HTTP请求失败，状态码: ${statusCode}`)
    }

    if (body.code === 1000) {
      throw new Error('QQ音乐Cookie已过期，请重新获取')
    }

    return body
  },

  /**
   * 获取用户自建歌单（使用新API）
   * module: music.musicasset.PlaylistBaseRead
   * method: GetPlaylistByUin
   */
  async getCreatedPlaylists(retryNum = 0): Promise<any> {
    const maxRetries = 3
    const retryDelay = 200
    const cookie = settingState.setting['common.tx_cookie']

    txLog.info('=== getCreatedPlaylists 开始 ===')

    if (!cookie) {
      throw new Error('未设置QQ音乐Cookie')
    }

    try {
      const uin = this.extractUin(cookie)
      if (!uin) {
        throw new Error('Cookie中未找到uin')
      }

      const payload = {
        comm: { ct: 24, cv: 1800 },
        req_0: {
          module: 'music.musicasset.PlaylistBaseRead',
          method: 'GetPlaylistByUin',
          param: { uin: String(uin) },
        },
      }

      const body = await this.sendSignedRequest(payload)

      if (body.code !== 0 || body.req_0?.code !== 0) {
        throw new Error('获取用户自建歌单失败')
      }

      const playlists = body.req_0?.data?.v_playlist || []

      txLog.info('获取用户自建歌单成功', { count: playlists.length })

      // 过滤不需要的歌单类型
      const excludeDirids = [202, 205, 206]
      const filteredPlaylists = playlists.filter((p: any) => !excludeDirids.includes(p.dirId))

      return filteredPlaylists.map((p: any) => ({
        id: String(p.tid),
        tid: p.tid,
        dirid: p.dirId,
        name: p.dirName,
        cover: p.picUrl || p.bigpicUrl || '',
        songCount: p.songNum || 0,
        desc: p.desc || '',
        isFavorites: p.dirId === 201,
        isCollected: false,
        createTime: p.createTime,
        updateTime: p.updateTime,
      }))
    } catch (error: any) {
      if (retryNum < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay))
        return this.getCreatedPlaylists(retryNum + 1)
      }
      throw error
    }
  },

  /**
   * 获取用户收藏的歌曲（我喜欢）
   * module: music.srfDissInfo.DissInfo
   * method: CgiGetDiss
   */
  async getFavSongs(page = 1, pageSize = 30, retryNum = 0): Promise<any> {
    const maxRetries = 3
    const retryDelay = 200
    const cookie = settingState.setting['common.tx_cookie']

    txLog.info('=== getFavSongs 开始 ===', { page, pageSize })

    if (!cookie) {
      throw new Error('未设置QQ音乐Cookie')
    }

    try {
      const euin = this.extractEuin(cookie)
      if (!euin) {
        throw new Error('Cookie中未找到euin')
      }

      const payload = {
        comm: { ct: 24, cv: 1800 },
        req_0: {
          module: 'music.srfDissInfo.DissInfo',
          method: 'CgiGetDiss',
          param: {
            disstid: 0,
            dirid: 201,
            tag: true,
            song_begin: (page - 1) * pageSize,
            song_num: pageSize,
            userinfo: true,
            orderlist: true,
            enc_host_uin: euin,
          },
        },
      }

      const body = await this.sendSignedRequest(payload)

      if (body.code !== 0 || body.req_0?.code !== 0) {
        throw new Error('获取收藏歌曲失败')
      }

      const data = body.req_0?.data || {}
      const songs = data.songlist || []
      const total = data.dirinfo?.songnum || 0

      txLog.info('获取收藏歌曲成功', { count: songs.length, total })

      return {
        list: songs.map((song: any) => ({
          id: song.id,
          // 统一使用 songId 作为 mid（与 likeKey 一致）
          mid: String(song.id),
          songmid: song.songmid || song.mid,
          name: song.title || song.name,
          singer: (song.singer || []).map((s: any) => s.name).join('/'),
          albumName: song.album?.name || '',
          albumMid: song.album?.mid || '',
          interval: song.interval || 0,
          source: 'tx',
        })),
        total,
        page,
        pageSize,
        hasMore: (page * pageSize) < total,
        dirInfo: {
          id: data.dirinfo?.id,
          name: data.dirinfo?.title,
          songCount: data.dirinfo?.songnum,
        },
      }
    } catch (error: any) {
      if (retryNum < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay))
        return this.getFavSongs(page, pageSize, retryNum + 1)
      }
      throw error
    }
  },

  /**
   * 获取用户收藏的歌单
   * module: music.musicasset.PlaylistFavRead
   * method: CgiGetPlaylistFavInfo
   */
  async getFavPlaylists(page = 1, pageSize = 30, retryNum = 0): Promise<any> {
    const maxRetries = 3
    const retryDelay = 200
    const cookie = settingState.setting['common.tx_cookie']

    txLog.info('=== getFavPlaylists 开始 ===', { page, pageSize })

    if (!cookie) {
      throw new Error('未设置QQ音乐Cookie')
    }

    try {
      const euin = this.extractEuin(cookie)
      if (!euin) {
        throw new Error('Cookie中未找到euin')
      }

      const payload = {
        comm: { ct: 24, cv: 1800 },
        req_0: {
          module: 'music.musicasset.PlaylistFavRead',
          method: 'CgiGetPlaylistFavInfo',
          param: {
            uin: euin,
            offset: (page - 1) * pageSize,
            size: pageSize,
          },
        },
      }

      const body = await this.sendSignedRequest(payload)

      if (body.code !== 0 || body.req_0?.code !== 0) {
        throw new Error('获取收藏歌单失败')
      }

      const data = body.req_0?.data || {}
      const playlists = data.v_list || []
      const total = data.total || data.number || 0

      txLog.info('获取收藏歌单成功', { count: playlists.length, total })

      return {
        list: playlists.map((p: any) => ({
          id: String(p.tid),
          tid: p.tid,
          dirid: p.dirId,
          name: p.name,
          cover: p.logo || p.albumPicUrl || '',
          songCount: p.songnum || 0,
          desc: '',
          isFavorites: false,
          isCollected: true,
          nickname: p.nickname || '',
          createTime: p.createtime,
          updateTime: p.updateTime,
        })),
        total,
        page,
        pageSize,
        hasMore: data.hasmore === 1,
      }
    } catch (error: any) {
      if (retryNum < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay))
        return this.getFavPlaylists(page, pageSize, retryNum + 1)
      }
      throw error
    }
  },

  /**
   * 获取用户收藏的专辑
   * module: music.musicasset.AlbumFavRead
   * method: CgiGetAlbumFavInfo
   */
  async getFavAlbums(page = 1, pageSize = 30, retryNum = 0): Promise<any> {
    const maxRetries = 3
    const retryDelay = 200
    const cookie = settingState.setting['common.tx_cookie']

    txLog.info('=== getFavAlbums 开始 ===', { page, pageSize })

    if (!cookie) {
      throw new Error('未设置QQ音乐Cookie')
    }

    try {
      const euin = this.extractEuin(cookie)
      if (!euin) {
        throw new Error('Cookie中未找到euin')
      }

      const payload = {
        comm: { ct: 24, cv: 1800 },
        req_0: {
          module: 'music.musicasset.AlbumFavRead',
          method: 'CgiGetAlbumFavInfo',
          param: {
            euin: euin,
            offset: (page - 1) * pageSize,
            size: pageSize,
          },
        },
      }

      const body = await this.sendSignedRequest(payload)

      if (body.code !== 0 || body.req_0?.code !== 0) {
        throw new Error('获取收藏专辑失败')
      }

      const data = body.req_0?.data || {}
      const albums = data.v_list || []
      const total = data.total || data.number || 0

      txLog.info('获取收藏专辑成功', { count: albums.length, total })

      return {
        list: albums.map((a: any) => ({
          id: String(a.albumId || a.id),
          mid: a.albumMid || a.mid,
          name: a.albumName || a.name,
          cover: a.albumPic || a.logo || '',
          singer: a.singerName || a.singer || '',
          songCount: a.songNum || 0,
          publishTime: a.publishTime || '',
        })),
        total,
        page,
        pageSize,
        hasMore: data.hasmore === 1,
      }
    } catch (error: any) {
      if (retryNum < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay))
        return this.getFavAlbums(page, pageSize, retryNum + 1)
      }
      throw error
    }
  },

  /**
   * 从歌单删除歌曲
   * module: music.musicasset.PlaylistDetailWrite
   * method: DelSonglist
   * @param listId 歌单 ID
   * @param songMids 歌曲 mid 列表
   */
  async removeSongFromPlaylist(listId: string, songMids: string[], retryNum = 0): Promise<any> {
    const maxRetries = 3
    const retryDelay = 200
    const cookie = settingState.setting['common.tx_cookie']

    txLog.info('=== removeSongFromPlaylist 开始 ===', { listId, songMids, songCount: songMids.length })

    if (!cookie) {
      throw new Error('未设置QQ音乐Cookie')
    }

    try {
      const uin = this.extractUin(cookie)
      if (!uin) {
        throw new Error('Cookie中未找到uin')
      }

      // 获取歌单列表来确定 dirid
      let dirid = 0
      let tid = parseInt(listId) || 0

      try {
        const playlists = await this.getUserPlaylists()
        const targetPlaylist = playlists.find(
          (p: any) => String(p.id) === String(listId) || String(p.tid) === String(listId),
        )
        if (targetPlaylist) {
          dirid = targetPlaylist.dirid || 0
          tid = targetPlaylist.tid || parseInt(listId) || 0
          txLog.info('找到目标歌单', { name: targetPlaylist.name, dirid, tid })
        }
      } catch (err) {
        txLog.warn('获取歌单列表失败，使用默认 dirid=0', err)
      }

      // 构建歌曲信息列表
      const songInfo: { songId: number; songType: number }[] = []
      const failedMids: string[] = []

      for (const mid of songMids) {
        try {
          // 使用正则判断是否为纯数字 songId（避免 parseInt 截断问题）
          if (/^\d+$/.test(mid.trim())) {
            const parsedId = parseInt(mid)
            songInfo.push({ songId: parsedId, songType: 13 })
          } else {
            const musicInfo = await getMusicInfo(mid)
            if (musicInfo && musicInfo.songId) {
              songInfo.push({ songId: musicInfo.songId, songType: 13 })
            } else {
              // 备用方法：使用 searchSong
              try {
                const searchResult = await this.searchSong(mid)
                if (searchResult && searchResult.length > 0 && searchResult[0].songId) {
                  songInfo.push({ songId: searchResult[0].songId, songType: 13 })
                } else {
                  failedMids.push(mid)
                }
              } catch {
                failedMids.push(mid)
              }
            }
          }
        } catch (err: any) {
          txLog.error('获取歌曲详情失败', { mid, error: err.message })
          failedMids.push(mid)
        }
      }

      if (songInfo.length === 0) {
        throw new Error('没有有效的歌曲可以删除')
      }

      // 构建请求体
      const payload = {
        comm: { ct: 24, cv: 1800 },
        req_0: {
          module: 'music.musicasset.PlaylistDetailWrite',
          method: 'DelSonglist',
          param: {
            dirId: dirid,
            tid: tid,
            bFmtUtf8: true,
            v_songInfo: songInfo,
          },
        },
      }

      const body = await this.sendSignedRequest(payload)

      const retCode = body?.req_0?.data?.retCode
      if (retCode === 1000 || retCode === 1001) {
        throw new Error('QQ音乐登录已过期，请重新登录QQ音乐')
      }
      if (retCode !== 0) {
        throw new Error(`${body?.req_0?.data?.retMsg || `删除歌曲失败，错误码: ${retCode}`}，可能是Cookie已失效，请重新登录QQ音乐`)
      }

      txLog.info('删除歌曲成功', { dirid, tid, songCount: songInfo.length })
      errorLog.info(`[QQ音乐] 删除歌曲成功，歌单ID: ${listId}, 歌曲数量: ${songInfo.length}`)

      return {
        success: true,
        message: '删除成功',
        removedCount: songInfo.length,
        failedCount: failedMids.length,
      }
    } catch (error: any) {
      txLog.error('删除歌曲失败', { error: error.message, listId, songMids })
      errorLog.error(`[QQ音乐] 删除歌曲失败: ${error.message}, 歌单ID: ${listId}`)

      if (retryNum < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay))
        return this.removeSongFromPlaylist(listId, songMids, retryNum + 1)
      }
      throw error
    }
  },

  /**
   * 删除歌单
   * module: music.musicasset.PlaylistBaseWrite
   * method: DelPlaylist
   * @param dirid 歌单目录 ID
   */
  async deletePlaylist(dirid: number, retryNum = 0): Promise<any> {
    const maxRetries = 3
    const retryDelay = 200
    const cookie = settingState.setting['common.tx_cookie']

    txLog.info('=== deletePlaylist 开始 ===', { dirid })

    if (!cookie) {
      throw new Error('未设置QQ音乐Cookie')
    }

    // 不能删除"我喜欢"歌单
    if (dirid === 201) {
      throw new Error('不能删除"我喜欢"歌单')
    }

    try {
      const payload = {
        comm: { ct: 24, cv: 1800 },
        req_0: {
          module: 'music.musicasset.PlaylistBaseWrite',
          method: 'DelPlaylist',
          param: { dirId: dirid },
        },
      }

      const body = await this.sendSignedRequest(payload)

      const retCode = body?.req_0?.data?.retCode
      if (retCode === 1000 || retCode === 1001) {
        throw new Error('QQ音乐登录已过期，请重新登录QQ音乐')
      }
      if (retCode !== 0) {
        const retMsg = body?.req_0?.data?.retMsg
        if (retCode === undefined || retCode === null) {
          throw new Error('删除歌单失败，Cookie无效或已过期，请重新登录QQ音乐')
        }
        throw new Error(`${retMsg || `删除歌单失败，错误码: ${retCode}`}，可能是Cookie已失效，请重新登录QQ音乐`)
      }

      txLog.info('删除歌单成功', { dirid })
      errorLog.info(`[QQ音乐] 删除歌单成功，dirid: ${dirid}`)

      return {
        success: true,
        message: '删除成功',
        dirid: body?.req_0?.data?.dirid,
      }
    } catch (error: any) {
      txLog.error('删除歌单失败', { error: error.message, dirid })
      errorLog.error(`[QQ音乐] 删除歌单失败: ${error.message}, dirid: ${dirid}`)

      if (retryNum < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay))
        return this.deletePlaylist(dirid, retryNum + 1)
      }
      throw error
    }
  },

  /**
   * 创建歌单
   * module: music.musicasset.PlaylistBaseWrite
   * method: AddPlaylist
   * @param name 歌单名称
   */
  async createPlaylist(name: string, retryNum = 0): Promise<any> {
    const maxRetries = 3
    const retryDelay = 200
    const cookie = settingState.setting['common.tx_cookie']

    txLog.info('=== createPlaylist 开始 ===', { name })

    if (!cookie) {
      throw new Error('未设置QQ音乐Cookie')
    }

    try {
      const payload = {
        comm: { ct: 24, cv: 1800 },
        req_0: {
          module: 'music.musicasset.PlaylistBaseWrite',
          method: 'AddPlaylist',
          param: { dirName: name },
        },
      }

      const body = await this.sendSignedRequest(payload)

      const retCode = body?.req_0?.data?.retCode
      if (retCode === 1000 || retCode === 1001) {
        throw new Error('QQ音乐登录已过期，请重新登录QQ音乐')
      }
      if (retCode !== 0) {
        throw new Error(`${body?.req_0?.data?.retMsg || `创建歌单失败，错误码: ${retCode}`}，可能是Cookie已失效，请重新登录QQ音乐`)
      }

      const newDirid = body?.req_0?.data?.dirid
      txLog.info('创建歌单成功', { name, dirid: newDirid })
      errorLog.info(`[QQ音乐] 创建歌单成功: ${name}, dirid: ${newDirid}`)

      return {
        success: true,
        message: '创建成功',
        dirid: newDirid,
        name: name,
      }
    } catch (error: any) {
      txLog.error('创建歌单失败', { error: error.message, name })
      errorLog.error(`[QQ音乐] 创建歌单失败: ${error.message}`)

      if (retryNum < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay))
        return this.createPlaylist(name, retryNum + 1)
      }
      throw error
    }
  },

  /**
   * 获取"我喜欢"歌单ID
   * dirid: 201 = 我喜欢
   */
  async getLikedListId(): Promise<string | null> {
    try {
      const playlists = await this.getUserPlaylists()
      const likedList = playlists.find((p: any) => p.dirid === 201 || p.isFavorites)
      return likedList ? String(likedList.id || likedList.tid) : null
    } catch (error: any) {
      txLog.error('获取"我喜欢"歌单ID失败', { error: error.message })
      return null
    }
  },

  /**
   * 通过 songmid 获取歌曲详情
   * 备用方法，当 getMusicInfo 失败时使用
   */
  async searchSong(songmid: string): Promise<any[]> {
    txLog.info('=== searchSong 开始 ===', { songmid })

    try {
      // 使用歌曲详情API获取歌曲信息
      const payload = {
        comm: { ct: 24, cv: 1800 },
        req: {
          module: 'music.pf_song_detail_svr',
          method: 'get_song_detail_yqq',
          param: {
            song_type: 0,
            song_mid: songmid,
          },
        },
      }

      txLog.info('searchSong: 请求payload', { payload: JSON.stringify(payload) })
      const body = await this.sendSignedRequest(payload)

      txLog.info('searchSong: 原始响应', { body: JSON.stringify(body) })

      // 检查响应
      if (!body || body.code !== 0) {
        txLog.warn('searchSong: 获取歌曲详情失败', { songmid, code: body?.code })
        return []
      }

      // 获取歌曲详情
      const trackInfo = body.req?.data?.track_info
      if (!trackInfo) {
        txLog.warn('searchSong: 未找到歌曲信息', { songmid })
        return []
      }

      const songId = trackInfo.id
      if (!songId || songId === 0) {
        txLog.warn('searchSong: songId 无效', { songmid, songId })
        return []
      }

      txLog.info('searchSong: 获取成功', { songmid, songId, name: trackInfo.title })

      return [{
        songId,
        songmid: trackInfo.mid,
        name: trackInfo.title,
        singer: (trackInfo.singer || []).map((s: any) => s.name).join('/'),
      }]
    } catch (error: any) {
      txLog.error('searchSong 失败', { songmid, error: error.message })
      return []
    }
  },

  /**
   * 喜欢/取消喜欢歌曲
   * @param songMid 歌曲 mid
   * @param like true=喜欢, false=取消喜欢
   */
  async likeSong(songMid: string, like: boolean): Promise<boolean> {
    const likedListId = await this.getLikedListId()
    if (!likedListId) {
      throw new Error('未找到"我喜欢"歌单，可能是Cookie已失效，请重新登录QQ音乐')
    }

    if (like) {
      await this.addSongToPlaylist(likedListId, [songMid])
      txLog.info('喜欢歌曲成功', { songMid })
    } else {
      await this.removeSongFromPlaylist(likedListId, [songMid])
      txLog.info('取消喜欢歌曲成功', { songMid })
    }

    return true
  },
};
