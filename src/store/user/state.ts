export interface FollowedArtistInfo {
  id: string | number
  name: string
  alias: string[] | null
  albumSize: number
  picUrl: string
  img1v1Url: string
}
export interface SubscribedAlbumInfo {
  id: string | number
  name: string
  picUrl: string
  artists: Array<{ id: string | number, name: string }>
  publishTime: number
  size: number
}
export interface SubscribedPlaylistInfo {
  id: string | number
  userId: number
  name: string
  coverImgUrl: string
  trackCount: number
  description?: string
}

export interface TxPlaylistInfo {
  id: string
  tid: number
  dirid: number
  name: string
  cover: string
  songCount: number
  desc: string
  isFavorites: boolean
  isCollected: boolean
}

export interface InitState {
  wy_uid: string | null
  wy_liked_song_ids: Set<string>
  wy_followed_artists: FollowedArtistInfo[]
  wy_subscribed_albums: SubscribedAlbumInfo[]
  wy_subscribed_playlists: SubscribedPlaylistInfo[]
  wy_vip_type: number
  // QQ音乐
  tx_liked_song_ids: Set<string>
  tx_subscribed_playlists: TxPlaylistInfo[]
}
const state: InitState = {
  wy_uid: null,
  wy_liked_song_ids: new Set(),
  wy_followed_artists: [],
  wy_subscribed_albums: [],
  wy_subscribed_playlists: [],
  wy_vip_type: 0,
  // QQ音乐
  tx_liked_song_ids: new Set(),
  tx_subscribed_playlists: [],
}

export default state
