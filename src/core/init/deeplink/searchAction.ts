import { setNavActiveId } from '@/core/common'
import { saveSearchSetting } from '@/utils/data'
import { setSearchText, addHistoryWord } from '@/core/search/search'

const PLATFORM_MAP: Record<string, string> = {
  kw: 'kw',
  kg: 'kg',
  tx: 'tx',
  wy: 'wy',
  mg: 'mg',
  bilibili: 'bilibili',
  git: 'git',
  '酷我': 'kw',
  '酷狗': 'kg',
  'QQ': 'tx',
  'qq': 'tx',
  '网易': 'wy',
  '咪咕': 'mg',
  'bilibili': 'bilibili',
  'b站': 'bilibili',
}

const TYPE_MAP: Record<string, string> = {
  music: 'music',
  songlist: 'songlist',
  singer: 'singer',
  album: 'album',
  '音乐': 'music',
  '歌单': 'songlist',
  '歌手': 'singer',
  '专辑': 'album',
}

const handleSearch = async (params: Record<string, any>) => {
  const { keyword, platform, type } = params

  let source = ''
  if (platform) {
    source = PLATFORM_MAP[platform] || platform
    const validSources = ['kw', 'kg', 'tx', 'wy', 'mg', 'bilibili', 'git']
    if (!validSources.includes(source)) {
      throw new Error(`Unknown platform: ${platform}`)
    }
    await saveSearchSetting({ source })
  }

  let searchType = ''
  if (type) {
    searchType = TYPE_MAP[type] || type
    const validTypes = ['music', 'songlist', 'singer', 'album']
    if (!validTypes.includes(searchType)) {
      throw new Error(`Unknown search type: ${type}`)
    }
    await saveSearchSetting({ type: searchType as any })
  }

  if (keyword) {
    setSearchText(keyword)
    await addHistoryWord(keyword)
  }

  setNavActiveId('nav_search')

  if (keyword || source || searchType) {
    global.app_event.searchDeepLink(keyword || '', source, searchType)
  }
}

export const handleSearchAction = async (_action: string, params: Record<string, any>) => {
  await handleSearch(params)
}
