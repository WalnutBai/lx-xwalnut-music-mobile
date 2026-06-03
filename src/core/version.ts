import { compareVer } from '@/utils'
import { downloadNewVersion, getVersionInfo } from '@/utils/version'
import versionActions from '@/store/version/action'
import versionState, { type InitState } from '@/store/version/state'
import {
  getIgnoreVersion,
  getIgnoreVersionFailTipTime,
  saveIgnoreVersion,
  saveIgnoreVersionFailTipTime,
} from '@/utils/data'
import { showVersionModal } from '@/navigation'
import { Navigation } from 'react-native-navigation'
import { log } from '@/utils/log'

export const showModal = () => {
  if (versionState.showModal) return
  versionActions.setVisibleModal(true)
  showVersionModal()
}

export const hideModal = (componentId: string) => {
  if (!versionState.showModal) return
  versionActions.setVisibleModal(false)
  void Navigation.dismissOverlay(componentId)
}

export const checkUpdate = async (silent = false) => {
  versionActions.setVersionInfo({ status: 'checking' })
  let versionInfo: InitState['versionInfo'] = { ...versionState.versionInfo }
  try {
    const { version, desc, history } = await getVersionInfo()
    versionInfo.newVersion = {
      version,
      desc,
      history,
    }
  } catch (err) {
    versionInfo.newVersion = {
      version: '0.0.0',
      desc: '',
      history: [],
    }
  }
  // const versionInfo = {
  //   version: '1.9.0',
  //   desc: '- 更新xxx\n- 修复xxx123的萨达修复xxx123的萨达修复xxx123的萨达修复xxx123的萨达修复xxx123的萨达',
  //   history: [{ version: '1.8.0', desc: '- 更新xxx22\n- 修复xxx22' }, { version: '1.7.0', desc: '- 更新xxx22\n- 修复xxx22' }],
  // }
  if (versionInfo.newVersion.version == '0.0.0') {
    versionInfo.isUnknown = true
    versionInfo.status = 'error'
  } else {
    versionInfo.status = 'idle'
    versionInfo.isUnknown = false
    if (compareVer(versionInfo.version, versionInfo.newVersion.version) != -1) {
      versionInfo.isLatest = true
    }
  }

  versionActions.setVersionInfo(versionInfo)

  if (!versionInfo.isLatest && !silent) {
    if (versionInfo.isUnknown) {
      const time = await getIgnoreVersionFailTipTime()
      if (Date.now() - time < 7 * 86400000) return
      saveIgnoreVersionFailTipTime(Date.now())
      showModal()
    } else if (versionInfo.newVersion.version != (await getIgnoreVersion())) {
      showModal()
    }
  }
  // console.log(compareVer(process.versions.app, versionInfo.version))
  // console.log(process.versions.app, versionInfo.version)
}

export const downloadUpdate = () => {
  versionActions.setVersionInfo({ status: 'downloading' })
  versionActions.setProgress({ total: 0, current: 0 })
  const version = versionState.versionInfo.newVersion!.version
  log.info(`[Update] Starting download for version ${version}`)

  downloadNewVersion(
    version,
    (total: number, current: number) => {
      versionActions.setProgress({ total, current })
    }
  )
    .then(() => {
      versionActions.setVersionInfo({ status: 'downloaded' })
      log.info(`[Update] Download completed for version ${version}`)
    })
    .catch((err: any) => {
      versionActions.setVersionInfo({ status: 'error' })
      log.error(`[Update] Download failed for version ${version}:`, err?.message || err || 'Unknown error')
    })
}

export const setIgnoreVersion = (version: InitState['ignoreVersion']) => {
  versionActions.setIgnoreVersion(version)
  saveIgnoreVersion(version)
}
