import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { View, BackHandler, TouchableOpacity, StyleSheet, TextInput as RNTextInput } from 'react-native'
import MusicList, { type MusicListType } from './MusicList'
import { type ListInfoItem } from '@/store/songlist/state'
import { ListInfoContext } from './state'
import ActionBar from './ActionBar'
import Image from '@/components/common/Image'
import Text from '@/components/common/Text'
import { NAV_SHEAR_NATIVE_IDS } from '@/config/constant'
import { createStyle, toast } from '@/utils/tools'
import { scaleSizeW } from '@/utils/pixelRatio'
import { useTheme } from '@/store/theme/hook'
import { BorderWidths } from '@/theme'
import { pop } from '@/navigation'
import commonState from '@/store/common/state'
import { Icon } from '@/components/common/Icon'
import { SvgIcon } from '@/components/common/SvgIcon'
import Input from '@/components/common/Input'
import { useIsWyPlaylistSubscribed, useWySubscribedPlaylists, useWyUid } from '@/store/user/hook'
import wyApi from '@/utils/musicSdk/wy/user'
import { addWySubscribedPlaylist, removeWySubscribedPlaylist } from '@/store/user/action'
import { COMPONENT_IDS } from '@/config/constant'
import { type DetailInfo } from "@/screens/SonglistDetail/Header.tsx"
import playerState from '@/store/player/state'
import { LIST_IDS } from '@/config/constant'
import listState from '@/store/list/state'
import {usePlayerMusicInfo} from "@/store/player/hook.ts"
import MusicInfoOnline = LX.Music.MusicInfoOnline

const IMAGE_WIDTH = scaleSizeW(70)

const ListHeader = ({ detailInfo, info, onBack, showSearchBar, searchText, isFuzzySearch, onToggleSearch, onSearchTextChanged, onToggleSearchMode }: { detailInfo: DetailInfo, info: ListInfoItem, onBack: () => void, showSearchBar: boolean, searchText: string, isFuzzySearch: boolean, onToggleSearch: () => void, onSearchTextChanged: (text: string) => void, onToggleSearchMode: () => void }) => {
  const theme = useTheme()
  const loggedInUserId = useWyUid()
  const isSubscribed = useIsWyPlaylistSubscribed(info.id)

  const isWyCreator = useMemo(() => {
    return info.source === 'wy' &&
      detailInfo.userId &&
      String(detailInfo.userId) === String(loggedInUserId)
  }, [info.source, detailInfo.userId, loggedInUserId])

  const showSubscribeButton = useMemo(() => {
    return info.source === 'wy' && !isWyCreator
  }, [info.source, isWyCreator])

  const toggleSubscribe = useCallback(() => {
    const newSubState = !isSubscribed
    wyApi.subPlaylist(String(info.id), newSubState).then(() => {
      toast(newSubState ? '收藏成功' : '取消收藏成功')
      if (newSubState) {
        addWySubscribedPlaylist({
          id: info.id,
          userId: detailInfo.userId as number,
          name: detailInfo.name,
          coverImgUrl: detailInfo.imgUrl || '',
          trackCount: info.total || 0,
        })
      } else {
        removeWySubscribedPlaylist(info.id)
      }
    }).catch(err => {
      toast(`操作失败: ${err.message}，可能是Cookie已失效，请重新登录`)
    })
  }, [isSubscribed, info, detailInfo])

  return (
    <>
      <View style={{ ...styles.listHeaderContainer, borderBottomColor: theme['c-border-background'] }}>
        <View style={{ flexDirection: 'row', flexGrow: 0, flexShrink: 0, padding: 10 }}>
          <View style={{ ...styles.listItemImg, width: IMAGE_WIDTH, height: IMAGE_WIDTH }}>
            {info.isFavorites ? (
              <View style={styles.favoritesPlaceholder}>
                <Icon name="love-filled" color="#FF4D6A" size={36} />
              </View>
            ) : (
              <Image
                nativeID={`${NAV_SHEAR_NATIVE_IDS.songlistDetail_pic}_to_${info.id}`}
                url={detailInfo.imgUrl}
                style={{ flex: 1, borderRadius: 4 }}
              />
            )}
            {detailInfo.playCount ? (
              <Text style={styles.playCount} numberOfLines={1}>
                {detailInfo.playCount}
              </Text>
            ) : null}
          </View>
          <View
            style={{ flexDirection: 'column', flexGrow: 1, flexShrink: 1, paddingLeft: 5 }}
            nativeID={NAV_SHEAR_NATIVE_IDS.songlistDetail_title}
          >
            <Text size={14} numberOfLines={1}>
              {detailInfo.name}
            </Text>
            <View style={styles.descContainer}>
              <View style={{ flexGrow: 1, flexShrink: 1 }}>
                <Text size={13} color={theme['c-font-label']} numberOfLines={4}>
                  {detailInfo.desc}
                </Text>
              </View>
              {showSubscribeButton && (
                <TouchableOpacity style={styles.subscribeButton} onPress={toggleSubscribe}>
                  <Icon name={isSubscribed ? 'love-filled' : 'love'} color={isSubscribed ? theme['c-liked'] : theme['c-font-label']} size={20} />
                </TouchableOpacity>
              )}
            </View>
          </View>
          <TouchableOpacity style={styles.searchIcon} onPress={onToggleSearch}>
            <Icon name="search-2" size={20} color={theme['c-font-label']} />
          </TouchableOpacity>
        </View>
        {showSearchBar && (
          <View style={styles.searchBarContainer}>
            <Input
              placeholder="搜索歌曲名称、歌手..."
              value={searchText}
              onChangeText={onSearchTextChanged}
              autoFocus
              style={styles.searchInput}
            />
            <TouchableOpacity style={styles.searchModeButton} onPress={onToggleSearchMode}>
              {isFuzzySearch ? (
                <SvgIcon name="fuzzy-search" size={18} color={theme['c-font-label']} />
              ) : (
                <Icon name="search-2" size={18} color={theme['c-font-label']} />
              )}
            </TouchableOpacity>
          </View>
        )}
        <ActionBar onBack={onBack} />
      </View>
    </>
  )
}

export default ({ info, onBack, initialScrollToInfo }: { info: ListInfoItem, onBack?: () => void, initialScrollToInfo: MusicInfoOnline | null }) => {
  const musicListRef = useRef<MusicListType>(null)
  const [detailInfo, setDetailInfo] = useState<DetailInfo>({
    name: info.name,
    desc: info.desc || '',
    playCount: info.play_count || '',
    imgUrl: info.img,
    userId: info.userId,
    total: Number(info.total) || 0,
  })
  const [showSearchBar, setShowSearchBar] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [isFuzzySearch, setIsFuzzySearch] = useState(true)
  const playlists = useWySubscribedPlaylists()
  const isInitialMount = useRef(true)
  const loggedInUserId = useWyUid()
  const playerMusicInfo = usePlayerMusicInfo()
  const initialScrollDoneRef = useRef(false)

  const handleBack = onBack

  const refreshList = useCallback((isRefresh = false) => {
    if (global.lx.isEnableLog) console.log(`[SonglistDetail] refreshList`, { source: info.source, id: info.id, isRefresh })
    musicListRef.current?.loadList(info.source, info.id, isRefresh).then(setDetailInfo)
  }, [info.source, info.id])

  useEffect(() => {
    const handleJumpPosition = () => {
      let listId = playerState.playMusicInfo.listId
      if (listId === LIST_IDS.TEMP) listId = listState.tempListMeta.id
      if (listId !== `${info.source}__${info.id}`) return
      const musicInfo = playerState.playMusicInfo.musicInfo
      if (musicInfo) {
        musicListRef.current?.scrollToInfo(musicInfo as LX.Music.MusicInfoOnline)
      }
    }
    global.app_event.on('jumpListPosition', handleJumpPosition)
    return () => {
      global.app_event.off('jumpListPosition', handleJumpPosition)
    }
  }, [info.id, info.source])

  useEffect(() => {
    refreshList(true)
  }, [refreshList])

  useEffect(() => {
    // Normalize ID for event matching: strip all known prefixes so different ID formats match
    const normalizeId = (id: string) =>
      id.toString().replace('kg__', '').replace('collection_', '').replace('id_', '')

    const handlePlaylistUpdate = ({ source, listId, addedSong }: { source: string, listId: string, addedSong?: any }) => {
      if (info.source === source && normalizeId(info.id) === normalizeId(listId)) {
        if (addedSong) {
          musicListRef.current?.addSongToList(addedSong)
        } else {
          setTimeout(() => {
            refreshList(true)
          }, 100)
        }
      }
    }
    global.app_event.on('playlist_updated', handlePlaylistUpdate)
    return () => {
      global.app_event.off('playlist_updated', handlePlaylistUpdate)
    }
  }, [info.id, info.source, refreshList])

  useEffect(() => {
    const onBackPress = () => {
      const lastScreen = commonState.componentIds[commonState.componentIds.length - 1]

      if (lastScreen && lastScreen.name !== COMPONENT_IDS.home) {
        return false
      }

      handleBack()
      return true
    }
    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress)
    return () => subscription.remove()
  }, [handleBack])

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }
    const updatedPlaylist = playlists.find(p => String(p.id) === String(info.id))
    if (!updatedPlaylist) {
      return
    }
    if (updatedPlaylist.name !== detailInfo.name || updatedPlaylist.description !== detailInfo.desc && updatedPlaylist.description != null) {
      setDetailInfo(prev => ({
        ...prev,
        name: updatedPlaylist.name,
        desc: updatedPlaylist.description || '',
      }))
    }
  }, [playlists, handleBack, info.id, detailInfo.name, detailInfo.desc])

  useEffect(() => {
    if (initialScrollToInfo && detailInfo.total > 0 && !initialScrollDoneRef.current) {
      initialScrollDoneRef.current = true
      setTimeout(() => {
        musicListRef.current?.scrollToInfo(initialScrollToInfo)
      }, 300)
    }
  }, [detailInfo.total, initialScrollToInfo])

  const handleToggleSearch = useCallback(() => {
    setShowSearchBar(prev => {
      if (prev) {
        setSearchText('')
        setIsFuzzySearch(true)
      }
      return !prev
    })
  }, [])

  const handleSearchTextChanged = useCallback((text: string) => {
    setSearchText(text)
  }, [])

  const handleToggleSearchMode = useCallback(() => {
    setIsFuzzySearch(prev => {
      toast(prev ? '精确搜索' : '模糊搜索')
      return !prev
    })
  }, [])

  const ListHeaderComponent = useMemo(() => (
    <ListHeader detailInfo={detailInfo} info={info} onBack={handleBack} showSearchBar={showSearchBar} searchText={searchText} isFuzzySearch={isFuzzySearch} onToggleSearch={handleToggleSearch} onSearchTextChanged={handleSearchTextChanged} onToggleSearchMode={handleToggleSearchMode} />
  ), [detailInfo, info, handleBack, showSearchBar, searchText, isFuzzySearch, handleToggleSearch, handleSearchTextChanged, handleToggleSearchMode])

  const handleListUpdate = useCallback((newList: LX.Music.MusicInfoOnline[]) => {
    setDetailInfo(prev => ({
      ...prev,
      total: newList.length,
    }))
  }, [])

  return (
    <View style={{ flex: 1 }}>
      <ListInfoContext.Provider value={info}>
        {ListHeaderComponent}
        <MusicList ref={musicListRef} playingId={playerMusicInfo.id} componentId={commonState.componentIds[commonState.componentIds.length - 1]?.id} isCreator={true} searchText={searchText} isFuzzySearch={isFuzzySearch} onListUpdate={handleListUpdate} />
      </ListInfoContext.Provider>
    </View>
  )
}

const styles = createStyle({
  listHeaderContainer: {
    flexDirection: 'column',
    flexWrap: 'nowrap',
    borderBottomWidth: BorderWidths.normal,
  },
  listItemImg: {
    flexGrow: 0,
    flexShrink: 0,
    overflow: 'hidden',
  },
  playCount: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: '100%',
    fontSize: 12,
    paddingLeft: 3,
    paddingRight: 3,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    color: '#fff',
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
  },
  descContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexGrow: 1,
    flexShrink: 1,
  },
  searchIcon: {
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
    padding: 5,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 5,
    paddingVertical: 5,
  },
  searchInput: {
    flex: 1,
    height: 38,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 10,
    fontSize: 14,
    justifyContent: 'center',
  },
  searchModeButton: {
    width: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  subscribeButton: {
    paddingLeft: 10,
    paddingRight: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  favoritesPlaceholder: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 4,
  },
})
