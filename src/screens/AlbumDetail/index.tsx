import { memo, useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { View } from 'react-native'
import PageContent from '@/components/PageContent'
import Header from './Header'
import OnlineList, { type OnlineListType } from '@/components/OnlineList'
import wyApi from '@/utils/musicSdk/wy/album'
import txApi from '@/utils/musicSdk/tx/album'
import kgApi from '@/utils/musicSdk/kg/album'
import { toast } from '@/utils/tools'
import { setComponentId } from '@/core/common'
import PlayerBar from '@/components/player/PlayerBar'
import { createStyle } from '@/utils/tools'
import { type ListInfoItem } from '@/store/songlist/state'
import { playOnlineList } from '@/core/list'
import {COMPONENT_IDS, LIST_IDS} from "@/config/constant.ts"
import playerState from '@/store/player/state'
import listState from '@/store/list/state'
import {usePlayerMusicInfo} from "@/store/player/hook.ts";
import { log } from '@/utils/log'

// 获取对应源的API
const getApi = (source) => {
  if (source === 'tx') return txApi
  if (source === 'kg') return kgApi
  return wyApi
}

export default memo(({ componentId, albumInfo }: { componentId: string; albumInfo: any }) => {
  log.info('[AlbumDetail] === 专辑详情页初始化 ===', {
    componentId,
    albumInfo,
    albumSource: albumInfo.source,
    albumId: albumInfo.id,
    albumMid: albumInfo.mid,
    albumName: albumInfo.name,
    timestamp: new Date().toISOString(),
  })
  const [albumDetail, setAlbumDetail] = useState({ info: null, list: [] })
  const listRef = useRef<OnlineListType>(null)
  const playerMusicInfo = usePlayerMusicInfo()

  useEffect(() => {
    const handleJumpPosition = () => {
      let listId = playerState.playMusicInfo.listId
      if (listId === LIST_IDS.TEMP) listId = listState.tempListMeta.id
      if (listId !== `album_${albumInfo.id}`) return

      const musicInfo = playerState.playMusicInfo.musicInfo
      if (musicInfo) {
        listRef.current?.scrollToInfo(musicInfo as LX.Music.MusicInfoOnline)
      }
    }
    global.app_event.on('jumpListPosition', handleJumpPosition)
    return () => {
      global.app_event.off('jumpListPosition', handleJumpPosition)
    }
  }, [albumInfo.id])

  useEffect(() => {
    log.info('[AlbumDetail] === 开始加载专辑详情 ===', {
      albumId: albumInfo.id,
      albumMid: albumInfo.mid,
      albumSource: albumInfo.source,
      albumName: albumInfo.name,
    })
    setComponentId(COMPONENT_IDS.ALBUM_DETAIL_SCREEN, componentId);
    log.info('[AlbumDetail] === 设置列表状态为loading ===')
    listRef.current?.setStatus('loading');
    
    const api = getApi(albumInfo.source)
    const albumParam = albumInfo.source === 'tx' ? albumInfo.mid : albumInfo.id
    
    log.info('[AlbumDetail] === 调用API获取专辑详情 ===', {
      albumId: albumInfo.id,
      albumMid: albumInfo.mid,
      albumSource: albumInfo.source,
      api: albumInfo.source,
      albumParam,
    })
    
    api.getAlbum(albumParam).then(data => {
      log.info('[AlbumDetail] 专辑加载成功', { albumId: albumInfo.id, listLength: data.list?.length || 0 })
      setAlbumDetail(data);
      listRef.current?.setList(data.list);
      listRef.current?.setStatus('idle');
    }).catch((err) => {
      log.error('[AlbumDetail] 专辑加载失败', { albumId: albumInfo.id, error: err.message })
      toast('获取专辑信息失败');
      listRef.current?.setStatus('error');
    });
  }, [componentId, albumInfo.id, albumInfo.source, albumInfo.mid]);

  const onRefresh = useCallback(() => {
    log.info('[AlbumDetail] === 下拉刷新专辑详情 ===', {
      albumId: albumInfo.id,
      albumMid: albumInfo.mid,
      albumSource: albumInfo.source,
    })
    listRef.current?.setStatus('refreshing');
    
    const refreshApi = getApi(albumInfo.source)
    const refreshParam = albumInfo.source === 'tx' ? albumInfo.mid : albumInfo.id
    
    refreshApi.getAlbum(refreshParam).then(data => {
      log.info('[AlbumDetail] === 刷新专辑详情成功 ===', {
        albumId: albumInfo.id,
        listLength: data.list.length,
      })
      setAlbumDetail(data);
      listRef.current?.setList(data.list);
      listRef.current?.setStatus('idle');
    }).catch((err) => {
      log.error('[AlbumDetail] === 刷新专辑详情失败 ===', {
        albumId: albumInfo.id,
        error: err.message,
      })
      toast('刷新专辑信息失败');
      listRef.current?.setStatus('error');
    });
  }, [albumInfo.id, albumInfo.source, albumInfo.mid]);

  const onPlayList = useCallback((index: number) => {
    log.info('[AlbumDetail] === 点击播放专辑 ===', {
      albumId: albumInfo.id,
      albumSource: albumInfo.source,
      playIndex: index,
      totalSongs: albumDetail.list.length,
    })
    if (!albumDetail.list.length) {
      log.warn('[AlbumDetail] === 无法播放，专辑列表为空 ===', {
        albumId: albumInfo.id,
      })
      return;
    }
    const listId = `album_${albumInfo.id}`;
    log.info('[AlbumDetail] === 调用playOnlineList ===', {
      listId,
      playIndex: index,
      totalSongs: albumDetail.list.length,
    })
    void playOnlineList(listId, albumDetail.list, index);
    log.info('[AlbumDetail] === 播放请求已发送 ===')
  }, [albumDetail.list, albumInfo.id]);

  const handleListUpdate = useCallback((newList: LX.Music.MusicInfoOnline[]) => {
    log.info('[AlbumDetail] === 列表数据更新 ===', {
      albumId: albumInfo.id,
      oldListLength: albumDetail.list.length,
      newListLength: newList.length,
    })
    setAlbumDetail(prev => ({
      ...prev,
      list: newList,
    }));
  }, [albumDetail.list, albumInfo.id]);
  const displayAlbumInfo = useMemo(() => {
    const info = {
      ...albumInfo,
      ...(albumDetail.info || {}),
      publishTime: albumDetail.info?.publishTime || albumInfo.publishTime || '',
      total: albumDetail.list.length || (albumDetail.info?.total || albumDetail.info?.size),
    }
    log.info('[AlbumDetail] === displayAlbumInfo构造 ===', {
      albumId: albumInfo.id,
      albumInfoPublishTime: albumInfo.publishTime,
      albumDetailInfoPublishTime: albumDetail.info?.publishTime,
      resultPublishTime: info.publishTime,
      hasAlbumDetail: !!albumDetail.info,
    })
    return info
  }, [albumInfo, albumDetail.info, albumDetail.list])

  log.info('[AlbumDetail] === 界面渲染诊断 ===', {
    albumId: albumInfo.id,
    hasAlbumDetail: !!albumDetail.info,
    displayAlbumName: displayAlbumInfo.name,
    displayAlbumPicUrl: displayAlbumInfo.picUrl || displayAlbumInfo.img,
    displayAlbumPublishTime: displayAlbumInfo.publishTime,
    displayAlbumArtists: displayAlbumInfo.artists,
    displayAlbumSource: displayAlbumInfo.source,
    albumDetailInfoPublishTime: albumDetail.info?.publishTime,
    albumDetailInfoArtists: albumDetail.info?.artists,
    songsListLength: albumDetail.list.length,
    timestamp: new Date().toISOString(),
  })

  return (
    <PageContent>
      <View style={styles.container}>
        <Header albumInfo={displayAlbumInfo} componentId={componentId} />
        <OnlineList componentId={componentId}
          ref={listRef}
          listId='album'
          forcePlayList={true}
          onPlayList={onPlayList}
          onLoadMore={() => {}}
          onRefresh={onRefresh}
          onListUpdate={handleListUpdate}
          playingId={playerMusicInfo.id}
        />
        <PlayerBar componentId={componentId} />
      </View>
    </PageContent>
  )
});

const styles = createStyle({
  container: {
    flex: 1,
    flexDirection: 'column',
  },
})
