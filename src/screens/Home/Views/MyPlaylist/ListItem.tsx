import { memo, useRef } from 'react'
import { View, TouchableOpacity } from 'react-native'
import Image from '@/components/common/Image'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import { type ListInfoItem } from '@/store/songlist/state'
import { SvgIcon } from '@/components/common/SvgIcon'
import { Icon } from '@/components/common/Icon'
import type { Position } from '@/components/common/Menu'
import { useWyUid } from '@/store/user/hook.ts'

export default memo(({ item, onPress, onHeartbeatPress, onMenuPress }: { item: any, onPress: (info: ListInfoItem) => void, onHeartbeatPress?: (info: ListInfoItem) => void, onMenuPress?: (item: any, position: Position) => void }) => {
  const theme = useTheme()
  const uid = useWyUid()
  const menuBtnRef = useRef<TouchableOpacity>(null)

  const isCreator = String(item.userId) === String(uid)

  const handlePress = () => {
    const playlistInfo: ListInfoItem = {
      id: String(item.id),
      name: item.name,
      author: item.creator?.nickname,
      img: item.coverImgUrl,
      play_count: item.playCount,
      desc: item.description,
      source: 'wy',
      userId: item.userId,
      total: item.trackCount,
    }
    onPress(playlistInfo)
  }

  const handleHeartbeatPress = () => {
    const playlistInfo: ListInfoItem = {
      id: String(item.id),
      name: item.name,
      author: item.creator?.nickname,
      img: item.coverImgUrl,
      play_count: item.playCount,
      desc: item.description,
      source: 'wy',
      userId: item.userId,
      total: item.trackCount,
    }
    onHeartbeatPress?.(playlistInfo)
  }

  const handleMenuPress = () => {
    menuBtnRef.current?.measure((fx, fy, width, height, px, py) => {
      const position = { x: Math.ceil(px), y: Math.ceil(py), w: Math.ceil(width), h: Math.ceil(height) }
      onMenuPress?.(item, position)
    })
  }

  return (
    <TouchableOpacity style={styles.container} onPress={handlePress}>
      <Image url={item.coverImgUrl} style={styles.artwork} />
      <View style={styles.info}>
        <Text size={16} numberOfLines={2}>{item.name}</Text>
        {item.trackCount > 0 ? (
          <Text size={12} color={theme['c-font-label']}>{item.trackCount} 首</Text>
        ) : null}
      </View>
      {item.name.endsWith('喜欢的音乐') && onHeartbeatPress && (
        <TouchableOpacity style={styles.heartbeatBtn} onPress={(e) => {
          e.stopPropagation()
          handleHeartbeatPress()
        }}>
          <SvgIcon name="heartbeat" size={28} color={theme['c-primary']} />
        </TouchableOpacity>
      )}
      {isCreator && onMenuPress && !item.name.endsWith('喜欢的音乐') && (
        <TouchableOpacity
          ref={menuBtnRef}
          style={styles.menuButton}
          onPress={(e) => {
            e.stopPropagation()
            handleMenuPress()
          }}
        >
          <Icon name="dots-vertical" color={theme['c-font-label']} size={20} />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  )
})

const styles = createStyle({
  container: {
    height: 100,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  artwork: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  info: {
    flex: 1,
    marginLeft: 15,
  },
  heartbeatBtn: {
    padding: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },
})
