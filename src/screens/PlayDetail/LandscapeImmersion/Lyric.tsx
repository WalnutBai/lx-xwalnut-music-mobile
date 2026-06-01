import { memo, useMemo, useEffect, useRef, useCallback } from 'react'
import {
  View,
  FlatList,
  Dimensions,
  type FlatListProps,
  type LayoutChangeEvent,
  TouchableOpacity,
} from 'react-native'
import { type Line, useLrcPlay, useLrcSet } from '@/plugins/lyric'
import { createStyle } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import { useSettingValue } from '@/store/setting/hook'
import { AnimatedColorText } from '@/components/common/Text'
import { setSpText } from '@/utils/pixelRatio'

type FlatListType = FlatListProps<Line>

interface LineProps {
  line: Line
  lineNum: number
  activeLine: number
  onPress: (index: number) => void
}

const LrcLine = memo(({ line, lineNum, activeLine, onPress }: LineProps) => {
  const theme = useTheme()
  const lrcFontSize = useSettingValue('playDetail.landscapeImmersion.style.lrcFontSize')
  const lrcAlign = useSettingValue('playDetail.landscapeImmersion.style.lrcAlign')
  const size = lrcFontSize / 10
  const lineHeight = setSpText(size) * 1.5 // 稍微增大行高

  const colors = useMemo(() => {
    const active = activeLine == lineNum
    return active
      ? ([theme['c-primary-font-active'], theme['c-primary-alpha-200'], 1] as const)
      : ([theme['c-450'], theme['c-400'], 0.8] as const)
  }, [activeLine, lineNum, theme])

  const handlePress = useCallback(() => {
    onPress(lineNum)
  }, [onPress, lineNum])

  return (
    <TouchableOpacity activeOpacity={0.7} onPress={handlePress}>
      <View style={styles.line}>
      <AnimatedColorText
        color={colors[0]}
        opacity={colors[2]}
        size={size}
        style={{ ...styles.lineText, lineHeight, textAlign: lrcAlign }}
      >
        {line.text}
      </AnimatedColorText>
      {line.extendedLyrics.map((lrc, index) => (
        <AnimatedColorText
          key={index}
          color={colors[0]}
          opacity={colors[2]}
          size={size * 0.8}
          style={{ ...styles.lineTranslationText, lineHeight: lineHeight * 0.8, textAlign: lrcAlign }}
        >
          {lrc}
        </AnimatedColorText>
      ))}
    </View>
  </TouchableOpacity>
  )
})

export default memo(() => {
  const lyricLines = useLrcSet()
  const { line, playedLines } = useLrcPlay()
  const flatListRef = useRef<FlatList<Line>>(null)
  const isPauseScrollRef = useRef(false)
  const scrollTimoutRef = useRef<NodeJS.Timeout | null>(null)
  const lineRef = useRef({ line: 0, prevLine: 0 })
  const isShowLyricProgressSetting = useSettingValue('playDetail.isShowLyricProgressSetting')

  const handleLinePress = useCallback((index: number) => {
    if (!isShowLyricProgressSetting) return
    const line = lyricLines[index]
    if (line) {
      global.app_event.setProgress(line.time / 1000)
    }
  }, [isShowLyricProgressSetting, lyricLines])

  const handleScrollToActive = useCallback((index = lineRef.current.line) => {
    if (index < 0 || !flatListRef.current || lyricLines.length <= index) return
    try {
      flatListRef.current.scrollToIndex({
        index,
        animated: true,
        viewPosition: 0.5,
      })
    } catch (e) {
      // ignore
    }
  }, [lyricLines.length])

  useEffect(() => {
    lineRef.current.prevLine = 0
    lineRef.current.line = 0
    if (!flatListRef.current) return
    flatListRef.current.scrollToOffset({ offset: 0, animated: false })
    if (!lyricLines.length) return
    const timeout = setTimeout(() => handleScrollToActive(), 100)
    return () => clearTimeout(timeout)
  }, [lyricLines, handleScrollToActive])

  useEffect(() => {
    if (line < 0) return
    lineRef.current.prevLine = lineRef.current.line
    lineRef.current.line = line
    if (!flatListRef.current || isPauseScrollRef.current) return
    handleScrollToActive()
  }, [line, playedLines, handleScrollToActive])

  const handleScrollBeginDrag = useCallback(() => {
    isPauseScrollRef.current = true
    if (scrollTimoutRef.current) clearTimeout(scrollTimoutRef.current)
  }, [])

  const handleScrollEndDrag = useCallback(() => {
    if (scrollTimoutRef.current) clearTimeout(scrollTimoutRef.current)
    scrollTimoutRef.current = setTimeout(() => {
      isPauseScrollRef.current = false
      handleScrollToActive()
    }, 3000)
  }, [handleScrollToActive])

  const renderItem: FlatListType['renderItem'] = ({ item, index }) => (
    <LrcLine line={item} lineNum={index} activeLine={line} onPress={handleLinePress} />
  )
  const getkey: FlatListType['keyExtractor'] = (item, index) => `${index}${item.text}${item.extendedLyrics.join('')}`

  return (
    <View style={styles.container}>
      <FlatList
        data={lyricLines}
        renderItem={renderItem}
        keyExtractor={getkey}
        style={{ flex: 1 }}
        contentContainerStyle={styles.listContent}
        ref={flatListRef}
        showsVerticalScrollIndicator={false}
        onScrollBeginDrag={handleScrollBeginDrag}
        onScrollEndDrag={handleScrollEndDrag}
        onMomentumScrollBegin={handleScrollBeginDrag}
        onMomentumScrollEnd={handleScrollEndDrag}
        fadingEdgeLength={100}
        initialNumToRender={50}
        maxToRenderPerBatch={50}
        windowSize={10}
        onScrollToIndexFailed={(info) => {
          flatListRef.current?.scrollToOffset({
            offset: info.averageItemLength * info.index,
            animated: false,
          })
          setTimeout(() => {
            if (flatListRef.current) {
              flatListRef.current.scrollToIndex({
                index: info.index,
                animated: false,
                viewPosition: 0.5,
              })
            }
          }, 100)
        }}
      />
    </View>
  )
})

const { height: screenHeight } = Dimensions.get('window')

const styles = createStyle({
  container: {
    flex: 1,
    paddingLeft: 40,
    paddingRight: 20,
  },
  listContent: {
    paddingVertical: '48%', // 使用 padding 代替 header/footer 组件，解决滑动受限
  },
  line: {
    paddingVertical: 12,
  },
  lineText: {
    // 移除居中
  },
  lineTranslationText: {
    paddingTop: 8,
  },
})
