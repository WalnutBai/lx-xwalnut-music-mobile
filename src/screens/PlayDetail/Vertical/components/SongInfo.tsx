import { memo, useCallback } from 'react'
import { View, TouchableOpacity } from 'react-native'
import { usePlayMusicInfo } from '@/store/player/hook'
import { useTheme } from '@/store/theme/hook'
import { navigations } from '@/navigation'
import commonState from '@/store/common/state'
import { createStyle, toast, clipboardWriteText } from '@/utils/tools'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import { handleLikeMusic, handleTxLikeMusic, handleKgLikeMusic } from '@/components/OnlineList/listAction'
import playerState from '@/store/player/state'
import { useIsWyLiked, useIsTxLiked, useIsKgLiked } from '@/store/user/hook'
import { useWindowSize } from '@/utils/hooks'

export default memo(() => {
  const playMusicInfo = usePlayMusicInfo()
  const theme = useTheme()
  const { height: winHeight } = useWindowSize()
  const isSmallWindow = winHeight < 700
  const musicInfo = playMusicInfo.musicInfo ? ('progress' in playMusicInfo.musicInfo ? playMusicInfo.musicInfo.metadata.musicInfo : playMusicInfo.musicInfo) : null

  const handleArtistPress = (artist: { id: string | number; name: string }) => {
    if (!musicInfo || musicInfo.source !== 'wy' || !artist.id) return
    navigations.pushArtistDetailScreen(commonState.componentIds[commonState.componentIds.length - 1]?.id!, { id: String(artist.id), name: artist.name })
  }

  const handleAlbumPress = () => {
    if (!musicInfo) return
    if (musicInfo.source !== 'wy' && musicInfo.source !== 'tx') return
    const albumId = (musicInfo.meta as any)?.albumId || musicInfo.albumId
    const albumName = musicInfo.meta?.albumName || musicInfo.albumName
    const albumMid = (musicInfo.meta as any)?.albumMid || musicInfo.albumMid || albumId
    if (!albumId || !albumName) return
    if (musicInfo.source === 'wy') {
      navigations.pushAlbumDetailScreen(commonState.componentIds[commonState.componentIds.length - 1]?.id!, { id: String(albumId), name: albumName, source: musicInfo.source })
    } else if (musicInfo.source === 'tx') {
      navigations.pushAlbumDetailScreen(commonState.componentIds[commonState.componentIds.length - 1]?.id!, { id: String(albumId), mid: albumMid, name: albumName, source: 'tx' })
    }
  }

  const handleLikePress = useCallback(() => {
    const info = playerState.playMusicInfo.musicInfo
    if (!info) return
    const musicInfo = 'progress' in info ? info.metadata.musicInfo : info
    if (musicInfo.source === 'wy') {
      handleLikeMusic(musicInfo as LX.Music.MusicInfoOnline)
    } else if (musicInfo.source === 'tx') {
      handleTxLikeMusic(musicInfo as LX.Music.MusicInfoOnline)
    } else if (musicInfo.source === 'kg') {
      handleKgLikeMusic(musicInfo as LX.Music.MusicInfoOnline)
    }
  }, [])

  const songName = musicInfo?.name || ''
  const artistText = musicInfo?.singer || ''
  const albumName = musicInfo?.meta?.albumName || musicInfo?.albumName || ''

  const artists = musicInfo?.artists || []

  const wySongId = (musicInfo?.source === 'wy' && musicInfo.meta?.songId) || ''
  const isWyLiked = useIsWyLiked(wySongId)

  const txLikeKey = (() => {
    if (musicInfo?.source !== 'tx') return ''
    const rawSongMid = (musicInfo.meta as any)?.songmid || (musicInfo.meta as any)?.strMediaMid || musicInfo.id
    const songMid = typeof rawSongMid === 'string' && rawSongMid.startsWith('tx_') ? rawSongMid.slice(3) : rawSongMid
    const songId = (musicInfo.meta as any)?.id
    const isNumericId = songId && /^\d+$/.test(String(songId))
    return isNumericId ? String(songId) : songMid
  })()
  const isTxLiked = useIsTxLiked(txLikeKey)

  const kgSongId = (musicInfo?.source === 'kg' && musicInfo.meta?.songId) || ''
  const isKgLiked = useIsKgLiked(kgSongId)

  const isLiked = musicInfo?.source === 'wy' ? isWyLiked : musicInfo?.source === 'tx' ? isTxLiked : musicInfo?.source === 'kg' ? isKgLiked : false
  const showLikeBtn = musicInfo?.source === 'wy' || musicInfo?.source === 'tx' || musicInfo?.source === 'kg'

  const handleSongNamePress = useCallback(() => {
    const songInfo = `${songName} - ${artistText}`
    clipboardWriteText(songInfo)
    toast('已复制')
  }, [songName, artistText])

  return (
    <View style={[styles.container, isSmallWindow && { marginTop: 8, marginBottom: 4 }]}>
      <View style={styles.songNameRow}>
        <TouchableOpacity onPress={handleSongNamePress} activeOpacity={0.6} style={styles.songNameTouch}>
          <Text
            numberOfLines={1}
            size={28}
            bold
            color={theme['c-font']}
            style={styles.songName}
          >
            {songName}
          </Text>
        </TouchableOpacity>
        {showLikeBtn && (
          <TouchableOpacity onPress={handleLikePress} activeOpacity={0.6} style={styles.heartBtn}>
            <Icon name={isLiked ? 'love-filled' : 'love'} color={isLiked ? '#ff4d4f' : theme['c-font']} size={28} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.artistWrapper}>
        {artists.length > 0 ? (
          <View style={styles.artistRow}>
            {artists.map((artist, index) => (
              <TouchableOpacity key={artist.id || index} onPress={() => handleArtistPress(artist)}>
                <Text numberOfLines={1} size={16} color={theme['c-font-secondary']}>
                  {artist.name}
                  {index < artists.length - 1 ? '、' : ''}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <Text numberOfLines={1} size={16} color={theme['c-font-secondary']}>
            {artistText}
          </Text>
        )}
      </View>

      {albumName ? (
        <TouchableOpacity onPress={handleAlbumPress} disabled={musicInfo?.source !== 'wy' && musicInfo?.source !== 'tx'}>
          <Text numberOfLines={1} size={14} color={theme['c-font-secondary']}>
            {albumName}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  )
})

const styles = createStyle({
  container: {
    paddingHorizontal: 20,
    marginTop: 20,
    marginBottom: 10,
  },
  songNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  songNameTouch: {
    flex: 1,
  },
  songName: {
    flexShrink: 1,
  },
  heartBtn: {
    paddingHorizontal: 5,
  },
  artistWrapper: {
    marginBottom: 4,
  },
  artistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
})
