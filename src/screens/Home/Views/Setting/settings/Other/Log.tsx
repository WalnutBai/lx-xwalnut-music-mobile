import { memo, useRef, useState, useEffect } from 'react'
import { View, Clipboard, Text as RNText, ScrollView, Dimensions } from 'react-native'
import { getLogs, clearLogs } from '@/utils/log'

import SubTitle from '../../components/SubTitle'
import Button from '../../components/Button'
import InputItem from '../../components/InputItem'
import { createStyle, toast } from '@/utils/tools'
import LogConfirmAlert, { type LogConfirmAlertType } from '@/components/common/LogConfirmAlert'
import CheckBoxItem from '../../components/CheckBoxItem'
import { useI18n } from '@/lang'
import Text from '@/components/common/Text'
import settingState from '@/store/setting/state'
import { updateSetting } from '@/core/common'
import { searchLog } from '@/utils/searchLog'
import { playerLog } from '@/utils/playerLog'

const DEFAULT_MAX_LOG_LINES = 2000
const LIST_MAX_HEIGHT = Dimensions.get('window').height * 0.5

export default memo(() => {
  const t = useI18n()
  const alertRef = useRef<LogConfirmAlertType>(null)
  const [logLines, setLogLines] = useState<string[]>([])
  const [isTruncated, setIsTruncated] = useState(false)
  const isUnmountedRef = useRef(true)
  
  const [isEnableLog, setIsEnableLog] = useState(settingState.setting['common.isEnableLog'])
  const [isEnableSyncErrorLog, setIsEnableSyncErrorLog] = useState(settingState.setting['common.isEnableSyncLog'])
  const [isEnableUserApiLog, setIsEnableUserApiLog] = useState(settingState.setting['common.isEnableUserApiLog'])
  const [isEnableWebDAVLog, setIsEnableWebDAVLog] = useState(settingState.setting['common.isEnableWebDAVLog'])
  const [isEnableSearchLog, setIsEnableSearchLog] = useState(settingState.setting['common.isEnableSearchLog'])
  const [isEnablePlayerLog, setIsEnablePlayerLog] = useState(settingState.setting['common.isEnablePlayerLog'])
  const [maxLogLines, setMaxLogLines] = useState(DEFAULT_MAX_LOG_LINES)

  const copyToClipboard = async (text: string) => {
    try {
      await Clipboard.setString(text)
      toast(t('setting_other_log_tip_copy_success'))
    } catch {
      toast(t('setting_other_log_tip_copy_failed'))
    }
  }

  const handleCopyAll = () => {
    copyToClipboard(logLines.join('\n\n'))
  }

  const getErrorLog = () => {
    void getLogs().then((log) => {
      if (isUnmountedRef.current) return
      const logArr = log.split(/^----lx log----\n|\n----lx log----\n|\n----lx log----$/)
      logArr.reverse()
      const filtered = logArr.filter(line => line.trim())
      if (filtered.length > maxLogLines) {
        setIsTruncated(true)
        setLogLines(filtered.slice(0, maxLogLines))
      } else {
        setIsTruncated(false)
        setLogLines(filtered)
      }
    })
  }

  const renderLogItem = (item: string, index: number) => (
    <RNText key={index} selectable={true} style={{ fontSize: 13, lineHeight: 18, paddingVertical: 4 }}>
      {item}
    </RNText>
  )

  const openLogModal = () => {
    getErrorLog()
    alertRef.current?.setVisible(true)
  }

  const handleMaxLogLinesChange = (text: string, callback: (value: string) => void) => {
    const num = parseInt(text, 10)
    if (!isNaN(num) && num > 0) {
      setMaxLogLines(num)
      callback(String(num))
    } else {
      callback(String(DEFAULT_MAX_LOG_LINES))
      setMaxLogLines(DEFAULT_MAX_LOG_LINES)
    }
  }

  const handleCleanLog = () => {
    void clearLogs().then(() => {
      toast(t('setting_other_log_tip_clean_success'))
      getErrorLog()
    })
  }

  const handleSetEnableLog = (enable: boolean) => {
    setIsEnableLog(enable)
    global.lx.isEnableLog = enable
    updateSetting({ 'common.isEnableLog': enable })
  }

  const handleSetEnableSyncErrorLog = (enable: boolean) => {
    setIsEnableSyncErrorLog(enable)
    global.lx.isEnableSyncLog = enable
    updateSetting({ 'common.isEnableSyncLog': enable })
  }

  const handleSetEnableUserApiLog = (enable: boolean) => {
    setIsEnableUserApiLog(enable)
    global.lx.isEnableUserApiLog = enable
    updateSetting({ 'common.isEnableUserApiLog': enable })
  }

  const handleSetEnableWebDAVLog = (enable: boolean) => {
    setIsEnableWebDAVLog(enable)
    updateSetting({ 'common.isEnableWebDAVLog': enable })
  }

  const handleSetEnableSearchLog = (enable: boolean) => {
    setIsEnableSearchLog(enable)
    updateSetting({ 'common.isEnableSearchLog': enable })
    searchLog.updateEnabled(enable)
  }

  const handleSetEnablePlayerLog = (enable: boolean) => {
    setIsEnablePlayerLog(enable)
    updateSetting({ 'common.isEnablePlayerLog': enable })
    playerLog.updateEnabled(enable)
  }

  useEffect(() => {
    isUnmountedRef.current = false
    return () => {
      isUnmountedRef.current = true
    }
  }, [])

  return (
    <>
      <SubTitle title={t('setting_other_log')}>
        <View style={styles.checkBox}>
          <CheckBoxItem
            check={isEnableLog}
            label={t('setting_other_log_enable_all')}
            onChange={handleSetEnableLog}
          />
          <CheckBoxItem
            check={isEnableSyncErrorLog}
            label={t('setting_other_log_sync_log')}
            onChange={handleSetEnableSyncErrorLog}
            disabled={!isEnableLog}
          />
          <CheckBoxItem
            check={isEnableUserApiLog}
            label={t('setting_other_log_user_api_log')}
            onChange={handleSetEnableUserApiLog}
            disabled={!isEnableLog}
          />
          <CheckBoxItem
            check={isEnableWebDAVLog}
            label={t('setting_other_log_webdav_log')}
            onChange={handleSetEnableWebDAVLog}
            disabled={!isEnableLog}
          />
          <CheckBoxItem
            check={isEnableSearchLog}
            label={t('setting_other_log_search_log')}
            onChange={handleSetEnableSearchLog}
            disabled={!isEnableLog}
          />
          <CheckBoxItem
            check={isEnablePlayerLog}
            label={t('setting_other_log_player_log')}
            onChange={handleSetEnablePlayerLog}
            disabled={!isEnableLog}
          />
        </View>
        <View style={{ marginLeft: -25 }}>
          <InputItem
            label={t('setting_other_log_max_lines')}
            value={String(maxLogLines)}
            onChanged={handleMaxLogLinesChange}
            keyboardType="number-pad"
          />
        </View>
        <View style={styles.btn}>
          <Button onPress={openLogModal}>{t('setting_other_log_btn_show')}</Button>
        </View>
      </SubTitle>
      <LogConfirmAlert
        ref={alertRef}
        cancelText={t('setting_other_log_btn_hide')}
        confirmText={t('setting_other_log_btn_clean')}
        onConfirm={handleCleanLog}
        showConfirm={logLines.length > 0}
        reverseBtn={true}
        middleText={t('setting_other_log_btn_copy_all')}
        onMiddle={handleCopyAll}
        showMiddle={logLines.length > 0}
      >
        <View style={styles.renameContent}>
          {logLines.length > 0 ? (
            <>
              {isTruncated ? (
                <Text style={{ color: 'orange', paddingVertical: 4 }} size={13}>
                  {t('setting_other_log_tip_truncated', { num: maxLogLines })}
                </Text>
              ) : null}
              {logLines.map((item, index) => renderLogItem(item, index))}
            </>
          ) : (
            <Text size={13}>{t('setting_other_log_tip_null')}</Text>
          )}
        </View>
      </LogConfirmAlert>
    </>
  )
})

const styles = createStyle({
  checkBox: {
    paddingBottom: 15,
    marginLeft: -25,
  },
  btn: {
    flexDirection: 'row',
  },
  renameContent: {
    flexGrow: 1,
    flexShrink: 1,
    flexDirection: 'column',
  },
})
