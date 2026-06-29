import { memo, useCallback, useMemo, useRef, useState } from 'react'
import { View, Animated, PanResponder, StyleSheet } from 'react-native'
import { useI18n } from '@/lang'
import { useSettingValue } from '@/store/setting/hook'
import { useTheme } from '@/store/theme/hook'
import { updateSetting } from '@/core/common'
import { createStyle } from '@/utils/tools'
import { Icon } from '@/components/common/Icon'
import Text from '@/components/common/Text'
import SubTitle from '../../components/SubTitle'

const DEFAULT_STRATEGY = [
  'lowerQuality',
  'togglePlatform',
  'playNext',
  'toggleSource',
]

const LONG_PRESS_MS = 350
const DRAG_CANCEL_THRESHOLD = 6

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

const StrategyItem = memo(({
  item,
  index,
  isDragging,
  isDragSource,
  translateY,
  scale,
  opacity,
  zIndex,
  isDisabled,
  onLayoutHeight,
  onLongPressStart,
  onDragMove,
  onDragRelease,
  onDragCancel,
}: {
  item: { key: string; label: string }
  index: number
  isDragging: boolean
  isDragSource: boolean
  translateY: Animated.Value
  scale: Animated.Value
  opacity: Animated.Value
  zIndex: number
  isDisabled: boolean
  onLayoutHeight: (index: number, height: number) => void
  onLongPressStart: (index: number) => void
  onDragMove: (dy: number) => void
  onDragRelease: () => void
  onDragCancel: () => void
}) => {
  const theme = useTheme()
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isActivatedRef = useRef(false)

  const onLongPressStartRef = useRef(onLongPressStart)
  const onDragMoveRef = useRef(onDragMove)
  const onDragReleaseRef = useRef(onDragRelease)
  const onDragCancelRef = useRef(onDragCancel)
  onLongPressStartRef.current = onLongPressStart
  onDragMoveRef.current = onDragMove
  onDragReleaseRef.current = onDragRelease
  onDragCancelRef.current = onDragCancel

  const clearLongPressTimer = () => {
    if (longPressTimer.current != null) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponder: (_e, gs) => {
          if (!isActivatedRef.current) return false
          return Math.abs(gs.dy) > 1 || Math.abs(gs.dx) > 1
        },
        onMoveShouldSetPanResponderCapture: (_e, gs) => {
          if (!isActivatedRef.current) return false
          return Math.abs(gs.dy) > 2
        },
        onPanResponderGrant: () => {
          clearLongPressTimer()
          isActivatedRef.current = false
          longPressTimer.current = setTimeout(() => {
            longPressTimer.current = null
            isActivatedRef.current = true
            onLongPressStartRef.current(index)
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
          onDragMoveRef.current(gs.dy)
        },
        onPanResponderRelease: () => {
          clearLongPressTimer()
          if (isActivatedRef.current) {
            isActivatedRef.current = false
            onDragReleaseRef.current()
          }
        },
        onPanResponderTerminate: () => {
          clearLongPressTimer()
          if (isActivatedRef.current) {
            isActivatedRef.current = false
            onDragCancelRef.current()
          }
        },
        onPanResponderTerminationRequest: () => !isActivatedRef.current,
      }),
    [index]
  )

  const transform = isDragSource
    ? [{ translateY }, { scale }]
    : [{ translateY }]
  const elevation = isDragSource ? 8 : 0
  const shadowOpacity = isDragSource ? 0.25 : 0

  return (
    <Animated.View
      onLayout={(e) => onLayoutHeight(index, e.nativeEvent.layout.height)}
      style={[
        styles.item,
        {
          backgroundColor: isDragSource ? theme['c-primary-background-active'] : 'transparent',
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
      <View style={styles.itemInfo}>
        <View style={styles.dragHandle} {...panResponder.panHandlers}>
          <Icon name="menu" color={theme['c-font-label']} size={16} />
        </View>
        <Text
          style={[
            styles.itemIndex,
            { color: isDisabled ? theme['c-font-label'] : theme['c-font'] },
          ]}
        >
          {`${index + 1}.`}
        </Text>
        <Text
          style={[
            styles.itemLabel,
            { color: isDisabled ? theme['c-font-label'] : theme['c-font'] },
          ]}
        >
          {item.label}
        </Text>
      </View>
    </Animated.View>
  )
})

export default memo(() => {
  const t = useI18n()
  const theme = useTheme()
  const failureStrategy = useSettingValue('player.failureStrategy')
  const isEnableAutoToggleSource = useSettingValue('player.enableAutoToggleSource')
  const subContainerOpacity = useSettingValue('theme.subContainerOpacity')

  const strategyList = useMemo(() => {
    const labelMap: Record<string, string> = {
      togglePlatform: t('setting_play_failure_toggle_platform') || '切换平台',
      lowerQuality: t('setting_play_failure_lower_quality') || '降低音质',
      toggleSource: t('setting_play_failure_toggle_source') || '自动切换音源',
      playNext: t('setting_play_failure_play_next') || '播放下一首',
    }
    return (failureStrategy || DEFAULT_STRATEGY).map((key) => ({
      key,
      label: labelMap[key] || key,
    }))
  }, [failureStrategy, t])

  const heightsRef = useRef<number[]>([])
  const animsRef = useRef<DragAnim[]>([])
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null)
  const draggingIndexRef = useRef<number | null>(null)
  const targetIndexRef = useRef<number | null>(null)
  const lastTargetRef = useRef<number | null>(null)

  if (animsRef.current.length !== strategyList.length) {
    if (animsRef.current.length < strategyList.length) {
      for (let i = animsRef.current.length; i < strategyList.length; i++) {
        animsRef.current.push(createAnim())
      }
    } else {
      animsRef.current.length = strategyList.length
    }
    heightsRef.current.length = strategyList.length
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

  const handleDragRelease = useCallback(() => {
    const from = draggingIndexRef.current
    const to = targetIndexRef.current ?? from
    draggingIndexRef.current = null
    targetIndexRef.current = null
    lastTargetRef.current = null
    if (from == null) return
    const needsReorder = to != null && to !== from
    if (needsReorder) {
      const next = [...strategyList]
      const [moved] = next.splice(from, 1)
      if (moved) {
        next.splice(to, 0, moved)
        const newOrder = next.map((item) => item.key)
        updateSetting({ 'player.failureStrategy': newOrder })
      }
    }
    setTimeout(resetAllAnims, 100)
    setDraggingIndex(null)
  }, [strategyList, resetAllAnims])

  const handleDragCancel = useCallback(() => {
    draggingIndexRef.current = null
    targetIndexRef.current = null
    lastTargetRef.current = null
    setDraggingIndex(null)
    resetAllAnims()
  }, [resetAllAnims])

  return (
    <SubTitle title={t('setting_play_failure_strategy')} collapsible sectionId="setting_play_failure_strategy">
      <View style={[styles.list, { backgroundColor: `rgba(255, 255, 255, ${subContainerOpacity / 100})`, padding: 8, borderRadius: 8 }]}>
        {strategyList.map((item, idx) => {
          const anim = animsRef.current[idx] ?? createAnim()
          const isDragSource = draggingIndex === idx
          return (
            <StrategyItem
              key={item.key}
              item={item}
              index={idx}
              isDragging={draggingIndex != null}
              isDragSource={isDragSource}
              translateY={anim.translateY}
              scale={anim.scale}
              opacity={anim.opacity}
              zIndex={isDragSource ? 10 : 1}
              isDisabled={item.key === 'toggleSource' && !isEnableAutoToggleSource}
              onLayoutHeight={handleLayoutHeight}
              onLongPressStart={handleLongPressStart}
              onDragMove={handleDragMove}
              onDragRelease={handleDragRelease}
              onDragCancel={handleDragCancel}
            />
          )
        })}
      </View>
    </SubTitle>
  )
})

const styles = createStyle({
  list: {
    flexGrow: 0,
    flexShrink: 1,
  },
  item: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128, 128, 128, 0.2)',
    borderRadius: 8,
  },
  itemInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dragHandle: {
    paddingHorizontal: 6,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemIndex: {
    fontSize: 16,
    marginRight: 8,
  },
  itemLabel: {
    fontSize: 16,
    flex: 1,
  },
})
