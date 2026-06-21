import { memo, useEffect, useRef, useState, useCallback } from 'react';
import { View } from 'react-native';
import PageContent from '@/components/PageContent';
import Header from './Header';
import SongList from './SongList';
import wyApi from '@/utils/musicSdk/wy/artist';
import txApi from '@/utils/musicSdk/tx/artist';
import kgApi from '@/utils/musicSdk/kg/artist';
import { toast } from '@/utils/tools';
import {setComponentId, updateSetting} from '@/core/common';
import PlayerBar from '@/components/player/PlayerBar';
import { createStyle } from '@/utils/tools';
import { getArtistCache, setArtistCache,
  clearArtistCache, getArtistDetailCache, setArtistDetailCache } from '@/core/cache';
import {useSettingValue} from "@/store/setting/hook.ts";
import playerState from '@/store/player/state'
import listState from '@/store/list/state'
import { LIST_IDS } from '@/config/constant'
import { type OnlineListType } from '@/components/OnlineList'
import {usePlayerMusicInfo} from "@/store/player/hook.ts";
import { log } from '@/utils/log'

const SONG_LIMIT = 100;
const ALBUM_LIMIT = 100;

// 获取对应源的API
const getApi = (source) => {
  if (source === 'tx') return txApi
  if (source === 'kg') return kgApi
  return wyApi
}

// 获取歌手参数
const getArtistParam = (artistInfo) => {
  if (artistInfo.source === 'tx') return artistInfo.mid || artistInfo.id
  if (artistInfo.source === 'kg') return artistInfo.id
  return artistInfo.id
}

export default memo(({ componentId, artistInfo }: { componentId: string, artistInfo: { id: string, mid?: string, name: string, source?: string } }) => {
  log.info('[ArtistDetail] === 歌手详情页初始化 ===', {
    componentId,
    artistInfo,
    artistSource: artistInfo.source,
    timestamp: new Date().toISOString(),
  })
  const [artistDetail, setArtistDetail] = useState(null);
  const [songs, setSongs] = useState({ list: [], hasMore: true, page: 1, loading: false, sort: 'hot' });
  const [albums, setAlbums] = useState({ list: [], hasMore: true, page: 1, loading: false });
  const [activeTab, setActiveTab] = useState('songs');
  const albumViewMode = useSettingValue('artistDetail.albumViewMode')
  const componentIdRef = useRef(componentId)
  const songListRef = useRef<any>(null)
  const pendingScrollInfoRef = useRef<LX.Music.MusicInfoOnline | null>(null)
  const isFirstSortEffect = useRef(true)
  const playerMusicInfo = usePlayerMusicInfo()

  const handleSongListUpdate = useCallback((newList: LX.Music.MusicInfoOnline[]) => {
    setSongs(prev => ({
      ...prev,
      list: newList,
    }))
  }, [])



  useEffect(() => {
    const handleJumpPosition = () => {
      let listId = playerState.playMusicInfo.listId
      if (listId === LIST_IDS.TEMP) listId = listState.tempListMeta.id
      if (listId !== `artist_detail_${artistInfo.id}`) return

      const musicInfo = playerState.playMusicInfo.musicInfo as LX.Music.MusicInfoOnline
      if (musicInfo) {
        if (songs.list.length) {
          songListRef.current?.scrollToInfo(musicInfo)
        } else {
          pendingScrollInfoRef.current = musicInfo
        }
      }
    }

    global.app_event.on('jumpListPosition', handleJumpPosition)
    return () => {
      global.app_event.off('jumpListPosition', handleJumpPosition)
    }
  }, [artistInfo.id, songs.list])
  useEffect(() => {
    if (pendingScrollInfoRef.current && songs.list.length) {
      setTimeout(() => {
        if (songListRef.current) {
          songListRef.current.scrollToInfo(pendingScrollInfoRef.current);
          pendingScrollInfoRef.current = null;
        }
      }, 300);
    };
  }, [songs.list])

  useEffect(() => {
    setComponentId('ARTIST_DETAIL', componentId);
    componentIdRef.current = componentId;
    const api = getApi(artistInfo.source)
    const artistParam = getArtistParam(artistInfo)

    log.info('[ArtistDetail] === 开始获取歌手详情 ===', {
      artistId: artistInfo.id,
      artistMid: artistInfo.mid,
      artistParam,
      artistName: artistInfo.name,
      artistSource: artistInfo.source,
      api: artistInfo.source,
    })

    const cachedDetail = getArtistDetailCache(artistParam);
    if (cachedDetail) {
      log.info('[ArtistDetail] === 使用缓存的歌手详情 ===', {
        artistId: artistInfo.id,
        artistParam,
        cached: true,
      })
      setArtistDetail(cachedDetail);
    } else {
      log.info('[ArtistDetail] === 从API获取歌手详情 ===', {
        artistId: artistInfo.id,
        artistParam,
        cached: false,
        api: artistInfo.source === 'tx' ? 'txApi' : 'wyApi',
      })
      api.getDetail(artistParam).then(data => {
        log.info('[ArtistDetail] 获取歌手详情成功', { artistId: artistInfo.id, hasArtist: !!data?.artist })
        setArtistDetailCache(artistInfo.id, data);
        setArtistDetail(data);
      }).catch((err) => {
        log.error('[ArtistDetail] 获取歌手详情失败', { artistId: artistInfo.id, error: err.message })
        toast('获取歌手信息失败');
      });
    }
  }, [componentId, artistInfo.id, artistInfo.source]);

  const loadSongs = useCallback((sort, page, isRefresh = false) => {
    const currentApi = getApi(artistInfo.source)
    const currentArtistParam = getArtistParam(artistInfo)

    log.info('[ArtistDetail] === loadSongs 被调用 ===', {
      artistId: artistInfo.id,
      artistMid: artistInfo.mid,
      artistParam: currentArtistParam,
      artistSource: artistInfo.source,
      sort,
      page,
      isRefresh,
      timestamp: new Date().toISOString(),
    })
    const cacheKey = `${currentArtistParam}_songs_${sort}_${page}`;

    const cachedData = getArtistCache(cacheKey);
    if (!isRefresh && cachedData) {
      log.info('[ArtistDetail] === 使用缓存的歌曲列表 ===', {
        artistId: artistInfo.id,
        artistParam: currentArtistParam,
        cacheKey,
        songCount: cachedData.list.length,
        hasMore: cachedData.hasMore,
      })
      setSongs(p => ({
        ...p,
        list: page === 1 ? cachedData.list : [...p.list, ...cachedData.list],
        hasMore: cachedData.hasMore,
        page: page + 1,
        loading: false,
        sort,
      }));
      return;
    }

    setSongs(prev => {
      if (!isRefresh && (prev.loading || !prev.hasMore)) {
        log.info('[ArtistDetail] === 跳过歌曲加载 ===', {
          reason: prev.loading ? '正在加载' : '没有更多数据',
          loading: prev.loading,
          hasMore: prev.hasMore,
        })
        return prev;
      }
      const offset = (page - 1) * SONG_LIMIT;
      log.info('[ArtistDetail] === 请求歌手歌曲列表 ===', {
        artistId: artistInfo.id,
        artistParam: currentArtistParam,
        artistSource: artistInfo.source,
        sort,
        page,
        offset,
        limit: SONG_LIMIT,
      })
      currentApi.getSongs(currentArtistParam, sort, SONG_LIMIT, offset).then(data => {
        log.info('[ArtistDetail] 歌手歌曲加载成功', { artistId: artistInfo.id, songCount: data.list.length, hasMore: data.hasMore })
        setArtistCache(cacheKey, { list: data.list, hasMore: data.hasMore });

        setSongs(p => ({
          ...p,
          list: page === 1 ? data.list : [...p.list, ...data.list],
          hasMore: data.hasMore,
          page: page + 1,
          loading: false,
          sort,
        }));
      }).catch((err) => {
        log.error('[ArtistDetail] 歌手歌曲加载失败', { artistId: artistInfo.id, error: err.message })
        toast('获取歌曲失败');
        setSongs(p => ({ ...p, loading: false }));
      });
      return { ...prev, loading: true };
    });
  }, [artistInfo.id, artistInfo.source]);

  const loadAlbums = useCallback((page, isRefresh = false) => {
    const currentApi = getApi(artistInfo.source)
    const currentArtistParam = getArtistParam(artistInfo)

    log.info('[ArtistDetail] === loadAlbums 被调用 ===', {
      artistId: artistInfo.id,
      artistMid: artistInfo.mid,
      artistParam: currentArtistParam,
      artistSource: artistInfo.source,
      page,
      isRefresh,
      timestamp: new Date().toISOString(),
    })
    const cacheKey = `${currentArtistParam}_albums_${page}`;

    const cachedData = getArtistCache(cacheKey);
    if (!isRefresh && cachedData) {
      log.info('[ArtistDetail] === 使用缓存的专辑列表 ===', {
        artistId: artistInfo.id,
        artistParam: currentArtistParam,
        cacheKey,
        albumCount: cachedData.hotAlbums.length,
        hasMore: cachedData.hasMore,
      })
      setAlbums(p => ({
        ...p,
        list: page === 1 ? cachedData.hotAlbums : [...p.list, ...cachedData.hotAlbums],
        hasMore: cachedData.hasMore,
        page: page + 1,
        loading: false,
      }));
      return;
    }

    setAlbums(prev => {
      if (!isRefresh && (prev.loading || !prev.hasMore)) {
        log.info('[ArtistDetail] === 跳过专辑加载 ===', {
          reason: prev.loading ? '正在加载' : '没有更多数据',
          loading: prev.loading,
          hasMore: prev.hasMore,
        })
        return prev;
      }
      const offset = (page - 1) * ALBUM_LIMIT;
      log.info('[ArtistDetail] === 请求歌手专辑列表 ===', {
        artistId: artistInfo.id,
        artistParam: currentArtistParam,
        artistSource: artistInfo.source,
        page,
        offset,
        limit: ALBUM_LIMIT,
      })
      currentApi.getAlbums(currentArtistParam, ALBUM_LIMIT, offset).then(data => {
        log.info('[ArtistDetail] 歌手专辑加载成功', { artistId: artistInfo.id, albumCount: data.hotAlbums.length, hasMore: data.hasMore })
        setArtistCache(cacheKey, { hotAlbums: data.hotAlbums, hasMore: data.hasMore });

        setAlbums(p => ({
          ...p,
          list: page === 1 ? data.hotAlbums : [...p.list, ...data.hotAlbums],
          hasMore: data.hasMore,
          page: page + 1,
          loading: false,
        }));
      }).catch((err) => {
        log.error('[ArtistDetail] 歌手专辑加载失败', { artistId: artistInfo.id, error: err.message })
        toast('获取专辑失败');
        setAlbums(p => ({ ...p, loading: false }));
      });
      return { ...prev, loading: true };
    });
  }, [artistInfo.id, artistInfo.source]);


  useEffect(() => {
    if (activeTab === 'songs') {
      if (songs.list.length === 0) loadSongs(songs.sort, 1, false); // 首次加载使用缓存
    } else {
      if (albums.list.length === 0) loadAlbums(1, false); // 首次加载使用缓存
    }
  }, [activeTab, artistInfo.id]);

  useEffect(() => {
    if (isFirstSortEffect.current) {
      isFirstSortEffect.current = false;
      return;
    }
    setSongs(prev => ({ ...prev, page: 1, list: [], hasMore: true }));
    loadSongs(songs.sort, 1, true);
  }, [songs.sort]);

  const handleLoadMoreSongs = () => {
    loadSongs(songs.sort, songs.page);
  };

  const handleLoadMoreAlbums = () => {
    loadAlbums(albums.page);
  };

  // 调用全局缓存清理
  const handleSortChange = (newSort) => {
    if (songs.sort === newSort) return;
    const cacheKeyParam = artistInfo.source === 'tx' ? (artistInfo.mid || artistInfo.id) : artistInfo.id
    clearArtistCache(cacheKeyParam); // 清理该歌手所有缓存
    setSongs(prev => ({ ...prev, sort: newSort, list: [], page: 1, hasMore: true }));
  };

  const handleTabChange = (newTab) => {
    if (activeTab === newTab) return;
    setActiveTab(newTab);
  };

  const handleRefresh = useCallback(() => {
    const refreshApi = getApi(artistInfo.source)
    const refreshParam = getArtistParam(artistInfo)

    clearArtistCache(refreshParam);

    refreshApi.getDetail(refreshParam).then(data => {
      setArtistDetailCache(refreshParam, data);
      setArtistDetail(data);
    }).catch(() => toast('刷新歌手信息失败'));

    if (activeTab === 'songs') {
      setSongs(prev => ({ ...prev, page: 1, list: [], hasMore: true }));
      loadSongs(songs.sort, 1, true);
    } else {
      setAlbums(prev => ({ ...prev, page: 1, list: [], hasMore: true }));
      loadAlbums(1, true);
    }
  }, [artistInfo.id, songs.sort, loadSongs, activeTab, loadAlbums]);


  const handleAlbumViewModeChange = useCallback((mode: 'grid' | 'list') => {
    updateSetting({ 'artistDetail.albumViewMode': mode })
  }, [])

  const displayArtist = artistDetail?.artist && artistDetail.artist.name ? artistDetail.artist : artistInfo

  log.info('[ArtistDetail] === 界面渲染诊断 ===', {
    artistId: artistInfo.id,
    hasArtistDetail: !!artistDetail,
    artistDetailKeys: artistDetail ? Object.keys(artistDetail) : [],
    displayArtistName: displayArtist?.name,
    displayArtistPicUrl: displayArtist?.picUrl ? '有封面' : '无封面',
    songsListLength: songs.list.length,
    songsHasMore: songs.hasMore,
    songsLoading: songs.loading,
    albumsListLength: albums.list.length,
    albumsHasMore: albums.hasMore,
    albumsLoading: albums.loading,
    activeTab,
  })

  return (
    <PageContent>
      <View style={styles.container}>
        <Header artist={displayArtist} componentId={componentIdRef.current} />
        <SongList
          componentId={componentId}
          songs={songs}
          albums={albums}
          activeTab={activeTab}
          ref={songListRef as any}
          artistId={artistInfo.id}
          albumViewMode={albumViewMode}
          onTabChange={handleTabChange}
          onLoadMoreSongs={handleLoadMoreSongs}
          onLoadMoreAlbums={handleLoadMoreAlbums}
          onSortChange={handleSortChange}
          onRefresh={handleRefresh}
          onAlbumViewModeChange={handleAlbumViewModeChange}
          onSongListUpdate={handleSongListUpdate}
          playingId={playerMusicInfo.id}
        />
        <PlayerBar componentId={componentId} />
      </View>
    </PageContent>
  );
});

const styles = createStyle({
  container: {
    flex: 1,
    flexDirection: 'column',
  },
})
