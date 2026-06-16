/**
 * QQ音乐歌单列表项 - 复刻网易云"我的歌单"列表项
 */

import { memo, useRef } from 'react'
import { View, TouchableOpacity, StyleSheet } from 'react-native'
import Image from '@/components/common/Image'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { Icon } from '@/components/common/Icon'
import type { Position } from '@/components/common/Menu'

interface PlaylistItem {
  id: string
  name: string
  cover: string
  songCount: number
  desc?: string
  isFavorites?: boolean
  isCollected?: boolean
  dirid?: number
}

interface ListItemProps {
  item: PlaylistItem
  onPress: (item: PlaylistItem) => void
  onMenuPress: (item: PlaylistItem, position: Position) => void
}

export default memo(({ item, onPress, onMenuPress }: ListItemProps) => {
  const theme = useTheme()
  const menuBtnRef = useRef<TouchableOpacity>(null)

  const handleMenuPress = () => {
    menuBtnRef.current?.measure((fx, fy, width, height, px, py) => {
      const position = { x: Math.ceil(px), y: Math.ceil(py), w: Math.ceil(width), h: Math.ceil(height) }
      onMenuPress(item, position)
    })
  }

  const showMenu = !(item.isFavorites || item.isCollected)

  return (
    <TouchableOpacity
      style={[styles.container, { borderBottomColor: theme['c-list-header-border-bottom'] }]}
      onPress={() => onPress(item)}
    >
      <View style={styles.coverContainer}>
        <Image url={item.cover} style={styles.cover} />
        {item.isFavorites && (
          <View style={styles.favoritesOverlay}>
            <Icon name="love-filled" color="white" size={32} />
          </View>
        )}
      </View>

      <View style={styles.info}>
        <Text size={16} numberOfLines={2}>{item.name}</Text>
        {item.songCount > 0 ? (
          <Text size={12} color={theme['c-font-label']} style={{ marginTop: 4 }}>
            {item.songCount} 首
          </Text>
        ) : null}
      </View>

      {showMenu && (
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

const styles = StyleSheet.create({
  container: {
    height: 90,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    borderBottomWidth: 1,
  },
  coverContainer: {
    position: 'relative',
    marginRight: 15,
  },
  cover: {
    width: 70,
    height: 70,
    borderRadius: 8,
  },
  favoritesOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 8,
  },
  info: {
    flex: 1,
  },
  menuButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },
})
