import { httpFetch } from '../../request'
import settingState from '@/store/setting/state'
import { stringMd5 } from 'react-native-quick-md5'

const SIGN_SALT = 'OIlwieks28dk2k092lksi2UIkp'

// 签名函数
function signAndroidParams(params: Record<string, any>, data = ''): string {
  const sortedKeys = Object.keys(params).sort()
  const paramsString = sortedKeys.map(key => {
    const value = typeof params[key] === 'object' ? JSON.stringify(params[key]) : params[key]
    return `${key}=${value}`
  }).join('')
  const signStr = `${SIGN_SALT}${paramsString}${data}${SIGN_SALT}`
  return stringMd5(signStr)
}

// 获取设备信息
function getDeviceInfo() {
  const cookie = settingState.setting['common.kg_cookie'] || ''
  const cookieObj: Record<string, string> = {}
  cookie.split(';').forEach(pair => {
    const [k, ...v] = pair.trim().split('=')
    if (k) cookieObj[k.trim()] = v.join('=').trim()
  })
  return {
    dfid: cookieObj.dfid || '',
    mid: cookieObj.mid || '',
    userid: cookieObj.userid || '',
    token: cookieObj.token || '',
  }
}

// 通用请求头
const buildHeaders = () => ({
  'User-Agent': 'Android15-1070-11083-46-0-DiscoveryDRADProtocol-wifi',
  'kg-rc': '1',
  'kg-thash': '5d816a0',
  'kg-rec': '1',
  'kg-rf': 'B9EDA08A64250DEFFBCADDEE00F8F25F',
})

export interface ClimaxInfo {
  hash: string
  begin: number   // 高潮开始时间（毫秒）
  end: number     // 高潮结束时间（毫秒）
  duration: number // 持续时间（毫秒）
}

/**
 * 获取歌曲高潮部分
 * @param hash 歌曲hash
 * @returns 高潮部分信息
 */
export async function getClimax(hash: string): Promise<ClimaxInfo | null> {
  console.log('[Climax] 获取高潮部分, hash:', hash)
  
  const device = getDeviceInfo()
  const clienttime = Math.floor(Date.now() / 1000)
  
  const paramsMap = {
    dfid: device.dfid,
    mid: device.mid,
    uuid: '-',
    appid: '1005',
    clientver: '20489',
    clienttime,
  }
  
  const data = JSON.stringify([{ hash }])
  const sig = signAndroidParams(paramsMap, data)
  
  try {
    const { body, statusCode } = await httpFetch('https://expendablekmrcdn.kugou.com/v1/audio_climax/audio', {
      method: 'GET',
      headers: {
        ...buildHeaders(),
        'x-router': 'expendablekmrcdn.kugou.com',
        dfid: device.dfid,
        mid: device.mid,
        clienttime: String(clienttime),
        Cookie: `mid=${device.mid}`,
      },
      params: { ...paramsMap, signature: sig, data },
    }).promise
    
    console.log('[Climax] 响应 statusCode:', statusCode, 'body:', body)
    
    if (!body || body.error_code !== 0 || !body.data) {
      console.error('[Climax] 获取失败:', body)
      return null
    }
    
    const climaxData = body.data[0]
    if (!climaxData || !climaxData.climax) {
      console.log('[Climax] 无高潮数据')
      return null
    }
    
    const climax = climaxData.climax
    console.log('[Climax] 高潮数据:', climax)
    
    return {
      hash,
      begin: climax.begin || 0,
      end: climax.end || 0,
      duration: (climax.end || 0) - (climax.begin || 0),
    }
  } catch (err: any) {
    console.error('[Climax] 请求异常:', err.message || err)
    return null
  }
}

/**
 * 格式化时间（毫秒转为 mm:ss）
 */
export function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
}
