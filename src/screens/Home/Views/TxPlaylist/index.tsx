/**
 * QQ音乐歌单页面 - 显示用户自建歌单和收藏歌单
 */

import { memo, useEffect, useState, useCallback, useRef } from 'react'
import { View, FlatList, RefreshControl, BackHandler, StyleSheet, Keyboard, TouchableOpacity } from 'react-native'
import ListItem from './ListItem'
import txUserApi from '@/utils/musicSdk/tx/user'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import Text from '@/components/common/Text'
import { toast, confirmDialog } from '@/utils/tools'
import SonglistDetail from '../../../SonglistDetail'
import commonState from '@/store/common/state'
import Menu, { type MenuType, type Position } from '@/components/common/Menu'
import ConfirmAlert, { type ConfirmAlertType } from '@/components/common/ConfirmAlert'
import Input from '@/components/common/Input'

interface PlaylistInfo {
  id: string
  name: string
  cover: string
  songCount: number
  desc: string
  isFavorites?: boolean
  isCollected?: boolean
  dirid?: number
}

type TabType = 'created' | 'collected'

export default memo(() => {
  const t = useI18n()
  const theme = useTheme()
  const [activeTab, setActiveTab] = useState<TabType>('created')
  const [createdPlaylists, setCreatedPlaylists] = useState<PlaylistInfo[]>([])
  const [collectedPlaylists, setCollectedPlaylists] = useState<PlaylistInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedPlaylist, setSelectedPlaylist] = useState<any>(null)
  const selectedPlaylistRef = useRef(selectedPlaylist)
  selectedPlaylistRef.current = selectedPlaylist

  const [menuVisible, setMenuVisible] = useState(false)
  const menuRef = useRef<MenuType>(null)
  const selectedItemRef = useRef<PlaylistInfo | null>(null)

  const [createModalVisible, setCreateModalVisible] = useState(false)
  const createModalRef = useRef<ConfirmAlertType>(null)
  const [newPlaylistName, setNewPlaylistName] = useState('')

  const playlists = activeTab === 'created' ? createdPlaylists : collectedPlaylists

  const fetchCreatedPlaylists = useCallback(async (isRefresh = false) => {
    try {
      const lists = await txUserApi.getCreatedPlaylists()
      
      const favoritesPlaylist = lists.find((p: PlaylistInfo) => p.isFavorites)
      if (favoritesPlaylist && favoritesPlaylist.songCount > 0) {
        try {
          const favSongs = await txUserApi.getFavSongs(1, 1)
          if (favSongs.list && favSongs.list.length > 0) {
            const firstSong = favSongs.list[0]
            const coverUrl = firstSong.albumMid 
              ? `https://y.gtimg.cn/music/photo_new/T002R800x800M000${firstSong.albumMid}.jpg`
              : favoritesPlaylist.cover
            favoritesPlaylist.cover = coverUrl
          }
        } catch (err) {
          console.warn('获取"我喜欢"歌单详情失败:', err)
        }
      }
      
      setCreatedPlaylists(lists)
    } catch (err: any) {
      console.error('获取自建歌单失败:', err)
      if (!isRefresh) {
        toast(`获取自建歌单失败: ${err.message}`)
      }
    }
  }, [])

  const fetchCollectedPlaylists = useCallback(async (isRefresh = false) => {
    try {
      const result = await txUserApi.getFavPlaylists(1, 50)
      setCollectedPlaylists(result.list || [])
    } catch (err: any) {
      console.error('获取收藏歌单失败:', err)
      if (!isRefresh) {
        toast(`获取收藏歌单失败: ${err.message}`)
      }
    }
  }, [])

  const fetchPlaylists = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }
      await Promise.all([
        fetchCreatedPlaylists(isRefresh),
        fetchCollectedPlaylists(isRefresh),
      ])
    } catch (err: any) {
      console.error('获取歌单失败:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [fetchCreatedPlaylists, fetchCollectedPlaylists])

  useEffect(() => {
    fetchPlaylists()
  }, [fetchPlaylists])

  const onRefresh = useCallback(() => {
    fetchPlaylists(true)
  }, [fetchPlaylists])

  useEffect(() => {
    const onBackPress = () => {
      if (selectedPlaylistRef.current) {
        if (commonState.componentIds.length > 1) {
          return false
        }
        setSelectedPlaylist(null)
        return true
      }
      return false
    }

    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress)
    return () => subscription.remove()
  }, [])

  const handleItemPress = useCallback((info: PlaylistInfo) => {
    const playlistInfo = {
      id: info.id,
      name: info.name,
      author: '',
      img: info.cover,
      play_count: 0,
      desc: info.desc,
      source: 'tx',
      userId: '',
      total: info.songCount,
    }
    setSelectedPlaylist(playlistInfo)
  }, [])

  const handleBack = useCallback(() => {
    setSelectedPlaylist(null)
  }, [])

  const handleMenuPress = useCallback((item: PlaylistInfo, position: Position) => {
    selectedItemRef.current = item
    setMenuVisible(true)
    requestAnimationFrame(() => {
      menuRef.current?.show(position)
    })
  }, [])

  const handleMenuAction = useCallback(({ action }: { action: string }) => {
    setMenuVisible(false)
    const item = selectedItemRef.current
    if (!item) return

    switch (action) {
      case 'create':
        setNewPlaylistName('')
        setCreateModalVisible(true)
        requestAnimationFrame(() => {
          createModalRef.current?.setVisible(true)
        })
        break
      case 'delete':
        confirmDialog({
          message: `确定要删除歌单"${item.name}"吗？`,
          confirmButtonText: '删除',
        }).then(async (confirmed) => {
          if (!confirmed) return
          if (!item.dirid) {
            toast('无法获取歌单信息')
            return
          }
          try {
            await txUserApi.deletePlaylist(item.dirid)
            toast('删除成功')
            await fetchPlaylists(true)
          } catch (err: any) {
            toast(`删除失败: ${err.message}`)
          }
        })
        break
    }
  }, [fetchPlaylists])

  const handleCreatePlaylist = useCallback(async () => {
    const name = newPlaylistName.trim()
    if (!name) {
      toast('歌单名不能为空')
      return
    }

    try {
      await txUserApi.createPlaylist(name)
      toast('创建成功')
      setNewPlaylistName('')
      createModalRef.current?.setVisible(false)
      await fetchPlaylists(true)
    } catch (err: any) {
      toast(`创建失败: ${err.message}`)
    }
  }, [newPlaylistName, fetchPlaylists])

  const renderTab = useCallback((tab: TabType, label: string) => {
    const isActive = activeTab === tab
    return (
      <TouchableOpacity
        key={tab}
        style={styles.tabItem}
        onPress={() => setActiveTab(tab)}
      >
        <Text
          style={[styles.tabText, { borderBottomColor: isActive ? theme['c-primary-font-active'] : 'transparent' }]}
          color={isActive ? theme['c-primary-font'] : theme['c-font']}
        >
          {label}
        </Text>
      </TouchableOpacity>
    )
  }, [activeTab, theme])

  return (
    <View style={{ flex: 1 }}>
      <View
        style={[{ flex: 1, overflow: 'hidden' }, selectedPlaylist ? { opacity: 0 } : null]}
        pointerEvents={selectedPlaylist ? 'none' : 'auto'}
      >
        <View style={[styles.tabBar, { borderBottomColor: theme['c-border-background'] }]}>
          {renderTab('created', `自建歌单 (${createdPlaylists.length})`)}
          {renderTab('collected', `收藏歌单 (${collectedPlaylists.length})`)}
        </View>

        <FlatList
          onScrollBeginDrag={Keyboard.dismiss}
          data={playlists}
          renderItem={({ item }) => (
            <ListItem item={item} onPress={handleItemPress} onMenuPress={handleMenuPress} />
          )}
          keyExtractor={item => `${item.id}-${item.isCollected ? 'collected' : 'created'}`}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingRight: 0 }}
          refreshControl={
            <RefreshControl
              colors={[theme['c-primary']]}
              refreshing={refreshing}
              onRefresh={onRefresh}
            />
          }
          ListEmptyComponent={
            loading ? null : (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>
                  {playlists.length === 0 ? t('list_empty') : ''}
                </Text>
              </View>
            )
          }
        />
      </View>
      {selectedPlaylist && (
        <View style={[StyleSheet.absoluteFill]}>
          <SonglistDetail info={selectedPlaylist} onBack={handleBack} />
        </View>
      )}
      {menuVisible && (
        <Menu
          ref={menuRef}
          menus={[{ action: 'create', label: '新建歌单' }, { action: 'delete', label: '删除歌单' }]}
          onPress={handleMenuAction}
          onHide={() => setMenuVisible(false)}
        />
      )}
      {createModalVisible && (
        <ConfirmAlert
          ref={createModalRef}
          onConfirm={handleCreatePlaylist}
          onHide={() => setCreateModalVisible(false)}
          title="新建歌单"
        >
          <Input
            value={newPlaylistName}
            onChangeText={setNewPlaylistName}
            placeholder="请输入歌单名称"
            style={{ backgroundColor: theme['c-primary-input-background'] }}
          />
        </ConfirmAlert>
      )}
    </View>
  )
})

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 3,
    alignItems: 'center',
  },
  tabText: {
    paddingBottom: 3,
    borderBottomWidth: 2,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 14,
    opacity: 0.7,
  },
})
