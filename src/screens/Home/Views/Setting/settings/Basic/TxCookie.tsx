import { useSettingValue } from '@/store/setting/hook';
import { updateSetting } from '@/core/common';
import InputItem from '../../components/InputItem';
import { createStyle, toast } from '@/utils/tools';
import { memo, useCallback, useEffect } from 'react';
import { View } from 'react-native';
import { useI18n } from '@/lang';

export default memo(() => {
  const t = useI18n();
  const txCookie = useSettingValue('common.tx_cookie');

  const handleTxCookieChanged = useCallback(
    (text: string) => {
      updateSetting({ 'common.tx_cookie': text });
      if (text && text.length > 50) {
        toast(t('setting_basic_tx_cookie') + ' ' + t('saved'));
      }
    },
    [t],
  );

  useEffect(() => {
    const handleCookieSet = (cookie: string) => {
      updateSetting({ 'common.tx_cookie': cookie });
    };

    global.app_event.on('tx-cookie-set', handleCookieSet);
    return () => {
      global.app_event.off('tx-cookie-set', handleCookieSet);
    };
  }, []);

  return (
    <View style={styles.content}>
      <InputItem
        value={txCookie}
        label={t('setting_basic_tx_cookie')}
        onChanged={handleTxCookieChanged}
        placeholder={t('setting_basic_tx_cookie_placeholder')}
      />
    </View>
  );
});

const styles = createStyle({
  content: {
    // marginTop: 10,
  },
});
