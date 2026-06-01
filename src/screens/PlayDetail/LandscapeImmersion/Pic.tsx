import { memo, useEffect, useRef, useCallback, useMemo } from 'react'
import { View, Animated, Easing } from 'react-native'
import { useIsPlay, usePlayerMusicInfo, usePlayMusicInfo } from '@/store/player/hook'
import { useWindowSize } from '@/utils/hooks'
import Image from '@/components/common/Image'
import { useSettingValue } from '@/store/setting/hook'
import { createStyle } from '@/utils/tools'

export default memo(() => {
  const musicInfo = usePlayerMusicInfo()
  const playMusicInfo = usePlayMusicInfo()
  const pic = useMemo(() => {
    return musicInfo.pic || (playMusicInfo.musicInfo ? ('progress' in playMusicInfo.musicInfo ? playMusicInfo.musicInfo.metadata.musicInfo.pic : playMusicInfo.musicInfo.pic) : null)
  }, [musicInfo.pic, playMusicInfo.musicInfo])
  const { width: winWidth, height: winHeight } = useWindowSize()
  const isPlay = useIsPlay()
  const isCoverSpin = useSettingValue('playDetail.isCoverSpin')
  const spinValue = useRef(new Animated.Value(0)).current
  const animationRef = useRef<Animated.CompositeAnimation | null>(null)
  const isAnimating = useRef(false)

  const createAnimation = useCallback((value: number) => {
    return Animated.timing(spinValue, {
      toValue: 1,
      duration: 25000 * (1 - value),
      easing: Easing.linear,
      useNativeDriver: true,
    })
  }, [spinValue])

  const startAnimation = useCallback(() => {
    if (isAnimating.current || !isCoverSpin) return
    isAnimating.current = true
    spinValue.stopAnimation(value => {
      animationRef.current = createAnimation(value)
      animationRef.current.start(({ finished }) => {
        if (finished && isAnimating.current) {
          spinValue.setValue(0)
          isAnimating.current = false
          startAnimation()
        }
      })
    })
  }, [spinValue, createAnimation, isCoverSpin])

  const stopAnimation = useCallback(() => {
    if (!isAnimating.current) return
    isAnimating.current = false
    animationRef.current?.stop()
    animationRef.current = null
    spinValue.stopAnimation()
  }, [spinValue])

  useEffect(() => {
    if (isPlay && isCoverSpin) {
      startAnimation()
    } else {
      stopAnimation()
    }
  }, [isPlay, isCoverSpin, startAnimation, stopAnimation])

  useEffect(() => {
    stopAnimation()
    if (isPlay && isCoverSpin && musicInfo.id) {
      startAnimation()
    }
  }, [musicInfo.id, isCoverSpin, startAnimation, stopAnimation])

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  })

  const imgSize = useMemo(() => {
    return Math.min(winWidth * 0.55, winHeight * 0.8)
  }, [winWidth, winHeight])

  const imageContainerStyle = useMemo(() => ({
    width: imgSize,
    height: imgSize,
    borderRadius: imgSize / 2,
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    backgroundColor: '#000',
  } as any), [imgSize])

  return (
    <View style={styles.container}>
      <Animated.View style={[imageContainerStyle, { transform: [{ rotate: spin }] }]}>
        <Image
          url={pic}
          style={styles.image}
        />
      </Animated.View>
    </View>
  )
})

const styles = createStyle({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
})
