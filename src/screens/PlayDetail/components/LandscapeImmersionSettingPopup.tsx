import { forwardRef, useImperativeHandle, useRef, useState, useCallback, useMemo } from 'react'
import { View, StyleSheet, TouchableOpacity } from 'react-native'
import Popup, { type PopupType } from '@/components/common/Popup'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import { useSettingValue } from '@/store/setting/hook'
import Slider, { type SliderProps } from '@/components/common/Slider'
import { updateSetting, setIsLandscapeImmersion } from '@/core/common'
import Text from '@/components/common/Text'
import { createStyle } from '@/utils/tools'
import CheckBox from '@/components/common/CheckBox'

export interface LandscapeImmersionSettingPopupType {
  show: () => void
}

export default forwardRef<LandscapeImmersionSettingPopupType, {}>((props, ref) => {
  const [visible, setVisible] = useState(false)
  const popupRef = useRef<PopupType>(null)
  const t = useI18n()
  const theme = useTheme()

  const lrcFontSizeKey = 'playDetail.landscapeImmersion.style.lrcFontSize'
  const showControlKey = 'playDetail.landscapeImmersion.showControl'

const lrcAlignKey = 'playDetail.landscapeImmersion.style.lrcAlign'

  const lrcFontSize = useSettingValue(lrcFontSizeKey)
  const showControl = useSettingValue(showControlKey)
  const lrcAlign = useSettingValue(lrcAlignKey)

  const setLrcAlign = (align: typeof ALIGN_LIST[number]) => {
    if (lrcAlign == align) return
    updateSetting({ [lrcAlignKey]: align })
  }

  const ALIGN_LIST = useMemo(() => [
    { id: 'left', name: t('play_detail_setting_lrc_align_left') },
    { id: 'center', name: t('play_detail_setting_lrc_align_center') },
    { id: 'right', name: t('play_detail_setting_lrc_align_right') },
  ] as const, [t])

  const [sliderSize, setSliderSize] = useState(lrcFontSize)
  const [isSliding, setSliding] = useState(false)
  const [tempShowControl, setTempShowControl] = useState(showControl)

  useImperativeHandle(ref, () => ({
    show() {
      setSliderSize(lrcFontSize)
      setTempShowControl(showControl)
      if (visible) popupRef.current?.setVisible(true)
      else {
        setVisible(true)
        requestAnimationFrame(() => {
          popupRef.current?.setVisible(true)
        })
      }
    },
  }))

  const handleSlidingStart: SliderProps['onSlidingStart'] = () => {
    setSliding(true)
  }
  const handleValueChange: SliderProps['onValueChange'] = (value) => {
    updateSetting({ [lrcFontSizeKey]: value })
    setSliderSize(value)
  }
  const handleSlidingComplete: SliderProps['onSlidingComplete'] = (value) => {
    setSliding(false)
    setSliderSize(value)
  }

  const handleConfirm = useCallback(() => {
    popupRef.current?.setVisible(false)
    setIsLandscapeImmersion(true)
  }, [])

  const handleCancel = useCallback(() => {
    popupRef.current?.setVisible(false)
  }, [])

  return visible ? (
    <Popup ref={popupRef} title={t('landscape_immersion_setting_title')}>
      <View style={styles.container}>
        <View style={styles.group}>
          <Text style={styles.label}>{t('play_detail_setting_lrc_font_size')}</Text>
          <View style={styles.content}>
            <Text style={styles.value} color={theme['c-font-label']}>
              {isSliding ? sliderSize : lrcFontSize}
            </Text>
            <Slider
              minimumValue={100}
              maximumValue={500}
              onSlidingComplete={handleSlidingComplete}
              onValueChange={handleValueChange}
              onSlidingStart={handleSlidingStart}
              step={2}
              value={lrcFontSize}
            />
          </View>
        </View>

        <View style={styles.group}>
          <Text style={styles.label}>{t('play_detail_setting_lrc_align')}</Text>
          <View style={styles.content}>
            {ALIGN_LIST.map(({ id, name }) => (
              <CheckBox
                key={id}
                check={lrcAlign == id}
                label={name}
                onChange={() => { setLrcAlign(id) }}
              />
            ))}
          </View>
        </View>

        <View style={styles.group}>
          <CheckBox
            check={tempShowControl}
            label={t('landscape_immersion_setting_show_control')}
            onChange={setTempShowControl}
          />
        </View>

        <View style={styles.footer}>
          <TouchableOpacity style={[styles.btn, { backgroundColor: theme['c-button-background'] }]} onPress={handleCancel}>
            <Text color={theme['c-button-font']}>{t('cancel')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, { backgroundColor: theme['c-button-background'] }]} onPress={handleConfirm}>
            <Text color={theme['c-button-font']}>{t('confirm')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Popup>
  ) : null
})

const styles = createStyle({
  container: {
    padding: 15,
  },
  group: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    marginBottom: 10,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  value: {
    width: 40,
    fontSize: 12,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
  },
  btn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 4,
    marginLeft: 15,
  },
})
