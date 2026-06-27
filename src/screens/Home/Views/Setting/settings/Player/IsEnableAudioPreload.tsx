import { updateSetting } from '@/core/common'
import { useI18n } from '@/lang'
import { createStyle, toast } from '@/utils/tools'
import { memo } from 'react'
import { View } from 'react-native'
import { useSettingValue } from '@/store/setting/hook'

import CheckBoxItem from '../../components/CheckBoxItem'

export default memo(() => {
  const t = useI18n()
  const isEnableAudioPreload = useSettingValue('player.isEnableAudioPreload')
  const setIsEnableAudioPreload = (isEnableAudioPreload: boolean) => {
    updateSetting({ 'player.isEnableAudioPreload': isEnableAudioPreload })
    toast(t('setting_play_audio_preload_tip'))
  }

  return (
    <View style={styles.content}>
      <CheckBoxItem
        check={isEnableAudioPreload}
        onChange={setIsEnableAudioPreload}
        helpDesc={t('setting_play_audio_preload_desc')}
        label={t('setting_play_audio_preload')}
      />
    </View>
  )
})

const styles = createStyle({
  content: {
    marginTop: 5,
  },
})
