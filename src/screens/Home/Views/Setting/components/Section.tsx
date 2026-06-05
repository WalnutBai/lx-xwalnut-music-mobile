import { View } from 'react-native'

import { createStyle } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import { useSettingValue } from '@/store/setting/hook'
import Text from '@/components/common/Text'
import { scaleSizeH } from '@/utils/pixelRatio'

interface Props {
  title: string
  children: React.ReactNode | React.ReactNode[]
}

const adjustColorOpacity = (color: string, opacity: number) => {
  // 解析颜色值
  const rgbaMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/)
  if (rgbaMatch) {
    const r = parseInt(rgbaMatch[1])
    const g = parseInt(rgbaMatch[2])
    const b = parseInt(rgbaMatch[3])
    return `rgba(${r}, ${g}, ${b}, ${opacity / 100})`
  }
  
  // 如果是 rgb 格式，添加透明度
  const rgbMatch = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1])
    const g = parseInt(rgbMatch[2])
    const b = parseInt(rgbMatch[3])
    return `rgba(${r}, ${g}, ${b}, ${opacity / 100})`
  }
  
  // 如果是十六进制格式，转换为 rgba
  const hexMatch = color.match(/#([0-9a-fA-F]{3})([0-9a-fA-F]{3})?/)
  if (hexMatch) {
    let r, g, b
    if (hexMatch[2]) {
      r = parseInt(hexMatch[1].slice(0, 2), 16)
      g = parseInt(hexMatch[1].slice(2, 4), 16)
      b = parseInt(hexMatch[1].slice(4, 6), 16)
    } else {
      r = parseInt(hexMatch[1][0] + hexMatch[1][0], 16)
      g = parseInt(hexMatch[1][1] + hexMatch[1][1], 16)
      b = parseInt(hexMatch[1][2] + hexMatch[1][2], 16)
    }
    return `rgba(${r}, ${g}, ${b}, ${opacity / 100})`
  }
  
  // 无法解析，使用原颜色
  return color
}

export default ({ title, children }: Props) => {
  const theme = useTheme()
  const sectionOpacity = useSettingValue('theme.sectionOpacity')

  return (
    <View style={styles.container}>
      <View style={{ ...styles.contentContainer, backgroundColor: adjustColorOpacity(theme['c-main-background'], sectionOpacity) }}>
        <Text style={{ ...styles.title, borderLeftColor: theme['c-primary'] }} size={16}>
          {title}
        </Text>
        <View>{children}</View>
      </View>
    </View>
  )
}

const styles = createStyle({
  container: {
    marginBottom: scaleSizeH(12),
  },
  contentContainer: {
    borderRadius: scaleSizeH(16),
    paddingHorizontal: scaleSizeH(12),
    paddingVertical: scaleSizeH(14),
    overflow: 'hidden',
  },
  title: {
    borderLeftWidth: 5,
    paddingLeft: 12,
    marginBottom: 14,
    fontWeight: '600',
  },
})
