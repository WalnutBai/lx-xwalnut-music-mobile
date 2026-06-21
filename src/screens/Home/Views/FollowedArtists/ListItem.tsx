import { memo, useState } from 'react'
import {View, TouchableOpacity, Animated} from 'react-native'
import Image from '@/components/common/Image'
import Text from '@/components/common/Text'
import Button from '@/components/common/Button'
import { useTheme } from '@/store/theme/hook'
import {createStyle, toast} from '@/utils/tools'
import { navigations } from '@/navigation'
import commonState from '@/store/common/state'
import { Icon } from '@/components/common/Icon'
import event = Animated.event;
import wyApi from '@/utils/musicSdk/wy/user'
import { useIsWyArtistFollowed } from '@/store/user/hook'
import { addWyFollowedArtist, removeWyFollowedArtist } from '@/store/user/action'
import {FollowedArtistInfo} from "@/store/user/state.ts";
import { log } from '@/utils/log'

export default memo(({ artist, showFollowButton = false }: { artist: any, showFollowButton?: boolean }) => {
  const theme = useTheme()
  const isFollowed = useIsWyArtistFollowed(artist.id)

  const handleFollow = (event) => {
    event.stopPropagation()
    const newFollowState = !isFollowed
    wyApi.followSinger(String(artist.id), newFollowState).then(() => {
      toast(newFollowState ? '关注成功' : '取消关注成功')
      if (newFollowState) {
        const artistInfoForStore: FollowedArtistInfo = {
          id: artist.id,
          name: artist.name,
          alias: artist.alias ? artist.alias[0] : null,
          albumSize: artist.albumSize,
          picUrl: artist.picUrl,
          img1v1Url: artist.picUrl,
        }
        addWyFollowedArtist(artistInfoForStore)
      } else {
        removeWyFollowedArtist(artist.id)
      }
    }).catch(err => {
      toast(`操作失败: ${err.message}，可能是Cookie已失效，请重新登录`)
    })
  }

  const handlePress = () => {
    log.info('[FollowedArtists/ListItem] === 点击歌手 ===', {
      artistId: artist.id,
      artistMid: artist.mid,
      artistName: artist.name,
      artistSource: artist.source,
      albumSize: artist.albumSize,
      songNum: artist.songNum,
      timestamp: new Date().toISOString(),
    })
    navigations.pushArtistDetailScreen(commonState.componentIds[commonState.componentIds.length - 1]?.id, { 
      id: String(artist.id),
      mid: String(artist.mid),
      name: artist.name,
      picUrl: artist.picUrl,
      source: artist.source,
    });
    log.info('[FollowedArtists/ListItem] === 跳转请求已发送 ===', {
      artistId: artist.id,
      artistMid: artist.mid,
      artistSource: artist.source,
    })
  }
  const alias = artist.alias && artist.alias.length ? ` ${artist.alias[0]}` : ''

  return (
    <TouchableOpacity style={styles.container} onPress={handlePress}>
      {artist.picUrl || artist.img1v1Url ? (
        <Image url={artist.picUrl || artist.img1v1Url} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.avatarPlaceholder]}>
          <Icon name="artist" size={30} color={theme['c-font-label']} />
        </View>
      )}
      <View style={styles.info}>
        <Text size={16} numberOfLines={1}>
          {artist.name}
          {alias ? <Text size={12} color={theme['c-font-label']}>{alias}</Text> : null}
        </Text>
        <Text size={12} color={theme['c-font-label']}>
          {artist.source === 'tx'
            ? `歌曲: ${artist.songNum || 0}  专辑: ${artist.albumSize || 0}`
            : artist.source === 'kg'
              ? `歌曲: ${artist.songNum || 0}  专辑: ${artist.albumSize || 0}`
              : `专辑: ${artist.albumSize}`}
        </Text>
      </View>
      {showFollowButton && artist.source !== 'tx' && artist.source !== 'kg' && (
        <TouchableOpacity style={styles.followButton} onPress={handleFollow}>
          <Icon name={isFollowed ? 'love-filled' : 'love'} color={isFollowed ? theme['c-liked'] : theme['c-font-label']} size={20} />
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
  avatar: {
    width: 70,
    height: 70,
    borderRadius: 50,
  },
  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  info: {
    flex: 1,
    marginLeft: 15,
  },
  followButton: {
    paddingHorizontal: 15,
    paddingVertical: 6,
    borderRadius: 15,
  },
})
