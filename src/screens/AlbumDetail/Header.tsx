import { memo, useState, useEffect } from 'react';
import { View, TouchableOpacity } from 'react-native';
import Image from '@/components/common/Image';
import ImagePreviewModal from '@/components/common/ImagePreviewModal';
import Text from '@/components/common/Text';
import { useTheme } from '@/store/theme/hook';
import { createStyle, toast } from '@/utils/tools';
import { dateFormat } from '@/utils/common';
import { useStatusbarHeight } from '@/store/common/hook';
import { Icon } from '@/components/common/Icon';
import { navigations } from '@/navigation';
import { useIsWyAlbumSubscribed } from '@/store/user/hook';
import wyApi from '@/utils/musicSdk/wy/user';
import { addWySubscribedAlbum, removeWySubscribedAlbum } from '@/store/user/action';
import { type SubscribedAlbumInfo } from '@/store/user/state';
import { log } from '@/utils/log';

interface Props {
  albumInfo: any
  componentId: string
}

export default memo(({ albumInfo, componentId }: Props) => {
  const theme = useTheme();
  const statusBarHeight = useStatusbarHeight();
  const isSubscribed = useIsWyAlbumSubscribed(albumInfo.id);
  const [isPreviewVisible, setPreviewVisible] = useState(false);
  const albumPic = albumInfo.picUrl || albumInfo.img;

  useEffect(() => {
    log.info('[AlbumDetail/Header] albumInfo更新', {
      albumId: albumInfo.id,
      publishTime: albumInfo.publishTime,
      publishTimeType: typeof albumInfo.publishTime,
      size: albumInfo.size,
      total: albumInfo.total,
    })
  }, [albumInfo.id, albumInfo.publishTime, albumInfo.size, albumInfo.total])

  const handleArtistPress = (artist: any) => {
    if (!artist.id && !artist.mid) return;
    navigations.pushArtistDetailScreen(componentId, { id: String(artist.id || artist.mid), mid: artist.mid || artist.id, name: artist.name, picUrl: artist.picUrl, source: albumInfo.source });
  };

  const toggleSubscribe = () => {
    if (!albumInfo.id) {
      toast('正在加载专辑信息，请稍后...');
      return;
    }
    const newSubState = !isSubscribed;
    wyApi.subAlbum(String(albumInfo.id), newSubState).then(() => {
      toast(newSubState ? '收藏成功' : '取消收藏成功');
      if (newSubState) {
        const albumInfoForStore: SubscribedAlbumInfo = {
          id: albumInfo.id,
          name: albumInfo.name,
          picUrl: albumInfo.picUrl,
          artists: albumInfo.artists,
          publishTime: albumInfo.publishTime,
          size: albumInfo.size,
        };
        addWySubscribedAlbum(albumInfoForStore);
      } else {
        removeWySubscribedAlbum(albumInfo.id);
      }
    }).catch((err: any) => {
      toast(`操作失败: ${err.message}，可能是Cookie已失效，请重新登录`);
    });
  };


  const artists = albumInfo.artists?.map((artist: any, index: number) => (
      <TouchableOpacity key={artist.id || `${artist.name}_${index}`} onPress={() => handleArtistPress(artist)}>
        <Text style={styles.artistName} size={14} color="rgba(255,255,255,0.9)">
          {artist.name}{index < albumInfo.artists.length - 1 ? ' / ' : ''}
        </Text>
      </TouchableOpacity>
  ))

  return (
    <View style={{ paddingTop: statusBarHeight, backgroundColor: 'rgba(0,0,0,0.2)' }}>
      <View style={styles.headerContainer}>
        <TouchableOpacity activeOpacity={0.85} disabled={!albumPic} onPress={() => setPreviewVisible(true)}>
          <Image url={albumPic} style={styles.albumArt} />
        </TouchableOpacity>
        <View style={styles.infoContainer}>
          <Text style={styles.albumName} size={18} color="#FFF" numberOfLines={2}>{albumInfo.name}</Text>
          <View style={styles.artistContainer}>{artists}</View>
          <Text style={styles.metaInfo} size={12} color="rgba(255,255,255,0.8)">
            {albumInfo.publishTime ? `${dateFormat(albumInfo.publishTime, 'Y.M.D') || albumInfo.publishTime} • ` : ''}{albumInfo.size || albumInfo.total} 首
          </Text>
        </View>
        {albumInfo.source !== 'tx' && albumInfo.source !== 'kg' && (
          <TouchableOpacity style={styles.followButton} onPress={toggleSubscribe}>
            <Icon name={isSubscribed ? 'love-filled' : 'love'} color={isSubscribed ? theme['c-liked'] : '#fff'} size={18} />
          </TouchableOpacity>
        )}
      </View>
      <ImagePreviewModal
        visible={isPreviewVisible}
        url={albumPic}
        name={albumInfo.name || 'album'}
        onClose={() => setPreviewVisible(false)}
      />
    </View>
  )
})

const styles = createStyle({
  backBtn: {
    position: 'absolute',
    top: 35,
    left: 10,
    zIndex: 10,
    padding: 5,
  },
  headerContainer: {
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  albumArt: {
    width: 96,
    height: 96,
    borderRadius: 8,
  },
  infoContainer: {
    flex: 1,
    marginLeft: 20,
    justifyContent: 'center',
  },
  albumName: {
    fontWeight: 'bold',
  },
  artistContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  artistName: {
    textDecorationLine: 'underline',
  },
  metaInfo: {
    marginTop: 8,
  },
  followButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginLeft: 10,
  },
});
