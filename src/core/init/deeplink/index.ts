import { Linking } from 'react-native'
import { errorDialog } from './utils'
import { handleMusicAction } from './musicAction'
import { handlePlayerAction, type PlayerAction } from './playerAction'
import { handleSonglistAction } from './songlistAction'
import { handleSearchAction } from './searchAction'
import { startMusicRecognition } from '@/core/musicRecognition'
import { setNavActiveId } from '@/core/common'
import { setPendingAction } from '@/core/pendingAction'
import { extname, stat } from '@/utils/fs'
import { handleFileMusicAction, handleFileJSAction, handleFileLXMCAction } from './fileAction'

const handleLinkAction = async (link: string) => {
  // console.log(link)
  const [url, hash] = link.split('#')
  const [type, action, ...paths] = url.replace('lxmusic://', '').split('/')
  const params: {
    paths: string[]
    data?: string
    [key: string]: any
  } = {
    paths: [],
  }
  if (hash) {
    const kwIdx = hash.indexOf('keyword=')
    if (kwIdx !== -1) {
      const kwEnd = hash.indexOf('&platform=', kwIdx)
      const kwEnd2 = hash.indexOf('&type=', kwIdx)
      const kwEnds = [kwEnd, kwEnd2].filter(e => e !== -1).sort((a, b) => a - b)
      if (kwEnds.length > 0) {
        params.keyword = decodeURIComponent(hash.substring(kwIdx + 8, kwEnds[0]))
      } else {
        params.keyword = decodeURIComponent(hash.substring(kwIdx + 8))
      }
    }
    const paramRegex = /([^&=]+)=([^&]*)/g
    let match
    while ((match = paramRegex.exec(hash)) !== null) {
      if (match[1] !== 'keyword') {
        params[match[1]] = decodeURIComponent(match[2] || '')
      }
    }
  }
  if (params.data) params.data = JSON.parse(decodeURIComponent(params.data))
  params.paths = paths.map((p) => decodeURIComponent(p))
  console.log(params)
  switch (type) {
    case 'music':
      await handleMusicAction(action, params)
      break
    case 'songlist':
      await handleSonglistAction(action, params)
      break
    case 'player':
      await handlePlayerAction(action as PlayerAction)
      break
    case 'search':
      await handleSearchAction(action, params)
      break
    case 'recognition':
      await startMusicRecognition()
      break
    case 'setting':
      setNavActiveId('nav_setting')
      break
    case 'nav':
      if (action === 'search' || params.target === 'search') {
        setPendingAction({ type: 'searchFocus' })
        setNavActiveId('nav_search')
        setTimeout(() => global.app_event.searchDeepLink(params.keyword || '', '', params.type || ''), 100)
      } else if (action === 'songlist' || params.target === 'songlist') {
        setPendingAction({ type: 'songlistImport' })
        setNavActiveId('nav_songList')
        setTimeout(() => global.app_event.openSonglistImport(), 100)
      } else if (action === 'setting' || params.target === 'setting') {
        setNavActiveId('nav_setting')
      }
      break
    // default: throw new Error('Unknown type: ' + type)
  }
}

const handleFileAction = async (link: string) => {
  const file = await stat(link)
  // console.log(file)
  switch (extname(file.name)) {
    case 'json':
    case 'lxmc':
      await handleFileLXMCAction(file)
      break
    case 'js':
      await handleFileJSAction(file)
      break
    case 'ogg':
    case 'flac':
    case 'wav':
    case 'mp3':
      await handleFileMusicAction(file)
      break
    default:
      if (!file.mimeType?.startsWith('audio/')) throw new Error('Unknown file type')
      await handleFileMusicAction(file)
      break
  }
}

// const handleHttpAction = async(link: string) => {
// }

const runLinkAction = async (link: string) => {
  if (link.startsWith('lxmusic://')) {
    try {
      await handleLinkAction(link)
    } catch (err: any) {
      errorDialog(err.message)
      // focusWindow()
    }
  } else if (link.startsWith('file://') || link.startsWith('content://')) {
    try {
      await handleFileAction(link)
    } catch (err: any) {
      errorDialog(err.message)
      // focusWindow()
    }
  }
  //  else if (/^https?:\/\//.test(link)) {
  //   try {
  //     await handleHttpAction(link)
  //   } catch (err: any) {
  //     errorDialog(err.message)
  //     // focusWindow()
  //   }
  // }
}

export const initDeeplink = async () => {
  Linking.addEventListener('url', ({ url }) => {
    void runLinkAction(url)
    console.log('deeplink', url)
  })
  const initialUrl = await Linking.getInitialURL()
  if (initialUrl == null) return
  console.log('deeplink', initialUrl)
  void runLinkAction(initialUrl)
}
