import { setNavActiveId } from '@/core/common'
import Event from './Event'
import commonState from '@/store/common/state'
import { type Source as SonglistSource } from '@/store/songlist/state'
import { type SearchType } from '@/store/search/state'
import DownloadTask = LX.Download.DownloadTask
import playerState from '@/store/player/state'
import listState from '@/store/list/state'
import userState from '@/store/user/state'
import {COMPONENT_IDS, LIST_IDS, type NAV_ID_Type} from '@/config/constant'
import {navigations} from "@/navigation";
import {getDailyRecCache} from "@/utils/data.ts";
import {toast} from "@/utils/tools.ts";
import { isOneDriveMusicInfo } from '@/core/oneDrive/utils'

// {
//   // sync: {
//   //   send_action_list: 'send_action_list',
//   //   handle_action_list: 'handle_action_list',
//   //   send_sync_list: 'send_sync_list',
//   //   handle_sync_list: 'handle_sync_list',
//   // },
// }

export class AppEvent extends Event {
  // configUpdate() {
  //   this.emit('configUpdate')
  // }

  focus() {
    this.emit('focus')
  }

  /**
   * My list updated
   */
  mylistUpdated(
    lists: Array<LX.List.MyDefaultListInfo | LX.List.MyLoveListInfo | LX.List.UserListInfo>,
  ) {
    this.emit('mylistUpdated', lists)
  }

  /**
   * My list toggled
   */
  mylistToggled(id: string) {
    this.emit('listToggled', id)
  }

  /**
   * Music info toggled
   */
  musicToggled() {
    this.emit('musicToggled')
  }

  /**
   * Manually change progress
   * @param progress progress
   */
  setProgress(progress: number, maxPlayTime?: number) {
    this.emit('setProgress', progress, maxPlayTime)
  }

  /**
   * Set volume level
   * @param volume volume level
   */
  setVolume(volume: number) {
    this.emit('setVolume', volume)
  }

  /**
   * Set whether to mute
   * @param isMute whether to mute
   */
  setVolumeIsMute(isMute: boolean) {
    this.emit('setVolumeIsMute', isMute)
  }

  play() {
    this.emit('play')
  }

  pause() {
    this.emit('pause')
  }

  stop() {
    this.emit('stop')
  }

  error() {
    this.emit('error')
  }

  playerPlaying() {
    this.emit('playerPlaying')
  }

  playerPause() {
    this.emit('playerPause')
  }

  // playerStop() {
  //   this.emit('playerStop')
  // }

  playerEnded() {
    this.emit('playerEnded')
  }

  playerError() {
    this.emit('playerError')
  }

  // playerLoadeddata() {
  //   this.emit('playerLoadeddata')
  // }

  playerLoadstart() {
    this.emit('playerLoadstart')
  }

  // playerCanplay() {
  //   this.emit('playerCanplay')
  // }

  playerEmptied() {
    this.emit('playerEmptied')
  }

  playerWaiting() {
    this.emit('playerWaiting')
  }

  picUpdated() {
    this.emit('picUpdated')
  }

  webdavPicUpdated(musicId: string, picUrl: string) {
    this.emit('webdavPicUpdated', musicId, picUrl)
  }

  lyricUpdated() {
    this.emit('lyricUpdated')
  }

  lyricOffsetUpdate() {
    this.emit('lyricOffsetUpdate')
  }

  myListMusicUpdate(ids: string[]) {
    if (!ids.length) return
    this.emit('myListMusicUpdate', ids)
  }

  downloadListUpdate() {
    this.emit('downloadListUpdate')
  }

  musicInfoUpdate(musicInfo: LX.Music.MusicInfo) {
    this.emit('musicInfoUpdate', musicInfo)
  }

  playHistoryUpdated() {
    this.emit('playHistoryUpdated')
  }

  changeMenuVisible(visible: boolean) {
    this.emit('changeMenuVisible', visible)
  }

  /**
   * Search type changed event
   * @param type
   */
  searchTypeChanged(type: SearchType) {
    this.emit('searchTypeChanged', type)
  }

  searchDeepLink(keyword: string, source: string, type: string) {
    this.emit('searchDeepLink', keyword, source, type)
  }

  async jumpListPosition() {
    const playMusicInfo = playerState.playMusicInfo
    let listId = playMusicInfo.listId
    const rawMusicInfo = playMusicInfo.musicInfo
    const musicInfo = rawMusicInfo && 'progress' in rawMusicInfo ? rawMusicInfo.metadata.musicInfo : rawMusicInfo

    if (isOneDriveMusicInfo(musicInfo)) {
      if (commonState.navActiveId !== 'nav_onedrive') setNavActiveId('nav_onedrive')
      setTimeout(() => {
        this.emit('jumpOneDrivePosition')
      }, 200)
      return
    }

    if (!listId || !musicInfo) {
      if (commonState.navActiveId === 'nav_love') {
        this.emit('jumpListPosition')
      } else {
        setNavActiveId('nav_love')
        setTimeout(() => this.emit('jumpListPosition'), 200)
      }
      return
    }

    if (listId === LIST_IDS.TEMP) {
      listId = listState.tempListMeta.id
    }

    const currentComponentId = commonState.componentIds[commonState.componentIds.length - 1]?.id
    if (!currentComponentId) return

    let navigatedToDetail = false
    const currentComponent = commonState.componentIds[commonState.componentIds.length - 1];

    if (listId.startsWith('artist_detail_')) {
      const artistId = listId.replace('artist_detail_', '')
      console.log(currentComponent?.name)
      if (currentComponent?.name !== COMPONENT_IDS.ARTIST_DETAIL) {
        navigations.pushArtistDetailScreen(currentComponentId, { id: artistId, name: musicInfo.singer })
        navigatedToDetail = true
      }
    } else if (listId.startsWith('album_')) {
      const albumId = listId.replace('album_', '')
      if (currentComponent?.name !== COMPONENT_IDS.ALBUM_DETAIL_SCREEN) {
        navigations.pushAlbumDetailScreen(currentComponentId, { id: albumId, name: musicInfo.meta.albumName, source: musicInfo.source as LX.OnlineSource })
        navigatedToDetail = true
      }
    } else if (listId.includes('__')) {
      const [source, sourceId] = listId.split('__')
      const isSubscribed = userState.wy_subscribed_playlists.some(p => String(p.id) === sourceId)
      const targetNavId: NAV_ID_Type = isSubscribed ? 'nav_my_playlist' : 'nav_songlist'

      if (commonState.navActiveId !== targetNavId) {
        global.lx.jumpMyListPosition = true
        setNavActiveId(targetNavId)
      }
    } else if (listId.startsWith('dailyrec_wy')) {
      setNavActiveId('nav_daily_rec')
    } else if (listId === 'similar_songs_list') {
      if (currentComponent?.name !== COMPONENT_IDS.SIMILAR_SONGS_SCREEN) {
        const cache = await getDailyRecCache();
        const allSimilarSongs = cache?.items.flatMap(item => item.similarSongs) ?? [];
        if (allSimilarSongs.length === 0) {
          toast('找不到相似歌曲列表');
          return;
        }
        const uniqueSongs = Array.from(new Map(allSimilarSongs.map(song => [song.id, song])).values());
        navigations.pushSimilarSongsScreen(currentComponentId, uniqueSongs);
        navigatedToDetail = true;
      }
    } else {
      const targetNavId: NAV_ID_Type = 'nav_love'
      if (commonState.navActiveId !== targetNavId) {
        global.lx.jumpMyListPosition = true
        setNavActiveId(targetNavId)
      }
    }

    setTimeout(() => {
      this.emit('jumpListPosition')
    }, navigatedToDetail ? 500 : 200)
  }

  changeLoveListVisible(visible: boolean) {
    this.emit('changeLoveListVisible', visible)
  }

  showSonglistTagList(source: SonglistSource, activeId: string) {
    this.emit('showSonglistTagList', source, activeId)
  }

  hideSonglistTagList() {
    this.emit('hideSonglistTagList')
  }

  songlistTagInfoChange(name: string, id: string) {
    this.emit('songlistTagInfoChange', name, id)
  }

  selectSyncMode(mode: LX.Sync.ModeType) {
    this.emit('selectSyncMode', mode)
  }

  showArtistSelector(artists: any[], onSelect: (artist: any) => void) {
    this.emit('showArtistSelector', artists, onSelect)
  }

  triggerSearch(text: string) {
    this.emit('triggerSearch', text)
  }

  download_list_changed() {
    this.emit('download_list_changed')
  }
  download_task_add(task: DownloadTask) {
    this.emit('download_task_add', task)
  }
  download_progress_update(payload: { id: string, progress: DownloadTask['progress'] }) {
    this.emit('download_progress_update', payload)
  }
  download_status_update(payload: { id: string, status: DownloadTask['status'], errorMsg?: string }) {
    this.emit('download_status_update', payload)
  }
  download_metadata_update(payload: { id: string, metadataStatus: DownloadTask['metadataStatus'] }) {
    this.emit('download_metadata_update', payload)
  }
  show_download_ball() {
    this.emit('show_download_ball')
  }
  showVideoPlayer(url: string) {
    this.emit('showVideoPlayer', url)
  }
  playlist_updated(data: { source: string, listId: string }) {
    this.emit('playlist_updated', data)
  }

  jumpOneDrivePosition() {
    this.emit('jumpOneDrivePosition')
  }

  showPlaylist() {
    this.emit('showPlaylist')
  }

  switchToLyricPage() {
    this.emit('switchToLyricPage')
  }
}

type EventMethods = Omit<EventType, keyof Event>

declare class EventType extends AppEvent {
  on<K extends keyof EventMethods>(event: K, listener: EventMethods[K]): any
  off<K extends keyof EventMethods>(event: K, listener: EventMethods[K]): any
}

export type AppEventTypes = Omit<EventType, keyof Omit<Event, 'on' | 'off'>>
export const createAppEventHub = (): AppEventTypes => {
  return new AppEvent()
}
