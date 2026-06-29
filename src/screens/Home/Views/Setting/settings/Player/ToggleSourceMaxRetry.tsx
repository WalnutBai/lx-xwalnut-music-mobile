import { memo, useMemo } from 'react'
import { View } from 'react-native'

import InputItem, { type InputItemProps } from '../../components/InputItem'
import { createStyle, toast } from '@/utils/tools'
import { useSettingValue } from '@/store/setting/hook'
import { useI18n } from '@/lang'
import { updateSetting } from '@/core/common'

const MAX_RETRY = 10
export default memo(() => {
  const t = useI18n()
  const isEnableAutoToggleSource = useSettingValue('player.enableAutoToggleSource')
  const toggleSourceMaxRetry = useSettingValue('player.toggleSourceMaxRetry')
  const setToggleSourceMaxRetry = (retry: string) => {
    updateSetting({ 'player.toggleSourceMaxRetry': retry })
  }

  const retry = useMemo(() => {
    let size: number | string = parseInt(toggleSourceMaxRetry)
    if (size == 0 || Number.isNaN(size)) size = ''
    return size.toString()
  }, [toggleSourceMaxRetry])

  const setRetry: InputItemProps['onChanged'] = (value, callback) => {
    let size: number | string = parseInt(value)
    if (Number.isNaN(size) || size < 0) size = ''
    else if (size > MAX_RETRY) size = MAX_RETRY
    size = size.toString()
    callback(size)
    if (toggleSourceMaxRetry == size) return
    setToggleSourceMaxRetry(size)
    toast(t('setting_play_toggle_source_max_retry_tip'))
  }

  return (
    <View style={styles.content}>
      <InputItem
        value={retry}
        label={t('setting_play_toggle_source_max_retry')}
        onChanged={setRetry}
        keyboardType="number-pad"
        editable={isEnableAutoToggleSource}
        style={isEnableAutoToggleSource ? undefined : styles.disabled}
      />
    </View>
  )
})

const styles = createStyle({
  content: {
    marginTop: 10,
  },
  disabled: {
    opacity: 0.5,
  },
})
