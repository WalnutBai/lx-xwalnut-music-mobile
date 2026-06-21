/**
 * 酷狗音乐 API 工具模块
 * 直接在应用内实现酷狗 API 调用，无需外部服务器
 */

import axios from 'axios';
import { stringMd5 } from 'react-native-quick-md5';
import { Buffer } from '@craftzdog/react-native-buffer';
import { generateSidEdt, cryptoAesEncrypt, cryptoRSAEncrypt, cryptoAesDecrypt, rsaEncrypt2, playlistAesEncrypt, playlistAesDecrypt } from './kugouCrypto';

// 酷狗 API 配置
const KG_CONFIG = {
  appid: '1005',
  clientver: '20489',
  liteAppid: '3116',
  liteClientver: '11440',
};

// API 基础 URL
const KG_API_BASE = 'https://gateway.kugou.com';
const KG_LOGIN_BASE = 'http://login.user.kugou.com';
// KuGouMusicApi 服务器地址（用于需要签名的接口）
// Android 模拟器使用 10.0.2.2，真机需要替换为电脑的 IP 地址
const KUGOU_API_SERVER = 'http://10.0.2.2:3000';

// 保存上次请求的设备信息，确保同一验证流程中 mid/dfid 一致
let cachedDevice: { headers: Record<string, string>; defaultParams: Record<string, any> } | null = null;

// 签名盐值
const ANDROID_SIGN_SALT = 'OIlwieks28dk2k092lksi2UIkp';

// 日志回调函数类型
export type LogCallback = (message: string) => void;

/**
 * MD5 加密
 */
function md5(str: string): string {
  return stringMd5(str);
}

/**
 * 生成随机字符串
 */
function randomString(length: number = 16): string {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * 生成设备标识
 */
function generateDeviceId(): string {
  return randomString(24);
}

/**
 * 生成 MID
 */
function generateMid(): string {
  const guid = randomString(32);
  return md5(guid);
}

/**
 * Android 版签名
 * 签名算法：MD5(salt + 排序后的参数 + data + salt)
 */
export function signAndroidParams(params: Record<string, any>, data?: string, onLog?: LogCallback): string {
  const sortedKeys = Object.keys(params).sort();
  const paramsString = sortedKeys
    .map((key) => {
      const value = typeof params[key] === 'object' ? JSON.stringify(params[key]) : params[key];
      return `${key}=${value}`;
    })
    .join('');

  // data 是请求体的 JSON 字符串
  const dataStr = data || '';
  const signStr = `${ANDROID_SIGN_SALT}${paramsString}${dataStr}${ANDROID_SIGN_SALT}`;
  
  onLog?.(`签名盐值: ${ANDROID_SIGN_SALT}`);
  onLog?.(`排序后的参数键: ${sortedKeys.join(', ')}`);
  onLog?.(`参数字符串: ${paramsString}`);
  onLog?.(`请求体数据: ${dataStr.substring(0, 100)}`);
  onLog?.(`完整签名字符串: ${signStr}`);
  
  const signature = md5(signStr);
  onLog?.(`生成签名: ${signature}`);
  return signature;
}

/**
 * 生成请求头和默认参数
 */
export function generateHeadersAndParams(): { headers: Record<string, string>; defaultParams: Record<string, any> } {
  const dfid = generateDeviceId();
  const mid = generateMid();
  const clienttime = Math.floor(Date.now() / 1000);

  const headers = {
    'User-Agent': 'Android15-1070-11083-46-0-DiscoveryDRADProtocol-wifi',
    'Content-Type': 'application/json',
    dfid,
    mid,
    clienttime: clienttime.toString(),
    'kg-rc': '1',
    'kg-thash': '5d816a0',
    'kg-rec': '1',
    'kg-rf': 'B9EDA08A64250DEFFBCADDEE00F8F25F',
  };

  const defaultParams = {
    dfid,
    mid,
    uuid: '-',
    appid: KG_CONFIG.appid,
    clientver: KG_CONFIG.clientver,
    clienttime,
  };

  return { headers, defaultParams };
}

/**
 * 发送验证码
 */
export async function sendCaptcha(
  mobile: string,
  onLog?: LogCallback
): Promise<{ success: boolean; message: string; ssaCode?: string }> {
  const log = (msg: string) => {
    console.log(`[KuGou] ${msg}`);
    onLog?.(msg);
  };

  try {
    // 如果有缓存的设备信息（验证后重试），复用相同的 mid/dfid
    const { headers, defaultParams } = cachedDevice || generateHeadersAndParams();
    log(`${cachedDevice ? '复用缓存' : '生成'}设备信息: MID=${defaultParams.mid}, dfid=${defaultParams.dfid}`);

    // 首次调用时缓存设备信息
    if (!cachedDevice) {
      cachedDevice = { headers, defaultParams };
    }

    const dataMap = {
      businessid: 5,
      mobile: mobile,
      plat: 3,
    };

    // 签名基于：默认参数（查询参数） + 请求体数据
    const dataStr = JSON.stringify(dataMap);
    const signature = signAndroidParams(defaultParams, dataStr, log);
    log(`生成签名: ${signature}`);

    log(`请求URL: ${KG_LOGIN_BASE}/v7/send_mobile_code`);
    log(`请求体: ${dataStr}`);
    log(`查询参数: ${JSON.stringify({ ...defaultParams, signature })}`);
    log(`请求头: ${JSON.stringify(headers)}`);
    log(`Cookie: mid=${defaultParams.mid}`);

    const response = await axios({
      baseURL: KG_LOGIN_BASE,
      url: '/v7/send_mobile_code',
      method: 'POST',
      data: dataMap,  // 请求体只包含业务参数
      params: { ...defaultParams, signature },  // signature 作为查询参数
      headers: {
        ...headers,
        Cookie: `mid=${defaultParams.mid}`,  // 添加 Cookie
      },
      timeout: 10000,
    });

    log(`响应状态: ${response.status}`);
    log(`响应头: ${JSON.stringify(response.headers)}`);
    log(`响应数据: ${JSON.stringify(response.data)}`);

    // 检查是否需要人机验证
    const ssaCode = response.headers['ssa-code'] || response.headers['SSA-CODE'];
    if (ssaCode) {
      log(`需要人机验证: ssa-code=${ssaCode}`);
      return { 
        success: false, 
        message: '需要人机验证', 
        ssaCode: ssaCode 
      };
    }

    const result = response.data;
    if (result.status === 1 || result.error_code === 0) {
      log('验证码发送成功');
      cachedDevice = null; // 发送成功，清除缓存
      return { success: true, message: '验证码已发送' };
    } else {
      log(`发送失败: error_code=${result.error_code}, msg=${result.msg || '未知错误'}`);
      return { success: false, message: result.msg || `发送失败(${result.error_code})` };
    }
  } catch (error: any) {
    const errorMsg = error.response?.data
      ? JSON.stringify(error.response.data)
      : error.message || '网络错误';
    log(`请求异常: ${errorMsg}`);
    if (error.response) {
      log(`HTTP状态码: ${error.response.status}`);
    }
    console.error('发送验证码失败:', error);
    return { success: false, message: errorMsg };
  }
}

/**
 * 手机号登录
 */
export async function loginByPhone(
  mobile: string,
  code: string,
  onLog?: LogCallback
): Promise<{ success: boolean; data?: any; message: string }> {
  const log = (msg: string) => {
    console.log(`[KuGou] ${msg}`);
    onLog?.(msg);
  };

  try {
    const dateTime = Date.now();
    // 复用缓存的设备信息，确保 mid/dfid 一致
    const { headers, defaultParams } = cachedDevice || generateHeadersAndParams();

    log(`设备信息: dfid=${defaultParams.dfid}, mid=${defaultParams.mid}, cached=${!!cachedDevice}`);

    // 使用纯 JS 加密生成 pk 和 params（匹配 KuGouMusicApi 行为）
    const encrypt = cryptoAesEncrypt({ mobile: mobile, code: code });
    const pk = cryptoRSAEncrypt({ clienttime_ms: dateTime, key: encrypt.key }).toUpperCase();
    const params = encrypt.str;
    log(`加密完成: pk长度=${pk.length}, params长度=${params.length}`);

    const dataMap = {
      plat: 1,
      support_multi: 1,
      t1: 0,
      t2: 0,
      t3: 'MCwwLDAsMCwwLDAsMCwwLDA=',
      clienttime_ms: dateTime,
      mobile: `${mobile.substring(0, 2)}*****${mobile.substring(10, 11)}`,
      key: md5(`${KG_CONFIG.appid}${ANDROID_SIGN_SALT}${KG_CONFIG.clientver}${dateTime}`),
      pk: pk,
      params: params,
    };

    // 签名基于：默认参数（查询参数） + 请求体数据
    const dataStr = JSON.stringify(dataMap);
    const signature = signAndroidParams(defaultParams, dataStr, log);
    log(`生成签名: ${signature}`);

    log(`请求URL: https://loginserviceretry.kugou.com/v7/login_by_verifycode`);
    log(`请求体: ${dataStr.substring(0, 200)}...`);

    const response = await axios({
      baseURL: 'https://loginserviceretry.kugou.com',
      url: '/v7/login_by_verifycode',
      method: 'POST',
      data: dataMap,
      params: { ...defaultParams, signature },
      headers: {
        ...headers,
        'support-calm': '1',
        'User-Agent': 'Android16-1070-11440-130-0-LOGIN-wifi',
        Cookie: `mid=${defaultParams.mid}`,
      },
      timeout: 10000,
    });

    log(`响应状态: ${response.status}`);
    log(`响应数据: ${JSON.stringify(response.data)}`);

    const result = response.data;
    if (result.status === 1 && result.data) {
      const data = { ...result.data };

      // 处理 secu_params（加密的 token）
      if (data.secu_params) {
        try {
          const decrypted = cryptoAesDecrypt(data.secu_params, encrypt.key);
          log(`secu_params 解密成功`);
          try {
            const tokenObj = JSON.parse(decrypted);
            Object.assign(data, tokenObj);
          } catch {
            data.token = decrypted;
          }
        } catch (e: any) {
          log(`secu_params 解密失败: ${e?.message}`);
        }
      }

      const { token, userid, vip_type, vip_token, t1 } = data;
      log(`登录成功: userid=${userid}, token=${token?.substring(0, 20)}...`);
      cachedDevice = null; // 登录成功，清除缓存
      return {
        success: true,
        data: {
          token,
          userid,
          t1,
          dfid: defaultParams.dfid,
          mid: defaultParams.mid,
          vip_type,
          vip_token,
        },
        message: '登录成功',
      };
    } else {
      log(`登录失败: error_code=${result.error_code}, msg=${result.msg || '未知错误'}`);
      return { success: false, message: result.msg || `登录失败(${result.error_code})` };
    }
  } catch (error: any) {
    const errorMsg = error.response?.data
      ? JSON.stringify(error.response.data)
      : error.message || '网络错误';
    log(`请求异常: ${errorMsg}`);
    if (error.response) {
      log(`HTTP状态码: ${error.response.status}`);
    }
    console.error('登录失败:', error);
    return { success: false, message: errorMsg };
  }
}

/**
 * 使用 token 刷新登录状态
 */
export async function refreshToken(
  token: string,
  userid: string,
  onLog?: LogCallback
): Promise<{ success: boolean; data?: any; message: string }> {
  const log = (msg: string) => {
    console.log(`[KuGou] ${msg}`);
    onLog?.(msg);
  };

  try {
    const dateTime = Date.now();
    const { headers, defaultParams } = generateHeadersAndParams();

    log(`生成设备标识: dfid=${defaultParams.dfid}`);
    log(`生成MID: ${defaultParams.mid}`);

    const dataMap = {
      dfid: defaultParams.dfid,
      p3: '', // 简化版本
      plat: 1,
      t1: 0,
      t2: 0,
      t3: 'MCwwLDAsMCwwLDAsMCwwLDA=',
      pk: '', // 简化版本
      params: '', // 简化版本
      userid: userid,
      clienttime_ms: dateTime,
    };

    // 签名基于：默认参数（查询参数） + 请求体数据
    const dataStr = JSON.stringify(dataMap);
    const signature = signAndroidParams(defaultParams, dataStr, log);
    log(`生成签名: ${signature}`);

    log(`请求URL: ${KG_LOGIN_BASE}/v5/login_by_token`);
    log(`请求体: ${dataStr}`);
    log(`查询参数: ${JSON.stringify({ ...defaultParams, signature })}`);

    const response = await axios({
      baseURL: KG_LOGIN_BASE,
      url: '/v5/login_by_token',
      method: 'POST',
      data: dataMap,  // 请求体只包含业务参数
      params: { ...defaultParams, signature },  // signature 作为查询参数
      headers,
      timeout: 10000,
    });

    log(`响应状态: ${response.status}`);
    log(`响应数据: ${JSON.stringify(response.data)}`);

    const result = response.data;
    if (result.status === 1 && result.data) {
      const { token: newToken, userid: newUserid, vip_type, vip_token } = result.data;
      log(`刷新成功: userid=${newUserid || userid}`);
      return {
        success: true,
        data: {
          token: newToken || token,
          userid: newUserid || userid,
          dfid: defaultParams.dfid,
          mid: defaultParams.mid,
          vip_type,
          vip_token,
        },
        message: '刷新成功',
      };
    } else {
      log(`刷新失败: error_code=${result.error_code}, msg=${result.msg || '未知错误'}`);
      return { success: false, message: result.msg || `刷新失败(${result.error_code})` };
    }
  } catch (error: any) {
    const errorMsg = error.response?.data
      ? JSON.stringify(error.response.data)
      : error.message || '网络错误';
    log(`请求异常: ${errorMsg}`);
    if (error.response) {
      log(`HTTP状态码: ${error.response.status}`);
    }
    console.error('刷新登录失败:', error);
    return { success: false, message: errorMsg };
  }
}

/**
 * 获取验证信息
 */
export async function getVerifyInfo(
  eventid: string,
  onLog?: LogCallback
): Promise<{ success: boolean; data?: any; message: string }> {
  const log = (msg: string) => {
    console.log(`[KuGou] ${msg}`);
    onLog?.(msg);
  };

  try {
    const { headers, defaultParams } = generateHeadersAndParams();

    const dataMap = {
      eventid: eventid,
      userid: 0,
      platid: 2,
      rtype: 1,
      wasm: 1,
      i: '',
      sid: '',
      edt: '',
    };

    const dataStr = JSON.stringify(dataMap);
    const signature = signAndroidParams(defaultParams, dataStr, log);

    log(`请求URL: ${KG_API_BASE}/verifyservice/v3/get_verify_info`);

    const response = await axios({
      baseURL: KG_API_BASE,
      url: '/verifyservice/v3/get_verify_info',
      method: 'POST',
      data: dataMap,
      params: { ...defaultParams, signature },
      headers: {
        ...headers,
        Cookie: `mid=${defaultParams.mid}`,
      },
      timeout: 10000,
    });

    log(`响应状态: ${response.status}`);
    log(`响应数据: ${JSON.stringify(response.data)}`);

    const result = response.data;
    if (result.status === 1 && result.data) {
      log('获取验证信息成功');
      return { success: true, data: result.data, message: '获取成功' };
    } else {
      log(`获取失败: ${result.msg || '未知错误'}`);
      return { success: false, message: result.msg || '获取失败' };
    }
  } catch (error: any) {
    const errorMsg = error.response?.data
      ? JSON.stringify(error.response.data)
      : error.message || '网络错误';
    log(`请求异常: ${errorMsg}`);
    return { success: false, message: errorMsg };
  }
}

/**
 * 提交验证结果
 */
export async function verifyUserInfo(
  eventid: string,
  vType: number,
  verifycode: string,
  sid: string,
  edt: string,
  onLog?: LogCallback
): Promise<{ success: boolean; message: string }> {
  const log = (msg: string) => {
    console.log(`[KuGou] ${msg}`);
    onLog?.(msg);
  };

  log(`=== verifyUserInfo 开始 ===`);
  log(`入参: eventid=${eventid}, vType=${vType}, sid长度=${sid.length}, edt长度=${edt.length}`);

  try {
    // 复用缓存的设备信息，确保 mid/dfid 与 sendCaptcha 一致
    const { headers, defaultParams } = cachedDevice || generateHeadersAndParams();
    log(`设备信息: mid=${defaultParams.mid}, dfid=${defaultParams.dfid}, cached=${!!cachedDevice}`);

    // 当 sid/edt 为空时，使用纯 JS 模块生成模拟行为数据
    let finalSid = sid;
    let finalEdt = edt;
    if (!finalSid || !finalEdt) {
      log(`sid/edt 为空，开始生成...`);
      try {
        const simulate = generateSidEdt(defaultParams.mid, '0', defaultParams.dfid);
        finalSid = simulate.sid;
        finalEdt = simulate.edt;
        log(`sid/edt 生成成功, sid长度=${finalSid.length}, edt长度=${finalEdt.length}`);
      } catch (genError: any) {
        log(`sid/edt 生成失败: ${genError?.message}`);
      }
    }

    // 使用纯 JS 加密生成 pk 和 params（匹配 KuGouMusicApi 行为）
    log(`开始生成 pk/params...`);
    const encrypt = cryptoAesEncrypt({});
    const pk = cryptoRSAEncrypt({ key: encrypt.key }).toUpperCase();
    const params = encrypt.str;
    log(`pk长度=${pk.length}, params长度=${params.length}, key=${encrypt.key}`);

    let dataMap: any = {
      eventid: eventid,
      userid: 0,
      platid: 2,
      v_type: vType,
      wasm: 1,
      i: '',
      sid: finalSid,
      edt: finalEdt,
    };

    if (vType === 23) {
      dataMap = {
        ...dataMap,
        verifycode: verifycode,
        pk: pk,
        params: params,
      };
    }

    if (vType === 32) {
      dataMap = {
        ...dataMap,
        code: verifycode,
        pk: pk,
        params: params,
      };
    }

    const dataStr = JSON.stringify(dataMap);
    log(`请求体: ${dataStr.substring(0, 300)}...`);

    // 签名：查询参数只有 clientver: 11510（匹配 KuGouMusicApi）
    const queryParams = { ...defaultParams, clientver: 11510 };
    const signature = signAndroidParams(queryParams, dataStr, log);

    log(`最终签名: ${signature}`);
    log(`请求URL: https://verifyservice.kugou.com/v4/verify_user_info`);

    const response = await axios({
      baseURL: 'https://verifyservice.kugou.com',
      url: '/v4/verify_user_info',
      method: 'POST',
      data: dataMap,
      params: { ...queryParams, signature },
      headers: {
        ...headers,
        Cookie: `mid=${defaultParams.mid}`,
      },
      timeout: 10000,
    });

    log(`响应状态: ${response.status}`);
    log(`响应数据: ${JSON.stringify(response.data)}`);

    const result = response.data;
    if (result.status === 1 || result.error_code === 0) {
      log('=== verifyUserInfo 验证成功 ===');
      return { success: true, message: '验证成功' };
    } else {
      log(`=== verifyUserInfo 验证失败: ${result.msg || result.data || '未知错误'} ===`);
      return { success: false, message: result.msg || result.data || '验证失败' };
    }
  } catch (error: any) {
    const errorMsg = error.response?.data
      ? JSON.stringify(error.response.data)
      : error.message || '网络错误';
    log(`=== verifyUserInfo 异常: ${errorMsg} ===`);
    return { success: false, message: errorMsg };
  }
}

/**
 * 构建 cookie 字符串
 */
export function buildCookieString(data: {
  userid?: string;
  token?: string;
  t1?: string;
  dfid?: string;
  mid?: string;
}): string {
  const parts = [];
  if (data.userid) {
    parts.push(`KugooID=${data.userid}`);
    parts.push(`userid=${data.userid}`);
  }
  if (data.token) {
    parts.push(`t=${data.token}`);
    parts.push(`token=${data.token}`);
  }
  if (data.t1) parts.push(`t1=${data.t1}`);
  if (data.dfid) parts.push(`dfid=${data.dfid}`);
  if (data.mid) parts.push(`mid=${data.mid}`);
  return parts.join('; ');
}

/**
 * 解析 cookie 字符串为对象
 */
function cookieToJson(cookie: string): Record<string, string> {
  const result: Record<string, string> = {}
  if (!cookie) return result
  cookie.split(';').forEach(pair => {
    const [key, ...rest] = pair.split('=')
    if (key && rest.length) result[key.trim()] = rest.join('=').trim()
  })
  return result
}

/**
 * 获取酷狗用户歌单列表
 */
export async function getUserPlaylists(
  cookie: string,
  onLog?: LogCallback
): Promise<{ success: boolean; data?: any; message: string }> {
  const log = (msg: string) => {
    console.log(`[KuGou] ${msg}`);
    onLog?.(msg);
  };

  const cookieObj = cookieToJson(cookie)
  const userid = cookieObj.userid || cookieObj.KugooID || ''
  const token = cookieObj.token || cookieObj.t || ''

  if (!userid || !token) {
    return { success: false, message: '缺少 userid 或 token，Cookie可能已失效，请重新登录' }
  }

  log(`获取歌单: userid=${userid}`)

  try {
    const { headers, defaultParams } = generateHeadersAndParams()
    // 使用 Cookie 中的 dfid 和 mid
    if (cookieObj.dfid) defaultParams.dfid = cookieObj.dfid
    if (cookieObj.mid) defaultParams.mid = cookieObj.mid

    const dataMap = {
      userid,
      token,
      total_ver: 979,
      type: 2,
      page: 1,
      pagesize: 100,
    }

    const dataStr = JSON.stringify(dataMap)
    // 签名
    const queryParams = { ...defaultParams, plat: 1, userid: Number(userid), token }
    const signature = signAndroidParams(queryParams, dataStr, log)

    const response = await axios({
      baseURL: 'https://gateway.kugou.com',
      url: '/v7/get_all_list',
      method: 'POST',
      data: dataMap,
      params: { ...queryParams, signature },
      headers: {
        ...headers,
        dfid: cookieObj.dfid || headers.dfid,
        mid: cookieObj.mid || headers.mid,
        'x-router': 'cloudlist.service.kugou.com',
        Cookie: `mid=${cookieObj.mid || defaultParams.mid}`,
        'Content-Type': undefined, // 移除 Content-Type
      },
      timeout: 10000,
    })

    log(`响应状态: ${response.status}`)

    const result = response.data
    if (result.status === 1 && result.data) {
      const myUserId = Number(userid)
      const allList = (result.data.info || []).map((item: any) => {
        let cover = item.pic || ''
        if (cover && cover.includes('{size}')) {
          cover = cover.replace('{size}', '400')
        }
        const isFavorites = item.is_def === 2
        const isCollected = item.list_create_userid !== myUserId || item.type === 1
        return {
          id: item.global_collection_id || String(item.listid),
          listid: item.listid,
          name: item.name || '',
          cover,
          songCount: item.count || 0,
          desc: item.intro || '',
          isFavorites,
          isDef: item.is_def || 0,
          isCollected,
        }
      })
      // 分离自建歌单和收藏歌单
      const createdList = allList.filter((p: any) => !p.isCollected)
      const collectedList = allList.filter((p: any) => p.isCollected)
      // 自建歌单排序：我喜欢(is_def=2)放最前，默认收藏(is_def=1)放第二
      createdList.sort((a: any, b: any) => {
        if (a.isDef === 2) return -1
        if (b.isDef === 2) return 1
        if (a.isDef === 1) return -1
        if (b.isDef === 1) return 1
        return 0
      })
      // 为所有封面为空的歌单获取封面（我喜欢、默认收藏等）
      const emptyCoverPlaylists = createdList.filter((p: any) => !p.cover && p.songCount > 0)
      log(`需要获取封面的歌单: ${emptyCoverPlaylists.map((p: any) => p.name).join(', ')}`)
      for (const playlist of emptyCoverPlaylists) {
        try {
          const songsResult = await getPlaylistSongs(cookie, playlist.id, 1, 1)
          if (songsResult.success && songsResult.data?.list?.length) {
            const firstSong = songsResult.data.list[0]
            log(`歌单"${playlist.name}"第一首歌曲封面: ${firstSong.img || '空'}`)
            playlist.cover = firstSong.img || ''
          } else {
            log(`歌单"${playlist.name}"获取歌曲失败或无歌曲`)
          }
        } catch (e) {
          log(`获取歌单"${playlist.name}"封面失败: ${e}`)
        }
      }
      log(`获取成功: 自建${createdList.length}个, 收藏${collectedList.length}个`)
      return { success: true, data: { createdList, collectedList, total: result.data.list_count || allList.length } }
    } else {
      log(`获取失败: error_code=${result.error_code}`)
      return { success: false, message: `获取失败(${result.error_code})` }
    }
  } catch (error: any) {
    const errorMsg = error.response?.data
      ? JSON.stringify(error.response.data)
      : error.message || '网络错误'
    log(`异常: ${errorMsg}`)
    return { success: false, message: errorMsg }
  }
}

/**
 * 参数密钥签名（匹配 KuGouMusicApi signParamsKey）
 */
function signParamsKey(data: string): string {
  const result = stringMd5(`${KG_CONFIG.appid}${ANDROID_SIGN_SALT}${KG_CONFIG.clientver}${data}`)
  console.log(`[KuGou] signParamsKey: md5('${KG_CONFIG.appid}${ANDROID_SIGN_SALT}${KG_CONFIG.clientver}${data}') = ${result}`)
  return result
}

/**
 * 收藏歌单 / 新建歌单
 */
export async function subscribePlaylist(
  cookie: string,
  playlistInfo: {
    name: string
    list_create_userid: number
    list_create_listid: number
    list_create_gid?: string
    type?: number // 0=新建, 1=收藏
    is_pri?: number // 0=公开, 1=隐私
  },
  onLog?: LogCallback
): Promise<{ success: boolean; message: string }> {
  const log = (msg: string) => {
    console.log(`[KuGou] ${msg}`)
    onLog?.(msg)
  }

  const cookieObj = cookieToJson(cookie)
  const userid = cookieObj.userid || cookieObj.KugooID || ''
  const token = cookieObj.token || cookieObj.t || ''

  if (!userid || !token) {
    return { success: false, message: '缺少 userid 或 token，Cookie可能已失效，请重新登录' }
  }

  const type = playlistInfo.type ?? 1
  log(`${type === 1 ? '收藏' : '新建'}歌单: ${playlistInfo.name}`)

  try {
    const { headers, defaultParams } = generateHeadersAndParams()
    const clienttime = Math.floor(Date.now() / 1000)

    const dataMap: any = {
      userid: Number(userid),
      token,
      total_ver: 0,
      name: playlistInfo.name,
      type,
      source: 1,
      is_pri: playlistInfo.is_pri || 0,
      list_create_userid: playlistInfo.list_create_userid,
      list_create_listid: playlistInfo.list_create_listid,
      list_create_gid: playlistInfo.list_create_gid || '',
      from_shupinmv: 0,
    }

    const dataStr = JSON.stringify(dataMap)
    const queryParams = type === 0
      ? { ...defaultParams, last_time: clienttime, last_area: 'gztx', userid: Number(userid), token }
      : { ...defaultParams }
    const signature = signAndroidParams(queryParams, dataStr, log)

    const fullUrl = 'https://gateway.kugou.com/cloudlist.service/v5/add_list'
    const fullHeaders: Record<string, string> = {
      ...headers,
      dfid: cookieObj.dfid || headers.dfid,
      mid: cookieObj.mid || headers.mid,
      Cookie: `mid=${cookieObj.mid || defaultParams.mid}`,
    }
    delete fullHeaders['Content-Type']
    log(`请求URL: ${fullUrl}`)
    log(`请求头: ${JSON.stringify(fullHeaders)}`)
    log(`查询参数: ${JSON.stringify({ ...queryParams, signature })}`)

    const response = await axios({
      url: fullUrl,
      method: 'POST',
      data: dataMap,
      params: { ...queryParams, signature },
      headers: fullHeaders,
      timeout: 10000,
    })

    log(`响应状态: ${response.status}`)
    log(`响应数据: ${JSON.stringify(response.data)}`)

    const result = response.data
    if (result.status === 1 || result.error_code === 0) {
      log(`${type === 1 ? '收藏' : '新建'}成功`)
      return { success: true, message: `${type === 1 ? '收藏' : '新建'}成功` }
    } else {
      log(`操作失败: error_code=${result.error_code}`)
      return { success: false, message: `操作失败(${result.error_code})` }
    }
  } catch (error: any) {
    const errorMsg = error.response?.data
      ? JSON.stringify(error.response.data)
      : error.message || '网络错误'
    log(`异常: ${errorMsg}`)
    return { success: false, message: errorMsg }
  }
}

/**
 * 取消收藏歌单 / 删除歌单
 */
export async function unsubscribePlaylist(
  cookie: string,
  listid: number,
  onLog?: LogCallback
): Promise<{ success: boolean; message: string }> {
  const log = (msg: string) => {
    console.log(`[KuGou] ${msg}`)
    onLog?.(msg)
  }

  const cookieObj = cookieToJson(cookie)
  const userid = cookieObj.userid || cookieObj.KugooID || ''
  const token = cookieObj.token || cookieObj.t || ''

  if (!userid || !token) {
    return { success: false, message: '缺少 userid 或 token，Cookie可能已失效，请重新登录' }
  }

  log(`删除歌单: listid=${listid}`)

  try {
    const clienttime = Math.floor(Date.now() / 1000)

    const dataMap = {
      listid: Number(listid),
      total_ver: 0,
      type: 1,
    }

    const aesEncrypt = playlistAesEncrypt(dataMap)
    const rsaData = { aes: aesEncrypt.key, uid: userid, token }
    log(`RSA加密数据: ${JSON.stringify(rsaData)}`)
    const p = rsaEncrypt2(JSON.stringify(rsaData)).toUpperCase()

    const { headers, defaultParams } = generateHeadersAndParams()

    // 使用 Cookie 中的 dfid 和 mid（与 KuGouMusicApi 的 useAxios 行为一致）
    if (cookieObj.dfid) defaultParams.dfid = cookieObj.dfid
    if (cookieObj.mid) defaultParams.mid = cookieObj.mid

    // 合并默认参数（dfid, mid, uuid 等）和自定义参数
    // 注意：必须加入 token 和 userid，KuGouMusicApi 的 useAxios 会自动加入
    const paramsMap: Record<string, any> = {
      ...defaultParams,
      clienttime,
      key: signParamsKey(clienttime.toString()),
      last_area: 'gztx',
      last_time: clienttime,
      p,
    }
    if (token) paramsMap['token'] = token
    if (userid && userid !== '0') paramsMap['userid'] = userid

    const signature = signAndroidParams(paramsMap, aesEncrypt.str, log)

    const fullUrl = 'https://gateway.kugou.com/v2/delete_list'
    const fullHeaders: Record<string, string> = {
      ...headers,
      dfid: cookieObj.dfid || headers.dfid,
      mid: cookieObj.mid || headers.mid,
      'x-router': 'cloudlist.service.kugou.com',
      Cookie: `mid=${cookieObj.mid || defaultParams.mid}`,
    }
    delete fullHeaders['Content-Type'] // 不设置 Content-Type，让 axios 自动检测
    log(`请求URL: ${fullUrl}`)
    log(`请求头: ${JSON.stringify(fullHeaders)}`)
    log(`查询参数: ${JSON.stringify({ ...paramsMap, signature })}`)
    log(`请求体(加密): ${aesEncrypt.str.substring(0, 100)}...`)

    // 使用 fetch 替代 axios，正确处理二进制响应
    const queryString = Object.entries({ ...paramsMap, signature })
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join('&')
    const fetchUrl = `${fullUrl}?${queryString}`

    const fetchResponse = await fetch(fetchUrl, {
      method: 'POST',
      headers: fullHeaders,
      body: aesEncrypt.str,
    })

    log(`响应状态: ${fetchResponse.status}`)

    const arrayBuffer = await fetchResponse.arrayBuffer()
    const uint8Array = new Uint8Array(arrayBuffer)
    log(`响应数据长度: ${uint8Array.length}`)

    // 尝试解析为 JSON（未加密）或 AES 解密（加密）
    let result: any
    try {
      // 先尝试转为文本看是否是 JSON
      const textDecoder = new TextDecoder('utf-8')
      const text = textDecoder.decode(uint8Array)
      result = JSON.parse(text)
      log(`JSON解析: ${JSON.stringify(result)}`)
    } catch {
      // 不是 JSON，用 AES 解密
      const base64Str = Buffer.from(uint8Array).toString('base64')
      log(`Base64: ${base64Str.substring(0, 100)}...`)
      result = playlistAesDecrypt({ str: base64Str, key: aesEncrypt.key })
      log(`AES解密: ${JSON.stringify(result)}`)
    }

    if (result && (result.status === 1 || result.error_code === 0)) {
      log('删除成功')
      return { success: true, message: '删除成功' }
    } else {
      log(`删除失败: ${JSON.stringify(result)}`)
      return { success: false, message: `删除失败(${result?.error_code || 'unknown'})` }
    }
  } catch (error: any) {
    const errorMsg = error.response?.data
      ? JSON.stringify(error.response.data)
      : error.message || '网络错误'
    log(`异常: ${errorMsg}`)
    return { success: false, message: errorMsg }
  }
}

/**
 * 从歌单删除歌曲
 * 接口: /v4/delete_songs
 * fileids: 歌单中歌曲的fileid数组
 */
export async function removeSongsFromPlaylist(
  cookie: string,
  listid: number,
  fileids: number[],
  onLog?: LogCallback
): Promise<{ success: boolean; message: string }> {
  const log = (msg: string) => {
    console.log(`[KuGou] ${msg}`)
    onLog?.(msg)
  }

  const cookieObj = cookieToJson(cookie)
  const userid = cookieObj.userid || cookieObj.KugooID || ''
  const token = cookieObj.token || cookieObj.t || ''

  if (!userid || !token) {
    return { success: false, message: '缺少 userid 或 token，Cookie可能已失效，请重新登录' }
  }

  log(`从歌单删除歌曲: listid=${listid}, fileids=${fileids.join(',')}`)

  try {
    const { headers, defaultParams } = generateHeadersAndParams()

    // 构建 resource 数组
    const resource = fileids.map(id => ({ fileid: Number(id) }))

    const dataMap = {
      listid: Number(listid),
      userid: Number(userid),
      data: resource,
      type: 0,
      token,
      list_ver: 0,
    }

    const dataStr = JSON.stringify(dataMap)
    const signature = signAndroidParams(defaultParams, dataStr, log)

    const fullUrl = 'https://gateway.kugou.com/v4/delete_songs'
    const fullHeaders: Record<string, string> = {
      ...headers,
      dfid: cookieObj.dfid || headers.dfid,
      mid: cookieObj.mid || headers.mid,
      'x-router': 'cloudlist.service.kugou.com',
      Cookie: `mid=${cookieObj.mid || defaultParams.mid}`,
    }
    delete fullHeaders['Content-Type']
    log(`请求URL: ${fullUrl}`)
    log(`请求头: ${JSON.stringify(fullHeaders)}`)
    log(`查询参数: ${JSON.stringify({ ...defaultParams, signature })}`)

    const response = await axios({
      url: fullUrl,
      method: 'POST',
      data: dataMap,
      params: { ...defaultParams, signature },
      headers: fullHeaders,
      timeout: 10000,
    })

    log(`响应状态: ${response.status}`)

    const result = response.data
    if (result.status === 1 || result.error_code === 0) {
      log('删除成功')
      return { success: true, message: '删除成功' }
    } else {
      log(`删除失败: error_code=${result.error_code}`)
      return { success: false, message: result.msg || `删除失败(${result.error_code})` }
    }
  } catch (error: any) {
    const errorMsg = error.response?.data
      ? JSON.stringify(error.response.data)
      : error.message || '网络错误'
    log(`异常: ${errorMsg}`)
    return { success: false, message: errorMsg }
  }
}

/**
 * 添加歌曲到酷狗歌单
 * 接口: /cloudlist.service/v6/add_song
 */
export async function addSongToPlaylist(
  cookie: string,
  listid: number,
  songInfo: { name: string; hash: string; album_id?: number; mixsongid?: number },
  onLog?: LogCallback
): Promise<{ success: boolean; message: string }> {
  const log = (msg: string) => {
    console.log(`[KuGou] ${msg}`);
    onLog?.(msg);
  };

  const cookieObj = cookieToJson(cookie)
  const userid = cookieObj.userid || cookieObj.KugooID || ''
  const token = cookieObj.token || cookieObj.t || ''

  if (!userid || !token) {
    return { success: false, message: '缺少 userid 或 token，Cookie可能已失效，请重新登录' }
  }

  log(`添加歌曲到歌单: listid=${listid}, song=${songInfo.name}`)

  try {
    const { headers, defaultParams } = generateHeadersAndParams()
    const clienttime = Math.floor(Date.now() / 1000)

    // 构建 resource 数组（与 KuGouMusicApi 一致）
    const resource = [{
      number: 1,
      name: songInfo.name || '',
      hash: songInfo.hash || '',
      size: 0,
      sort: 0,
      timelen: 0,
      bitrate: 0,
      album_id: songInfo.album_id || 0,
      mixsongid: songInfo.mixsongid || 0,
    }];

    // 请求体（与 KuGouMusicApi 一致）
    const dataMap = {
      userid: Number(userid),
      token,
      listid,
      list_ver: 0,
      type: 0,
      slow_upload: 1,
      scene: 'false;null',
      data: resource,
    }

    const dataStr = JSON.stringify(dataMap)
    
    // 查询参数：defaultParams + 接口特定参数（不含 timestamp）
    const queryParams = {
      ...defaultParams,
      last_time: clienttime,
      last_area: 'gztx',
      userid: Number(userid),
      token,
    }

    // 签名：基于查询参数和请求体
    const signature = signAndroidParams(queryParams, dataStr, log)

    const fullUrl = 'https://gateway.kugou.com/cloudlist.service/v6/add_song'
    const fullHeaders: Record<string, string> = {
      ...headers,
      dfid: cookieObj.dfid || headers.dfid,
      mid: cookieObj.mid || headers.mid,
      Cookie: `mid=${cookieObj.mid || defaultParams.mid}`,
    }
    delete fullHeaders['Content-Type']

    log(`请求URL: ${fullUrl}`)
    log(`请求头: ${JSON.stringify(fullHeaders)}`)
    log(`查询参数: ${JSON.stringify({ ...queryParams, signature })}`)

    const response = await axios({
      url: fullUrl,
      method: 'POST',
      data: dataMap,
      params: { ...queryParams, signature },
      headers: fullHeaders,
      timeout: 10000,
    })

    log(`响应状态: ${response.status}`)
    log(`响应数据: ${JSON.stringify(response.data)}`)

    const result = response.data
    if (result.status === 1 || result.error_code === 0) {
      log('添加成功')
      // 返回添加的歌曲信息（用于乐观更新）
      const addedSong = result.data?.info?.[0] || null
      return { success: true, message: '添加成功', song: addedSong }
    } else {
      log(`添加失败: error_code=${result.error_code}`)
      return { success: false, message: result.msg || `添加失败(${result.error_code})` }
    }
  } catch (error: any) {
    const errorMsg = error.response?.data
      ? JSON.stringify(error.response.data)
      : error.message || '网络错误'
    log(`异常: ${errorMsg}`)
    return { success: false, message: errorMsg }
  }
}

/**
 * 获取酷狗歌单详情（歌曲列表）
 * 使用 global_collection_id 格式
 */
export async function getPlaylistSongs(
  cookie: string,
  globalCollectionId: string,
  page: number = 1,
  pagesize: number = 100,
  onLog?: LogCallback
): Promise<{ success: boolean; data?: any; message: string }> {
  const log = (msg: string) => {
    console.log(`[KuGou] ${msg}`);
    onLog?.(msg);
  };

  const cookieObj = cookieToJson(cookie)
  const userid = cookieObj.userid || cookieObj.KugooID || ''
  const token = cookieObj.token || cookieObj.t || ''

  log(`获取歌单详情: id=${globalCollectionId}, page=${page}`)

  try {
    const { headers, defaultParams } = generateHeadersAndParams()
    if (cookieObj.dfid) defaultParams.dfid = cookieObj.dfid
    if (cookieObj.mid) defaultParams.mid = cookieObj.mid

    const begin_idx = (page - 1) * pagesize
    const paramsMap = {
      ...defaultParams,
      area_code: 1,
      begin_idx,
      plat: 1,
      type: 1,
      mode: 1,
      personal_switch: 1,
      extend_fields: 'abtags,hot_cmt,popularization',
      pagesize,
      global_collection_id: globalCollectionId,
    }

    const signature = signAndroidParams(paramsMap, '', log)

    const fullUrl = 'https://gateway.kugou.com/pubsongs/v2/get_other_list_file_nofilt'
    const fullHeaders: Record<string, string> = {
      ...headers,
      dfid: cookieObj.dfid || headers.dfid,
      mid: cookieObj.mid || headers.mid,
      Cookie: `mid=${cookieObj.mid || defaultParams.mid}`,
    }
    delete fullHeaders['Content-Type']

    const response = await axios({
      url: fullUrl,
      method: 'GET',
      params: { ...paramsMap, signature },
      headers: fullHeaders,
      timeout: 10000,
    })

    const result = response.data
    if (result.status === 1 && result.data) {
      const list = (result.data.songs || []).map((item: any, index: number) => ({
        songmid: String(item.audio_id || item.hash || ''),
        name: item.songname || item.filename || item.name || '',
        singer: item.singername || '',
        albumName: item.album_name || '',
        albumMid: '',
        img: item.image ? `https://imge.kugou.com/stdmusic/${item.image.replace('{size}', '400')}` : '',
        interval: item.duration ? Math.floor(item.duration / 1000) : 0,
        source: 'kg',
        order: index,
        fileId: item.fileid || 0,
        hash: item.hash || '',
        albumId: item.album_id || 0,
        mixSongId: item.mixsongid || 0,
      }))
      log(`获取成功: ${list.length} 首歌曲`)
      return { success: true, data: { list, total: result.data.total || list.length } }
    } else {
      return { success: false, message: `获取失败(${result.error_code})` }
    }
  } catch (error: any) {
    const errorMsg = error.response?.data
      ? JSON.stringify(error.response.data)
      : error.message || '网络错误'
    log(`异常: ${errorMsg}`)
    return { success: false, message: errorMsg }
  }
}