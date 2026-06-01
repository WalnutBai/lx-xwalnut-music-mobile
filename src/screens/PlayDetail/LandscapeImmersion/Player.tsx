import { memo } from 'react'
import { View, TouchableOpacity } from 'react-native'
import Progress from '@/components/player/ProgressBar'
import { useProgress, useIsPlay } from '@/store/player/hook'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import Text from '@/components/common/Text'
import { useBufferProgress } from '@/plugins/player'
import { Icon } from '@/components/common/Icon'
import { playNext, playPrev, togglePlay } from '@/core/player/player'

const ControlBtn = memo(() => {
  const theme = useTheme()
  const isPlay = useIsPlay()

  return (
    <View style={styles.controlBtn}>
      <TouchableOpacity onPress={playPrev} style={styles.btn}>
        <Icon name="prevMusic" size={24} color={theme['c-primary-font-active']} />
      </TouchableOpacity>
      <TouchableOpacity onPress={togglePlay} style={[styles.btn, styles.playBtn]}>
        <Icon name={isPlay ? 'pause' : 'play'} size={30} color={theme['c-primary-font-active']} />
      </TouchableOpacity>
      <TouchableOpacity onPress={playNext} style={styles.btn}>
        <Icon name="nextMusic" size={24} color={theme['c-primary-font-active']} />
      </TouchableOpacity>
    </View>
  )
})

export default memo(() => {
  const { maxPlayTimeStr, nowPlayTimeStr, progress, maxPlayTime } = useProgress()
  const buffered = useBufferProgress()
  const theme = useTheme()

  return (
    <View style={styles.container}>
      <View style={styles.progressContainer}>
        <Text style={styles.timeText} color={theme['c-400']}>{nowPlayTimeStr}</Text>
        <View style={styles.progress}>
          <Progress progress={progress} duration={maxPlayTime} buffered={buffered} />
        </View>
        <Text style={styles.timeText} color={theme['c-400']}>{maxPlayTimeStr}</Text>
      </View>
      <ControlBtn />
    </View>
  )
})

const styles = createStyle({
  container: {
    width: '100%',
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  progress: {
    flex: 1,
    marginHorizontal: 10,
  },
  timeText: {
    fontSize: 12,
    width: 45,
    textAlign: 'center',
  },
  controlBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  btn: {
    padding: 10,
    marginHorizontal: 20,
  },
  playBtn: {
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
})
