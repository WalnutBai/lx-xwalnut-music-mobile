import {forwardRef, useImperativeHandle, useRef, useState, useCallback, memo, useEffect} from 'react'
import { FlatList, RefreshControl } from 'react-native'
import wyMusicSearch from '@/utils/musicSdk/wy/musicSearch'
import txMusicSearch from '@/utils/musicSdk/tx/musicSearch'
import kgMusicSearch from '@/utils/musicSdk/kg/musicSearch'
import { useTheme } from '@/store/theme/hook'
import SingerListItem from '../FollowedArtists/ListItem'
import AlbumListItem from '../../Views/SubscribedAlbums/ListItem'
import { log } from '@/utils/log'
import { toast } from '@/utils/tools'

interface SearchResultListProps {
  searchType: 'singer' | 'album'
  source: string
}

export default forwardRef(({ searchType, source }: SearchResultListProps, ref) => {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(false)
  const searchInfoRef = useRef({ text: '', page: 1, hasMore: true })
  const searchTypeRef = useRef(searchType)
  const theme = useTheme()

  useEffect(() => {
    searchTypeRef.current = searchType
  }, [searchType])

  useEffect(() => {
    setList([])
    searchInfoRef.current.page = 1
    searchInfoRef.current.hasMore = true
  }, [searchType, source])

  const handleLoad = useCallback((text: string, page: number, isRefresh = false) => {
    log.info('[SearchResultList] === handleLoad 被调用 ===', {
      text,
      page,
      isRefresh,
      searchType,
      source,
      loading,
      hasMore: searchInfoRef.current.hasMore,
      timestamp: new Date().toISOString(),
    })
    if (loading || (!isRefresh && !searchInfoRef.current.hasMore)) {
      log.info('[SearchResultList] === 跳过加载 ===', {
        reason: loading ? '正在加载中' : '没有更多数据',
        loading,
        hasMore: searchInfoRef.current.hasMore,
      })
      return
    }
    setLoading(true)

    // 歌手/专辑搜索支持网易云、QQ音乐和酷狗平台
    if (source !== 'wy' && source !== 'tx' && source !== 'kg') {
      toast('当前音源平台暂不支持歌手/专辑搜索')
      setLoading(false)
      setList([])
      searchInfoRef.current.hasMore = false
      return
    }

    const musicSearch = source === 'tx' ? txMusicSearch : source === 'kg' ? kgMusicSearch : wyMusicSearch
    log.info('[SearchResultList] === 开始搜索 ===', {
      searchType,
      source,
      musicSearchModule: source === 'tx' ? 'txMusicSearch' : source === 'kg' ? 'kgMusicSearch' : 'wyMusicSearch',
    })
    let searchPromise
    if (searchType === 'singer') {
      searchPromise = musicSearch.searchSinger(text, page)
    } else if (searchType === 'album') {
      searchPromise = musicSearch.searchAlbum(text, page)
    } else {
      log.warn('[SearchResultList] === 未知的搜索类型 ===', { searchType })
      setLoading(false)
      return
    }

    searchPromise.then((result: any) => {
      if (searchTypeRef.current !== searchType) {
        log.info('[SearchResultList] === 搜索类型已切换，丢弃结果 ===', {
          originalSearchType: searchType,
          currentSearchType: searchTypeRef.current,
        })
        return
      }
      log.info('[SearchResultList] === 搜索成功返回 ===', {
        searchType,
        source,
        text,
        page,
        resultListLength: result.list.length,
        total: result.total,
        allPage: result.allPage,
        hasMore: result.list.length > 0 && result.total > (page * 30),
        firstItem: result.list[0] ? {
          id: result.list[0].id,
          name: result.list[0].name,
          mid: result.list[0].mid,
          source: result.list[0].source,
        } : null,
      })
      setList(isRefresh ? result.list : [...list, ...result.list])
      searchInfoRef.current.page = page + 1
      searchInfoRef.current.hasMore = result.list.length > 0 && result.total > (page * 30)
    }).catch((err: any) => {
      log.error('[SearchResultList] === 搜索出错 ===', {
        searchType,
        source,
        text,
        page,
        error: err.message,
        stack: err.stack,
      })
    }).finally(() => {
      log.info('[SearchResultList] === 搜索流程结束 ===', {
        searchType,
        source,
        text,
        page,
        finalLoadingState: false,
      })
      setLoading(false)
    })
  }, [loading, list, searchType, source])

  useImperativeHandle(ref, () => ({
    loadList(text: string) {
      searchInfoRef.current = { text, page: 1, hasMore: true }
      handleLoad(text, 1, true)
    },
  }))

  const renderItem = ({ item, index }: { item: any, index: number }) => {
    log.info('[SearchResultList] === 渲染列表项 ===', {
      index,
      searchType,
      item: {
        id: item.id,
        name: item.name,
        mid: item.mid,
        source: item.source,
        albumSize: item.albumSize,
        songNum: item.songNum,
        size: item.size,
      },
    })
    if (searchType === 'singer') {
      return <SingerListItem artist={item} showFollowButton={true} />
    }
    if (searchType === 'album') {
      return <AlbumListItem item={item} showSubscribeButton={true} />
    }
    return null
  }

  return (
    <FlatList
      data={list}
      renderItem={renderItem}
      keyExtractor={item => String(item.id)}
      onEndReached={() => {
        log.info('[SearchResultList] === 触底加载更多 ===', {
          text: searchInfoRef.current.text,
          page: searchInfoRef.current.page,
          hasMore: searchInfoRef.current.hasMore,
        })
        handleLoad(searchInfoRef.current.text, searchInfoRef.current.page)
      }}
      onEndReachedThreshold={0.5}
      onScrollBeginDrag={() => {
        log.info('[SearchResultList] === 开始拖动列表 ===', {
          text: searchInfoRef.current.text,
          page: searchInfoRef.current.page,
          listLength: list.length,
        })
      }}
      refreshControl={
        <RefreshControl
          colors={[theme['c-primary']]}
          refreshing={loading && searchInfoRef.current.page === 1}
          onRefresh={() => {
            log.info('[SearchResultList] === 下拉刷新 ===', {
              text: searchInfoRef.current.text,
              currentPage: searchInfoRef.current.page,
            })
            handleLoad(searchInfoRef.current.text, 1, true)
          }}
        />
      }
    />
  )
})
