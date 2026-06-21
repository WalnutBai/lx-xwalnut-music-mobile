import { memo, useRef, useCallback, useState, useEffect } from 'react'
import { View, TouchableOpacity, Alert } from 'react-native'
import { Icon } from '@/components/common/Icon'
import { SvgIcon } from '@/components/common/SvgIcon'
import { useTheme } from '@/store/theme/hook'
import { createStyle, toast } from '@/utils/tools'
import { scaleSizeW } from '@/utils/pixelRatio'
import { navigations } from '@/navigation'
import commonState from '@/store/common/state'
import playerState from '@/store/player/state'
import { useSettingValue } from '@/store/setting/hook'
import PlayDetailMenu, { type PlayDetailMenuType, type SelectInfo } from '@/screens/PlayDetail/components/PlayDetailMenu'
import MusicAddModal, { type MusicAddModalType } from '@/components/MusicAddModal'
import MusicDownloadModal, { type MusicDownloadModalType } from '@/screens/Home/Views/Mylist/MusicList/MusicDownloadModal'
import DesktopLyricEnable, { type DesktopLyricEnableType } from '@/components/DesktopLyricEnable'
import SimilarSongsModal, { type SimilarSongsModalType } from '@/components/SimilarSongsModal'
import { toggleDesktopLyricLock } from '@/core/desktopLyric'
import { updateSetting } from '@/core/common'
import settingState from '@/store/setting/state'
import { handleDislikeMusic, handleShare, handleShowMusicSourceDetail, handleClearMusicCache } from '@/screens/Home/Views/Mylist/MusicList/listAction'
import { handleLikeMusic, handleTxLikeMusic, handleKgLikeMusic, handleShowAlbumDetail, handleShowArtistDetail } from '@/components/OnlineList/listAction'
import { isOneDriveMusicInfo } from '@/core/oneDrive/utils'
import { usePlayMusicInfo } from '@/store/player/hook'
import { type Position } from '@/screens/Home/Views/Mylist/MusicList/ListMenu'
import { getMvUrl as getWyMvUrl } from '@/utils/musicSdk/wy/mv.js'
import { getMvUrl as getTxMvUrl } from '@/utils/musicSdk/tx/mv.js'
import { getMvUrl as getKgMvUrl } from '@/utils/musicSdk/kg/mv.js'
import ClimaxBtn from '@/screens/PlayDetail/Vertical/Player/components/MoreBtn/ClimaxBtn'
import { useWindowSize } from '@/utils/hooks'

const BTN_SIZE = scaleSizeW(50)

export default memo(({ componentId }: { componentId: string }) => {
  const theme = useTheme()
  const iconColor = theme.isDark ? theme['c-font'] : theme['c-primary']
  const { height: winHeight } = useWindowSize()
  const isSmallWindow = winHeight < 700
  const menuRef = useRef<PlayDetailMenuType>(null)
  const musicAddModalRef = useRef<MusicAddModalType>(null)
  const musicDownloadModalRef = useRef<MusicDownloadModalType>(null)
  const desktopLyricEnableRef = useRef<DesktopLyricEnableType>(null)
  const similarSongsModalRef = useRef<SimilarSongsModalType>(null)
  const moreBtnRef = useRef<TouchableOpacity>(null)
  const playMusicInfo = usePlayMusicInfo()
  const isOneDrive = isOneDriveMusicInfo(playMusicInfo.musicInfo)
  const enabledLyric = useSettingValue('desktopLyric.enable')

  // BUG1: 歌词按钮 - 打开/关闭桌面歌词（参考 DesktopLyricBtn）
  const handleLyricPress = useCallback(() => {
    desktopLyricEnableRef.current?.setEnabled(!enabledLyric)
  }, [enabledLyric])

  // BUG3: 下载按钮 - 显示下载弹窗（参考 MoreBtn/index.tsx onDownload）
  const handleDownloadPress = useCallback(() => {
    const info = playerState.playMusicInfo.musicInfo
    if (!info) return
    const musicInfo = 'progress' in info ? info.metadata.musicInfo : info
    if (settingState.setting['download.enable']) {
      musicDownloadModalRef.current?.show(musicInfo)
    }
  }, [])

  // BUG2: 评论按钮 - 使用 componentId 而非 commonState
  const handleCommentPress = useCallback(() => {
    navigations.pushCommentScreen(componentId)
  }, [componentId])

  const handleShowMenu = useCallback(() => {
    const musicInfo = playerState.playMusicInfo.musicInfo
    if (!musicInfo) return
    moreBtnRef.current?.measure((fx, fy, width, height, px, py) => {
      const position: Position = {
        x: Math.ceil(px),
        y: Math.ceil(py),
        w: Math.ceil(width),
        h: Math.ceil(height),
      }
      menuRef.current?.show({ musicInfo: 'progress' in musicInfo ? musicInfo.metadata.musicInfo : musicInfo }, position)
    })
  }, [])

  const handleAddPress = useCallback(() => {
    const musicInfo = playerState.playMusicInfo.musicInfo
    if (!musicInfo) return
    musicAddModalRef.current?.show({
      musicInfo: 'progress' in musicInfo ? musicInfo.metadata.musicInfo : musicInfo,
      isMove: false,
      listId: playerState.playMusicInfo.listId!,
    })
  }, [])

  const onAdd = useCallback((info: SelectInfo) => {
    musicAddModalRef.current?.show({
      musicInfo: info.musicInfo,
      isMove: false,
      listId: playerState.playMusicInfo.listId!,
    })
  }, [])

  const onLike = useCallback((info: SelectInfo) => {
    if (info.musicInfo.source === 'wy') {
      handleLikeMusic(info.musicInfo as LX.Music.MusicInfoOnline)
    } else if (info.musicInfo.source === 'tx') {
      handleTxLikeMusic(info.musicInfo as LX.Music.MusicInfoOnline)
    } else if (info.musicInfo.source === 'kg') {
      handleKgLikeMusic(info.musicInfo as LX.Music.MusicInfoOnline)
    }
  }, [])

  const onDownload = useCallback((info: SelectInfo) => {
    if (settingState.setting['download.enable']) {
      musicDownloadModalRef.current?.show(info.musicInfo)
    }
  }, [])

  const onCopyName = useCallback((info: SelectInfo) => {
    handleShare(info.musicInfo)
  }, [])

  const onArtistDetail = useCallback((info: SelectInfo) => {
    if (info.musicInfo.source !== 'local') {
      handleShowArtistDetail(componentId, info.musicInfo)
    }
  }, [componentId])

  const onAlbumDetail = useCallback((info: SelectInfo) => {
    if (info.musicInfo.source !== 'local') {
      handleShowAlbumDetail(componentId, info.musicInfo)
    }
  }, [componentId])

  const onSimilarSongs = useCallback((info: SelectInfo) => {
    similarSongsModalRef.current?.show(info.musicInfo)
  }, [])

  const onMusicSourceDetail = useCallback((info: SelectInfo) => {
    void handleShowMusicSourceDetail(info.musicInfo)
  }, [])

  const onDislikeMusic = useCallback((info: SelectInfo) => {
    void handleDislikeMusic(info.musicInfo)
  }, [])

  const onPlayMv = useCallback((info: SelectInfo) => {
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

  const onClearCache = useCallback((info: SelectInfo) => {
    void handleClearMusicCache(info.musicInfo)
  }, [])

  return (
    <View style={[styles.container, isSmallWindow && { paddingVertical: 6 }]}>
      <ClimaxBtn />
      <TouchableOpacity style={styles.btnItem} onPress={handleLyricPress} activeOpacity={0.6}>
        <SvgIcon name="lyric" color={enabledLyric ? theme['c-primary'] : iconColor} size={enabledLyric ? BTN_SIZE * 0.9 : BTN_SIZE * 0.8} />
      </TouchableOpacity>
      <TouchableOpacity style={styles.btnItem} onPress={handleAddPress} activeOpacity={0.6}>
        <Icon name="add-music" color={iconColor} size={BTN_SIZE * 0.55} />
      </TouchableOpacity>
      <TouchableOpacity style={styles.btnItem} onPress={handleDownloadPress} activeOpacity={0.6}>
        <Icon name="download-2" color={iconColor} size={BTN_SIZE * 0.55} />
      </TouchableOpacity>
      <TouchableOpacity style={styles.btnItem} onPress={handleCommentPress} activeOpacity={0.6}>
        <Icon name="comment" color={iconColor} size={BTN_SIZE * 0.55} />
      </TouchableOpacity>
      <TouchableOpacity ref={moreBtnRef} style={styles.btnItem} onPress={handleShowMenu} activeOpacity={0.6}>
        <Icon name="dots-vertical" color={iconColor} size={BTN_SIZE * 0.55} />
      </TouchableOpacity>
      <PlayDetailMenu
        ref={menuRef}
        onAdd={onAdd}
        onLike={onLike}
        onDownload={onDownload}
        onCopyName={onCopyName}
        onArtistDetail={onArtistDetail}
        onAlbumDetail={onAlbumDetail}
        onSimilarSongs={onSimilarSongs}
        onMusicSourceDetail={onMusicSourceDetail}
        onDislikeMusic={onDislikeMusic}
        onPlayMv={onPlayMv}
        onClearCache={onClearCache}
      />
      <MusicAddModal ref={musicAddModalRef} />
      {settingState.setting['download.enable'] && <MusicDownloadModal ref={musicDownloadModalRef} onDownloadInfo={() => {}} />}
      <DesktopLyricEnable ref={desktopLyricEnableRef} />
      <SimilarSongsModal ref={similarSongsModalRef} />
    </View>
  )
})

const styles = createStyle({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
    paddingVertical: 16,
  },
  btnItem: {
    width: BTN_SIZE,
    height: BTN_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
})
