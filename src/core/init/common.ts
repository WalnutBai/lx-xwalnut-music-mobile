// import musicSdk from '@/utils/musicSdk'
// import commonActions from '@/store/common/action'
import playerState from '@/store/player/state'
import { prefetch } from '@/components/common/ImageBackground'
import { setBgPic } from '@/core/common'
import wyUserApi from '@/utils/musicSdk/wy/user';
import txUserApi from '@/utils/musicSdk/tx/user';
import { setWyFollowedArtists, setWyLikedSongs, setWySubscribedAlbums, setTxLikedSongs, setKgLikedSongs } from '@/store/user/action';
import { getUserPlaylists, getPlaylistSongs } from '@/utils/kugouApi';
import { toast } from '@/utils/tools';

// const handleUpdateSourceNmaes = () => {
//   const prefix = settingState.setting['common.sourceNameType'] == 'real' ? 'source_' : 'source_alias_'
//   const sourceNames: Record<LX.OnlineSource | 'all', string> = {
//     kw: 'kw',
//     tx: 'tx',
//     kg: 'kg',
//     mg: 'mg',
//     wy: 'wy',
//
//     all: global.i18n.t(prefix + 'all' as any),
//   }
//   for (const { id } of musicSdk.sources) {
//
//     sourceNames[id as LX.OnlineSource] = global.i18n.t(prefix + id as any)
//   }
//   commonActions.setSourceNames(sourceNames)
// }
const formatUri = <T extends string | null>(url: T) => {
  return typeof url == 'string' && url.startsWith('/') ? `file://${url}` : url
}

export default async (setting: LX.AppSetting) => {
  // const handleConfigUpdated = (keys: Array<keyof LX.AppSetting>, setting: Partial<LX.AppSetting>) => {
  //   // if (keys.includes('common.sourceNameType')) handleUpdateSourceNmaes()
  //   handleConfigUpdate(keys, setting)
  // }

  let pic = playerState.musicInfo.pic
  let isDynamicBg = setting['theme.dynamicBg']
  const handleUpdatePic = (pic: string) => {
    if (!pic) return
    const picUrl = formatUri(pic)
    void prefetch(picUrl).then(() => {
      if (pic != playerState.musicInfo.pic || !isDynamicBg) return
      setBgPic(picUrl)
    })
  }
  const handlePicUpdate = () => {
    if (playerState.musicInfo.pic && playerState.musicInfo.pic != playerState.loadErrorPicUrl) {
      // if (playerState.musicInfo.pic != playerState.loadErrorPicUrl) {
      pic = playerState.musicInfo.pic
      if (!isDynamicBg) return
      handleUpdatePic(pic)
      // .catch(() => {
      //   if (pic != playerState.musicInfo.pic) return
      //   setBgPic(null)
      // })
    }
    // } else {
    //   if (!isDynamicBg) return
    //   setPic(null)
    // }
  }
  const handleConfigUpdate = (
    keys: Array<keyof LX.AppSetting>,
    setting: Partial<LX.AppSetting>
  ) => {
    if (!keys.includes('theme.dynamicBg')) return
    isDynamicBg = setting['theme.dynamicBg']!
    if (isDynamicBg) {
      if (pic) handleUpdatePic(pic)
    } else setBgPic(null)
  }

  const handleWyCookieUpdate = (keys: Array<keyof LX.AppSetting>, setting: Partial<LX.AppSetting>) => {
    if (!keys.includes('common.wy_cookie')) return;
    const cookie = setting['common.wy_cookie'];
    if (cookie) {
      console.log('正在刷新网易云数据...');
      wyUserApi.getUid(cookie)
        .then(uid => Promise.all([
          wyUserApi.getLikedSongList(uid, cookie),
          wyUserApi.getAllSublist(),
          wyUserApi.getAllSubAlbumList(),
        ]))
        .then(([likedIds, followedArtists, subscribedAlbums]) => {
          setWyLikedSongs(likedIds);
          setWyFollowedArtists(followedArtists);
          setWySubscribedAlbums(subscribedAlbums);
        })
        .catch((err: any) => {
          toast(`网易云数据获取失败: ${err.message}`);
        });
    } else {
    }
  };

  const handleTxCookieUpdate = async (keys: Array<keyof LX.AppSetting>, setting: Partial<LX.AppSetting>) => {
    if (!keys.includes('common.tx_cookie')) return;
    const cookie = setting['common.tx_cookie'];
    if (cookie) {
      console.log('正在刷新QQ音乐数据...');
      try {
        // 获取所有喜欢的歌曲（分页获取）
        const allLikedMids: string[] = [];
        let page = 1;
        const pageSize = 100;
        let hasMore = true;

        while (hasMore) {
          const result = await txUserApi.getFavSongs(page, pageSize);
          if (result.list && result.list.length > 0) {
            allLikedMids.push(...result.list.map((song: any) => song.mid));
          }
          hasMore = result.hasMore;
          page++;
        }

        setTxLikedSongs(allLikedMids);
        console.log(`QQ音乐喜欢歌曲加载成功，共 ${allLikedMids.length} 首`);
      } catch (err: any) {
        toast(`QQ音乐数据获取失败: ${err.message}`);
      }
    } else {
      setTxLikedSongs([]);
    }
  };

  const handleKgCookieUpdate = async (keys: Array<keyof LX.AppSetting>, setting: Partial<LX.AppSetting>) => {
    if (!keys.includes('common.kg_cookie')) return;
    const cookie = setting['common.kg_cookie'];
    if (cookie) {
      console.log('正在刷新酷狗音乐数据...');
      try {
        // 获取用户歌单列表，找到"我喜欢"歌单
        const playlistsResult = await getUserPlaylists(cookie);
        if (!playlistsResult.success || !playlistsResult.data) {
          console.log('酷狗歌单获取失败');
          return;
        }

        const favoritesPlaylist = playlistsResult.data.createdList.find((p: any) => p.isFavorites);
        if (!favoritesPlaylist) {
          console.log('未找到酷狗"我喜欢"歌单');
          setKgLikedSongs([]);
          return;
        }

        // 获取"我喜欢"歌单中的所有歌曲
        const allLikedIds: string[] = [];
        let page = 1;
        const pageSize = 500;
        let hasMore = true;

        while (hasMore) {
          const songsResult = await getPlaylistSongs(cookie, favoritesPlaylist.id, page, pageSize);
          if (songsResult.success && songsResult.data?.list?.length) {
            for (const song of songsResult.data.list) {
              // 使用 songmid 或 hash 作为唯一标识
              const songId = song.songmid || song.hash || song.audio_id;
              if (songId) {
                allLikedIds.push(String(songId));
              }
            }
            hasMore = songsResult.data.list.length === pageSize;
            page++;
          } else {
            hasMore = false;
          }
        }

        setKgLikedSongs(allLikedIds);
        console.log(`酷狗喜欢歌曲加载成功，共 ${allLikedIds.length} 首`);
      } catch (err: any) {
        toast(`酷狗数据获取失败: ${err.message}`);
      }
    } else {
      setKgLikedSongs([]);
    }
  };

  const handleLogSettingUpdate = (keys: Array<keyof LX.AppSetting>, setting: Partial<LX.AppSetting>) => {
    if (keys.includes('common.isEnableLog')) {
      global.lx.isEnableLog = setting['common.isEnableLog']!
    }
    if (keys.includes('common.isEnableSyncLog')) {
      global.lx.isEnableSyncLog = setting['common.isEnableSyncLog']!
    }
    if (keys.includes('common.isEnableUserApiLog')) {
      global.lx.isEnableUserApiLog = setting['common.isEnableUserApiLog']!
    }
  };

  handlePicUpdate()
  global.state_event.on('playerMusicInfoChanged', handlePicUpdate)
  global.state_event.on('configUpdated', handleConfigUpdate)
  global.state_event.on('configUpdated', handleWyCookieUpdate);
  global.state_event.on('configUpdated', handleTxCookieUpdate);
  global.state_event.on('configUpdated', handleKgCookieUpdate);
  global.state_event.on('configUpdated', handleLogSettingUpdate);
}
