import { useRef, useImperativeHandle, forwardRef, useState, useEffect, useMemo } from 'react'
import { useI18n } from '@/lang'
import Menu, { type Menus, type MenuType, type Position } from '@/components/common/Menu'
import { toast } from '@/utils/tools'

export interface SelectInfo {
  musicInfo: LX.WebDAV.MusicInfo
  index: number
}
const initSelectInfo = {}

export interface WebDAVListMenuProps {
  onPlay: (selectInfo: SelectInfo) => void
  onPlayLater: (selectInfo: SelectInfo) => void
  onDownload: (selectInfo: SelectInfo) => void
  onFetchPicFromOnline: (selectInfo: SelectInfo) => void
  onEditMetadata: (selectInfo: SelectInfo) => void
  onRemove: (selectInfo: SelectInfo) => void
  onCopyName: (selectInfo: SelectInfo) => void
  onLoadMetadata: (selectInfo: SelectInfo) => void
}
export interface WebDAVListMenuType {
  show: (selectInfo: SelectInfo, position: Position) => void
}

export type { Position }

export default forwardRef<WebDAVListMenuType, WebDAVListMenuProps>((props, ref) => {
  const t = useI18n()
  const [visible, setVisible] = useState(false)
  const menuRef = useRef<MenuType>(null)
  const [selectInfo, setSelectInfo] = useState<SelectInfo | null>(null)
  const [menus, setMenus] = useState<Menus>([])

  useImperativeHandle(ref, () => ({
    show(info, position) {
      setSelectInfo(info)
      if (visible) {
        menuRef.current?.show(position)
      } else {
        setVisible(true)
        requestAnimationFrame(() => {
          menuRef.current?.show(position)
        })
      }
    },
  }))

  useEffect(() => {
    if (!selectInfo) return

    const buildMenu = async() => {
      const musicInfo = selectInfo.musicInfo

      const menu: Menus[number][] = []

      menu.push({ action: 'playLater', label: t('play_later') })
      menu.push({ action: 'fetchPicFromOnline', label: '在线封面' })
      menu.push({ action: 'loadMetadata', label: '加载标签' })
      menu.push({ action: 'editMetadata', label: t('edit_metadata') })
      menu.push({ action: 'copyName', label: t('copy_name') })
      menu.push({ action: 'remove', label: t('delete') })

      setMenus(menu)
    }

    void buildMenu()
  }, [selectInfo, t])

  const handleMenuPress = ({ action }: (typeof menus)[number]) => {
    const info = selectInfo
    if (!info) return
    switch (action) {
      case 'play': props.onPlay(info); break
      case 'playLater': props.onPlayLater(info); break
      case 'download': props.onDownload(info); break
      case 'fetchPicFromOnline': props.onFetchPicFromOnline(info); break
      case 'loadMetadata': props.onLoadMetadata(info); break
      case 'editMetadata': props.onEditMetadata(info); break
      case 'copyName': props.onCopyName(info); break
      case 'remove': props.onRemove(info); break
      default:
        break
    }
  }

  return visible ? <Menu ref={menuRef} menus={menus} onPress={handleMenuPress} /> : null
})
