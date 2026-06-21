import {useRef, forwardRef, useImperativeHandle, useCallback} from 'react'
import { View } from 'react-native'
import List, { type ListProps, type ListType, type Status, type RowInfoType } from './List'
import ListMenu, { type ListMenuType, type Position, type SelectInfo } from './ListMenu'
import ListMusicMultiAdd, {
  type MusicMultiAddModalType as ListAddMultiType,
} from '@/components/MusicMultiAddModal'
import ListMusicAdd, {
  type MusicAddModalType as ListMusicAddType,
} from '@/components/MusicAddModal'
import MultipleModeBar, { type MultipleModeBarType, type SelectMode } from './MultipleModeBar'
import {
  handleDislikeMusic,
  handlePlay,
  handlePlayLater,
  handleShare,
  handleShowMusicSourceDetail,
  handleShowArtistDetail,
  handleShowAlbumDetail,
  handleLikeMusic,
  handleTxLikeMusic,
  handleKgLikeMusic,
} from './listAction'
import { handleClearMusicCache } from '@/screens/Home/Views/Mylist/MusicList/listAction'
import MusicDownloadModal, {
  type MusicDownloadModalType,
} from '@/screens/Home/Views/Mylist/MusicList/MusicDownloadModal'
import {createStyle, toast} from '@/utils/tools'
import wyApi from '@/utils/musicSdk/wy/user'
import txUserApi from '@/utils/musicSdk/tx/user'
import { removeSongsFromPlaylist as removeKgSongsFromPlaylist, getPlaylistSongs as getKgPlaylistSongs } from '@/utils/kugouApi'
import {batchDownload} from "@/core/download.ts"
import {getMvUrl as getWyMvUrl} from "@/utils/musicSdk/wy/mv.js"
import {getMvUrl as getTxMvUrl} from "@/utils/musicSdk/tx/mv.js"
import {getMvUrl as getKgMvUrl} from "@/utils/musicSdk/kg/mv.js"
import {useI18n} from "@/lang"
import {removeWyLikedSong, updateWySubscribedPlaylistTrackCount} from "@/store/user/action.ts"
import {clearListDetailCache} from "@/core/songlist.ts"
import commonState from '@/store/common/state'
import {useWySubscribedPlaylists} from "@/store/user/hook.ts";
import {useSettingValue} from "@/store/setting/hook.ts";
import SimilarSongsModal, { type SimilarSongsModalType } from '@/components/SimilarSongsModal'

export interface OnlineListProps {
  onRefresh: ListProps['onRefresh']
  onLoadMore: ListProps['onLoadMore']
  onPlayList?: ListProps['onPlayList']
  progressViewOffset?: ListProps['progressViewOffset']
  ListHeaderComponent?: ListProps['ListHeaderComponent']
  ListFooterComponent?: ListProps['ListFooterComponent']
  checkHomePagerIdle?: boolean
  rowType?: RowInfoType
  listId?: string
  playingId?: string | null
  forcePlayList?: boolean
  onListUpdate?: ListProps['onListUpdate']
  isCreator?: boolean
  componentId?: string
}

export interface OnlineListType {
  setList: (list: LX.Music.MusicInfoOnline[], isAppend?: boolean, showSource?: boolean) => void
  setStatus: (val: Status) => void
  getList: () => LX.Music.MusicInfoOnline[]
  scrollToInfo: (info: LX.Music.MusicInfoOnline) => void
}

export default forwardRef<OnlineListType, OnlineListProps>(
  (
    {
      onRefresh,
      onLoadMore,
      onPlayList,
      progressViewOffset,
      ListHeaderComponent,
      ListFooterComponent,
      checkHomePagerIdle = false,
      rowType,
      listId,
      playingId,
      forcePlayList,
      onListUpdate,
      isCreator = false,
      componentId: componentId_raw,
    },
    ref,
  ) => {
    const listRef = useRef<ListType>(null)
    const multipleModeBarRef = useRef<MultipleModeBarType>(null)
    const listMusicAddRef = useRef<ListMusicAddType>(null)
    const listMusicMultiAddRef = useRef<ListAddMultiType>(null)
    const listMenuRef = useRef<ListMenuType>(null)
    const musicDownloadModalRef = useRef<MusicDownloadModalType>(null)
    const similarSongsModalRef = useRef<SimilarSongsModalType>(null)
    const t = useI18n()
    const subscribedPlaylists = useWySubscribedPlaylists()
    const kgCookie = useSettingValue('common.kg_cookie')

    useImperativeHandle(ref, () => ({
      setList(list, isAppend = false, showSource = false) {
        listRef.current?.setList(list, isAppend, showSource)
        multipleModeBarRef.current?.setIsSelectAll(false)
      },
      setStatus(val) {
        listRef.current?.setStatus(val)
      },
      getList() {
        return listRef.current?.getList() ?? []
      },
      scrollToInfo(info) {
        listRef.current?.scrollToInfo(info)
      },
    }))

    const hancelMultiSelect = () => {
      multipleModeBarRef.current?.show()
      listRef.current?.setIsMultiSelectMode(true)
    }

    const hancelSwitchSelectMode = (mode: SelectMode) => {
      multipleModeBarRef.current?.setSwitchMode(mode)
      listRef.current?.setSelectMode(mode)
    }

    const hancelExitSelect = useCallback(() => {
      multipleModeBarRef.current?.exitSelectMode()
      listRef.current?.setIsMultiSelectMode(false)
    }, [])

    const handleBatchDownload = useCallback(() => {
      const selectedList = listRef.current?.getSelectedList() ?? []
      if (!selectedList.length) return
      void batchDownload(selectedList)
      hancelExitSelect()
    }, [hancelExitSelect])


    const showMenu = (musicInfo: LX.Music.MusicInfoOnline, index: number, position: Position) => {
      listMenuRef.current?.show(
        {
          musicInfo,
          index,
          single: false,
          selectedList: listRef.current!.getSelectedList(),
        },
        position,
      )
    }

    const handleAddMusic = (info: SelectInfo) => {
      if (info.selectedList.length) {
        listMusicMultiAddRef.current?.show({
          selectedList: info.selectedList,
          listId: '',
          isMove: false,
        })
      } else {
        listMusicAddRef.current?.show({ musicInfo: info.musicInfo, listId: '', isMove: false })
      }
    }

    const handleShowArtist = (info: SelectInfo) => {
      const componentId = componentId_raw ?? commonState.componentIds[commonState.componentIds.length - 1]?.id!
      void handleShowArtistDetail(componentId, info.musicInfo)
    }

    const handleShowAlbum = (info: SelectInfo) => {
      const componentId = componentId_raw ?? commonState.componentIds[commonState.componentIds.length - 1]?.id!
      handleShowAlbumDetail(componentId, info.musicInfo)
    }
    const handlePlayMv = useCallback((info: SelectInfo) => {
      console.log('[MV] 点击播放MV, source:', info.musicInfo.source, 'musicInfo:', info.musicInfo)
      
      if (info.musicInfo.source === 'wy') {
        const mvId = info.musicInfo.meta.mv
        if (!mvId) {
          console.log('[MV] 网易云: 无MV ID')
          return
        }
        console.log('[MV] 网易云: 获取MV URL, mvId:', mvId)
        getWyMvUrl(mvId).then(data => {
          console.log('[MV] 网易云: 获取MV URL成功:', data)
          global.app_event.showVideoPlayer(data.url)
        }).catch(err => {
          console.error('[MV] 网易云: 获取MV失败:', err)
          toast(err.message || '获取MV失败')
        })
      } else if (info.musicInfo.source === 'tx') {
        const vid = info.musicInfo.meta.vid
        if (!vid) {
          console.log('[MV] QQ: 无VID')
          return
        }
        console.log('[MV] QQ: 获取MV URL, vid:', vid)
        getTxMvUrl(vid).then(data => {
          console.log('[MV] QQ: 获取MV URL成功:', data)
          global.app_event.showVideoPlayer(data.url)
        }).catch(err => {
          console.error('[MV] QQ: 获取MV失败:', err)
          toast(err.message || '获取MV失败')
        })
      } else if (info.musicInfo.source === 'kg') {
        const mixSongId = info.musicInfo.meta.mixSongId || info.musicInfo.mixSongId || info.musicInfo.meta.songId
        const songName = info.musicInfo.name
        const singerName = info.musicInfo.singer
        if (!mixSongId) {
          console.log('[MV] 酷狗: 无mixSongId')
          toast('无法获取歌曲ID')
          return
        }
        console.log('[MV] 酷狗: 开始获取MV, mixSongId:', mixSongId, 'songName:', songName, 'singerName:', singerName)
        getKgMvUrl(String(mixSongId), songName, singerName).then(data => {
          console.log('[MV] 酷狗: 获取MV URL成功:', data)
          if (data && data.url) {
            global.app_event.showVideoPlayer(data.url)
          } else {
            console.log('[MV] 酷狗: 返回数据无URL:', data)
            toast('获取MV链接失败')
          }
        }).catch(err => {
          console.error('[MV] 酷狗: 获取MV失败:', err)
          toast(err.message || '该歌曲暂无MV')
        })
      }
    }, [])
    const handleMoveMusic = (info: SelectInfo) => {
      if (info.selectedList.length) {
        listMusicMultiAddRef.current?.show({ selectedList: info.selectedList, listId: listId!, isMove: true })
      } else {
        listMusicAddRef.current?.show({ musicInfo: info.musicInfo, listId: listId!, isMove: true })
      }
    }

    const handleRemoveMusic = useCallback((info: SelectInfo) => {
      if (!listId) return
      
      const musicInfos = info.selectedList.length ? info.selectedList : [info.musicInfo]
      
      // 判断来源
      if (listId.startsWith('wy__')) {
        // 网易云音乐
        const playlistId = listId.replace('wy__', '')
        const sourcePlaylist = subscribedPlaylists.find(p => String(p.id) === playlistId)
        const songIds = musicInfos.map(m => m.meta.songId)
        wyApi.manipulatePlaylistTracks('del', playlistId, songIds).then(() => {
          if (sourcePlaylist?.name === sourcePlaylist?.creator?.nickname + '喜欢的音乐') {
            songIds.forEach(removeWyLikedSong)
          }
          toast(t('list_edit_action_tip_remove_success'))
          updateWySubscribedPlaylistTrackCount(playlistId, -songIds.length)
          clearListDetailCache('wy', playlistId)
          global.app_event.playlist_updated({ source: 'wy', listId: playlistId })
          hancelExitSelect()
        }).catch(err => {
          toast('移除失败: ' + err.message)
        })
      } else if (listId.startsWith('tx__')) {
        // QQ音乐
        const playlistId = listId.replace('tx__', '')
        const songMids = musicInfos.map(m => m.meta.songId || m.id)
        txUserApi.removeSongFromPlaylist(playlistId, songMids).then(() => {
          toast(t('list_edit_action_tip_remove_success'))
          clearListDetailCache('tx', playlistId)
          global.app_event.playlist_updated({ source: 'tx', listId: playlistId })
          hancelExitSelect()
        }).catch(err => {
          toast('移除失败: ' + err.message)
        })
      } else if (listId.startsWith('kg__')) {
        // 酷狗音乐 - 需要先获取歌单歌曲的 fileid
        if (!kgCookie) {
          toast('请先登录酷狗音乐，Cookie可能已失效')
          return
        }
        const playlistId = listId.replace('kg__', '')
        // 从 collection_3_userid_listid_ver 格式提取数字 listid
        const numericListId = (() => {
          const parts = playlistId.split('_')
          return parts.length >= 4 ? Number(parts[3]) : Number(playlistId)
        })()
        if (!numericListId || isNaN(numericListId)) {
          toast('无法获取歌单ID')
          return
        }
        // 获取歌单歌曲列表来获取 fileid
        getKgPlaylistSongs(kgCookie, playlistId, 1, 500).then(songsResult => {
          if (!songsResult.success || !songsResult.data?.list) {
            toast('获取歌单歌曲失败')
            return
          }
          // 通过 songmid(hash) 匹配找到 fileid
          const hashToFileId = new Map<string, number>()
          for (const song of songsResult.data.list) {
            if (song.songmid && song.fileId) hashToFileId.set(song.songmid.toLowerCase(), song.fileId)
          }
          // 尝试多种方式获取 hash
          const selectedHashes = musicInfos.map(m => {
            const meta = m.meta as any
            return (meta?.songmid || meta?.songId || m.id || '').toString().toLowerCase()
          }).filter(h => h)
          console.log('[KuGou] 歌单歌曲 hash 列表:', [...hashToFileId.keys()].slice(0, 5))
          console.log('[KuGou] 选中歌曲 hash:', selectedHashes.slice(0, 5))
          const fileids = selectedHashes.map(h => hashToFileId.get(h) || 0).filter(id => id > 0)
          if (fileids.length === 0) {
            toast('找不到对应的歌曲')
            return
          }
          return removeKgSongsFromPlaylist(kgCookie, numericListId, fileids)
        }).then(result => {
          if (!result) return
          if (result.success) {
            toast(t('list_edit_action_tip_remove_success'))
            clearListDetailCache('kg', playlistId)
            global.app_event.playlist_updated({ source: 'kg', listId: playlistId })
            hancelExitSelect()
          } else {
            toast('移除失败: ' + result.message)
          }
        }).catch(err => {
          toast('移除失败: ' + err.message)
        })
      } else {
        toast('不支持的操作')
      }
    }, [listId, hancelExitSelect, t, subscribedPlaylists, kgCookie])

    return (
      <View style={styles.container}>
        <View style={{ flex: 1 }}>
          <List
            ref={listRef}
            listId={listId}
            onShowMenu={showMenu}
            onMuiltSelectMode={hancelMultiSelect}
            onSelectAll={(isAll) => multipleModeBarRef.current?.setIsSelectAll(isAll)}
            onRefresh={onRefresh}
            onLoadMore={onLoadMore}
            onPlayList={onPlayList}
            progressViewOffset={progressViewOffset}
            ListHeaderComponent={ListHeaderComponent}
            ListFooterComponent={ListFooterComponent}
            checkHomePagerIdle={checkHomePagerIdle}
            rowType={rowType}
            playingId={playingId}
            forcePlayList={forcePlayList}
            onListUpdate={onListUpdate}
          />
          <MultipleModeBar
            ref={multipleModeBarRef}
            onSwitchMode={hancelSwitchSelectMode}
            onSelectAll={(isAll) => listRef.current?.selectAll(isAll)}
            onExitSelectMode={hancelExitSelect}
            onDownload={handleBatchDownload}
          />
          <MusicDownloadModal ref={musicDownloadModalRef} onDownloadInfo={(info) => {}} />
        </View>
        <ListMusicAdd
          ref={listMusicAddRef}
          onAdded={hancelExitSelect}
        />
        <ListMusicMultiAdd
          ref={listMusicMultiAddRef}
          onAdded={hancelExitSelect}
        />
        <ListMenu
          ref={listMenuRef}
          listId={listId}
          isCreator={isCreator}
          onPlay={(info) => {
            handlePlay(info.musicInfo)
          }}
          onPlayLater={(info) => {
            hancelExitSelect()
            handlePlayLater(info.musicInfo, info.selectedList, hancelExitSelect)
          }}
          onCopyName={(info) => {
            handleShare(info.musicInfo)
          }}
          onAdd={handleAddMusic}
          onMove={handleMoveMusic}
          onRemove={handleRemoveMusic}
          onArtistDetail={handleShowArtist}
          onAlbumDetail={handleShowAlbum}
          onSimilarSongs={(info) => {
            similarSongsModalRef.current?.show(info.musicInfo)
          }}
          onMusicSourceDetail={(info) => {
            void handleShowMusicSourceDetail(info.musicInfo)
          }}
          onDislikeMusic={(info) => {
            void handleDislikeMusic(info.musicInfo, listId)
          }}
          onDownload={(info) => musicDownloadModalRef.current?.show(info.musicInfo)}
          onLike={(info) => {
            if (info.musicInfo.source === 'wy') {
              handleLikeMusic(info.musicInfo)
            } else if (info.musicInfo.source === 'tx') {
              handleTxLikeMusic(info.musicInfo)
            } else if (info.musicInfo.source === 'kg') {
              handleKgLikeMusic(info.musicInfo)
            }
          }}
          onPlayMv={handlePlayMv}
          onClearCache={(info) => {
            void handleClearMusicCache(info.musicInfo)
          }}
        />
        <SimilarSongsModal ref={similarSongsModalRef} />
        {}
      </View>
    )
  },
)

const styles = createStyle({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  list: {
    flex: 1,
  },
  exitMultipleModeBtn: {
    height: 40,
  },
})
