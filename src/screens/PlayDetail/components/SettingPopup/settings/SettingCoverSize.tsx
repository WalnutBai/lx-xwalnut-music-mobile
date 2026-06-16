import { useState } from 'react'

import { View } from 'react-native'
import { useTheme } from '@/store/theme/hook'
import Text from '@/components/common/Text'
import { useSettingValue } from '@/store/setting/hook'
import Slider, { type SliderProps } from '@/components/common/Slider'
import { updateSetting } from '@/core/common'
import { useI18n } from '@/lang'
import styles from './style'

const CoverSize = () => {
  const theme = useTheme()
  const coverSize = useSettingValue('playDetail.style.coverSize')
  const [sliderSize, setSliderSize] = useState(coverSize)
  const [isSliding, setSliding] = useState(false)
  const t = useI18n()

  const handleSlidingStart: SliderProps['onSlidingStart'] = (value) => {
    setSliding(true)
  }
  const handleValueChange: SliderProps['onValueChange'] = (value) => {
    setSliderSize(value)
  }
  const handleSlidingComplete: SliderProps['onSlidingComplete'] = (value) => {
    setSliding(false)
    if (coverSize == value) return
    updateSetting({ 'playDetail.style.coverSize': value })
  }

  return (
    <View style={styles.container}>
      <Text>{t('play_detail_setting_cover_size')}</Text>
      <View style={styles.content}>
        <Text style={styles.label} color={theme['c-font-label']}>
          {isSliding ? sliderSize : coverSize}%
        </Text>
        <Slider
          minimumValue={50}
          maximumValue={150}
          onSlidingComplete={handleSlidingComplete}
          onValueChange={handleValueChange}
          onSlidingStart={handleSlidingStart}
          step={2}
          value={coverSize}
        />
      </View>
    </View>
  )
}

export default CoverSize