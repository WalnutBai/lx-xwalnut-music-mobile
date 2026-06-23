import { useCallback, useEffect, useMemo, useState } from 'react'
import { ScrollView, TouchableOpacity, View } from 'react-native'

import Text from '@/components/common/Text'
import { useMyList } from '@/store/list/hook'
import ListItem, { styles as listStyles } from './ListItem'
import CreateUserList from './CreateUserList'
import { useWindowSize } from '@/utils/hooks'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { createStyle } from '@/utils/tools'
import { scaleSizeW, scaleSizeH } from '@/utils/pixelRatio'
import {useWySubscribedPlaylists, useWyUid, useTxSubscribedPlaylists, useKgSubscribedPlaylists} from "@/store/user/hook.ts"
import { setTxSubscribedPlaylists, setKgSubscribedPlaylists, setWySubscribedPlaylists } from '@/store/user/action'
import wyUserApi from '@/utils/musicSdk/wy/user'
import txUserApi from '@/utils/musicSdk/tx/user'
import { getUserPlaylists as getKgUserPlaylists } from '@/utils/musicSdk/kg/utils/api'
import settingState from '@/store/setting/state'
import { log } from '@/utils/log'

const styles = createStyle({
  list: {
    paddingLeft: 15,
    paddingRight: 2,
    paddingBottom: 5,
    flexDirection: 'row',
    flexWrap: 'wrap',
    // backgroundColor: 'rgba(0,0,0,0.2)'
    // justifyContent: 'center',
  },
})
const MIN_WIDTH = scaleSizeW(150)
const PADDING = styles.list.paddingLeft + styles.list.paddingRight

const EditListItem = ({ itemWidth, playlistType }: { itemWidth: number, playlistType: 'local' | 'online' }) => {
  const [isEdit, setEdit] = useState(false)
  const theme = useTheme()
  const t = useI18n()

  return (
    <View style={{ ...listStyles.listItem, width: itemWidth }}>
      <TouchableOpacity
        style={{
          ...listStyles.button,
          borderColor: theme['c-primary-light-200-alpha-700'],
          borderStyle: 'dashed',
        }}
        onPress={() => {
          setEdit(true)
        }}
      >
        <Text
          style={{ opacity: isEdit ? 0 : 1 }}
          numberOfLines={1}
          size={14}
          color={theme['c-button-font']}
        >
          {t('list_create')}
        </Text>
      </TouchableOpacity>
      {isEdit ? (
        <CreateUserList
          isEdit={isEdit}
          onHide={() => {
            setEdit(false)
          }}
          playlistType={playlistType}
        />
      ) : null}
    </View>
  )
}

export default ({
  musicInfo,
  onPress,
  playlistType,
}: {
  musicInfo: LX.Music.MusicInfo
  onPress: (listInfo: LX.List.MyListInfo) => void
  playlistType: 'local' | 'wy' | 'tx' | 'kg'
}) => {
  const windowSize = useWindowSize()

  const localLists = useMyList()
  const onlinePlaylists = useWySubscribedPlaylists()
  const txPlaylists = useTxSubscribedPlaylists()
  const kgPlaylists = useKgSubscribedPlaylists()
  const uid = useWyUid()
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Req3: 切换标签时实时刷新在线歌单
  const refreshOnlinePlaylists = useCallback(async (type: 'wy' | 'tx' | 'kg') => {
    if (isRefreshing) return
    setIsRefreshing(true)
    try {
      if (type === 'wy') {
        const cookie = settingState.setting['common.wy_cookie']
        if (!cookie) return
        const wyUid = await wyUserApi.getUid(cookie)
        if (!wyUid) return
        const playlists = await wyUserApi.getUserPlaylists(wyUid, cookie)
        const formatted = playlists.map((p: any) => ({
          id: p.id,
          userId: p.userId || p.creator?.userId,
          name: p.name,
          coverImgUrl: p.coverImgUrl || p.picUrl || '',
          trackCount: p.trackCount || 0,
          description: p.description || '',
          creator: p.creator,
        }))
        setWySubscribedPlaylists(formatted)
      } else if (type === 'tx') {
        const cookie = settingState.setting['common.tx_cookie']
        if (!cookie) return
        const playlists = await txUserApi.getUserPlaylists()
        const formatted = playlists.map((p: any) => ({
          id: `tx__${p.id}`,
          name: p.name,
          cover: p.cover,
          songCount: p.songCount,
          creator: { nickname: 'QQ音乐' },
          dirid: p.dirid,
          tid: p.tid,
          desc: p.desc,
          isFavorites: p.isFavorites,
          isCollected: p.isCollected,
        }))
        setTxSubscribedPlaylists(formatted)
      } else if (type === 'kg') {
        const cookie = settingState.setting['common.kg_cookie']
        if (!cookie) return
        const result = await getKgUserPlaylists(cookie)
        if (result.success && result.data) {
          const allPlaylists = [...(result.data.createdList || []), ...(result.data.collectedList || [])]
          const formatted = allPlaylists.map((p: any) => ({
            id: p.id || `kg_${p.listid}`,
            listid: p.listid,
            name: p.name,
            cover: p.cover,
            songCount: p.songCount,
            desc: p.desc,
            isCollected: p.isCollected || false,
          }))
          setKgSubscribedPlaylists(formatted)
        }
      }
    } catch (err: any) {
      log.warn('[MusicAddModal] 刷新歌单失败', { type, error: err.message })
    } finally {
      setIsRefreshing(false)
    }
  }, [isRefreshing])

  useEffect(() => {
    if (playlistType !== 'local') {
      void refreshOnlinePlaylists(playlistType)
    }
  }, [playlistType])

  const allList = useMemo(() => {
    if (playlistType === 'wy') {
      return onlinePlaylists.filter(p => String(p.userId) === String(uid))
    }
    if (playlistType === 'tx') {
      return txPlaylists
    }
    if (playlistType === 'kg') {
      // Req2: 过滤掉收藏的他人歌单，只保留用户自建歌单
      return kgPlaylists
        .filter(p => !p.isCollected)
        .map(p => ({
          id: `kg__${p.listid}`,
          listid: p.listid,
          name: p.name,
          avatar: p.cover,
          songCount: p.songCount,
        }))
    }
    return localLists
  }, [playlistType, localLists, onlinePlaylists, uid, txPlaylists, kgPlaylists])

  const itemWidth = useMemo(() => {
    let w = Math.floor(windowSize.width * 0.9 - PADDING)
    let n = Math.floor(w / MIN_WIDTH)
    if (n > 10) n = 10
    return Math.floor((w - 1) / n)
  }, [windowSize])

  return (
    <ScrollView style={{ flexGrow: 0, minHeight: scaleSizeH(200) }}>
      <View style={styles.list} onStartShouldSetResponder={() => true}>
        {allList.map((info) => (
          <ListItem
            key={info.id}
            listInfo={info}
            musicInfo={musicInfo}
            onPress={onPress}
            width={itemWidth}
          />
        ))}
        {playlistType === 'local' && <EditListItem itemWidth={itemWidth} playlistType={playlistType} />}
      </View>
    </ScrollView>
  )
}
