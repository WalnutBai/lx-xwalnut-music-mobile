import { memo, useCallback, useState, useEffect, useRef, useMemo } from 'react'

import { View, TouchableOpacity, Animated } from 'react-native'
import { createStyle } from '@/utils/tools'
import Text from '@/components/common/Text'
import { SvgIcon } from '@/components/common/SvgIcon'
import { useTheme } from '@/store/theme/hook'
import { useSettingValue } from '@/store/setting/hook'
import settingAction from '@/store/setting/action'

interface Props {
  title: string
  children: React.ReactNode | React.ReactNode[]
  collapsible?: boolean
  sectionId?: keyof LX.AppSetting['common.sectionExpandedStatus']
}

export default memo(
  ({ title, children, collapsible = false, sectionId }: Props) => {
    const theme = useTheme()
    const expandedStatus = useSettingValue('common.sectionExpandedStatus')
    
    const initialExpanded = sectionId ? (expandedStatus[sectionId] ?? true) : true
    
    const rotateAnimRef = useRef(new Animated.Value(initialExpanded ? 0 : 1))
    const rotateInterpolate = useMemo(() => 
      rotateAnimRef.current.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '180deg'],
      }),
    []
    )
    
    const isInitializedRef = useRef(false)
    
    const [expanded, setExpanded] = useState(initialExpanded)
    
    useEffect(() => {
      if (!sectionId) return
      if (isInitializedRef.current) return
      isInitializedRef.current = true
      const storedValue = expandedStatus[sectionId] ?? true
      if (storedValue !== expanded) {
        setExpanded(storedValue)
      }
    }, [sectionId])

    useEffect(() => {
      if (!collapsible) return
      Animated.spring(rotateAnimRef.current, {
        toValue: expanded ? 0 : 1,
        useNativeDriver: true,
        friction: 7,
        tension: 40,
      }).start()
    }, [expanded, collapsible])

    const toggleExpanded = useCallback(() => {
      if (!sectionId) return
      const newExpanded = !expanded
      setExpanded(newExpanded)
      const newStatus = { ...expandedStatus, [sectionId]: newExpanded }
      settingAction.updateSetting({ 'common.sectionExpandedStatus': newStatus })
    }, [expandedStatus, sectionId, expanded])

    if (!collapsible) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>{title}</Text>
          {children}
        </View>
      )
    }

    return (
      <View style={styles.container}>
        <TouchableOpacity style={styles.titleRow} onPress={toggleExpanded} activeOpacity={0.7}>
          <Text style={styles.title}>{title}</Text>
          <View style={styles.iconContainer}>
            <Animated.View style={{ transform: [{ rotate: rotateInterpolate }] }}>
              <SvgIcon 
                name="collapse" 
                size={16} 
                color={theme['c-font-label']} 
              />
            </Animated.View>
          </View>
        </TouchableOpacity>
        {expanded ? children : null}
      </View>
    )
  }
)

const styles = createStyle({
  container: {
    paddingLeft: 25,
    marginBottom: 18,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  title: {
    marginLeft: -10,
    marginBottom: 10,
    flex: 1,
  },
  iconContainer: {
    paddingHorizontal: 8,
  },
})