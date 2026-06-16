import { memo, useCallback, useMemo, useState, useEffect, useRef } from 'react'
import { View, TouchableOpacity, FlatList, ActivityIndicator, RefreshControl, Animated, PanResponder, BackHandler, type GestureResponderEvent, type PanResponderGestureState } from 'react-native'
import { useMyList, useActiveListId, useListFetching } from '@/store/list/hook'
import { setActiveList, updateUserListPosition } from '@/core/list'
import { getListMusics, getListPrevSelectId } from '@/utils/data'
import { useTheme } from '@/store/theme/hook'
import Text from '@/components/common/Text'
import Image from '@/components/common/Image'
import { Icon } from '@/components/common/Icon'
import { createStyle } from '@/utils/tools'
import commonState from '@/store/common/state'
import MusicList from './MusicList'
import ListMenu, { type ListMenuType, type Position } from './MyList/ListMenu'
import ListNameEdit, { type ListNameEditType } from './MyList/ListNameEdit'
import ListMusicSort, { type ListMusicSortType } from './MyList/ListMusicSort'
import DuplicateMusic, { type DuplicateMusicType } from './MyList/DuplicateMusic'
import ListImportExport, { type ListImportExportType } from './MyList/ListImportExport'
import { handleRemove, handleSync } from './MyList/listAction'
import { LIST_IDS } from '@/config/constant'
import { scaleSizeH } from '@/utils/pixelRatio'
import Loading from '@/components/common/Loading'

const CARD_HEIGHT = 90
const LONG_PRESS_MS = 350
const DRAG_CANCEL_THRESHOLD = 6

interface ListItemInfo {
  id: string
  name: string
  cover: string
  total: number
  isFixed: boolean
}

interface DragAnim {
  translateY: Animated.Value
  scale: Animated.Value
  opacity: Animated.Value
}

const createAnim = (): DragAnim => ({
  translateY: new Animated.Value(0),
  scale: new Animated.Value(1),
  opacity: new Animated.Value(1),
})

type MenuPosition = { x: number; y: number; w: number; h: number }

// 固定列表卡片组件
const FixedPlaylistCard = memo(({
  item,
  onPress,
  onShowMenu,
}: {
  item: ListItemInfo
  onPress: () => void
  onShowMenu: (item: ListItemInfo, position: MenuPosition) => void
}) => {
  const theme = useTheme()
  const fetching = useListFetching(item.id)
  const moreButtonRef = useRef<TouchableOpacity>(null)

  const handleShowMenu = () => {
    if (moreButtonRef.current?.measure) {
      moreButtonRef.current.measure((fx, fy, width, height, px, py) => {
        onShowMenu(item, {
          x: Math.ceil(px),
          y: Math.ceil(py),
          w: Math.ceil(width),
          h: Math.ceil(height),
        })
      })
    }
  }

  return (
    <Animated.View style={[styles.cardContainer, { height: CARD_HEIGHT }]}>
      <TouchableOpacity onPress={onPress} style={styles.cardContent}>
        <Image url={item.cover} style={styles.artwork} />
        <View style={styles.info}>
          <Text size={16} numberOfLines={2} color={theme['c-font']}>{item.name}</Text>
          {item.total > 0 ? (
            <Text size={12} color={theme['c-font-label']}>{item.total} 首</Text>
          ) : null}
        </View>
        {fetching ? (
          <Loading color={theme['c-font']} style={styles.loading} />
        ) : null}
      </TouchableOpacity>
      <TouchableOpacity onPress={handleShowMenu} ref={moreButtonRef} style={styles.moreBtn}>
        <Icon name="dots-vertical" color={theme['c-350']} size={12} />
      </TouchableOpacity>
    </Animated.View>
  )
})

const PlaylistCard = memo(({
  item,
  userListIndex,
  onPress,
  onShowMenu,
  isDragging,
  isDragSource,
  translateY,
  scale,
  opacity,
  zIndex,
  onLayoutHeight,
  onLongPressStart,
  onDragMove,
  onDragRelease,
  onDragCancel,
  onTouchStart,
  onTouchEnd,
}: {
  item: ListItemInfo
  userListIndex: number
  onPress: () => void
  onShowMenu: (item: ListItemInfo, index: number, position: MenuPosition) => void
  isDragging: boolean
  isDragSource: boolean
  translateY: Animated.Value
  scale: Animated.Value
  opacity: Animated.Value
  zIndex: number
  onLayoutHeight: (index: number, height: number) => void
  onLongPressStart: (index: number) => void
  onDragMove: (dy: number) => void
  onDragRelease: () => void
  onDragCancel: () => void
  onTouchStart: () => void
  onTouchEnd: () => void
}) => {
  const theme = useTheme()
  const fetching = useListFetching(item.id)
  const moreButtonRef = useRef<TouchableOpacity>(null)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isActivatedRef = useRef(false)

  const clearLongPressTimer = () => {
    if (longPressTimer.current != null) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  useEffect(() => {
    return () => {
      clearLongPressTimer()
    }
  }, [])

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponder: (_e: GestureResponderEvent, gs: PanResponderGestureState) => {
          if (!isActivatedRef.current) return false
          return Math.abs(gs.dy) > 1 || Math.abs(gs.dx) > 1
        },
        onMoveShouldSetPanResponderCapture: (
          _e: GestureResponderEvent,
          gs: PanResponderGestureState
        ) => {
          if (!isActivatedRef.current) return false
          return Math.abs(gs.dy) > 2
        },
        onPanResponderGrant: () => {
          onTouchStart()
          clearLongPressTimer()
          isActivatedRef.current = false
          longPressTimer.current = setTimeout(() => {
            longPressTimer.current = null
            isActivatedRef.current = true
            onLongPressStart(userListIndex)
          }, LONG_PRESS_MS)
        },
        onPanResponderMove: (_e, gs) => {
          if (!isActivatedRef.current) {
            if (
              Math.abs(gs.dy) > DRAG_CANCEL_THRESHOLD ||
              Math.abs(gs.dx) > DRAG_CANCEL_THRESHOLD
            ) {
              clearLongPressTimer()
            }
            return
          }
          onDragMove(gs.dy)
        },
        onPanResponderRelease: () => {
          onTouchEnd()
          clearLongPressTimer()
          if (isActivatedRef.current) {
            isActivatedRef.current = false
            onDragRelease()
          }
        },
        onPanResponderTerminate: () => {
          onTouchEnd()
          clearLongPressTimer()
          if (isActivatedRef.current) {
            isActivatedRef.current = false
            onDragCancel()
          }
        },
        onPanResponderTerminationRequest: () => !isActivatedRef.current,
      }),
    [userListIndex, onLongPressStart, onDragMove, onDragRelease, onDragCancel, onTouchStart, onTouchEnd]
  )

  const handleShowMenu = () => {
    if (moreButtonRef.current?.measure) {
      moreButtonRef.current.measure((fx, fy, width, height, px, py) => {
        onShowMenu(item, userListIndex, {
          x: Math.ceil(px),
          y: Math.ceil(py),
          w: Math.ceil(width),
          h: Math.ceil(height),
        })
      })
    }
  }

  const transform = isDragSource
    ? [{ translateY }, { scale }]
    : [{ translateY }]
  const elevation = isDragSource ? 8 : 0
  const shadowOpacity = isDragSource ? 0.25 : 0
  const backgroundColor = isDragSource
    ? theme['c-primary-background-active']
    : 'transparent'

  return (
    <Animated.View
      onLayout={(e) => onLayoutHeight(userListIndex, e.nativeEvent.layout.height)}
      style={[
        styles.cardContainer,
        {
          height: CARD_HEIGHT,
          backgroundColor,
          opacity,
          transform,
          zIndex,
          elevation,
          shadowOpacity,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowRadius: 4,
        },
      ]}
    >
      <TouchableOpacity onPress={onPress} style={styles.cardContent}>
        <Image
          url={item.cover}
          style={styles.artwork}
        />
        <View style={styles.info}>
          <Text size={16} numberOfLines={2} color={theme['c-font']}>
            {item.name}
          </Text>
          {item.total > 0 ? (
            <Text size={12} color={theme['c-font-label']}>
              {item.total} 首
            </Text>
          ) : null}
        </View>
        {fetching ? (
          <Loading color={theme['c-font']} style={styles.loading} />
        ) : null}
      </TouchableOpacity>
      {!item.isFixed && (
        <View style={styles.dragHandle} {...panResponder.panHandlers}>
          <Icon name="menu" color={theme['c-font-label']} size={14} />
        </View>
      )}
      <TouchableOpacity onPress={handleShowMenu} ref={moreButtonRef} style={styles.moreBtn}>
        <Icon name="dots-vertical" color={theme['c-350']} size={12} />
      </TouchableOpacity>
    </Animated.View>
  )
})

export default memo(() => {
  const theme = useTheme()
  const allList = useMyList()
  const activeListId = useActiveListId()

  const [listInfoMap, setListInfoMap] = useState<Map<string, { cover: string; total: number }>>(new Map())
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [showMusicList, setShowMusicList] = useState(false)
  const [isTouchingDragHandle, setIsTouchingDragHandle] = useState(false)

  // 追踪 showMusicList 的最新状态
  const showMusicListRef = useRef(false)
  useEffect(() => {
    showMusicListRef.current = showMusicList
  }, [showMusicList])

  // 返回卡片列表的处理函数
  const handleBackToList = useCallback(() => {
    setShowMusicList(false)
    setActiveList(LIST_IDS.DEFAULT)
  }, [])

  // 处理物理返回键
  useEffect(() => {
    const onBackPress = () => {
      if (showMusicListRef.current) {
        // 检查是否有其他原生屏幕在 Home 屏幕之上
        if (commonState.componentIds.length > 1) {
          return false
        }
        // 返回卡片列表
        handleBackToList()
        return true
      }
      return false
    }

    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress)
    return () => subscription.remove()
  }, [handleBackToList])

  // 拖动排序相关状态
  const heightsRef = useRef<number[]>([])
  const animsRef = useRef<DragAnim[]>([])
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null)
  const draggingIndexRef = useRef<number | null>(null)
  const targetIndexRef = useRef<number | null>(null)
  const lastTargetRef = useRef<number | null>(null)

  // 菜单相关ref
  const listMenuRef = useRef<ListMenuType>(null)
  const listNameEditRef = useRef<ListNameEditType>(null)
  const listMusicSortRef = useRef<ListMusicSortType>(null)
  const duplicateMusicRef = useRef<DuplicateMusicType>(null)
  const listImportExportRef = useRef<ListImportExportType>(null)

  // 用户列表（排除固定列表）
  const userLists = useMemo(() => allList.filter(l => l.id !== LIST_IDS.DEFAULT && l.id !== LIST_IDS.LOVE), [allList])

  // 初始化动画数组
  if (animsRef.current.length !== userLists.length) {
    if (animsRef.current.length < userLists.length) {
      for (let i = animsRef.current.length; i < userLists.length; i++) {
        animsRef.current.push(createAnim())
      }
    } else {
      animsRef.current.length = userLists.length
    }
    heightsRef.current.length = userLists.length
  }

  const fetchListInfo = useCallback(async (listId: string) => {
    try {
      const musics = await getListMusics(listId)
      const cover = musics.length > 0 ? (musics[0].meta?.picUrl || '') : ''
      return { cover, total: musics.length }
    } catch {
      return { cover: '', total: 0 }
    }
  }, [])

  const refreshListInfo = useCallback(async () => {
    setIsLoading(true)
    setHasError(false)
    try {
      const newMap = new Map<string, { cover: string; total: number }>()
      for (const list of allList) {
        const info = await fetchListInfo(list.id)
        newMap.set(list.id, info)
      }
      setListInfoMap(newMap)
    } catch {
      setHasError(true)
    } finally {
      setIsLoading(false)
    }
  }, [allList, fetchListInfo])

  useEffect(() => {
    void refreshListInfo()
  }, [refreshListInfo])

  // 组件挂载时重置所有动画状态
  useEffect(() => {
    resetAllAnims()
  }, [resetAllAnims])

  // 列表数据变化时重置动画状态
  useEffect(() => {
    // 确保动画引用数组与列表同步
    const userListCount = userLists.length
    while (animsRef.current.length < userListCount) {
      animsRef.current.push(createAnim())
    }
    while (animsRef.current.length > userListCount) {
      animsRef.current.pop()
    }
    resetAllAnims()
  }, [allList, userLists, resetAllAnims])

  // 恢复之前选中的列表
  useEffect(() => {
    // 只有当 activeListId 不是默认列表时，才恢复详细列表
    // 如果 activeListId 是默认列表（LIST_IDS.DEFAULT），说明用户在卡片列表视图，不需要恢复
    if (activeListId && activeListId !== LIST_IDS.DEFAULT) {
      setShowMusicList(true)
    }
  }, [activeListId])

  // 点击进入列表详情
  const handleItemPress = useCallback((item: ListItemInfo) => {
    setActiveList(item.id)
    setShowMusicList(true)
  }, [])

  const listItems = useMemo(() => {
    return allList.map(list => {
      const info = listInfoMap.get(list.id)
      return {
        id: list.id,
        name: list.name,
        cover: info?.cover || '',
        total: info?.total || 0,
        isFixed: list.id === LIST_IDS.DEFAULT || list.id === LIST_IDS.LOVE,
      }
    })
  }, [allList, listInfoMap])

  // 拖动排序相关函数
  const handleLayoutHeight = useCallback((index: number, height: number) => {
    heightsRef.current[index] = height
  }, [])

  const resetAllAnims = useCallback(() => {
    for (const anim of animsRef.current) {
      anim.translateY.stopAnimation()
      anim.scale.stopAnimation()
      anim.opacity.stopAnimation()
      anim.translateY.setValue(0)
      anim.scale.setValue(1)
      anim.opacity.setValue(1)
    }
  }, [])

  const handleLongPressStart = useCallback((index: number) => {
    draggingIndexRef.current = index
    targetIndexRef.current = index
    lastTargetRef.current = index
    setDraggingIndex(index)
    setIsTouchingDragHandle(true)
    const anim = animsRef.current[index]
    if (!anim) return
    Animated.parallel([
      Animated.spring(anim.scale, { toValue: 1.03, useNativeDriver: true, friction: 7 }),
      Animated.timing(anim.opacity, { toValue: 0.92, duration: 120, useNativeDriver: true }),
    ]).start()
  }, [])

  const computeTargetIndex = useCallback((from: number, dy: number) => {
    const heights = heightsRef.current
    const n = heights.length
    if (n === 0) return from

    const cumulative: number[] = []
    let acc = 0
    for (let i = 0; i < n; i++) {
      cumulative.push(acc)
      acc += heights[i] ?? 0
    }
    const draggedHeight = heights[from] ?? 0
    const originalTop = cumulative[from] ?? 0
    const newCenter = originalTop + dy + draggedHeight / 2

    let target = from
    let minDist = Infinity
    for (let i = 0; i < n; i++) {
      const itemCenter = (cumulative[i] ?? 0) + (heights[i] ?? 0) / 2
      const dist = Math.abs(itemCenter - newCenter)
      if (dist < minDist) {
        minDist = dist
        target = i
      }
    }
    return target
  }, [])

  const animateLayout = useCallback((from: number, to: number) => {
    const heights = heightsRef.current
    const draggedHeight = heights[from] ?? 0
    if (draggedHeight <= 0) return
    for (let i = 0; i < animsRef.current.length; i++) {
      if (i === from) continue
      const anim = animsRef.current[i]
      let target = 0
      if (from < to) {
        if (i > from && i <= to) target = -draggedHeight
      } else if (from > to) {
        if (i >= to && i < from) target = draggedHeight
      }
      Animated.spring(anim.translateY, {
        toValue: target,
        useNativeDriver: true,
        friction: 9,
        tension: 70,
      }).start()
    }
  }, [])

  const handleDragMove = useCallback(
    (dy: number) => {
      const from = draggingIndexRef.current
      if (from == null) return
      const anim = animsRef.current[from]
      if (anim) anim.translateY.setValue(dy)
      const target = computeTargetIndex(from, dy)
      targetIndexRef.current = target
      if (target !== lastTargetRef.current) {
        lastTargetRef.current = target
        animateLayout(from, target)
      }
    },
    [computeTargetIndex, animateLayout]
  )

  const persistReorder = useCallback((from: number, to: number) => {
    if (from === to) return
    const next = [...userLists]
    const [moved] = next.splice(from, 1)
    if (!moved) return
    next.splice(to, 0, moved)
    updateUserListPosition(to, [moved.id])
  }, [userLists])

  const handleDragRelease = useCallback(() => {
    const from = draggingIndexRef.current
    const to = targetIndexRef.current ?? from
    draggingIndexRef.current = null
    targetIndexRef.current = null
    lastTargetRef.current = null
    setDraggingIndex(null)
    setIsTouchingDragHandle(false)
    if (from == null) return
    resetAllAnims()
    if (to != null && to !== from) {
      persistReorder(from, to)
    }
  }, [persistReorder, resetAllAnims])

  const handleDragCancel = useCallback(() => {
    draggingIndexRef.current = null
    targetIndexRef.current = null
    lastTargetRef.current = null
    setDraggingIndex(null)
    setIsTouchingDragHandle(false)
    resetAllAnims()
  }, [resetAllAnims])

  const handleTouchStart = useCallback(() => {
    setIsTouchingDragHandle(true)
  }, [])

  const handleTouchEnd = useCallback(() => {
    setIsTouchingDragHandle(false)
  }, [])

  // 菜单相关函数
  const showMenu = useCallback((item: ListItemInfo, index: number, position: Position) => {
    const listInfo = allList.find(l => l.id === item.id)
    if (listInfo) {
      listMenuRef.current?.show({ listInfo, index }, position)
    }
  }, [allList])

  // 显示音乐列表
  if (showMusicList) {
    return <MusicList onBack={handleBackToList} />
  }

  // 显示错误
  if (hasError) {
    return (
      <View style={styles.errorContainer}>
        <Text size={16} color={theme['c-font']} style={styles.errorText}>加载失败</Text>
        <TouchableOpacity onPress={refreshListInfo} style={styles.retryButton}>
          <Text size={14} color={theme['c-primary-font']}>点击尝试重新加载</Text>
        </TouchableOpacity>
      </View>
    )
  }

  // 显示卡片列表
  const renderItem = ({ item }: { item: ListItemInfo }) => {
    const userListIndex = userLists.findIndex(l => l.id === item.id)

    if (item.isFixed) {
      return (
        <FixedPlaylistCard
          item={item}
          onPress={() => handleItemPress(item)}
          onShowMenu={(itemInfo, position) => showMenu(itemInfo, -1, position)}
        />
      )
    }

    const anim = animsRef.current[userListIndex] ?? createAnim()
    const isDragSource = draggingIndex === userListIndex

    return (
      <PlaylistCard
        item={item}
        userListIndex={userListIndex}
        onPress={() => handleItemPress(item)}
        onShowMenu={showMenu}
        isDragging={draggingIndex != null}
        isDragSource={isDragSource}
        translateY={anim.translateY}
        scale={anim.scale}
        opacity={anim.opacity}
        zIndex={isDragSource ? 10 : 1}
        onLayoutHeight={handleLayoutHeight}
        onLongPressStart={handleLongPressStart}
        onDragMove={handleDragMove}
        onDragRelease={handleDragRelease}
        onDragCancel={handleDragCancel}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      />
    )
  }

  return (
    <View style={styles.content}>
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={theme['c-primary-font']} size="large" />
        </View>
      ) : (
        <>
          <FlatList
            data={listItems}
            renderItem={renderItem}
            keyExtractor={item => item.id}
            style={styles.listContainer}
            scrollEnabled={draggingIndex == null}
            refreshControl={
              <RefreshControl
                refreshing={isLoading}
                onRefresh={refreshListInfo}
                colors={[theme['c-primary-font']]}
                enabled={!isTouchingDragHandle}
              />
            }
          />
          <ListNameEdit ref={listNameEditRef} />
          <ListMusicSort ref={listMusicSortRef} />
          <DuplicateMusic ref={duplicateMusicRef} />
          <ListImportExport ref={listImportExportRef} />
          <ListMenu
            ref={listMenuRef}
            onNew={(index) => listNameEditRef.current?.showCreate(index)}
            onRename={(info) => listNameEditRef.current?.show(info)}
            onSort={(info) => listMusicSortRef.current?.show(info)}
            onDuplicateMusic={(info) => duplicateMusicRef.current?.show(info)}
            onImport={(info, position) => listImportExportRef.current?.import(info, position)}
            onExport={(info, position) => listImportExportRef.current?.export(info, position)}
            onRemove={(info) => handleRemove(info)}
            onSync={(info) => handleSync(info)}
            onSelectLocalFile={(info, position) =>
              listImportExportRef.current?.selectFile(info, position)
            }
          />
        </>
      )}
    </View>
  )
})

const styles = createStyle({
  content: {
    flex: 1,
  },
  listContainer: {
    flex: 1,
  },
  cardContainer: {
    height: CARD_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  cardContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  artwork: {
    width: 70,
    height: 70,
    borderRadius: 8,
  },
  info: {
    flex: 1,
    marginLeft: 15,
  },
  loading: {
    marginLeft: 10,
  },
  dragHandle: {
    paddingHorizontal: 6,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreBtn: {
    height: '100%',
    width: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    marginTop: 16,
    marginBottom: 20,
  },
  retryButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 8,
  },
})