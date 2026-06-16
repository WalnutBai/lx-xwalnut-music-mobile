import { updateSetting } from '@/core/common'
import { useI18n } from '@/lang'
import { createStyle } from '@/utils/tools'
import { memo } from 'react'
import { View } from 'react-native'
import { useSettingValue } from '@/store/setting/hook'

import CheckBoxItem from '../../components/CheckBoxItem'

export default memo(() => {
  const t = useI18n()
  const bilibiliMultiPage = useSettingValue('common.bilibili_multi_page')
  const handleUpdate = (bilibiliMultiPage: boolean) => {
    updateSetting({ 'common.bilibili_multi_page': bilibiliMultiPage })
  }

  return (
    <View style={styles.content}>
      <CheckBoxItem
        check={bilibiliMultiPage}
        onChange={handleUpdate}
        label={t('setting_common_bilibili_multi_page')}
      />
    </View>
  )
})

const styles = createStyle({
  content: {
    marginTop: 5,
    marginBottom: 15,
  },
})
