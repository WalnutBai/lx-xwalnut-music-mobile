/**
 * Third-party music source module standardized type declarations
 *
 * This file defines the unified interface structure for wy / tx / kg
 * three-platform music source SDKs.
 *
 * Design principles:
 * 1. Unified export structure — MusicSourceModule defines the module collection all platforms must have
 * 2. Accommodate platform differences — Each sub-module uses optional properties (?) internally to support different platform-specific method names
 * 3. Do not rename existing methods — Strictly follow the "no rename" rule, all differing methods coexist as optional properties
 */
declare namespace LX {

  // ============================================================

  type AnyMusicInfo = LX.Music.MusicInfoOnline

  interface SongListTag {
    id: string
    name: string
  }

  interface SongListCategory {
    name: string
    list: SongListTag[]
  }

  interface SongListItem {
    play_count: string
    id: string
    author: string
    name: string
    img: string
    desc?: string
    source: LX.OnlineSource
  }

  interface SongListDetail {
    info: {
      id: string
      name: string
      img: string
      desc: string
      author: string
      play_count?: string
      source: LX.OnlineSource
    }
    list: AnyMusicInfo[]
  }

  interface LeaderboardItem {
    id: string
    name: string
    bangid?: string | number
    source: LX.OnlineSource
  }

  interface LeaderboardListResult {
    list: AnyMusicInfo[]
    total?: number
    hasMore?: boolean
    source: LX.OnlineSource
  }

  interface MusicSearchResult {
    list: AnyMusicInfo[]
    total?: number
    hasMore?: boolean
    source: LX.OnlineSource
  }

  interface SingerSearchResult {
    list: Array<{
      id: string | number
      name: string
      img?: string
      source: LX.OnlineSource
    }>
    total?: number
    hasMore?: boolean
    source: LX.OnlineSource
  }

  interface AlbumSearchResult {
    list: Array<{
      id: string | number
      name: string
      img?: string
      singer?: string
      publishDate?: string
      source: LX.OnlineSource
    }>
    total?: number
    hasMore?: boolean
    source: LX.OnlineSource
  }

  interface HotSearchResult {
    list: string[]
    source: LX.OnlineSource
  }

  interface CommentItem {
    commentId: string | number
    userName: string
    avatar?: string
    content: string
    time: string | number
    likedCount?: number
    replyCount?: number
  }

  interface CommentResult {
    list: CommentItem[]
    total?: number
    hasMore?: boolean
    source: LX.OnlineSource
  }

  interface ArtistDetail {
    artist: {
      id: string | number
      mid?: string
      name: string
      alias?: string[]
      picUrl?: string
      briefDesc?: string
      albumSize?: number
      songNum?: number
      source: LX.OnlineSource
    }
  }

  interface ArtistSongsResult {
    list: AnyMusicInfo[]
    total?: number
    hasMore?: boolean
    source: LX.OnlineSource
  }

  interface ArtistAlbumsResult {
    hotAlbums: Array<{
      id: string | number
      mid?: string
      name: string
      picUrl?: string
      publishTime?: string
      size?: number
      artist?: string
      source: LX.OnlineSource
    }>
    hasMore?: boolean
    total?: number
  }

  interface AlbumDetail {
    list: AnyMusicInfo[]
    info: {
      id: string | number
      mid?: string
      name: string
      img?: string
      picUrl?: string
      desc?: string
      author?: string
      artist?: string
      artistId?: string | number
      artists?: Array<{ id: string | number; name: string }>
      publishTime?: string
      size?: number
      source: LX.OnlineSource
    }
  }

  interface UserPlaylistItem {
    id: string | number
    name: string
    img?: string
    playCount?: number
    trackCount?: number
    creator?: string
    source: LX.OnlineSource
  }

  interface UserPlaylistsResult {
    createdList?: UserPlaylistItem[]
    collectedList?: UserPlaylistItem[]
    list?: UserPlaylistItem[]
    source: LX.OnlineSource
  }

  interface UserInfo {
    name: string
    avatar?: string
    uid?: string | number
    uin?: string | number
    source: LX.OnlineSource
  }

  interface FavAlbumItem {
    id: string | number
    name: string
    img?: string
    artist?: string
    publishTime?: string
    size?: number
    source: LX.OnlineSource
  }

  interface FavPlaylistItem {
    id: string | number
    name: string
    img?: string
    playCount?: number
    trackCount?: number
    source: LX.OnlineSource
  }

  interface DailyRecResult {
    list: AnyMusicInfo[]
    source: LX.OnlineSource
  }

  interface RecommendSonglistResult {
    list: Array<{
      id: string | number
      name: string
      img?: string
      playCount?: number
      source: LX.OnlineSource
    }>
    hasMore?: boolean
    source: LX.OnlineSource
  }

  // ============================================================
  //  Sub-module interface definitions
  // ============================================================

  /**
   * Playlist module
   *
   * Unified methods: getTags, getList, getListDetail, getDetailPageUrl, search
   * Platform differences:
   *   - kg: getSongList, getSongListRecommend, getUserListDetail (KuGou-specific playlist parsing)
   *   - tx/kg: getListDetailNew (new playlist detail)
   */
  interface SongListModule {
    /** Get playlist tag categories */
    getTags(retryNum?: number): Promise<{
      tags: SongListCategory[]
      hotTag: SongListTag[]
    }>

    /** Get playlist list */
    getList(sortId: string | number, tagId: string, page: number, retryNum?: number): Promise<{
      list: SongListItem[]
      total?: number
      hasMore?: boolean
      source: LX.OnlineSource
    }>

    /** Get playlist detail (song list) */
    getListDetail(id: string | number, page: number, retryNum?: number): Promise<SongListDetail>

    /** Get playlist detail page URL */
    getDetailPageUrl(id: string | number): Promise<string> | string

    /** Search playlists */
    search(text: string, page: number, limit?: number, retryNum?: number): Promise<{
      list: SongListItem[]
      total?: number
      hasMore?: boolean
      source: LX.OnlineSource
    }>

    // --- wy specific ---
    /** Parse playlist link ID (wy) */
    handleParseId?(link: string, retryNum?: number): Promise<string>
    /** Get playlist ID (wy) */
    getListId?(id: string | number): Promise<{ id: string }>

    // --- kg specific ---
    /** Get playlist list - legacy API (kg) */
    getSongList?(sortId: string | number, tagId: string, page: number, retryNum?: number): Promise<any>
    /** Get recommended playlists (kg) */
    getSongListRecommend?(retryNum?: number): Promise<any>
    /** Get user playlist detail by link (kg) */
    getUserListDetail?(link: string, page: number, retryNum?: number): Promise<SongListDetail>
    /** Get user playlist detail by ID (kg) */
    getUserListDetailById?(id: string, page: number, limit: number): Promise<SongListDetail>
    /** Get playlist info (kg) */
    getListInfo?(tagId: string, retryNum?: number): Promise<any>

    // --- tx specific ---
    /** New playlist detail (tx) */
    getListDetailNew?(id: string | number, retryNum?: number): Promise<SongListDetail>
  }

  /**
   * Daily recommendation module
   *
   * Platform differences (core recommendation method names differ, no renaming):
   *   - wy: getList(cookie, retryNum) → daily recommended songs
   *   - tx: getGuessRecommend(retryNum) → guess you like
   *         getHomeFeed(page, direction, sNum, vCache, retryNum) → home Feed
   *   - kg: getRecommendSongs(retryNum) → personalized recommendation
   *         getEverydayRecommend(retryNum) → daily recommendation
   */
  interface DailyRecModule {
    // --- wy specific ---
    /** Get daily recommended songs (wy) */
    getList?(cookie: string, retryNum?: number): Promise<DailyRecResult>
    /** Save stylized tag (wy) */
    saveStylizedTag?(cookie: string, categoryId: string, tagIds: string, retryNum?: number): Promise<any>
    /** Get stylized recommendations (wy) */
    getStylizedList?(cookie: string, retryNum?: number): Promise<any>
    /** Get recommended playlists (wy) */
    getRecPlaylists?(cookie: string, retryNum?: number): Promise<RecommendSonglistResult>
    /** Get similar songs (wy) */
    getSimilarSongs?(songId: string | number, limit?: number, offset?: number, retryNum?: number): Promise<DailyRecResult>
    /** Get heartbeat mode list (wy) */
    getHeartbeatModeList?(cookie: string, playlistId?: string, songId?: string, retryNum?: number): Promise<DailyRecResult>

    // --- tx specific ---
    /** Guess you like recommendation (tx) */
    getGuessRecommend?(retryNum?: number): Promise<DailyRecResult>
    /** Get home feed (tx) */
    getHomeFeed?(page?: number, direction?: number, sNum?: number, vCache?: any[], retryNum?: number): Promise<DailyRecResult>
    /** Radar recommendation (tx) */
    getRadarRecommend?(page?: number, retryNum?: number): Promise<DailyRecResult>
    /** Recommended playlists (tx) */
    getRecommendSonglist?(page?: number, num?: number, retryNum?: number): Promise<RecommendSonglistResult>
    /** Recommended new songs (tx) */
    getRecommendNewsong?(retryNum?: number): Promise<DailyRecResult>
    /** Similar songs (tx) */
    getSimilarSongs?(songMid: string, limit?: number, retryNum?: number): Promise<DailyRecResult>

    // --- kg specific ---
    /** Personalized recommendation (kg) */
    getRecommendSongs?(retryNum?: number): Promise<DailyRecResult>
    /** Daily recommendation (kg) */
    getEverydayRecommend?(retryNum?: number): Promise<DailyRecResult>
    /** New song express (kg) */
    getNewSongs?(retryNum?: number): Promise<DailyRecResult>
  }

  /**
   * Artist module
   *
   * Unified methods: getDetail, getSongs, getAlbums, getSimilar
   * Platform differences:
   *   - Parameter names differ: wy uses id, tx uses artistMid, kg uses singerid
   *   - tx extras: getSingerDesc, getAlbumSongCount
   *   - kg: getSimilar not yet supported (returns empty array)
   */
  interface ArtistModule {
    /** Get artist detail */
    getDetail(id: string | number, retryNum?: number): Promise<ArtistDetail>

    /** Get artist songs */
    getSongs(
      id: string | number,
      order?: string,
      limit?: number,
      offset?: number,
      retryNum?: number
    ): Promise<ArtistSongsResult>

    /** Get artist albums */
    getAlbums(
      id: string | number,
      limit?: number,
      offset?: number,
      retryNum?: number
    ): Promise<ArtistAlbumsResult>

    /** Get similar artists */
    getSimilar(id: string | number, retryNum?: number): Promise<ArtistDetail[] | { artists: ArtistDetail[] }>

    // --- tx specific ---
    /** Get artist description (tx) */
    getSingerDesc?(artistMid: string, retryNum?: number): Promise<string>
    /** Get album song count (tx) */
    getAlbumSongCount?(albumMid: string, retryNum?: number): Promise<number>
  }

  /**
   * Album module
   *
   * Unified methods: getAlbum
   * Platform differences:
   *   - tx: getAlbumDetail (get raw detail data)
   *   - kg: getAlbumInfo, getAlbumDetail (split into info + list two APIs)
   */
  interface AlbumModule {
    /** Get album song list + detail (unified entry) */
    getAlbum(id: string | number, retryNum?: number): Promise<AlbumDetail>

    // --- tx specific ---
    /** Get album raw detail data (tx) */
    getAlbumDetail?(albumMid: string, retryNum?: number): Promise<any>

    // --- kg specific ---
    /** Get album info (kg) */
    getAlbumInfo?(id: string | number): Promise<any>
    /** Get album song list (kg) */
    getAlbumDetail?(id: string | number, page?: number, limit?: number): Promise<any>
  }

  /**
   * User module (playlist sync)
   *
   * Platform differences are significant, method names and parameters vary:
   *   - wy: manipulatePlaylistTracks(op, pid, tracks) unified add/remove
   *   - tx: addSongToPlaylist / removeSongFromPlaylist separate add/remove
   *   - kg: adapted via kg/utils/api.ts, method signatures include cookie
   */
  interface UserModule {

    /** Get user playlists */
    getUserPlaylists(
      ...args: [uid?: string | number, cookie?: string, retryNum?: number] | [retryNum?: number] | [cookie?: string]
    ): Promise<UserPlaylistsResult>

    /** Create playlist */
    createPlaylist?(
      name: string,
      privacyOrRetry?: number | string,
      retryNum?: number
    ): Promise<any>

    /** Delete playlist */
    deletePlaylist?(
      id: string | number,
      retryNum?: number
    ): Promise<any>

    /** Add songs to playlist */
    addSongToPlaylist?(
      ...args:
        | [pid: string | number, tracks: any[], retryNum?: number]
        | [listId: string | number, songMids: string[], retryNum?: number]
        | [cookie: string, listId: string | number, songInfo: any]
    ): Promise<any>

    /** Remove songs from playlist */
    removeSongsFromPlaylist?(
      ...args:
        | [pid: string | number, tracks: any[], retryNum?: number]
        | [listId: string | number, songMids: string[], retryNum?: number]
        | [cookie: string, listId: string | number, fileHash: string]
    ): Promise<any>

    /** Manipulate playlist tracks - unified add/remove entry (wy) */
    manipulatePlaylistTracks?(
      op: 'add' | 'del',
      pid: string | number,
      tracks: any[],
      retryNum?: number
    ): Promise<any>

    /** Get playlist song list */
    getPlaylistSongs?(
      cookie: string,
      listId: string | number,
      page?: number,
      limit?: number
    ): Promise<{ list: AnyMusicInfo[]; total?: number }>

    /** Get playlist detail (tx) */
    getPlaylistDetail?(
      disstid: string | number,
      retryNum?: number
    ): Promise<SongListDetail>

    /** Subscribe/unsubscribe playlist */
    subPlaylist?(id: string | number, isSub: boolean, retryNum?: number): Promise<any>

    /** Unsubscribe playlist */
    unsubscribePlaylist?(
      ...args:
        | [cookie: string, listid: string | number]
        | [id: string | number, isSub: boolean]
    ): Promise<any>

    /** Subscribe playlist (kg) */
    subscribePlaylist?(
      cookie: string,
      playlistInfo: any
    ): Promise<any>

    /** Get favorited playlists */
    getFavPlaylists?(page?: number, pageSize?: number, retryNum?: number): Promise<{
      list: FavPlaylistItem[]
      total?: number
      hasMore?: boolean
    }>

    /** Get all subscribed album list - full (wy) */
    getAllSubAlbumList?(): Promise<FavAlbumItem[]>

    /** Subscribe/unsubscribe album */
    subAlbum?(id: string | number, isSub: boolean, retryNum?: number): Promise<any>

    /** Like/unlike song */
    likeSong?(
      ...args:
        | [songId: string | number, like: boolean, retryNum?: number]
        | [songMid: string, like: boolean]
    ): Promise<any>

    /** Get liked song list */
    getLikedSongList?(
      uid: string | number,
      cookie: string,
      retryNum?: number
    ): Promise<AnyMusicInfo[]>

    /** Get favorited songs (tx) */
    getFavSongs?(page?: number, pageSize?: number, retryNum?: number): Promise<{
      list: AnyMusicInfo[]
      total?: number
      hasMore?: boolean
    }>

    /** Get "My Favorites" playlist ID (tx) */
    getLikedListId?(): Promise<string>

    /** Get user UID (wy) */
    getUid?(cookie: string, retryNum?: number): Promise<string | number>

    /** Get user info (tx) */
    getUserInfo?(retryNum?: number): Promise<UserInfo>

    /** Extract uin from cookie (tx) */
    extractUin?(cookie: string): string | undefined

    /** Extract encrypted UIN from cookie (tx) */
    extractEuin?(cookie: string): string | undefined

    /** Get followed artist list (wy) */
    getSublist?(limit?: number, offset?: number, retryNum?: number): Promise<any>

    /** Get all followed artists (wy) */
    getAllSublist?(): Promise<any>

    /** Follow/unfollow artist (wy) */
    followSinger?(id: string | number, isFollow: boolean, retryNum?: number): Promise<any>

    /** Song scrobble/play record (wy) */
    scrobble?(songId: string | number, sourceId: string | number, duration: number, retryNum?: number): Promise<any>

    /** Update playlist info (wy) */
    updatePlaylist?(id: string | number, name: string, desc: string, retryNum?: number): Promise<any>

    /** Get user-created playlists (tx) */
    getCreatedPlaylists?(retryNum?: number): Promise<UserPlaylistsResult>

    /** Get "My Favorites" music (tx) */
    getFavoritesMusic?(page?: number, pageSize?: number, retryNum?: number): Promise<any>

    /** Search songs by songmid (tx) */
    searchSong?(songmid: string): Promise<AnyMusicInfo | null>

    /** Send signed request (tx) */
    sendSignedRequest?(payload: any): Promise<any>
  }

  /**
   * Leaderboard module
   *
   * Unified methods: getBoards, getList
   */
  interface LeaderboardModule {
    /** Get leaderboard list */
    getBoards(retryNum?: number): Promise<{
      list: LeaderboardItem[]
      source: LX.OnlineSource
    }>

    /** Get leaderboard songs */
    getList(bangid: string | number, page?: number, retryNum?: number): Promise<LeaderboardListResult>

    /** Get leaderboard detail page URL */
    getDetailPageUrl?(id: string | number): string
  }

  /**
   * Search module
   *
   * Unified methods: search, searchSinger, searchAlbum
   * Platform differences:
   *   - wy: musicSearch is internal method (lowercase first letter), search is public method
   *   - tx: musicSearch is internal method, search is public method
   *   - kg: musicSearch is internal method, search is public method
   */
  interface MusicSearchModule {
    /** Search songs */
    search(str: string, page?: number, limit?: number, retryNum?: number, options?: Record<string, any>): Promise<MusicSearchResult>

    /** Search artists */
    searchSinger(str: string, page?: number, limit?: number, retryNum?: number): Promise<SingerSearchResult>

    /** Search albums */
    searchAlbum(str: string, page?: number, limit?: number, retryNum?: number): Promise<AlbumSearchResult>
  }

  /**
   * Hot search module
   *
   * Unified methods: getList
   */
  interface HotSearchModule {
    /** Get hot search term list */
    getList(retryNum?: number): Promise<HotSearchResult>
  }

  /**
   * Comment module
   *
   * Unified methods: getComment, getHotComment
   * Platform differences:
   *   - wy: sendComment, replyComment, deleteComment (can send/reply/delete comments)
   *   - kg: getReplyComment (can get nested replies)
   */
  interface CommentModule {
    /** Get comments */
    getComment(
      musicInfo: AnyMusicInfo,
      page?: number,
      limit?: number
    ): Promise<CommentResult>

    /** Get hot comments */
    getHotComment(
      musicInfo: AnyMusicInfo,
      page?: number,
      limit?: number
    ): Promise<CommentResult>

    // --- wy specific ---
    /** Send comment (wy) */
    sendComment?(songmid: string, content: string, retryNum?: number): Promise<any>
    /** Reply to comment (wy) */
    replyComment?(songmid: string, content: string, commentId: string | number, retryNum?: number): Promise<any>
    /** Delete comment (wy) */
    deleteComment?(songmid: string, commentId: string | number, retryNum?: number): Promise<any>

    // --- kg specific ---
    /** Get nested replies (kg) */
    getReplyComment?(
      musicInfo: AnyMusicInfo,
      replyId: string | number,
      page?: number,
      limit?: number
    ): Promise<CommentResult>
  }

  // ============================================================
  //  Main module interface
  // ============================================================

  /**
   * Music source module — unified export structure
   *
   * The index.js export objects of wy / tx / kg all must implement this interface.
   * Each sub-module uses optional properties (?) to accommodate platform differences,
   * ensuring unified access without losing platform-specific features.
   */
  interface MusicSourceModule {
    leaderboard: LeaderboardModule
    songList: SongListModule
    musicSearch: MusicSearchModule
    hotSearch: HotSearchModule
    comment: CommentModule
    artist: ArtistModule
    dailyRec: DailyRecModule

    /** Album module (wy not yet mounted, must be mounted after standardization) */
    album?: AlbumModule

    /** User module (wy/kg not yet mounted, must be mounted after standardization) */
    user?: UserModule

    // --- Cookie module (wy specific) ---
    cookie?: {
      /** Get cookie-related operations */
      [key: string]: any
    }

    // --- Playback related ---
    /** Get music playback URL */
    getMusicUrl(songInfo: AnyMusicInfo, type: string): Promise<LX.Music.MusicUrlInfo>

    /** Get lyrics */
    getLyric(songInfo: AnyMusicInfo): Promise<LX.Music.LyricInfo>

    /** Get song cover image */
    getPic(songInfo: AnyMusicInfo): Promise<string>

    /** Get song detail page URL */
    getMusicDetailPageUrl(songInfo: AnyMusicInfo): string
  }

  /**
   * Music source module registry
   *
   * Access platform module instances via musicSdk[source]
   */
  interface MusicSdkRegistry {
    wy: MusicSourceModule
    tx: MusicSourceModule
    kg: MusicSourceModule
    [key: string]: MusicSourceModule
  }
}
