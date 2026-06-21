import { memo, useState, useMemo, useRef } from 'react'
import { View, TouchableOpacity, ScrollView } from 'react-native'
import ImageBackground from '@/components/common/ImageBackground'
import Image from '@/components/common/Image'
import ImagePreviewModal from '@/components/common/ImagePreviewModal'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { createStyle, toast } from '@/utils/tools'
import { useStatusbarHeight } from '@/store/common/hook'
import { Icon } from '@/components/common/Icon'
import wyApi from '@/utils/musicSdk/wy/user'
import { useIsWyArtistFollowed } from '@/store/user/hook'
import { addWyFollowedArtist, removeWyFollowedArtist } from '@/store/user/action'
import { type FollowedArtistInfo } from '@/store/user/state'
import SimilarArtistsModal, { type SimilarArtistsModalType } from './SimilarArtistsModal'

interface Props {
  artist: any
  onFollow?: () => void
  componentId: string
}

export default memo(({ artist, onFollow, componentId }: Props) => {
  const theme = useTheme()
  const statusBarHeight = useStatusbarHeight()
  const similarArtistsModalRef = useRef<SimilarArtistsModalType>(null)
  const [isDescExpanded, setDescExpanded] = useState(false)
  const [isPreviewVisible, setPreviewVisible] = useState(false)
  const isFollowed = useIsWyArtistFollowed(artist.id)

  const artistName = artist?.name || ''
  const artistAlias = artist?.alias?.length ? ` ${artist.alias[0]}` : ''
  const description = artist?.briefDesc || ''
  const artistPic = artist?.avatar || artist?.cover || artist?.picUrl

  const toggleFollow = () => {
    if (!artist.name) {
      toast('正在加载歌手信息，请稍后...')
      return
    }
    const newFollowState = !isFollowed
    wyApi.followSinger(String(artist.id), newFollowState).then(() => {
      toast(newFollowState ? '关注成功' : '取消关注成功')
      if (newFollowState) {
        const artistInfoForStore: FollowedArtistInfo = {
          id: artist.id,
          name: artist.name,
          alias: artist.alias || null,
          albumSize: artist.albumSize,
          picUrl: artist.avatar,
          img1v1Url: artist.avatar,
        }
        addWyFollowedArtist(artistInfoForStore)
      } else {
        removeWyFollowedArtist(artist.id)
      }
    }).catch((err: any) => {
      toast(`操作失败: ${err.message}，可能是Cookie已失效，请重新登录`)
    })
  }

  const truncatedDesc = useMemo(() => {
    if (!isDescExpanded && description.length > 75) {
      return description.substring(0, 75) + '...'
    }
    return description
  }, [description, isDescExpanded])

  return (
    <View style={{ paddingTop: statusBarHeight }}>
      <ImageBackground source={artist?.cover || artist?.picUrl ? { uri: artist.cover || artist?.picUrl } : null} style={styles.headerContainer} blurRadius={10}>
        <View style={styles.overlay}>
          <TouchableOpacity activeOpacity={0.85} disabled={!artistPic} onPress={() => setPreviewVisible(true)}>
            <Image url={artistPic} style={styles.avatar} />
          </TouchableOpacity>
          <View style={styles.infoContainer}>
            <Text style={styles.name} size={18} color="#FFF" numberOfLines={2}>
              {artistName}
              {artistAlias ? <Text size={12} color="rgba(255,255,255,0.8)">{artistAlias}</Text> : null}
            </Text>

            {!!description && (
              <View style={styles.descWrapper}>
                <ScrollView nestedScrollEnabled={true}>
                  <TouchableOpacity activeOpacity={0.8} onPress={() => setDescExpanded(!isDescExpanded)}>
                    <Text size={12} color="rgba(255,255,255,0.8)">
                      {truncatedDesc}
                    </Text>
                  </TouchableOpacity>
                </ScrollView>
              </View>
            )}

            {(artist.albumSize > 0 || artist.songNum > 0) && (
              <View style={styles.statsContainer}>
                {artist.songNum > 0 && (
                  <Text size={11} color="rgba(255,255,255,0.7)">歌曲: {artist.songNum}</Text>
                )}
                {artist.albumSize > 0 && (
                  <Text size={11} color="rgba(255,255,255,0.7)" style={{ marginLeft: artist.songNum > 0 ? 10 : 0 }}>专辑: {artist.albumSize}</Text>
                )}
              </View>
            )}

          </View>
          {artist?.source !== 'tx' && artist?.source !== 'kg' && (
            <TouchableOpacity style={styles.followButton} onPress={toggleFollow}>
              <Icon name={isFollowed ? 'love-filled' : 'love'} color={isFollowed ? theme['c-liked'] : '#fff'} size={18} />
            </TouchableOpacity>
          )}
          {artist?.source !== 'kg' && (
            <TouchableOpacity
              activeOpacity={0.82}
              style={styles.similarButton}
              onPress={() => similarArtistsModalRef.current?.show({ id: artist?.mid || artist?.id, name: artistName, source: artist?.source })}
            >
              <Text size={12} color="#fff" numberOfLines={1}>相似歌手</Text>
              <Icon name="chevron-right" color="#fff" size={12} />
            </TouchableOpacity>
          )}
        </View>
      </ImageBackground>
      <ImagePreviewModal
        visible={isPreviewVisible}
        url={artistPic}
        name={artistName || 'artist'}
        onClose={() => setPreviewVisible(false)}
      />
      <SimilarArtistsModal ref={similarArtistsModalRef} componentId={componentId} />
    </View>
  )
})

const styles = createStyle({
  headerContainer: {
    height: 200,
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  overlay: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  infoContainer: {
    flex: 1,
    marginLeft: 15,
    flexDirection: 'column',
    justifyContent: 'center',
    height: '100%',
  },
  name: {
    fontWeight: 'bold',
    marginBottom: 8,
  },
  descWrapper: {
    flexShrink: 1,
    maxHeight: 90,
  },
  statsContainer: {
    flexDirection: 'row',
    marginTop: 4,
  },
  followButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginLeft: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  similarButton: {
    position: 'absolute',
    right: 15,
    bottom: 12,
    minWidth: 82,
    height: 30,
    paddingHorizontal: 10,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.2)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
})
