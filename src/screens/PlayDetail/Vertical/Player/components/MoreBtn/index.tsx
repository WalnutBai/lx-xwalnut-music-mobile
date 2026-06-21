import {createStyle, toast} from '@/utils/tools'
import { View, TouchableOpacity } from 'react-native'
import PlayModeBtn from './PlayModeBtn'
import MusicAddBtn from './MusicAddBtn'
import DesktopLyricBtn from './DesktopLyricBtn'
import CommentBtn from './CommentBtn'
import {memo, useRef, useCallback, useEffect} from 'react'
import Btn from './Btn'
import { type Position } from '@/screens/Home/Views/Mylist/MusicList/ListMenu'
import PlayDetailMenu, { type PlayDetailMenuType, type SelectInfo } from '@/screens/PlayDetail/components/PlayDetailMenu'
import playerState from '@/store/player/state'
import { handleDislikeMusic, handleShare, handleShowMusicSourceDetail, handleClearMusicCache } from '@/screens/Home/Views/Mylist/MusicList/listAction'
import {handleLikeMusic, handleTxLikeMusic, handleKgLikeMusic, handleShowAlbumDetail, handleShowArtistDetail} from '@/components/OnlineList/listAction'
import MusicAddModal, { type MusicAddModalType } from '@/components/MusicAddModal'
import MusicDownloadModal, { type MusicDownloadModalType } from '@/screens/Home/Views/Mylist/MusicList/MusicDownloadModal'
import settingState from '@/store/setting/state'
import {getMvUrl as getWyMvUrl} from "@/utils/musicSdk/wy/mv.js";
import {getMvUrl as getTxMvUrl} from "@/utils/musicSdk/tx/mv.js";
import {getMvUrl as getKgMvUrl} from "@/utils/musicSdk/kg/mv.js";
import SimilarSongsModal, { type SimilarSongsModalType } from '@/components/SimilarSongsModal'
import { isOneDriveMusicInfo } from '@/core/oneDrive/utils'
import { usePlayMusicInfo } from '@/store/player/hook'
import ClimaxBtn from './ClimaxBtn'


export default memo(({ componentId }: { componentId: string }) => {
  const menuRef = useRef<PlayDetailMenuType>(null);
  const moreBtnRef = useRef<TouchableOpacity>(null);
  const musicAddModalRef = useRef<MusicAddModalType>(null);
  const musicDownloadModalRef = useRef<MusicDownloadModalType>(null);
  const similarSongsModalRef = useRef<SimilarSongsModalType>(null);
  const playMusicInfo = usePlayMusicInfo();
  const isOneDrive = isOneDriveMusicInfo(playMusicInfo.musicInfo);

  // 监听歌曲变化，以便在菜单打开时能重新渲染以获取最新的“喜欢”状态
  useEffect(() => {
    const handleMusicChange = () => {
      // 这是一个空的回调，目的只是为了触发组件的重新渲染
      // 以便 useMemo 能够重新计算菜单项
    };
    global.state_event.on('playerMusicInfoChanged', handleMusicChange);
    global.state_event.on('wyLikedListChanged', handleMusicChange);

    return () => {
      global.state_event.off('playerMusicInfoChanged', handleMusicChange);
      global.state_event.off('wyLikedListChanged', handleMusicChange);
    };
  }, []);

  const handleShowMenu = useCallback(() => {
    const musicInfo = playerState.playMusicInfo.musicInfo;
    if (!musicInfo) return;

    moreBtnRef.current?.measure((fx, fy, width, height, px, py) => {
      const position: Position = {
        x: Math.ceil(px),
        y: Math.ceil(py),
        w: Math.ceil(width),
        h: Math.ceil(height),
      };
      menuRef.current?.show({ musicInfo: 'progress' in musicInfo ? musicInfo.metadata.musicInfo : musicInfo }, position);
    });
  }, []);

  const onAdd = (info: SelectInfo) => {
    musicAddModalRef.current?.show({
      musicInfo: info.musicInfo,
      isMove: false,
      listId: playerState.playMusicInfo.listId!,
    });
  };

  const onDownload = (info: SelectInfo) => {
    if (settingState.setting['download.enable']) {
      musicDownloadModalRef.current?.show(info.musicInfo);
    }
  };

  const onCopyName = (info: SelectInfo) => {
    handleShare(info.musicInfo);
  };

  const onArtistDetail = (info: SelectInfo) => {
    if (info.musicInfo.source !== 'local') {
      handleShowArtistDetail(componentId, info.musicInfo);
    }
  };

  const onAlbumDetail = (info: SelectInfo) => {
    if (info.musicInfo.source !== 'local') {
      handleShowAlbumDetail(componentId, info.musicInfo);
    }
  };

  const onSimilarSongs = (info: SelectInfo) => {
    similarSongsModalRef.current?.show(info.musicInfo);
  };

  const onMusicSourceDetail = (info: SelectInfo) => {
    void handleShowMusicSourceDetail(info.musicInfo);
  };

  const onDislikeMusic = (info: SelectInfo) => {
    void handleDislikeMusic(info.musicInfo);
  };

  const onPlayMv = useCallback((info: SelectInfo) => {
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

  const onLike = (info: SelectInfo) => {
    if (info.musicInfo.source === 'wy') {
      handleLikeMusic(info.musicInfo as LX.Music.MusicInfoOnline);
    } else if (info.musicInfo.source === 'tx') {
      handleTxLikeMusic(info.musicInfo as LX.Music.MusicInfoOnline);
    } else if (info.musicInfo.source === 'kg') {
      handleKgLikeMusic(info.musicInfo as LX.Music.MusicInfoOnline);
    }
  };

  const onClearCache = (info: SelectInfo) => {
    void handleClearMusicCache(info.musicInfo);
  };

  return (
    <>
      <View style={styles.container}>
        <ClimaxBtn />
        <DesktopLyricBtn />
        <MusicAddBtn />
        <PlayModeBtn />
        {isOneDrive ? null : <CommentBtn />}
        <Btn icon="dots-vertical" onPress={handleShowMenu} ref={moreBtnRef} />
      </View>

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
      <SimilarSongsModal ref={similarSongsModalRef} />
    </>
  )
})

const styles = createStyle({
  container: {
    // flexShrink: 0,
    // flexGrow: 0,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    // backgroundColor: 'rgba(0,0,0,0.1)',
  },
})
