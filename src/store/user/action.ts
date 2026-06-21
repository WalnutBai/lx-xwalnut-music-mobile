import state, {FollowedArtistInfo, SubscribedAlbumInfo, SubscribedPlaylistInfo, TxPlaylistInfo, KgPlaylistInfo} from './state'

export const setWyUid = (uid: string) => {
  state.wy_uid = uid
}
export const setWyVipType = (type: number) => {
  state.wy_vip_type = type
}
export const setWyLikedSongs = (ids: (string | number)[]) => {
  state.wy_liked_song_ids = new Set(ids.map(String))
  global.state_event.wyLikedListChanged()
}
export const addWyLikedSong = (id: string | number) => {
  const strId = String(id)
  if (state.wy_liked_song_ids.has(strId)) return
  state.wy_liked_song_ids.add(strId)
  global.state_event.wyLikedListChanged()
}
export const removeWyLikedSong = (id: string | number) => {
  const strId = String(id)
  if (!state.wy_liked_song_ids.has(strId)) return
  state.wy_liked_song_ids.delete(strId)
  global.state_event.wyLikedListChanged()
}

export const setWyFollowedArtists = (artists: FollowedArtistInfo[]) => {
  state.wy_followed_artists = artists
  global.state_event.wyFollowedListChanged()
}

export const addWyFollowedArtist = (artist: FollowedArtistInfo) => {
  if (state.wy_followed_artists.some(a => String(a.id) === String(artist.id))) return
  // 创建一个新数组，而不是修改原数组
  state.wy_followed_artists = [artist, ...state.wy_followed_artists]
  global.state_event.wyFollowedListChanged()
}

export const removeWyFollowedArtist = (id: string | number) => {
  const strId = String(id)
  const index = state.wy_followed_artists.findIndex(a => String(a.id) === strId)
  if (index < 0) return
  // 创建一个新数组，而不是修改原数组
  const newList = [...state.wy_followed_artists]
  newList.splice(index, 1)
  state.wy_followed_artists = newList
  global.state_event.wyFollowedListChanged()
}

export const setWySubscribedAlbums = (albums: SubscribedAlbumInfo[]) => {
  state.wy_subscribed_albums = albums;
  global.state_event.wySubscribedAlbumsChanged();
};

export const addWySubscribedAlbum = (album: SubscribedAlbumInfo) => {
  if (state.wy_subscribed_albums.some(a => String(a.id) === String(album.id))) return;
  state.wy_subscribed_albums = [album, ...state.wy_subscribed_albums];
  global.state_event.wySubscribedAlbumsChanged();
};

export const removeWySubscribedAlbum = (id: string | number) => {
  const strId = String(id);
  const index = state.wy_subscribed_albums.findIndex(a => String(a.id) === strId);
  if (index < 0) return;
  const newList = [...state.wy_subscribed_albums];
  newList.splice(index, 1);
  state.wy_subscribed_albums = newList;
  global.state_event.wySubscribedAlbumsChanged();
};

export const setWySubscribedPlaylists = (playlists: SubscribedPlaylistInfo[]) => {
  state.wy_subscribed_playlists = playlists;
  global.state_event.wySubscribedPlaylistsChanged();
};

export const addWySubscribedPlaylist = (playlist: SubscribedPlaylistInfo) => {
  if (state.wy_subscribed_playlists.some(p => String(p.id) === String(playlist.id))) return;
  state.wy_subscribed_playlists = [playlist, ...state.wy_subscribed_playlists];
  global.state_event.wySubscribedPlaylistsChanged();
};

export const removeWySubscribedPlaylist = (id: string | number) => {
  const strId = String(id);
  const index = state.wy_subscribed_playlists.findIndex(p => String(p.id) === strId);
  if (index < 0) return;
  const newList = [...state.wy_subscribed_playlists];
  newList.splice(index, 1);
  state.wy_subscribed_playlists = newList;
  global.state_event.wySubscribedPlaylistsChanged();
};

export const updateWySubscribedPlaylist = (id: string | number, details: Partial<SubscribedPlaylistInfo>) => {
  const strId = String(id)
  const index = state.wy_subscribed_playlists.findIndex(p => String(p.id) === strId)
  if (index > -1) {
    const updatedPlaylist = { ...state.wy_subscribed_playlists[index], ...details }
    const newList = [...state.wy_subscribed_playlists]
    newList.splice(index, 1, updatedPlaylist)
    state.wy_subscribed_playlists = newList
    global.state_event.wySubscribedPlaylistsChanged()
  }
}
export const updateWySubscribedPlaylistTrackCount = (id: string | number, change: number) => {
  const strId = String(id);
  const index = state.wy_subscribed_playlists.findIndex(p => String(p.id) === strId);

  if (index > -1) {
    const updatedPlaylist = {
      ...state.wy_subscribed_playlists[index],
      trackCount: state.wy_subscribed_playlists[index].trackCount + change,
    };
    const newList = [...state.wy_subscribed_playlists];
    newList.splice(index, 1, updatedPlaylist);

    state.wy_subscribed_playlists = newList;
    global.state_event.wySubscribedPlaylistsChanged();
  }
};

// QQ音乐喜欢歌曲
export const setTxLikedSongs = (ids: (string | number)[]) => {
  state.tx_liked_song_ids = new Set(ids.map(String))
  global.state_event.txLikedListChanged()
}
export const addTxLikedSong = (id: string | number) => {
  const strId = String(id)
  if (state.tx_liked_song_ids.has(strId)) return
  state.tx_liked_song_ids.add(strId)
  global.state_event.txLikedListChanged()
}
export const removeTxLikedSong = (id: string | number) => {
  const strId = String(id)
  if (!state.tx_liked_song_ids.has(strId)) return
  state.tx_liked_song_ids.delete(strId)
  global.state_event.txLikedListChanged()
}

// QQ音乐歌单列表
export const setTxSubscribedPlaylists = (playlists: TxPlaylistInfo[]) => {
  state.tx_subscribed_playlists = playlists
  global.state_event.txSubscribedPlaylistsChanged()
}
export const addTxSubscribedPlaylist = (playlist: TxPlaylistInfo) => {
  if (state.tx_subscribed_playlists.some(p => String(p.id) === String(playlist.id))) return
  state.tx_subscribed_playlists = [playlist, ...state.tx_subscribed_playlists]
  global.state_event.txSubscribedPlaylistsChanged()
}
export const removeTxSubscribedPlaylist = (id: string | number) => {
  const strId = String(id)
  const index = state.tx_subscribed_playlists.findIndex(p => String(p.id) === strId)
  if (index < 0) return
  const newList = [...state.tx_subscribed_playlists]
  newList.splice(index, 1)
  state.tx_subscribed_playlists = newList
  global.state_event.txSubscribedPlaylistsChanged()
}

// 酷狗音乐喜欢歌曲
export const setKgLikedSongs = (ids: (string | number)[]) => {
  state.kg_liked_song_ids = new Set(ids.map(String))
  global.state_event.kgLikedListChanged()
}
export const addKgLikedSong = (id: string | number) => {
  const strId = String(id)
  if (state.kg_liked_song_ids.has(strId)) return
  state.kg_liked_song_ids.add(strId)
  global.state_event.kgLikedListChanged()
}
export const removeKgLikedSong = (id: string | number) => {
  const strId = String(id)
  if (!state.kg_liked_song_ids.has(strId)) return
  state.kg_liked_song_ids.delete(strId)
  global.state_event.kgLikedListChanged()
}

// 酷狗音乐歌单列表
export const setKgSubscribedPlaylists = (playlists: KgPlaylistInfo[]) => {
  state.kg_subscribed_playlists = playlists
  global.state_event.kgSubscribedPlaylistsChanged()
}
export const addKgSubscribedPlaylist = (playlist: KgPlaylistInfo) => {
  if (state.kg_subscribed_playlists.some(p => String(p.id) === String(playlist.id))) return
  state.kg_subscribed_playlists = [playlist, ...state.kg_subscribed_playlists]
  global.state_event.kgSubscribedPlaylistsChanged()
}
export const removeKgSubscribedPlaylist = (id: string | number) => {
  const strId = String(id)
  const index = state.kg_subscribed_playlists.findIndex(p => String(p.id) === strId)
  if (index < 0) return
  const newList = [...state.kg_subscribed_playlists]
  newList.splice(index, 1)
  state.kg_subscribed_playlists = newList
  global.state_event.kgSubscribedPlaylistsChanged()
}
