import {memo, useState, useRef, useMemo, useEffect, useCallback} from 'react'
import { View, AppState, Animated, PanResponder } from 'react-native'

import Header from './components/Header'
import MiniLyric from '../components/MiniLyric';
import Player from './Player'
import PagerView, { type PagerViewOnPageSelectedEvent } from 'react-native-pager-view'
import Pic from './Pic'
import Lyric from './Lyric'
import { screenkeepAwake, screenUnkeepAwake } from '@/utils/nativeModules/utils'
import commonState, { type InitState as CommonState } from '@/store/common/state'
import { createStyle } from '@/utils/tools'
import { useWindowSize } from '@/utils/hooks'
import { useSettingValue } from '@/store/setting/hook'
import { playNext, playPrev } from '@/core/player/player'

const LyricPage = ({ activeIndex }: { activeIndex: number }) => {
  const initedRef = useRef(false)
  const lyric = useMemo(() => <Lyric />, [])
  switch (activeIndex) {
    case 1:
      if (!initedRef.current) initedRef.current = true
      return lyric
    default:
      return initedRef.current ? lyric : null
  }
}

export default memo(({ componentId }: { componentId: string }) => {
  const [pageIndex, setPageIndex] = useState(0)
  const pagerViewRef = useRef<PagerView>(null);
  const showLyricRef = useRef(false)
  const { height: winHeight } = useWindowSize()
  const isEnableSlideSwitchSong = useSettingValue('player.isEnableSlideSwitchSong')
  
  const slideOffset = useRef(new Animated.Value(0)).current;
  const maxSlide = winHeight * 0.45;
  const slideThresholdNext = winHeight * 0.09;
  const slideThresholdPrev = winHeight * 0.04;
  
  const resetSlide = useCallback(() => {
    Animated.spring(slideOffset, {
      toValue: 0,
      tension: 50,
      friction: 7,
      useNativeDriver: true,
    }).start();
  }, [slideOffset]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        if (!isEnableSlideSwitchSong || pageIndex !== 0) return false;
        const { dy } = gestureState;
        return Math.abs(dy) > 10;
      },
      onMoveShouldSetPanResponderCapture: (_, gestureState) => {
        if (!isEnableSlideSwitchSong || pageIndex !== 0) return false;
        const { dy } = gestureState;
        return Math.abs(dy) > Math.abs(gestureState.dx) * 0.5;
      },
      onPanResponderMove: (_, gestureState) => {
        const clampedDy = Math.max(-maxSlide, Math.min(maxSlide, gestureState.dy));
        slideOffset.setValue(clampedDy);
      },
      onPanResponderRelease: (_, gestureState) => {
        const shouldPlayNext = gestureState.dy < -slideThresholdNext;
        const shouldPlayPrev = gestureState.dy > slideThresholdPrev;
        
        if (shouldPlayNext) {
          void playNext();
        } else if (shouldPlayPrev) {
          void playPrev();
        }
        resetSlide();
      },
      onPanResponderTerminate: () => {
        resetSlide();
      },
      onPanResponderTerminationRequest: () => {
        return false;
      },
    })
  ).current;

  const slideStyle = useMemo(() => {
    const scale = slideOffset.interpolate({
      inputRange: [-maxSlide, 0, maxSlide],
      outputRange: [0.95, 1, 0.95],
    });
    const opacity = slideOffset.interpolate({
      inputRange: [-maxSlide, -maxSlide * 0.5, 0, maxSlide * 0.5, maxSlide],
      outputRange: [0.9, 0.95, 1, 0.95, 0.9],
    });
    return {
      transform: [
        { translateY: slideOffset },
        { scale },
      ],
      opacity,
    };
  }, [slideOffset, maxSlide]);

  const onPageSelected = ({ nativeEvent }: PagerViewOnPageSelectedEvent) => {
    setPageIndex(nativeEvent.position)
    showLyricRef.current = nativeEvent.position === 1
    if (showLyricRef.current) {
      screenkeepAwake()
    } else {
      screenUnkeepAwake()
    }
  }

  const handleSwitchToLyricPage = useCallback(() => {
    pagerViewRef.current?.setPage(1);
  }, []);

  useEffect(() => {
    let appstateListener = AppState.addEventListener('change', (state) => {
      switch (state) {
        case 'active':
          if (showLyricRef.current && !commonState.componentIds.comment) screenkeepAwake()
          break
        case 'background':
          screenUnkeepAwake()
          break
      }
    })

    const handleComponentIdsChange = (ids: CommonState['componentIds']) => {
      if (ids.comment) screenUnkeepAwake()
      else if (AppState.currentState === 'active') screenkeepAwake()
    }

    global.state_event.on('componentIdsUpdated', handleComponentIdsChange)

    return () => {
      global.state_event.off('componentIdsUpdated', handleComponentIdsChange)
      appstateListener.remove()
      screenUnkeepAwake()
    }
  }, [])

  return (
    <>
      <Header />
      <View style={styles.container} {...panResponder.panHandlers}>
        <PagerView
          onPageSelected={onPageSelected}
          style={styles.pagerView}
          ref={pagerViewRef}
        >
          <View collapsable={false}>
            <Animated.View collapsable={false} style={[styles.picPageContainer, slideStyle]}>
              <Pic componentId={componentId} />
              <MiniLyric
                onPress={handleSwitchToLyricPage}
                style={styles.miniLyricContainer}
              />
            </Animated.View>
          </View>
          <View collapsable={false}>
            <LyricPage activeIndex={pageIndex} />
          </View>
        </PagerView>
        <Player componentId={componentId} />
      </View>
    </>
  )
})

const styles = createStyle({
  container: {
    flex: 1,
    flexDirection: 'column',
  },
  pagerView: {
    flex: 1,
  },
  picPageContainer: {
    flex: 1,
    justifyContent: 'center',
    position: 'relative',
  },
  miniLyricContainer: {
    position: 'absolute',
    bottom: '6%',
    left: 0,
    right: 0,
  },
})
