import { updateSetting } from '@/core/common'
import { useI18n } from '@/lang'
import { createStyle } from '@/utils/tools'
import { memo } from 'react'
import { View } from 'react-native'
import { useSettingValue } from '@/store/setting/hook'

import CheckBoxItem from '../../components/CheckBoxItem'

export default memo(() => {
  const t = useI18n()
  const isEnableAutoToggleSource = useSettingValue('player.enableAutoToggleSource')
  const setEnableAutoToggleSource = (enableAutoToggleSource: boolean) => {
    updateSetting({ 'player.enableAutoToggleSource': enableAutoToggleSource })
  }

  return (
    <View style={styles.content}>
      <CheckBoxItem
        check={isEnableAutoToggleSource}
        onChange={setEnableAutoToggleSource}
        label={t('setting_play_enable_auto_toggle_source')}
        helpDesc={t('setting_play_enable_auto_toggle_source_tip')}
      />
    </View>
  )
})

const styles = createStyle({
  content: {
    marginTop: 5,
  },
})
