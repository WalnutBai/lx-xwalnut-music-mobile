import React, { useMemo, useRef, useImperativeHandle, forwardRef, useState } from 'react'
import { View } from 'react-native'
import { useI18n } from '@/lang'
import Menu, { type MenuType, type Position, type Menus } from '@/components/common/Menu'
import settingState from '@/store/setting/state'
import userState from '@/store/user/state'
import {useSettingValue} from "@/store/setting/hook.ts";
import { isOneDriveMusicInfo } from '@/core/oneDrive/utils'
import { Icon } from '@/components/common/Icon'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'

export interface SelectInfo {
  musicInfo: LX.Music.MusicInfo
}

const initSelectInfo = {}

export interface PlayDetailMenuProps {
  onAdd: (selectInfo: SelectInfo) => void
  onDownload: (selectInfo: SelectInfo) => void
  onCopyName: (selectInfo: SelectInfo) => void
  onMusicSourceDetail: (selectInfo: SelectInfo) => void
  onDislikeMusic: (selectInfo: SelectInfo) => void
  onArtistDetail: (selectInfo: SelectInfo) => void
  onAlbumDetail: (selectInfo: SelectInfo) => void
  onSimilarSongs: (selectInfo: SelectInfo) => void
  onLike: (selectInfo: SelectInfo) => void
  onPlayMv: (selectInfo: SelectInfo) => void
  onClearCache: (selectInfo: SelectInfo) => void
}

export interface PlayDetailMenuType {
  show: (selectInfo: SelectInfo, position: Position) => void;
}

export type { Position }

export default forwardRef<PlayDetailMenuType, PlayDetailMenuProps>((props, ref) => {
  const t = useI18n();
  const theme = useTheme();
  const [visible, setVisible] = useState(false);
  const menuRef = useRef<MenuType>(null);
  const selectInfoRef = useRef<SelectInfo>(initSelectInfo as SelectInfo);
  const [isLiked, setIsLiked] = useState(false);

  const renderLikeLabel = (liked: boolean) => (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Icon name={liked ? "love-filled" : "love"} size={16} color={liked ? theme['c-liked'] : theme['c-350']} />
      <View style={{ width: 6 }} />
      <Text size={15} color={theme['c-font']}>{liked ? '取消喜欢' : '喜欢'}</Text>
    </View>
  );

  const menuSetting = {
    share: useSettingValue('menu.share'),
    playMV: useSettingValue('menu.playMV'),
    songDetail: useSettingValue('menu.songDetail'),
  }

  useImperativeHandle(ref, () => ({
    show(selectInfo, position) {
      selectInfoRef.current = selectInfo;
      if (selectInfo.musicInfo.source === 'wy') {
        setIsLiked(userState.wy_liked_song_ids.has(String(selectInfo.musicInfo.meta.songId)));
      } else if (selectInfo.musicInfo.source === 'tx') {
        const songId = (selectInfo.musicInfo.meta as any).id
        const songMid = (selectInfo.musicInfo.meta as any).songmid || (selectInfo.musicInfo.meta as any).strMediaMid || selectInfo.musicInfo.id
        const likeKey = songId && /^\d+$/.test(String(songId)) ? String(songId) : songMid
        setIsLiked(userState.tx_liked_song_ids.has(likeKey));
      } else if (selectInfo.musicInfo.source === 'kg') {
        setIsLiked(userState.kg_liked_song_ids.has(String(selectInfo.musicInfo.meta.songId)));
      }
      if (visible) {
        menuRef.current?.show(position);
      } else {
        setVisible(true);
        requestAnimationFrame(() => {
          menuRef.current?.show(position);
        });
      }
    },
  }));

  const menus = useMemo((): Menus => {
    const musicInfo = selectInfoRef.current.musicInfo;
    const isOneDrive = isOneDriveMusicInfo(musicInfo);
    const menuItems: Menus[number][] = [];
    if (!isOneDrive) menuItems.push({ action: 'download', label: t('download') });
    if (menuSetting.share) menuItems.push({ action: 'copyName', label: t('copy_name') });

    if (musicInfo?.source === 'wy') {
      menuItems.push({ action: 'like', label: renderLikeLabel(isLiked) })
      menuItems.push({ action: 'artistDetail', label: t('artist_detail') });
      menuItems.push({ action: 'albumDetail', label: t('album_detail') });
      menuItems.push({ action: 'similarSongs', label: '相似歌曲' });

      if (musicInfo.meta.mv && menuSetting.playMV) {
        menuItems.push({ action: 'playMv', label: '播放MV' })
      }
    }

    if (musicInfo?.source === 'tx') {
      menuItems.push({ action: 'like', label: renderLikeLabel(isLiked) })
      menuItems.push({ action: 'artistDetail', label: t('artist_detail') });
      menuItems.push({ action: 'albumDetail', label: t('album_detail') });
      menuItems.push({ action: 'similarSongs', label: '相似歌曲' });
      if (musicInfo.meta.vid && menuSetting.playMV) {
        menuItems.push({ action: 'playMv', label: '播放MV' })
      }
    }

    if (musicInfo?.source === 'kg') {
      menuItems.push({ action: 'like', label: renderLikeLabel(isLiked) })
      menuItems.push({ action: 'artistDetail', label: t('artist_detail') });
      menuItems.push({ action: 'albumDetail', label: t('album_detail') });
      if (menuSetting.playMV) {
        menuItems.push({ action: 'playMv', label: '播放MV' })
      }
    }

    if (musicInfo && musicInfo.source !== 'local') {
     if (menuSetting.songDetail) menuItems.push({ action: 'musicSourceDetail', label: t('music_source_detail') });
    }
    menuItems.push({ action: 'clearCache', label: t('clear_music_cache') });

    return menuItems;
  }, [t, isLiked, selectInfoRef.current.musicInfo, menuSetting]);

  const handleMenuPress = ({ action }: (typeof menus)[number]) => {
    const selectInfo = selectInfoRef.current;
    switch (action) {
      case 'like':
        props.onLike(selectInfo);
        break;
      case 'download':
        props.onDownload(selectInfo);
        break;
      case 'playMv':
        props.onPlayMv(selectInfo);
        break;
      case 'copyName':
        props.onCopyName(selectInfo);
        break;
      case 'artistDetail':
        props.onArtistDetail(selectInfo);
        break;
      case 'albumDetail':
        props.onAlbumDetail(selectInfo);
        break;
      case 'similarSongs':
        props.onSimilarSongs(selectInfo);
        break;
      case 'musicSourceDetail':
        props.onMusicSourceDetail(selectInfo);
        break;
      case 'clearCache':
        props.onClearCache(selectInfo);
        break;
      default:
        break;
    }
  };

  return visible ? <Menu ref={menuRef} menus={menus} onPress={handleMenuPress} /> : null;
});
