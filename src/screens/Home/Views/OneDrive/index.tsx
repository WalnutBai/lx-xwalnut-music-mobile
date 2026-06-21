import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  FlatList,
  Keyboard,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  type ListRenderItem,
} from 'react-native'
import Text from '@/components/common/Text'
import Button from '@/components/common/Button'
import Image from '@/components/common/Image'
import { Icon } from '@/components/common/Icon'
import { useTheme } from '@/store/theme/hook'
import { confirmDialog, createStyle, openUrl, toast } from '@/utils/tools'
import { LIST_IDS, LIST_ITEM_HEIGHT } from '@/config/constant'
import { scaleSizeH } from '@/utils/pixelRatio'
import { overwriteListMusics } from '@/core/list'
import { playList } from '@/core/player/player'
import { usePlayMusicInfo } from '@/store/player/hook'
import playerState from '@/store/player/state'
import {
  clearOneDriveAuth,
  createOneDriveDeviceCode,
  getOneDriveAuth,
  pollOneDriveDeviceCode,
} from '@/core/oneDrive/auth'
import {
  getOneDriveConfig,
  listOneDriveFolders,
  saveOneDriveSelectedFolder,
  scanOneDriveSongs,
} from '@/core/oneDrive/drive'

type ActiveTab = 'config' | 'list'
const ITEM_HEIGHT = scaleSizeH(LIST_ITEM_HEIGHT)

const formatTime = (time?: number) => {
  if (!time) return ''
  return new Date(time).toLocaleString()
}

const formatBriefTime = (time?: number) => {
  if (!time) return ''
  const date = new Date(time)
  const pad = (num: number) => String(num).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const formatSize = (size?: number) => {
  if (!size) return ''
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  if (size < 1024 * 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`
  return `${(size / 1024 / 1024 / 1024).toFixed(1)} GB`
}

const getFolderName = (folder?: LX.OneDrive.DriveFolder | null) => folder?.path || 'OneDrive 根目录'

const SongItem = memo(
  ({
    item,
    index,
    isPlaying,
    onPress,
  }: {
    item: LX.OneDrive.MusicInfo
    index: number
    isPlaying: boolean
    onPress: (musicInfo: LX.OneDrive.MusicInfo) => void
  }) => {
    const theme = useTheme()
    const subText = item.singer || item.meta.filePath
    const sizeText = formatSize(item.meta.size)
    const timeText = formatBriefTime(item.meta.lastModifiedTime)
    const detailText = [sizeText, timeText].filter(Boolean).join(' · ')

    return (
      <View
        style={{
          ...styles.songItem,
          backgroundColor: isPlaying ? theme['c-primary-background-hover'] : 'transparent',
        }}
      >
        <TouchableOpacity style={styles.songItemLeft} onPress={() => onPress(item)}>
          <View style={styles.sn}>
            <Image url={item.meta.picUrl} style={styles.albumArt} cache={false} />
          </View>
          <View style={styles.itemInfo}>
            <Text color={isPlaying ? theme['c-primary-font'] : theme['c-font']} numberOfLines={1}>
              {item.name || item.meta.fileName}
            </Text>
            <View style={styles.listItemSingle}>
              <Text
                style={styles.listItemSingleText}
                size={11}
                color={isPlaying ? theme['c-primary-alpha-200'] : theme['c-500']}
                numberOfLines={1}
              >
                {subText}
              </Text>
            </View>
            {detailText ? (
              <Text size={10} color={isPlaying ? theme['c-primary-alpha-200'] : theme['c-500']} numberOfLines={1}>
                {detailText}
              </Text>
            ) : null}
          </View>
        </TouchableOpacity>
      </View>
    )
  }
)

export default memo(() => {
  const theme = useTheme()
  const playMusicInfo = usePlayMusicInfo()
  const [activeTab, setActiveTab] = useState<ActiveTab>('config')
  const [clientId, setClientId] = useState('')
  const [authInfo, setAuthInfo] = useState<LX.OneDrive.AuthInfo | null>(null)
  const [deviceInfo, setDeviceInfo] = useState<LX.OneDrive.DeviceCodeInfo | null>(null)
  const [statusText, setStatusText] = useState('')
  const [loading, setLoading] = useState(false)
  const [folderStack, setFolderStack] = useState<LX.OneDrive.DriveFolder[]>([])
  const [folders, setFolders] = useState<LX.OneDrive.DriveFolder[]>([])
  const [selectedFolder, setSelectedFolder] = useState<LX.OneDrive.DriveFolder | null>(null)
  const [songs, setSongs] = useState<LX.OneDrive.MusicInfo[]>([])
  const [scannedAt, setScannedAt] = useState<number | undefined>()
  const [folderLoading, setFolderLoading] = useState(false)
  const [scanText, setScanText] = useState('')
  const [searchVisible, setSearchVisible] = useState(false)
  const [searchText, setSearchText] = useState('')
  const listRef = useRef<FlatList<LX.OneDrive.MusicInfo>>(null)
  const searchInputRef = useRef<TextInput>(null)
  const pendingJumpIdRef = useRef<string | null>(null)

  const currentFolder = folderStack.at(-1) ?? null

  const accountName =
    authInfo?.account?.displayName ||
    authInfo?.account?.mail ||
    authInfo?.account?.userPrincipalName ||
    ''

  const filteredSongs = useMemo(() => {
    const text = searchText.trim().toLowerCase()
    if (!text) return songs
    return songs.filter((item) => {
      return [
        item.name,
        item.singer,
        item.meta.fileName,
        item.meta.filePath,
      ].some(value => (value ?? '').toLowerCase().includes(text))
    })
  }, [searchText, songs])

  const loadConfig = useCallback(() => {
    void Promise.all([getOneDriveAuth(), getOneDriveConfig()]).then(([auth, config]) => {
      setAuthInfo(auth)
      setClientId(auth?.clientId ?? '')
      setSelectedFolder(config.selectedFolder ?? null)
      setSongs(config.songs ?? [])
      setScannedAt(config.scannedAt)
    })
  }, [])

  const loadFolders = useCallback((folder: LX.OneDrive.DriveFolder | null) => {
    setFolderLoading(true)
    void listOneDriveFolders(folder)
      .then(setFolders)
      .catch((err: any) => {
        const message = err.message ?? String(err)
        toast(message, 'long')
      })
      .finally(() => {
        setFolderLoading(false)
      })
  }, [])

  useEffect(() => {
    loadConfig()
  }, [loadConfig])

  useEffect(() => {
    if (!authInfo) return
    loadFolders(currentFolder)
  }, [authInfo, currentFolder, loadFolders])

  const handleDeviceLogin = useCallback(() => {
    Keyboard.dismiss()
    setLoading(true)
    setStatusText('正在生成设备码...')
    void createOneDriveDeviceCode(clientId)
      .then(async (info) => {
        setDeviceInfo(info)
        setStatusText('请在浏览器完成授权，App 会自动等待登录结果。')
        await openUrl(info.verificationUriComplete ?? info.verificationUri)
        return pollOneDriveDeviceCode(info)
      })
      .then((info) => {
        setAuthInfo(info)
        setDeviceInfo(null)
        setStatusText('')
        toast('OneDrive 登录成功')
      })
      .catch((err: any) => {
        const message = err.message ?? String(err)
        setStatusText(message)
        toast(message, 'long')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [clientId])

  const handleLogout = useCallback(() => {
    setLoading(true)
    void clearOneDriveAuth()
      .then(() => {
        setAuthInfo(null)
        setDeviceInfo(null)
        setStatusText('')
        setFolders([])
        setFolderStack([])
        toast('OneDrive 登录信息已清除')
      })
      .catch((err: any) => {
        toast(err.message ?? String(err), 'long')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  const handleSelectCurrentFolder = useCallback(() => {
    setLoading(true)
    void saveOneDriveSelectedFolder(currentFolder)
      .then((config) => {
        setSelectedFolder(config.selectedFolder ?? null)
        toast(`已选择：${getFolderName(config.selectedFolder)}`)
      })
      .catch((err: any) => {
        toast(err.message ?? String(err), 'long')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [currentFolder])

  const handleScan = useCallback(() => {
    if (!authInfo) {
      toast('请先登录 OneDrive，Cookie可能已失效')
      setActiveTab('config')
      return
    }
    const runScan = () => {
      setLoading(true)
      setScanText('开始扫描...')
      void scanOneDriveSongs(selectedFolder, (count, path) => {
        setScanText(`已找到 ${count} 首，正在扫描：${path}`)
      })
        .then((config) => {
          setSongs(config.songs)
          setScannedAt(config.scannedAt)
          setScanText('')
          setActiveTab('list')
          toast(`扫描完成：${config.songs.length} 首`)
        })
        .catch((err: any) => {
          const message = err.message ?? String(err)
          setScanText(message)
          toast(message, 'long')
        })
        .finally(() => {
          setLoading(false)
        })
    }
    if (!selectedFolder) {
      void confirmDialog({
        title: '扫描 OneDrive 根目录',
        message:
          '根目录扫描会递归读取所有子目录。文件夹很多时会产生大量 OneDrive 请求，可能较慢，也可能触发微软限流。建议优先选择音乐目录。确定继续扫描根目录？',
        confirmButtonText: '继续扫描',
      }).then((confirmed) => {
        if (confirmed) runScan()
      })
      return
    }
    runScan()
  }, [authInfo, selectedFolder])

  const handlePlay = useCallback(
    (musicInfo: LX.OneDrive.MusicInfo) => {
      const index = songs.findIndex(item => item.id === musicInfo.id)
      if (index < 0) return
      void overwriteListMusics(LIST_IDS.TEMP, songs).then(() => {
        void playList(LIST_IDS.TEMP, index)
      })
    },
    [songs]
  )

  const scrollToMusic = useCallback((musicId: string) => {
    let list = filteredSongs
    let index = list.findIndex(item => item.id === musicId)
    if (index < 0 && searchText) {
      setSearchText('')
      list = songs
      index = list.findIndex(item => item.id === musicId)
    }
    if (index < 0) return
    setActiveTab('list')
    requestAnimationFrame(() => {
      setTimeout(() => {
        listRef.current?.scrollToIndex({
          index,
          viewPosition: 0.3,
          animated: true,
        })
      }, searchText ? 160 : 80)
    })
  }, [filteredSongs, searchText, songs])

  useEffect(() => {
    const handleJumpPosition = () => {
      const rawMusicInfo = playerState.playMusicInfo.musicInfo
      const musicInfo = rawMusicInfo && 'progress' in rawMusicInfo ? rawMusicInfo.metadata.musicInfo : rawMusicInfo
      if (!musicInfo) return
      pendingJumpIdRef.current = musicInfo.id
      scrollToMusic(musicInfo.id)
    }
    global.app_event.on('jumpOneDrivePosition', handleJumpPosition)
    return () => {
      global.app_event.off('jumpOneDrivePosition', handleJumpPosition)
    }
  }, [scrollToMusic])

  useEffect(() => {
    if (activeTab !== 'list' || !pendingJumpIdRef.current) return
    const musicId = pendingJumpIdRef.current
    pendingJumpIdRef.current = null
    scrollToMusic(musicId)
  }, [activeTab, scrollToMusic])

  const renderSong: ListRenderItem<LX.OneDrive.MusicInfo> = useCallback(
    ({ item, index }) => (
      <SongItem
        item={item}
        index={index}
        isPlaying={playMusicInfo.musicInfo?.id === item.id}
        onPress={handlePlay}
      />
    ),
    [handlePlay, playMusicInfo.musicInfo?.id]
  )

  const headerText = useMemo(() => {
    if (searchText.trim()) return `${filteredSongs.length}/${songs.length} 首`
    return `${songs.length} 首${scannedAt ? ` · ${formatTime(scannedAt)}` : ''}`
  }, [filteredSongs.length, scannedAt, searchText, songs.length])

  const handleToggleSearch = useCallback(() => {
    setSearchVisible((visible) => {
      const nextVisible = !visible
      if (nextVisible) {
        requestAnimationFrame(() => {
          searchInputRef.current?.focus()
        })
      } else {
        setSearchText('')
        Keyboard.dismiss()
      }
      return nextVisible
    })
  }, [])

  const handleClearSearch = useCallback(() => {
    if (searchText) {
      setSearchText('')
      searchInputRef.current?.focus()
      return
    }
    setSearchVisible(false)
    Keyboard.dismiss()
  }, [searchText])

  const renderConfig = () => (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      onScrollBeginDrag={Keyboard.dismiss}
      style={styles.scroll}
      contentContainerStyle={styles.content}
    >
      <View style={{ ...styles.panel, borderColor: theme['c-border-background'] }}>
        <Text style={styles.label}>登录状态</Text>
        <Text color={authInfo ? theme['c-primary-font'] : theme['c-font-label']}>
          {authInfo ? `已登录${accountName ? `：${accountName}` : ''}` : '未登录'}
        </Text>
        {authInfo ? (
          <Text style={styles.meta} color={theme['c-font-label']}>
            Access Token 过期时间：{formatTime(authInfo.expiresAt)}
          </Text>
        ) : null}
      </View>

      <View style={{ ...styles.panel, borderColor: theme['c-border-background'] }}>
        <Text style={styles.label}>Microsoft 应用 Client ID</Text>
        <TextInput
          value={clientId}
          editable={!loading}
          placeholder="client_id"
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={setClientId}
          placeholderTextColor={theme['c-font-label']}
          selectionColor={theme['c-primary-light-100-alpha-300']}
          style={{
            ...styles.input,
            borderColor: theme['c-border-background'],
            color: theme['c-font'],
          }}
        />
        <Text style={styles.tip} color={theme['c-font-label']}>
          权限：Files.Read、User.Read、offline_access。
        </Text>
        <View style={styles.buttonRow}>
          <Button
            style={{ ...styles.button, backgroundColor: theme['c-button-background'] }}
            disabled={loading || !clientId.trim()}
            onPress={handleDeviceLogin}
          >
            <Text color={theme['c-button-font']}>设备码登录</Text>
          </Button>
          <Button
            style={{ ...styles.button, backgroundColor: theme['c-button-background'] }}
            disabled={loading || !authInfo}
            onPress={handleLogout}
          >
            <Text color={theme['c-button-font']}>退出登录</Text>
          </Button>
        </View>
      </View>

      <View style={{ ...styles.panel, borderColor: theme['c-border-background'] }}>
        <Text style={styles.label}>配置方法</Text>
        <Text style={styles.tip} color={theme['c-font-label']}>
          1. 打开 Azure Portal，进入“应用注册”，新建应用。
        </Text>
        <Text style={styles.tip} color={theme['c-font-label']}>
          2. 账户类型选择“任何 Entra ID 租户 + 个人 Microsoft 帐户”。
        </Text>
        <Text style={styles.tip} color={theme['c-font-label']}>
          3. 在“身份验证”里添加“移动和桌面应用程序”，重定向 URI 选择 https://login.microsoftonline.com/common/oauth2/nativeclient。
        </Text>
        <Text style={styles.tip} color={theme['c-font-label']}>
          4. 在高级设置里开启“允许公共客户端流”，保存后复制“应用程序(客户端) ID”填到上面。
        </Text>
        <Text style={styles.tip} color={theme['c-font-label']}>
          5. 点击设备码登录，浏览器授权完成后回来选择音乐目录并扫描。
        </Text>
      </View>

      <View style={{ ...styles.panel, borderColor: theme['c-border-background'] }}>
        <Text style={styles.label}>设备码</Text>
        {deviceInfo ? (
          <>
            <Text selectable size={22} color={theme['c-primary-font']} style={styles.codeText}>
              {deviceInfo.userCode}
            </Text>
            <Text selectable style={styles.tip} color={theme['c-font-label']}>
              {deviceInfo.message ?? `打开 ${deviceInfo.verificationUri} 输入上面的代码。`}
            </Text>
          </>
        ) : (
          <Text style={styles.tip} color={theme['c-font-label']}>
            点击“设备码登录”后，会打开微软登录页；按页面提示输入这里显示的代码。
          </Text>
        )}
        {statusText ? (
          <Text style={styles.meta} color={theme['c-font-label']}>
            {statusText}
          </Text>
        ) : null}
      </View>

      <View style={{ ...styles.panel, borderColor: theme['c-border-background'] }}>
        <Text style={styles.label}>目录</Text>
        <Text color={theme['c-font-label']} style={styles.meta}>
          当前：{getFolderName(currentFolder)}
        </Text>
        <Text color={theme['c-font-label']} style={styles.meta}>
          已选：{getFolderName(selectedFolder)}
        </Text>
        <View style={styles.buttonRow}>
          <Button
            style={{ ...styles.button, backgroundColor: theme['c-button-background'] }}
            disabled={!authInfo || folderLoading || !folderStack.length}
            onPress={() => setFolderStack(prev => prev.slice(0, -1))}
          >
            <Text color={theme['c-button-font']}>返回上级</Text>
          </Button>
          <Button
            style={{ ...styles.button, backgroundColor: theme['c-button-background'] }}
            disabled={!authInfo || loading}
            onPress={handleSelectCurrentFolder}
          >
            <Text color={theme['c-button-font']}>选择当前目录</Text>
          </Button>
          <Button
            style={{ ...styles.button, backgroundColor: theme['c-button-background'] }}
            disabled={!authInfo || loading}
            onPress={handleScan}
          >
            <Text color={theme['c-button-font']}>扫描已选目录</Text>
          </Button>
        </View>

        {folderLoading ? (
          <Text style={styles.tip} color={theme['c-font-label']}>
            正在读取目录...
          </Text>
        ) : folders.length ? (
          folders.map(folder => (
            <TouchableOpacity
              key={folder.id}
              style={{ ...styles.folderItem, borderBottomColor: theme['c-border-background'] }}
              onPress={() => setFolderStack(prev => [...prev, folder])}
            >
              <Text numberOfLines={1}>{folder.name}</Text>
              <Text size={11} color={theme['c-font-label']} numberOfLines={1}>
                {folder.path}
              </Text>
            </TouchableOpacity>
          ))
        ) : (
          <Text style={styles.tip} color={theme['c-font-label']}>
            {authInfo ? '当前目录没有子目录。' : '登录后可以浏览 OneDrive 目录。'}
          </Text>
        )}
      </View>
    </ScrollView>
  )

  const renderList = () => (
    <View style={styles.listPage}>
      <View style={{ ...styles.listHeader, borderBottomColor: theme['c-border-background'] }}>
        <View style={styles.listHeaderText}>
          {searchVisible ? (
            <TextInput
              ref={searchInputRef}
              value={searchText}
              placeholder="搜索歌曲或歌手"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              onChangeText={setSearchText}
              placeholderTextColor={theme['c-font-label']}
              selectionColor={theme['c-primary-light-100-alpha-300']}
              style={{
                ...styles.searchInput,
                color: theme['c-font'],
                borderColor: theme['c-border-background'],
              }}
            />
          ) : (
            <>
              <Text numberOfLines={1}>已选：{getFolderName(selectedFolder)}</Text>
              <Text size={11} color={theme['c-font-label']} numberOfLines={1}>
                {scanText || headerText}
              </Text>
            </>
          )}
        </View>
        <TouchableOpacity style={styles.headerIconButton} onPress={handleToggleSearch}>
          <Icon name="search-2" size={16} color={searchVisible ? theme['c-primary-font'] : theme['c-font-label']} />
        </TouchableOpacity>
        {searchVisible ? (
          <TouchableOpacity style={styles.headerIconButton} onPress={handleClearSearch}>
            <Icon name="close" size={13} color={theme['c-font-label']} />
          </TouchableOpacity>
        ) : null}
        <Button
          style={{ ...styles.scanButton, backgroundColor: theme['c-button-background'] }}
          disabled={!authInfo || loading}
          onPress={handleScan}
        >
          <Text color={theme['c-button-font']}>扫描</Text>
        </Button>
      </View>
      <FlatList
        ref={listRef}
        data={filteredSongs}
        renderItem={renderSong}
        keyExtractor={item => item.id}
        getItemLayout={(data, index) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index })}
        onScrollToIndexFailed={(info) => {
          listRef.current?.scrollToOffset({
            offset: Math.max(0, info.averageItemLength * info.index),
            animated: true,
          })
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text color={theme['c-font-label']}>{searchText.trim() ? '没有匹配的歌曲' : '还没有扫描到歌曲'}</Text>
          </View>
        }
      />
    </View>
  )

  return (
    <View style={styles.container}>
      <View style={{ ...styles.tabs, borderBottomColor: theme['c-border-background'] }}>
        <TouchableOpacity
          style={styles.tab}
          onPress={() => setActiveTab('config')}
        >
          <Text
            style={{
              ...styles.tabText,
              borderBottomColor:
                activeTab === 'config' ? theme['c-primary-font-active'] : 'transparent',
            }}
            color={activeTab === 'config' ? theme['c-primary-font'] : theme['c-font']}
          >
            配置
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.tab}
          onPress={() => setActiveTab('list')}
        >
          <Text
            style={{
              ...styles.tabText,
              borderBottomColor:
                activeTab === 'list' ? theme['c-primary-font-active'] : 'transparent',
            }}
            color={activeTab === 'list' ? theme['c-primary-font'] : theme['c-font']}
          >
            列表
          </Text>
        </TouchableOpacity>
      </View>
      {activeTab === 'config' ? renderConfig() : renderList()}
    </View>
  )
})

const styles = createStyle({
  container: {
    flex: 1,
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
  },
  tab: {
    paddingRight: 18,
  },
  tabText: {
    paddingTop: 10,
    paddingBottom: 8,
    borderBottomWidth: 2,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 12,
  },
  panel: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 4,
    padding: 10,
    marginBottom: 10,
  },
  label: {
    marginBottom: 6,
  },
  meta: {
    marginTop: 5,
  },
  tip: {
    marginTop: 6,
    lineHeight: 18,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 4,
    height: 38,
    paddingHorizontal: 6,
    paddingVertical: 0,
    marginTop: 6,
    fontSize: 13,
  },
  codeText: {
    marginTop: 8,
    marginBottom: 4,
    letterSpacing: 1,
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
  },
  button: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
    marginRight: 10,
    marginBottom: 8,
  },
  folderItem: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 9,
  },
  listPage: {
    flex: 1,
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  listHeaderText: {
    flex: 1,
    paddingRight: 8,
  },
  searchInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 4,
    height: 34,
    paddingHorizontal: 8,
    paddingVertical: 0,
    fontSize: 13,
  },
  headerIconButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  songItem: {
    height: ITEM_HEIGHT,
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'center',
    paddingRight: 2,
  },
  songItemLeft: {
    flex: 1,
    flexGrow: 1,
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sn: {
    width: 70,
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 5,
    paddingRight: 5,
  },
  albumArt: {
    width: 52,
    height: 52,
    borderRadius: 4,
  },
  itemInfo: {
    flexGrow: 1,
    flexShrink: 1,
    paddingRight: 2,
  },
  listItemSingle: {
    paddingTop: 3,
    flexDirection: 'row',
  },
  listItemSingleText: {
    flexGrow: 0,
    flexShrink: 1,
    fontWeight: '300',
  },
  empty: {
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
