import { useEffect, useMemo, useState } from 'react'
import Search from '../Views/Search'
import SongList from '../Views/SongList'
import Mylist from '../Views/Mylist'
import Leaderboard from '../Views/Leaderboard'
import Setting from '../Views/Setting'
import commonState, { type InitState as CommonState } from '@/store/common/state'
import DailyRec from '../Views/DailyRec'
import TXDailyRec from '../Views/DailyRec/TXDailyRec'
import MyPlaylist from '../Views/MyPlaylist'
import SubscribedAlbums from "@/screens/Home/Views/SubscribedAlbums"
import FollowedArtists from "@/screens/Home/Views/FollowedArtists"
import PlayHistory from '../Views/PlayHistory'
import OneDrive from '../Views/OneDrive'
import WebDAV from '../Views/WebDAV'
import TXPlaylist from '../Views/TxPlaylist'
import KgPlaylist from '../Views/KgPlaylist'
import KgDailyRec from '../Views/KgDailyRec'

const Main = () => {
  const [id, setId] = useState(commonState.navActiveId)

  useEffect(() => {
    const handleUpdate = (id: CommonState['navActiveId']) => {
      requestAnimationFrame(() => {
        setId(id)
      })
    }
    global.state_event.on('navActiveIdUpdated', handleUpdate)
    return () => {
      global.state_event.off('navActiveIdUpdated', handleUpdate)
    }
  }, [])

  const component = useMemo(() => {
    switch (id) {
      case 'nav_play_history':
        return <PlayHistory />
      case 'nav_daily_rec':
        return <DailyRec />
      case 'nav_tx_daily_rec':
        return <TXDailyRec />
      case 'nav_my_playlist':
        return <MyPlaylist />
      case 'nav_songlist':
        return <SongList />
      case 'nav_top':
        return <Leaderboard />
      case 'nav_followed_artists':
        return <FollowedArtists />
      case 'nav_subscribed_albums':
        return <SubscribedAlbums />
      case 'nav_onedrive':
        return <OneDrive />
      case 'nav_webdav':
        return <WebDAV />
      case 'nav_tx_playlist':
        return <TXPlaylist />
      case 'nav_kg_playlist':
        return <KgPlaylist />
      case 'nav_kg_daily_rec':
        return <KgDailyRec />
      case 'nav_love':
        return <Mylist />
      case 'nav_setting':
        return <Setting />
      case 'nav_search':
      default:
        return <Search />
    }
  }, [id])

  return component
}

export default Main
