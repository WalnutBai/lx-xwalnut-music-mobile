import searchMusicState, { type Source } from '@/store/search/music/state'
import searchMusicActions, { type SearchResult } from '@/store/search/music/action'
import musicSdk from '@/utils/musicSdk'
import { log } from '@/utils/log'

log.info('[Search Music] 模块初始化')
log.info('[Search Music] musicSdk sources: ' + Object.keys(musicSdk).join(', '))
log.info('[Search Music] searchMusicState.sources: ' + searchMusicState.sources.join(', '))

export const setSource: (typeof searchMusicActions)['setSource'] = (source) => {
  searchMusicActions.setSource(source)
}
export const setSearchText: (typeof searchMusicActions)['setSearchText'] = (text) => {
  searchMusicActions.setSearchText(text)
}
export const setListInfo: typeof searchMusicActions.setListInfo = (result, id, page) => {
  return searchMusicActions.setListInfo(result, id, page)
}

export const clearListInfo: typeof searchMusicActions.clearListInfo = (source) => {
  searchMusicActions.clearListInfo(source)
}

export const search = async (
  text: string,
  page: number,
  sourceId: Source
): Promise<LX.Music.MusicInfoOnline[]> => {
  log.info('========== [Search Music] 搜索开始 ==========')
  log.info('[Search Music] 参数:')
  log.info('  - 关键词: "' + text + '"')
  log.info('  - 页码: ' + page)
  log.info('  - 源ID: ' + sourceId)
  log.info('[Search Music] 可用源列表: ' + searchMusicState.sources.join(', '))
  log.info('[Search Music] musicSdk keys: ' + Object.keys(musicSdk).join(', '))
  
  const listInfo = searchMusicState.listInfos[sourceId]!
  if (!text) {
    log.info('[Search Music] 文本为空，返回空数组')
    return []
  }
  
  const key = `${page}__${text}`
  log.info('[Search Music] 缓存key: ' + key)
  
  if (sourceId == 'all') {
    log.info('[Search Music] 聚合搜索模式')
    listInfo.key = key
    let task = []
    for (const source of searchMusicState.sources) {
      if (source == 'all') continue
      
      log.info('[Search Music] 检查源 "' + source + '":')
      log.info('  - musicSdk[' + source + '] 存在: ' + (!!musicSdk[source]))
      log.info('  - musicSdk[' + source + '].musicSearch 存在: ' + (!!musicSdk[source]?.musicSearch))
      
      if (!musicSdk[source]?.musicSearch) {
        log.warn('[Search Music] 源 "' + source + '" 没有 musicSearch，跳过')
        continue
      }
      
      log.info('[Search Music] 添加源 "' + source + '" 到搜索任务')
      task.push(
        (
          (musicSdk[source]?.musicSearch.search(
            text,
            page,
            searchMusicState.listInfos.all.limit,
            0,
            { enableSerpApi: false }
          ) as Promise<SearchResult>) ?? Promise.reject(new Error('source not found: ' + source))
        ).catch((error: any) => {
          log.error('[Search Music] 源 "' + source + '" 搜索失败: ' + error.message)
          return {
            allPage: 1,
            limit: 30,
            list: [],
            source,
            total: 0,
          }
        })
      )
    }
    
    log.info('[Search Music] 共 ' + task.length + ' 个搜索任务')
    return Promise.all(task).then((results: SearchResult[]) => {
      log.info('[Search Music] 所有搜索任务完成')
      log.info('[Search Music] 结果统计:')
      results.forEach((r, i) => {
        log.info('  - 结果 ' + (i + 1) + ': 源=' + r.source + ', 数量=' + r.list.length + ', 总页数=' + r.allPage)
      })
      
      if (key != listInfo.key) {
        log.info('[Search Music] key不匹配，返回空数组')
        return []
      }
      setSearchText(text)
      setSource(sourceId)
      const finalList = setListInfo(results, page, text)
      log.info('[Search Music] 最终列表长度: ' + finalList.length)
      log.info('========== [Search Music] 搜索完成 ==========')
      return finalList
    })
  } else {
    log.info('[Search Music] 单源搜索模式: ' + sourceId)
    log.info('[Search Music] 检查 musicSdk[' + sourceId + ']:')
    log.info('  - 存在: ' + (!!musicSdk[sourceId]))
    log.info('  - musicSearch 存在: ' + (!!musicSdk[sourceId]?.musicSearch))
    
    if (listInfo?.key == key && listInfo?.list.length) {
      log.info('[Search Music] 使用缓存结果')
      return listInfo?.list
    }
    
    listInfo.key = key
    
    if (!musicSdk[sourceId]?.musicSearch) {
      log.error('[Search Music] 源 "' + sourceId + '" 不存在或没有 musicSearch')
      return Promise.reject(new Error('source not found: ' + sourceId))
    }
    
    log.info('[Search Music] 调用 musicSdk[' + sourceId + '].musicSearch.search(...)')
    return (
      musicSdk[sourceId]?.musicSearch
        .search(text, page, listInfo.limit, 0, { enableSerpApi: sourceId == 'wy' })
        .then((data: SearchResult) => {
          log.info('[Search Music] 源 "' + sourceId + '" 搜索成功')
          log.info('  - 结果数量: ' + data.list.length)
          log.info('  - 总页数: ' + data.allPage)
          log.info('  - 总数: ' + data.total)
          
          if (key != listInfo.key) {
            log.info('[Search Music] key不匹配，返回空数组')
            return []
          }
          const finalList = setListInfo(data, page, text)
          log.info('[Search Music] 最终列表长度: ' + finalList.length)
          log.info('========== [Search Music] 搜索完成 ==========')
          return finalList
        }) ?? Promise.reject(new Error('source not found: ' + sourceId))
    ).catch((err: any) => {
      log.error('[Search Music] 源 "' + sourceId + '" 搜索失败: ' + err.message)
      log.error('========== [Search Music] 搜索错误 ==========')
      if (listInfo.list.length && page == 1) clearListInfo(sourceId)
      throw err
    })
  }
}