import { storageDataPrefix, storageDataPrefixOld } from '@/config/constant'
import defaultSetting from '@/config/defaultSetting'
import { getData, removeData, saveData } from '@/plugins/storage'
import migrateSetting from './migrateSetting'
import settingState from '@/store/setting/state'
import { migrateMetaData, migrateListData } from './migrate'
import { exitApp, tipDialog } from '@/utils/tools'

const primitiveType = ['string', 'boolean', 'number']
const checkPrimitiveType = (val: any): boolean => val === null || primitiveType.includes(typeof val)

const arraysEqual = (a: any[], b: any[]): boolean => {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false
  }
  return true
}

const mergeSetting = (
  originSetting: LX.AppSetting,
  targetSetting?: Partial<LX.AppSetting> | null
): {
  setting: LX.AppSetting
  updatedSettingKeys: Array<keyof LX.AppSetting>
  updatedSetting: Partial<LX.AppSetting>
} => {
  let originSettingCopy: LX.AppSetting = { ...originSetting }
  const updatedSettingKeys: Array<keyof LX.AppSetting> = []
  const updatedSetting: Partial<LX.AppSetting> = {}

  if (targetSetting) {
    const originSettingKeys = Object.keys(originSettingCopy)
    const targetSettingKeys = Object.keys(targetSetting)

    const processKey = (key: keyof LX.AppSetting) => {
      const targetValue: any = targetSetting[key]
      const isPrimitive = checkPrimitiveType(targetValue)
      let shouldSkip = false
      
      if (!isPrimitive && key !== 'common.navStatus' && key !== 'common.navOrder' && key !== 'common.sectionExpandedStatus' && key !== 'player.failureStrategy') {
        shouldSkip = true
      } 
      else if (key === 'common.navStatus' || key === 'common.navOrder' || key === 'common.sectionExpandedStatus' || key === 'player.failureStrategy') {
        if (Array.isArray(targetValue) && Array.isArray(originSettingCopy[key])) {
          if (arraysEqual(targetValue, originSettingCopy[key])) {
            shouldSkip = true
          }
        } 
        else if (typeof targetValue === 'object' && typeof originSettingCopy[key] === 'object' && targetValue !== null && originSettingCopy[key] !== null) {
          if (JSON.stringify(targetValue) === JSON.stringify(originSettingCopy[key])) {
            shouldSkip = true
          }
        }
        else if (targetValue == originSettingCopy[key]) {
          shouldSkip = true
        }
      } 
      else if (targetValue == originSettingCopy[key]) {
        shouldSkip = true
      }

      if (!shouldSkip) {
        updatedSettingKeys.push(key)
        updatedSetting[key] = targetValue
        // @ts-expect-error
        originSettingCopy[key] = targetValue
      }
    }

    if (originSettingKeys.length > targetSettingKeys.length) {
      for (const key of targetSettingKeys as Array<keyof LX.AppSetting>) {
        processKey(key)
      }
    } else {
      for (const key of originSettingKeys as Array<keyof LX.AppSetting>) {
        if (targetSetting[key] !== undefined) {
          processKey(key)
        }
      }
    }
  }

  return {
    setting: originSettingCopy,
    updatedSettingKeys,
    updatedSetting,
  }
}
export const updateSetting = (setting?: Partial<LX.AppSetting> | null, isInit: boolean = false) => {
  let originSetting: LX.AppSetting
  if (isInit) {
    originSetting = { ...defaultSetting }
  } else originSetting = settingState.setting

  const result = mergeSetting(originSetting, setting)

  result.setting.version = defaultSetting.version

  return result
}

export const initSetting = async () => {
  let setting: Partial<LX.AppSetting> | null = await getData(storageDataPrefix.setting)

  // try migrate setting before v1
  if (!setting) {
    const config = await getData<{ setting?: any }>(storageDataPrefixOld.setting)
    if (config != null) {
      setting = migrateSetting(config)
      try {
        await migrateListData()
        await migrateMetaData()
      } catch (err: any) {
        void tipDialog({
          title: '数据迁移失败 (Failed to migrate data)',
          message: `请截图并在 GitHub 反馈。为了防止数据丢失，应用将停止运行。错误信息：\n${(err.stack ?? err.message) as string}`,
          btnText: 'Exit',
          bgClose: false,
        }).then(() => {
          exitApp()
        })
        throw err
      }
      await removeData(storageDataPrefixOld.setting)
    }
  }

  const updatedSetting = updateSetting(setting, true)
  void saveData(storageDataPrefix.setting, updatedSetting.setting)

  return updatedSetting
}
