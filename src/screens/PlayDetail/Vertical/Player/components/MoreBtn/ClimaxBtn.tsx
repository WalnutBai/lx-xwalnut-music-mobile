import { memo, useState, useEffect, useCallback, useRef } from 'react'
import { Alert, TouchableOpacity, View } from 'react-native'
import { getClimax, formatTime, type ClimaxInfo } from '@/utils/musicSdk/kg/climax'
import playerState from '@/store/player/state'
import { useTheme } from '@/store/theme/hook'
import { SvgIcon } from '@/components/common/SvgIcon'
import { scaleSizeW } from '@/utils/pixelRatio'
import { createStyle } from '@/utils/tools'

const BTN_SIZE = scaleSizeW(36)
const ICON_SIZE = scaleSizeW(24)

export default memo(() => {
  const theme = useTheme()
  const [climaxInfo, setClimaxInfo] = useState<ClimaxInfo | null>(null)
  const iconColor = theme.isDark ? theme['c-font'] : theme['c-primary']

  // 自动加载高潮数据（仅酷狗源）
  useEffect(() => {
    const musicInfo = playerState.playMusicInfo.musicInfo
    if (!musicInfo || musicInfo.source !== 'kg') {
      return
    }
    
    const hash = 'hash' in musicInfo ? musicInfo.hash : (musicInfo as any).hash
    if (!hash) {
      console.log('[Climax] 无hash，跳过加载')
      return
    }
    
    console.log('[Climax] 检测到酷狗源，自动加载高潮数据')
    getClimax(hash)
      .then(result => {
        console.log('[Climax] 加载结果:', result)
        setClimaxInfo(result)
      })
      .catch(err => {
        console.error('[Climax] 加载失败:', err)
      })
  }, [playerState.playMusicInfo.musicInfo?.hash, playerState.playMusicInfo.musicInfo?.source])

  // 高潮按钮点击处理
  const handleClimaxPress = useCallback(() => {
    if (!climaxInfo) {
      console.log('[Climax] 无高潮数据')
      return
    }
    
    const beginTime = formatTime(climaxInfo.begin)
    const endTime = formatTime(climaxInfo.end)
    const duration = formatTime(climaxInfo.duration)
    
    Alert.alert(
      '歌曲高潮部分',
      `开始时间: ${beginTime}\n结束时间: ${endTime}\n持续时长: ${duration}`,
      [{ text: '我知道了' }]
    )
  }, [climaxInfo])

  // 没有高潮数据时不显示
  if (!climaxInfo) {
    return null
  }

  return (
    <TouchableOpacity style={styles.btn} onPress={handleClimaxPress} activeOpacity={0.6}>
      <SvgIcon name="heartbeat" color={theme['c-danger']} size={ICON_SIZE * 0.9} />
    </TouchableOpacity>
  )
})

const styles = createStyle({
  btn: {
    width: BTN_SIZE,
    height: BTN_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 5,
  },
})
