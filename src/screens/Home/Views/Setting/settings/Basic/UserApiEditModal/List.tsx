import { useCallback, useEffect, useMemo, useRef, useState, memo } from 'react'
import Text from '@/components/common/Text'
import {
  View,
  TouchableOpacity,
  ScrollView,
  Animated,
  PanResponder,
  type LayoutChangeEvent,
  type GestureResponderEvent,
  type PanResponderGestureState,
} from 'react-native'
import { confirmDialog, createStyle } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { useUserApiList, state as userApiState } from '@/store/userApi'
import { useSettingValue } from '@/store/setting/hook'
import { removeUserApi, reorderUserApi, setUserApiAllowShowUpdateAlert } from '@/core/userApi'
import { BorderRadius } from '@/theme'
import CheckBox from '@/components/common/CheckBox'
import { Icon } from '@/components/common/Icon'
import { SvgIcon } from '@/components/common/SvgIcon'
import settingState from '@/store/setting/state'
import apiSourceInfo from '@/utils/musicSdk/api-source-info'
import { setApiSource } from '@/core/apiSource'

const LONG_PRESS_MS = 350
const DRAG_CANCEL_THRESHOLD = 6

const formatVersionName = (version: string) => {
  return /^\d/.test(version) ? `v${version}` : version
}

interface ListItemProps {
  item: LX.UserApi.UserApiInfo
  index: number
  activeId: string
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
  onRemove: (id: string, name: string) => void
  onExport: (id: string) => void
  onChangeAllowShowUpdateAlert: (id: string, enabled: boolean) => void
  dragHandleHint: string
}

const ListItem = memo(
  ({
    item,
    index,
    activeId,
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
    onRemove,
    onExport,
    onChangeAllowShowUpdateAlert,
    dragHandleHint,
  }: ListItemProps) => {
  const theme = useTheme()
  const t = useI18n()
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isActivatedRef = useRef(false)

  const changeAllowShowUpdateAlert = (check: boolean) => {
    onChangeAllowShowUpdateAlert(item.id, check)
  }
  const handleRemove = () => {
    onRemove(item.id, item.name)
  }
  const handleExport = () => {
    onExport(item.id)
  }

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
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => false,
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

  const handleLayout = useCallback(
    (e: LayoutChangeEvent) => {
      onLayoutHeight(index, e.nativeEvent.layout.height)
    },
    [index, onLayoutHeight]
  )

  const transform = isDragSource
    ? [{ translateY }, { scale }]
    : [{ translateY }]
  const elevation = isDragSource ? 8 : 0
  const shadowOpacity = isDragSource ? 0.25 : 0
  const backgroundColor = isDragSource
    ? theme['c-primary-background-active']
    : activeId == item.id
      ? theme['c-primary-background-active']
      : 'transparent'

  return (
    <Animated.View
      onLayout={handleLayout}
      style={[
        styles.listItem,
        {
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
      {...panResponder.panHandlers}
    >
      <View style={styles.dragHandle}>
        <Icon name="menu" color={theme['c-font-label']} size={16} />
      </View>
      <View style={styles.listItemLeft}>
        <Text size={14} numberOfLines={1}>
          {item.name}
          {item.version ? (
            <Text size={12} color={theme['c-font-label']}>
              {'   ' + formatVersionName(item.version)}
            </Text>
          ) : null}
          {item.author ? (
            <Text size={12} color={theme['c-font-label']}>
              {'   ' + item.author}
            </Text>
          ) : null}
        </Text>
        {item.description ? (
          <Text size={12} color={theme['c-font-label']}>
            {item.description}
          </Text>
        ) : null}
        <CheckBox
          check={item.allowShowUpdateAlert}
          label={t('user_api_allow_show_update_alert')}
          onChange={changeAllowShowUpdateAlert}
          size={0.86}
        />
        {isDragging && index === 0 ? (
          <Text size={11} color={theme['c-font-label']} style={styles.dragHint}>
            {dragHandleHint}
          </Text>
        ) : null}
      </View>
      <View style={styles.listItemRight}>
        <TouchableOpacity style={styles.btn} onPress={handleExport} disabled={isDragging}>
          <SvgIcon name="export" color={theme['c-button-font']} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.btn} onPress={handleRemove} disabled={isDragging}>
          <Icon name="close" color={theme['c-button-font']} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  )
  },
  (prev, next) => {
    if (prev.item !== next.item) return false
    if (prev.index !== next.index) return false
    if (prev.activeId !== next.activeId) return false
    if (prev.isDragging !== next.isDragging) return false
    if (prev.isDragSource !== next.isDragSource) return false
    if (prev.zIndex !== next.zIndex) return false
    if (prev.dragHandleHint !== next.dragHandleHint) return false
    if (prev.translateY !== next.translateY) return false
    if (prev.scale !== next.scale) return false
    if (prev.opacity !== next.opacity) return false
    return true
  }
)
ListItem.displayName = 'UserApiListItem'

export interface UserApiEditModalProps {
  onSave: (rules: string) => void
  onExport: (id: string) => void
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

export default ({ onExport }: UserApiEditModalProps) => {
  const userApiList = useUserApiList()
  const apiSource = useSettingValue('common.apiSource')
  const theme = useTheme()
  const t = useI18n()

  const heightsRef = useRef<number[]>([])
  const animsRef = useRef<DragAnim[]>([])
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null)
  const draggingIndexRef = useRef<number | null>(null)
  const targetIndexRef = useRef<number | null>(null)
  const lastTargetRef = useRef<number | null>(null)

  // 同步动画值数组长度与列表长度
  if (animsRef.current.length !== userApiList.length) {
    if (animsRef.current.length < userApiList.length) {
      for (let i = animsRef.current.length; i < userApiList.length; i++) {
        animsRef.current.push(createAnim())
      }
    } else {
      animsRef.current.length = userApiList.length
    }
    heightsRef.current.length = userApiList.length
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
    // 累加位移，找出被拖项中心新位置应落在哪个 slot
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
        // 向下移动：from..to 之间的项要向上让位
        if (i > from && i <= to) target = -draggedHeight
      } else if (from > to) {
        // 向上移动：to..from 之间的项要向下让位
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
    const next = [...userApiState.list]
    const [moved] = next.splice(from, 1)
    if (!moved) return
    next.splice(to, 0, moved)
    void reorderUserApi(next)
  }, [])

  const handleDragRelease = useCallback(() => {
    const from = draggingIndexRef.current
    const to = targetIndexRef.current ?? from
    draggingIndexRef.current = null
    targetIndexRef.current = null
    lastTargetRef.current = null
    setDraggingIndex(null)
    if (from == null) return
    // 落位前重置所有动画
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

  const handleRemove = useCallback(async (id: string, name: string) => {
    const confirm = await confirmDialog({
      message: global.i18n.t('user_api_remove_tip', { name }),
      cancelButtonText: global.i18n.t('cancel_button_text_2'),
      confirmButtonText: global.i18n.t('confirm_button_text'),
      bgClose: false,
    })
    if (!confirm) return
    void removeUserApi([id]).finally(() => {
      if (settingState.setting['common.apiSource'] == id) {
        let backApiId = apiSourceInfo.find((api) => !api.disabled)?.id
        if (!backApiId) backApiId = userApiState.list[0]?.id
        setApiSource(backApiId ?? '')
      }
    })
  }, [])
  const handleChangeAllowShowUpdateAlert = useCallback((id: string, enabled: boolean) => {
    void setUserApiAllowShowUpdateAlert(id, enabled)
  }, [])

  const reorderHint = t('user_api_reorder_tip')

  return (
    <ScrollView
      style={styles.scrollView}
      keyboardShouldPersistTaps={'always'}
      scrollEnabled={draggingIndex == null}
    >
      <View onStartShouldSetResponder={() => true}>
        {userApiList.length ? (
          userApiList.map((item, index) => {
            const anim = animsRef.current[index] ?? createAnim()
            const isDragSource = draggingIndex === index
            return (
              <ListItem
                key={item.id}
                item={item}
                index={index}
                activeId={apiSource}
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
                onRemove={handleRemove}
                onExport={onExport}
                onChangeAllowShowUpdateAlert={handleChangeAllowShowUpdateAlert}
                dragHandleHint={reorderHint}
              />
            )
          })
        ) : (
          <Text style={styles.tipText} color={theme['c-font-label']}>
            {t('user_api_empty')}
          </Text>
        )}
      </View>
    </ScrollView>
  )
}

const styles = createStyle({
  scrollView: {
    paddingHorizontal: 7,
    flexGrow: 0,
  },
  list: {
    paddingBottom: 15,
    flexDirection: 'column',
  },
  listItem: {
    padding: 10,
    borderRadius: BorderRadius.normal,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dragHandle: {
    paddingHorizontal: 6,
    paddingVertical: 6,
    marginRight: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listItemLeft: {
    paddingRight: 10,
    flex: 1,
    gap: 2,
  },
  listItemRight: {
    flex: 0,
  },
  btn: {
    padding: 10,
  },
  dragHint: {
    marginTop: 2,
  },
  tipText: {
    textAlign: 'center',
    marginTop: 25,
    marginBottom: 15,
  },
})
