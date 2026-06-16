import { memo } from 'react';
import InputItem, { type InputItemProps } from '../../components/InputItem';
import { useSettingValue } from '@/store/setting/hook';
import { updateSetting } from '@/core/common';

export default memo(() => {
  const serpApiKey = useSettingValue('common.wy_serpapi_key');

  const handleSerpApiKeyChanged: InputItemProps['onChanged'] = (text, callback) => {
    callback(text);
    updateSetting({ 'common.wy_serpapi_key': text.trim() });
  };

  return (
    <InputItem
      value={serpApiKey}
      label="SerpApi API Key"
      onChanged={handleSerpApiKeyChanged}
      placeholder="用于网易云搜索补充 Google 搜索结果"
    />
  );
});