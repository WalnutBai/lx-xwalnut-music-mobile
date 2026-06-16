import { memo, useEffect, useRef, useCallback, useState, useMemo } from 'react'
import {
  View,
  TouchableOpacity,
  FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type FlatListProps,
  Animated,
  PanResponder,
  type GestureResponderEvent,
  type PanResponderGestureState,
} from 'react-native'

import { Icon } from '@/components/common/Icon'

import { useTheme } from '@/store/theme/hook'
import { useActiveListId, useListFetching, useMyList } from '@/store/list/hook'
import { createStyle } from '@/utils/tools'
import { LIST_SCROLL_POSITION_KEY, LIST_IDS } from '@/config/constant'
import { getListPosition, saveListPosition } from '@/utils/data'
import { setActiveList, updateUserListPosition } from '@/core/list'
import Text from '@/components/common/Text'
import { type Position } from './ListMenu'
import { scaleSizeH } from '@/utils/pixelRatio'
import Loading from '@/components/common/Loading'

const LONG_PRESS_MS = 350
const DRAG_CANCEL_THRESHOLD = 6

type FlatListType = FlatListProps<LX.List.MyListInfo>

const ITEM_HEIGHT = 90

// 固定列表项组件（用于 DEFAULT 和 LOVE）
const FixedListItem = memo(({
  item,
  index,
  activeId,
  onPress,
  onShowMenu,
}: {
  item: LX.List.MyListInfo
  index: number
  activeId: string
  onPress: (item: LX.List.MyListInfo) => void
  onShowMenu: (
    item: LX.List.MyListInfo,
    index: number,
    position: { x: number; y: number; w: number; h: number }
  ) => void
}) => {
  const theme = useTheme()
  const fetching = useListFetching(item.id)
  const moreButtonRef = useRef<TouchableOpacity>(null)
  const active = activeId == item.id

  const handleShowMenu = () => {
    if (moreButtonRef.current?.measure) {
      moreButtonRef.current.measure((fx, fy, width, height, px, py) => {
        onShowMenu(item, index, {
          x: Math.ceil(px),
          y: Math.ceil(py),
          w: Math.ceil(width),
          h: Math.ceil(height),
        })
      })
    }
  }

  return (
    <View key={item.id} style={[styles.listItem, { height: ITEM_HEIGHT }]}>
      {active ? (
        <Icon
          style={styles.listActiveIcon}
          name="chevron-right"
          size={12}
          color={theme['c-primary-font']}
        />
      ) : null}
      {fetching ? (
        <Loading
          color={active ? theme['c-primary-font'] : theme['c-font']}
          style={styles.loading}
        />
      ) : null}
      <TouchableOpacity style={styles.listName} onPress={() => onPress(item)}>
        <Text
          numberOfLines={1}
          color={active ? theme['c-primary-font'] : theme['c-font']}
        >
          {item.name}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={handleShowMenu} ref={moreButtonRef} style={styles.listMoreBtn}>
        <Icon name="dots-vertical" color={theme['c-350']} size={12} />
      </TouchableOpacity>
    </View>
  )
})

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

interface ListItemProps {
  item: LX.List.MyListInfo
  index: number
  activeId: string
  onPress: (item: LX.List.MyListInfo) => void
  onShowMenu: (
    item: LX.List.MyListInfo,
    index: number,
    position: { x: number; y: number; w: number; h: number }
  ) => void
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
  isFixed: boolean
}

const ListItem = memo(
  ({
    item,
    index,
    activeId,
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
    isFixed,
  }: ListItemProps) => {
    const theme = useTheme()
    const moreButtonRef = useRef<TouchableOpacity>(null)
    const fetching = useListFetching(item.id)
    const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const isActivatedRef = useRef(false)

    const active = activeId == item.id

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
            clearLongPressTimer()
            isActivatedRef.current = false
            longPressTimer.current = setTimeout(() => {
              longPressTimer.current = null
              isActivatedRef.current = true
              onLongPressStart(index)
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
            clearLongPressTimer()
            if (isActivatedRef.current) {
              isActivatedRef.current = false
              onDragRelease()
            }
          },
          onPanResponderTerminate: () => {
            clearLongPressTimer()
            if (isActivatedRef.current) {
              isActivatedRef.current = false
              onDragCancel()
            }
          },
          onPanResponderTerminationRequest: () => !isActivatedRef.current,
        }),
      [index, onLongPressStart, onDragMove, onDragRelease, onDragCancel]
    )

    const handleShowMenu = () => {
      if (moreButtonRef.current?.measure) {
        moreButtonRef.current.measure((fx, fy, width, height, px, py) => {
          onShowMenu(item, index, {
            x: Math.ceil(px),
            y: Math.ceil(py),
            w: Math.ceil(width),
            h: Math.ceil(height),
          })
        })
      }
    }

    const handlePress = () => {
      onPress(item)
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
        onLayout={(e) => onLayoutHeight(index, e.nativeEvent.layout.height)}
        style={[
          styles.listItem,
          {
            height: ITEM_HEIGHT,
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
        {active ? (
          <Icon
            style={styles.listActiveIcon}
            name="chevron-right"
            size={12}
            color={theme['c-primary-font']}
          />
        ) : null}
        {fetching ? (
          <Loading
            color={active ? theme['c-primary-font'] : theme['c-font']}
            style={styles.loading}
          />
        ) : null}
        <TouchableOpacity style={styles.listName} onPress={handlePress}>
          <Text numberOfLines={1} color={active ? theme['c-primary-font'] : theme['c-font']}>
            {item.name}
          </Text>
        </TouchableOpacity>
        {!isFixed && (
          <View style={styles.dragHandle} {...panResponder.panHandlers}>
            <Icon name="menu" color={theme['c-font-label']} size={14} />
          </View>
        )}
        <TouchableOpacity onPress={handleShowMenu} ref={moreButtonRef} style={styles.listMoreBtn}>
          <Icon name="dots-vertical" color={theme['c-350']} size={12} />
        </TouchableOpacity>
      </Animated.View>
    )
  },
  (prevProps, nextProps) => {
    return !!(
      prevProps.item === nextProps.item &&
      prevProps.index === nextProps.index &&
      prevProps.item.name == nextProps.item.name &&
      prevProps.activeId != nextProps.item.id &&
      nextProps.activeId != nextProps.item.id &&
      prevProps.isDragging === nextProps.isDragging &&
      prevProps.isDragSource === nextProps.isDragSource &&
      prevProps.zIndex === nextProps.zIndex
    )
  }
)

export default ({
  onShowMenu,
}: {
  onShowMenu: (info: { listInfo: LX.List.MyListInfo; index: number }, position: Position) => void
}) => {
  const flatListRef = useRef<FlatList>(null)
  const allList = useMyList()
  const activeListId = useActiveListId()

  const heightsRef = useRef<number[]>([])
  const animsRef = useRef<DragAnim[]>([])
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null)
  const draggingIndexRef = useRef<number | null>(null)
  const targetIndexRef = useRef<number | null>(null)
  const lastTargetRef = useRef<number | null>(null)

  const userLists = useMemo(() => allList.filter(l => l.id !== LIST_IDS.DEFAULT && l.id !== LIST_IDS.LOVE), [allList])

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
    resetAllAnims()
  }, [resetAllAnims])

  const handleToggleList = (item: LX.List.MyListInfo) => {
    global.app_event.changeLoveListVisible(false)
    requestAnimationFrame(() => {
      setActiveList(item.id)
    })
  }

  const handleScroll = ({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) => {
    void saveListPosition(LIST_SCROLL_POSITION_KEY, nativeEvent.contentOffset.y)
  }

  const showMenu = (listInfo: LX.List.MyListInfo, index: number, position: Position) => {
    onShowMenu({ listInfo, index }, position)
  }

  useEffect(() => {
    void getListPosition(LIST_SCROLL_POSITION_KEY).then((offset) => {
      flatListRef.current?.scrollToOffset({ offset, animated: false })
    })
  }, [])

  const renderItem: FlatListType['renderItem'] = ({ item, index }) => {
    const isFixed = item.id === LIST_IDS.DEFAULT || item.id === LIST_IDS.LOVE
    const userListIndex = userLists.findIndex(l => l.id === item.id)

    if (isFixed) {
      return (
        <FixedListItem
          item={item}
          index={index}
          activeId={activeListId}
          onPress={handleToggleList}
          onShowMenu={showMenu}
        />
      )
    }

    const anim = animsRef.current[userListIndex] ?? createAnim()
    const isDragSource = draggingIndex === userListIndex

    return (
      <ListItem
        key={item.id}
        item={item}
        index={userListIndex}
        activeId={activeListId}
        onPress={handleToggleList}
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
        isFixed={isFixed}
      />
    )
  }

  const getkey: FlatListType['keyExtractor'] = (item) => item.id
  const getItemLayout: FlatListType['getItemLayout'] = (data, index) => {
    return { length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index }
  }

  return (
    <FlatList
      ref={flatListRef}
      onScroll={handleScroll}
      style={styles.container}
      data={allList}
      maxToRenderPerBatch={9}
      windowSize={9}
      removeClippedSubviews={true}
      initialNumToRender={18}
      renderItem={renderItem}
      keyExtractor={getkey}
      getItemLayout={getItemLayout}
      scrollEnabled={draggingIndex == null}
    />
  )
}

const styles = createStyle({
  container: {
    flexShrink: 1,
    flexGrow: 0,
  },
  listItem: {
    height: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 5,
    paddingLeft: 5,
  },
  listActiveIcon: {
    marginLeft: 3,
    textAlign: 'center',
  },
  loading: {
    marginLeft: 5,
  },
  listName: {
    height: '100%',
    justifyContent: 'center',
    flexGrow: 1,
    flexShrink: 1,
    paddingLeft: 5,
  },
  dragHandle: {
    paddingHorizontal: 6,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listMoreBtn: {
    height: '100%',
    width: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
})
