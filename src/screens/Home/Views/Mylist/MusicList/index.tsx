import { useCallback, useRef } from 'react'

import listState from '@/store/list/state'
import settingState from '@/store/setting/state'
import ListMenu, { type ListMenuType, type Position, type SelectInfo } from './ListMenu'
import {
  handleDislikeMusic,
  handlePlay,
  handlePlayLater,
  handleRemove,
  handleShare,
  handleShowMusicSourceDetail,
  handleUpdateMusicInfo,
  handleUpdateMusicPosition,
  handleClearMusicCache,
} from './listAction'
import List, { type ListType } from './List'
import ListMusicAdd, {
  type MusicAddModalType as ListMusicAddType,
} from '@/components/MusicAddModal'
import ListMusicMultiAdd, {
  type MusicMultiAddModalType as ListAddMultiType,
} from '@/components/MusicMultiAddModal'
import {createStyle, toast} from '@/utils/tools'
import { type LayoutChangeEvent, TouchableOpacity, View } from 'react-native'
import ActiveList, { type ActiveListType } from './ActiveList'
import MultipleModeBar, { type SelectMode, type MultipleModeBarType } from './MultipleModeBar'
import ListSearchBar, { type ListSearchBarType } from './ListSearchBar'
import ListMusicSearch, { type ListMusicSearchType } from './ListMusicSearch'
import MusicPositionModal, { type MusicPositionModalType } from './MusicPositionModal'
import MetadataEditModal, {
  type MetadataEditType,
  type MetadataEditProps,
} from '@/components/MetadataEditModal'
import MusicDownloadModal, { type MusicDownloadModalType } from './MusicDownloadModal'
import MusicToggleModal, { type MusicToggleModalType } from './MusicToggleModal'
import {handleShowAlbumDetail, handleShowArtistDetail} from "@/components/OnlineList/listAction.ts";
import {useSettingValue} from "@/store/setting/hook.ts";
import {updateSetting} from "@/core/common.ts";
import {getMvUrl as getWyMvUrl} from "@/utils/musicSdk/wy/mv.js";
import {getMvUrl as getTxMvUrl} from "@/utils/musicSdk/tx/mv.js";
import {getMvUrl as getKgMvUrl} from "@/utils/musicSdk/kg/mv.js";
import commonState from '@/store/common/state';
import SimilarSongsModal, { type SimilarSongsModalType } from '@/components/SimilarSongsModal'

export interface MusicListProps {
  onBack?: () => void
}

export default ({ onBack }: MusicListProps) => {
  const activeListRef = useRef<ActiveListType>(null)
  const listMusicSearchRef = useRef<ListMusicSearchType>(null)
  const listRef = useRef<ListType>(null)
  const multipleModeBarRef = useRef<MultipleModeBarType>(null)
  const listSearchBarRef = useRef<ListSearchBarType>(null)
  const listMusicAddRef = useRef<ListMusicAddType>(null)
  const listMusicMultiAddRef = useRef<ListAddMultiType>(null)
  const musicPositionModalRef = useRef<MusicPositionModalType>(null)
  let musicDownloadModalRef = null
  if (settingState.setting['download.enable']) {
    musicDownloadModalRef = useRef<MusicDownloadModalType>(null)
  }
  const metadataEditTypeRef = useRef<MetadataEditType>(null)
  const listMenuRef = useRef<ListMenuType>(null)
  const musicToggleModalRef = useRef<MusicToggleModalType>(null)
  const similarSongsModalRef = useRef<SimilarSongsModalType>(null)
  const layoutHeightRef = useRef<number>(0)
  const isShowMultipleModeBar = useRef(false)
  const isShowSearchBarModeBar = useRef(false)
  const selectedInfoRef = useRef<SelectInfo>()

  const showCover = useSettingValue('list.isShowCover');
  const handleToggleView = useCallback(() => {
    updateSetting({ 'list.isShowCover': !showCover });
  }, [showCover]);

  const hancelMultiSelect = useCallback(() => {
    if (isShowSearchBarModeBar.current) {
      multipleModeBarRef.current?.setVisibleBar(false)
    } else activeListRef.current?.setVisibleBar(false)
    isShowMultipleModeBar.current = true
    multipleModeBarRef.current?.show()
    listRef.current?.setIsMultiSelectMode(true)
  }, [])
  const hancelExitSelect = useCallback(() => {
    if (isShowSearchBarModeBar.current) {
      multipleModeBarRef.current?.setVisibleBar(true)
    } else activeListRef.current?.setVisibleBar(true)
    multipleModeBarRef.current?.exitSelectMode()
    listRef.current?.setIsMultiSelectMode(false)
    isShowMultipleModeBar.current = false
  }, [])
  const hancelSwitchSelectMode = useCallback((mode: SelectMode) => {
    multipleModeBarRef.current?.setSwitchMode(mode)
    listRef.current?.setSelectMode(mode)
  }, [])
  const hancelScrollToTop = useCallback(() => {
    listRef.current?.scrollToTop()
  }, [])
  const handleShowArtist = useCallback((info: SelectInfo) => {
    if (info.musicInfo.source !== 'local') {
      void handleShowArtistDetail(commonState.componentIds[commonState.componentIds.length - 1]?.id!, info.musicInfo);
    }
  }, []);

  const handleShowAlbum = useCallback((info: SelectInfo) => {
    if (info.musicInfo.source !== 'local') {
      handleShowAlbumDetail(commonState.componentIds[commonState.componentIds.length - 1]?.id!, info.musicInfo);
    }
  }, []);

  const handlePlayMv = useCallback((info: SelectInfo) => {
    console.log('[MV] 点击播放MV, source:', info.musicInfo.source, 'musicInfo:', info.musicInfo)
    
    if (info.musicInfo.source === 'wy') {
      const mvId = info.musicInfo.meta.mv;
      if (!mvId) {
        console.log('[MV] 网易云: 无MV ID')
        return
      }
      console.log('[MV] 网易云: 获取MV URL, mvId:', mvId)
      getWyMvUrl(mvId).then(data => {
        console.log('[MV] 网易云: 获取MV URL成功:', data)
        global.app_event.showVideoPlayer(data.url);
      }).catch(err => {
        console.error('[MV] 网易云: 获取MV失败:', err)
        toast(err.message || '获取MV失败');
      });
    } else if (info.musicInfo.source === 'tx') {
      const vid = info.musicInfo.meta.vid;
      if (!vid) {
        console.log('[MV] QQ: 无VID')
        return
      }
      console.log('[MV] QQ: 获取MV URL, vid:', vid)
      getTxMvUrl(vid).then(data => {
        console.log('[MV] QQ: 获取MV URL成功:', data)
        global.app_event.showVideoPlayer(data.url);
      }).catch(err => {
        console.error('[MV] QQ: 获取MV失败:', err)
        toast(err.message || '获取MV失败');
      });
    } else if (info.musicInfo.source === 'kg') {
      const mixSongId = info.musicInfo.meta.mixSongId || info.musicInfo.mixSongId || info.musicInfo.meta.songId;
      const songName = info.musicInfo.name;
      const singerName = info.musicInfo.singer;
      if (!mixSongId) {
        console.log('[MV] 酷狗: 无mixSongId')
        toast('无法获取歌曲ID')
        return
      }
      console.log('[MV] 酷狗: 开始获取MV, mixSongId:', mixSongId, 'songName:', songName, 'singerName:', singerName)
      getKgMvUrl(String(mixSongId), songName, singerName).then(data => {
        console.log('[MV] 酷狗: 获取MV URL成功:', data)
        if (data && data.url) {
          global.app_event.showVideoPlayer(data.url);
        } else {
          console.log('[MV] 酷狗: 返回数据无URL:', data)
          toast('获取MV链接失败')
        }
      }).catch(err => {
        console.error('[MV] 酷狗: 获取MV失败:', err)
        toast(err.message || '该歌曲暂无MV');
      });
    }
  }, []);

  const showMenu = useCallback(
    (musicInfo: LX.Music.MusicInfo, index: number, position: Position) => {
      listMenuRef.current?.show(
        {
          musicInfo,
          index,
          listId: listState.activeListId,
          single: false,
          selectedList: listRef.current!.getSelectedList(),
        },
        position
      )
    },
    []
  )
  const handleShowSearch = useCallback(() => {
    isShowSearchBarModeBar.current = true
    if (isShowMultipleModeBar.current) {
      multipleModeBarRef.current?.setVisibleBar(false)
    } else activeListRef.current?.setVisibleBar(false)
    listSearchBarRef.current?.show()
  }, [])
  const handleExitSearch = useCallback(() => {
    isShowSearchBarModeBar.current = false
    listMusicSearchRef.current?.hide()
    listSearchBarRef.current?.hide()
    if (isShowMultipleModeBar.current) {
      multipleModeBarRef.current?.setVisibleBar(true)
    } else activeListRef.current?.setVisibleBar(true)
  }, [])
  const handleScrollToInfo = useCallback(
    (info: LX.Music.MusicInfo) => {
      listRef.current?.scrollToInfo(info)
      handleExitSearch()
    },
    [handleExitSearch]
  )
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    layoutHeightRef.current = e.nativeEvent.layout.height
  }, [])

  const handleAddMusic = useCallback((info: SelectInfo) => {
    if (info.selectedList.length) {
      listMusicMultiAddRef.current?.show({
        selectedList: info.selectedList,
        listId: info.listId,
        isMove: false,
      })
    } else {
      listMusicAddRef.current?.show({
        musicInfo: info.musicInfo,
        listId: info.listId,
        isMove: false,
      })
    }
  }, [])
  const handleMoveMusic = useCallback((info: SelectInfo) => {
    if (info.selectedList.length) {
      listMusicMultiAddRef.current?.show({
        selectedList: info.selectedList,
        listId: info.listId,
        isMove: true,
      })
    } else {
      listMusicAddRef.current?.show({
        musicInfo: info.musicInfo,
        listId: info.listId,
        isMove: true,
      })
    }
  }, [])
  const handleEditMetadata = useCallback((info: SelectInfo) => {
    if (info.musicInfo.source != 'local') return
    selectedInfoRef.current = info
    metadataEditTypeRef.current?.show(info.musicInfo.meta.filePath)
  }, [])
  const handleUpdateMetadata = useCallback<MetadataEditProps['onUpdate']>((info) => {
    if (!selectedInfoRef.current || selectedInfoRef.current.musicInfo.source != 'local') return
    handleUpdateMusicInfo(selectedInfoRef.current.listId, selectedInfoRef.current.musicInfo, info)
  }, [])

  return (
    <View style={styles.container}>
      <View style={{ zIndex: 2 }}>
        <ActiveList
          ref={activeListRef}
          onShowSearchBar={handleShowSearch}
          onScrollToTop={hancelScrollToTop}
          showCover={showCover}
          onToggleView={handleToggleView}
          onBack={onBack}
        />
        <MultipleModeBar
          ref={multipleModeBarRef}
          onSwitchMode={hancelSwitchSelectMode}
          onSelectAll={(isAll) => listRef.current?.selectAll(isAll)}
          onExitSelectMode={hancelExitSelect}
        />
        <ListSearchBar
          ref={listSearchBarRef}
          onSearch={(keyword) =>
            listMusicSearchRef.current?.search(keyword, layoutHeightRef.current)
          }
          onExitSearch={handleExitSearch}
        />
      </View>
      <View style={{ flex: 1 }} onLayout={onLayout}>
        <List
          ref={listRef}
          onShowMenu={showMenu}
          onMuiltSelectMode={hancelMultiSelect}
          onSelectAll={(isAll) => multipleModeBarRef.current?.setIsSelectAll(isAll)}
          showCover={showCover}
        />
        <ListMusicSearch ref={listMusicSearchRef} onScrollToInfo={handleScrollToInfo} />
      </View>
      <ListMusicAdd ref={listMusicAddRef} onAdded={hancelExitSelect} />
      <ListMusicMultiAdd ref={listMusicMultiAddRef} onAdded={hancelExitSelect} />
      <MusicPositionModal
        ref={musicPositionModalRef}
        onUpdatePosition={(info, postion) => {
          handleUpdateMusicPosition(
            postion,
            info.listId,
            info.musicInfo,
            info.selectedList,
            hancelExitSelect
          )
        }}
      />
      {musicDownloadModalRef && (
        <MusicDownloadModal ref={musicDownloadModalRef} onDownloadInfo={(info) => {}} />
      )}
      <ListMenu
        ref={listMenuRef}
        onPlay={(info) => {
          handlePlay(info.listId, info.index)
        }}
        onPlayLater={(info) => {
          hancelExitSelect()
          handlePlayLater(info.listId, info.musicInfo, info.selectedList, hancelExitSelect)
        }}
        onRemove={(info) => {
          hancelExitSelect()
          handleRemove(info.listId, info.musicInfo, info.selectedList, hancelExitSelect)
        }}
        onDislikeMusic={(info) => {
          void handleDislikeMusic(info.musicInfo)
        }}
        onCopyName={(info) => {
          handleShare(info.musicInfo)
        }}
        onDownload={(info) => musicDownloadModalRef?.current?.show(info.musicInfo)}
        onMusicSourceDetail={(info) => {
          void handleShowMusicSourceDetail(info.musicInfo)
        }}
        onAdd={handleAddMusic}
        onMove={handleMoveMusic}
        onEditMetadata={handleEditMetadata}
        onChangePosition={(info) => musicPositionModalRef.current?.show(info)}
        onToggleSource={(info) => musicToggleModalRef.current?.show(info)}
        onArtistDetail={handleShowArtist}
        onAlbumDetail={handleShowAlbum}
        onSimilarSongs={(info) => {
          similarSongsModalRef.current?.show(info.musicInfo)
        }}
        onPlayMv={handlePlayMv}
        onClearCache={(info) => {
          void handleClearMusicCache(info.musicInfo)
        }}
      />
      <MetadataEditModal ref={metadataEditTypeRef} onUpdate={handleUpdateMetadata} />
      <MusicToggleModal ref={musicToggleModalRef} />
      <SimilarSongsModal ref={similarSongsModalRef} />
    </View>
  )
}

const styles = createStyle({
  container: {
    flex: 1,
    flexDirection: 'column',
  },
})