// import { getPlayInfo } from '@/utils/data'
// import { log } from '@/utils/log'
import { init as musicSdkInit } from '@/utils/musicSdk'
import { getUserLists, setUserList } from '@/core/list'
import { setNavActiveId } from '../common'
import { getViewPrevState } from '@/utils/data'
import { bootLog } from '@/utils/bootLog'
import { getDislikeInfo, setDislikeInfo } from '@/core/dislikeList'
import { unlink } from '@/utils/fs'
import { TEMP_FILE_PATH } from '@/utils/tools'
// import { play, playList } from '../player/player'
import wyUserApi from '@/utils/musicSdk/wy/user'
import txUserApi from '@/utils/musicSdk/tx/user'
import { getUserPlaylists as getKgUserPlaylists } from '@/utils/kugouApi'
import {
  setWyFollowedArtists,
  setWyLikedSongs,
  setWySubscribedAlbums,
  setWySubscribedPlaylists,
  setWyUid,
  setTxLikedSongs,
  setTxSubscribedPlaylists,
  setKgSubscribedPlaylists,
  setKgLikedSongs
} from '@/store/user/action.ts'
import {getDownloadTasks} from "@/utils/data/download.ts";
import downloadActions from '@/store/download/action';
// const initPrevPlayInfo = async(appSetting: LX.AppSetting) => {
//   const info = await getPlayInfo()
//   global.lx.restorePlayInfo = null
//   if (!info?.listId || info.index < 0) return
//   const list = await getListMusics(info.listId)
//   if (!list[info.index]) return
//   global.lx.restorePlayInfo = info
//   await playList(info.listId, info.index)

//   if (appSetting['player.startupAutoPlay']) setTimeout(play)
// }

export default async (appSetting: LX.AppSetting) => {
  // await Promise.all([
  //   initUserApi(), // 自定义API
  // ]).catch(err => log.error(err))
  void musicSdkInit() // 初始化音乐sdk
  bootLog('User list init...')
  setUserList(await getUserLists()) // 获取用户列表
  setDislikeInfo(await getDislikeInfo()) // 获取不喜欢列表
  bootLog('User list inited.')


  bootLog('Download tasks init...');
  const savedTasks = await getDownloadTasks();
  downloadActions.setTasks(savedTasks);
  bootLog('Download tasks inited.');

  // 获取网易云喜欢列表
  const wy_cookie = appSetting['common.wy_cookie']
  if (wy_cookie) {
    bootLog('Wy like list init...')
    wyUserApi.getUid(wy_cookie)
      .then(uid =>
      {
        setWyUid(uid)
        wyUserApi.getLikedSongList(uid, wy_cookie).then(ids => {
          setWyLikedSongs(ids)
          bootLog('Wy like list inited.')
        })
        wyUserApi.getAllSublist().then(artists => {
          setWyFollowedArtists(artists)
          bootLog('Wy followed artists inited.')
        }).catch(err => {
          bootLog(`Wy followed artists init failed: ${err.message}`)
        })
        wyUserApi.getAllSubAlbumList().then(albums => {
          setWySubscribedAlbums(albums)
          bootLog('Wy liked albums inited.')
        }).catch(err => {
          bootLog(`Wy liked albums init failed: ${err.message}`)
        })
        wyUserApi.getUserPlaylists(uid, wy_cookie).then(playlists => {
          setWySubscribedPlaylists(playlists)
          bootLog('Wy subscribed playlists inited.')
        }).catch(err => {
          bootLog(`Wy subscribed playlists init failed: ${err.message}`)
        })
      })
      .catch(err => {
        bootLog(`Wy like list init failed: ${err.message}`)
      })
  }

  // 获取QQ音乐喜欢列表
  const tx_cookie = appSetting['common.tx_cookie']
  if (tx_cookie) {
    bootLog('Tx like list init...')
    ;(async () => {
      try {
        const allLikedMids: string[] = []
        let page = 1
        const pageSize = 100
        let hasMore = true

        while (hasMore) {
          const result = await txUserApi.getFavSongs(page, pageSize)
          if (result.list && result.list.length > 0) {
            allLikedMids.push(...result.list.map((song: any) => song.mid))
          }
          hasMore = result.hasMore
          page++
        }

        setTxLikedSongs(allLikedMids)
        bootLog(`Tx like list inited. (${allLikedMids.length} songs)`)
      } catch (err: any) {
        bootLog(`Tx like list init failed: ${err.message}`)
      }
    })()

    bootLog('Tx playlists init...')
    txUserApi.getUserPlaylists().then(playlists => {
      const formattedPlaylists = playlists.map((p: any) => ({
        id: `tx__${p.id}`,
        name: p.name,
        cover: p.cover,
        songCount: p.songCount,
        creator: { nickname: 'QQ音乐' },
        dirid: p.dirid,
        tid: p.tid,
        desc: p.desc,
        isFavorites: p.isFavorites,
        isCollected: p.isCollected,
      }))
      setTxSubscribedPlaylists(formattedPlaylists)
      bootLog('Tx playlists inited.')
    }).catch(err => {
      bootLog(`Tx playlists init failed: ${err.message}`)
    })
  }

  // 获取酷狗音乐歌单列表
  const kg_cookie = appSetting['common.kg_cookie']
  if (kg_cookie) {
    bootLog('Kg playlists init...')
    getKgUserPlaylists(kg_cookie).then(async result => {
      if (result.success && result.data) {
        const allPlaylists = [...(result.data.createdList || []), ...(result.data.collectedList || [])]
        const formattedPlaylists = allPlaylists.map((p: any) => ({
          id: p.id || `kg_${p.listid}`,
          listid: p.listid,  // 保存数字ID用于API调用
          name: p.name,
          cover: p.cover,
          songCount: p.songCount,
          desc: p.desc,
          isCollected: p.isCollected || false,  // 是否是收藏的歌单
        }))
        setKgSubscribedPlaylists(formattedPlaylists)
        bootLog('Kg playlists inited.')

        // 获取"我喜欢"歌单中的歌曲ID列表
        const favoritesPlaylist = result.data.createdList.find((p: any) => p.isFavorites)
        if (favoritesPlaylist) {
          bootLog('Kg like list init...')
          try {
            const { getPlaylistSongs } = await import('@/utils/kugouApi')
            const allLikedIds: string[] = []
            let page = 1
            const pageSize = 500
            let hasMore = true

            while (hasMore) {
              const songsResult = await getPlaylistSongs(kg_cookie, favoritesPlaylist.id, page, pageSize)
              if (songsResult.success && songsResult.data?.list?.length) {
                for (const song of songsResult.data.list) {
                  const songId = song.songmid || song.hash || song.audio_id
                  if (songId) {
                    allLikedIds.push(String(songId))
                  }
                }
                hasMore = songsResult.data.list.length === pageSize
                page++
              } else {
                hasMore = false
              }
            }

            setKgLikedSongs(allLikedIds)
            bootLog(`Kg like list inited. (${allLikedIds.length} songs)`)
          } catch (err: any) {
            bootLog(`Kg like list init failed: ${err.message}`)
          }
        }
      }
    }).catch(err => {
      bootLog(`Kg playlists init failed: ${err.message}`)
    })
  }

  setNavActiveId((await getViewPrevState()).id)
  void unlink(TEMP_FILE_PATH)
  // await initPrevPlayInfo(appSetting).catch(err => log.error(err)) // 初始化上次的歌曲播放信息
}
