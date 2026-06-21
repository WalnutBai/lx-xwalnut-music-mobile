/**
 * 酷狗音乐歌单页面 - 显示用户自建歌单和收藏歌单（复刻QQ音乐歌单页面）
 */

import { memo, useEffect, useState, useCallback, useRef } from 'react'
import { View, FlatList, RefreshControl, BackHandler, StyleSheet, Keyboard, TouchableOpacity } from 'react-native'
import ListItem from './ListItem'
import { getUserPlaylists, subscribePlaylist, unsubscribePlaylist } from '@/utils/kugouApi'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import Text from '@/components/common/Text'
import { toast, confirmDialog } from '@/utils/tools'
import SonglistDetail from '../../../SonglistDetail'
import commonState from '@/store/common/state'
import { useSettingValue } from '@/store/setting/hook'
import Menu, { type MenuType, type Position } from '@/components/common/Menu'
import ConfirmAlert, { type ConfirmAlertType } from '@/components/common/ConfirmAlert'
import Input from '@/components/common/Input'

interface PlaylistInfo {
  id: string
  listid?: number
  name: string
  cover: string
  songCount: number
  desc: string
  isFavorites?: boolean
  isCollected?: boolean
}

type TabType = 'created' | 'collected'

export default memo(() => {
  const t = useI18n()
  const theme = useTheme()
  const kgCookie = useSettingValue('common.kg_cookie')
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

  const fetchPlaylists = useCallback(async (isRefresh = false) => {
    if (!kgCookie) {
      setCreatedPlaylists([])
      setCollectedPlaylists([])
      setLoading(false)
      return
    }
    try {
      if (isRefresh) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }
      const result = await getUserPlaylists(kgCookie)
      if (result.success && result.data) {
        setCreatedPlaylists(result.data.createdList || [])
        setCollectedPlaylists(result.data.collectedList || [])
      } else if (!isRefresh) {
        toast(`获取歌单失败: ${result.message}`)
      }
    } catch (err: any) {
      console.error('获取酷狗歌单失败:', err)
      if (!isRefresh) {
        toast(`获取歌单失败: ${err.message}`)
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [kgCookie])

  useEffect(() => {
    fetchPlaylists()
  }, [fetchPlaylists])

  // 监听歌单更新事件，刷新歌单列表（封面等）
  useEffect(() => {
    const handlePlaylistUpdate = ({ source, listId, newCover }: { source: string, listId?: string, newCover?: string }) => {
      if (source === 'kg') {
        console.log('[KgPlaylist] 收到歌单更新事件')
        // 如果有新封面，立即更新对应歌单的封面
        if (newCover && listId) {
          setCreatedPlaylists(prev => prev.map(p =>
            p.id === listId ? { ...p, cover: newCover } : p
          ))
        }
        // 刷新歌单列表获取最新数据
        fetchPlaylists(true)
      }
    }
    global.app_event.on('playlist_updated', handlePlaylistUpdate)
    return () => {
      global.app_event.off('playlist_updated', handlePlaylistUpdate)
    }
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
      listid: info.listid,
      name: info.name,
      author: '',
      img: info.cover,
      play_count: 0,
      desc: info.desc,
      source: 'kg',
      userId: '',
      total: info.songCount,
      isFavorites: info.isFavorites,
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
          if (!kgCookie) {
            toast('请先登录酷狗音乐，Cookie可能已失效')
            return
          }
          if (!item.listid) {
            toast('无法获取歌单信息')
            return
          }
          try {
            const result = await unsubscribePlaylist(kgCookie, item.listid)
            if (result.success) {
              toast('删除成功')
              await fetchPlaylists(true)
            } else {
              toast(`删除失败: ${result.message}`)
            }
          } catch (err: any) {
            toast(`删除失败: ${err.message}`)
          }
        })
        break
    }
  }, [fetchPlaylists, kgCookie])

  const handleCreatePlaylist = useCallback(async () => {
    const name = newPlaylistName.trim()
    if (!name) {
      toast('歌单名不能为空')
      return
    }
    if (!kgCookie) {
      toast('请先登录酷狗音乐，Cookie可能已失效')
      return
    }

    try {
      const result = await subscribePlaylist(kgCookie, {
        name,
        list_create_userid: 0,
        list_create_listid: 0,
        type: 0,
      })
      if (result.success) {
        toast('创建成功')
        setNewPlaylistName('')
        createModalRef.current?.setVisible(false)
        await fetchPlaylists(true)
      } else {
        toast(`创建失败: ${result.message}`)
      }
    } catch (err: any) {
      toast(`创建失败: ${err.message}`)
    }
  }, [newPlaylistName, fetchPlaylists, kgCookie])

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
                  {!kgCookie ? t('setting_basic_kg_cookie_placeholder') : playlists.length === 0 ? t('list_empty') : ''}
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
