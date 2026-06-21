import RNFetchBlob from 'rn-fetch-blob';
import {toMD5, toast, requestStoragePermission} from '@/utils/tools';
import { getMusicUrl, getLyricInfo } from '@/core/music';
import {getFileExtension, getFileExtensionFromUrl} from '@/screens/Home/Views/Mylist/MusicList/download/utils';
import { mergeLyrics } from '@/screens/Home/Views/Mylist/MusicList/download/lrcTool';
import {writeFile, unlink} from '@/utils/fs';
import { writeMetadata, writePic, writeLyric } from '@/utils/localMediaMetadata';
import settingState from '@/store/setting/state';
import downloadState from '@/store/download/state';
import downloadActions from '@/store/download/action';
import {filterFileName, sizeFormate} from "@/utils";
import { getPicUrl } from '@/core/music/online'
import DownloadTask = LX.Download.DownloadTask
import wySdk from '@/utils/musicSdk/wy'
import bilibiliSdk from '@/utils/musicSdk/bilibili'

const taskQueue: DownloadTask[] = [];
let isProcessing = false;
const DOWNLOAD_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Mobile Safari/537.36',
};
const WY_MEDIA_HEADERS = {
  'User-Agent': '',
}
const getDownloadHeaders = (task: DownloadTask) => {
  return task.musicInfo.source === 'wy' ? WY_MEDIA_HEADERS : DOWNLOAD_HEADERS
}
let currentDownloadTask: any | null = null;

const processQueue = async () => {
  if (isProcessing || taskQueue.length === 0) return;
  isProcessing = true;

  const task = taskQueue.shift();
  if (!task) {
    isProcessing = false;
    return;
  }

  try {
    await startDownload(task);
  } catch (error: any) {
    downloadActions.updateTask(task.id, { status: 'error', errorMsg: error.message });
  } finally {
    isProcessing = false;
    processQueue();
  }
};

const startDownload = async (task: DownloadTask) => {
  downloadActions.updateTask(task.id, { status: 'downloading' });

  let url: string;
  let headers: any = getDownloadHeaders(task);
  if (task.isForceCookie && task.musicInfo.source === 'wy') {
    const highQualityLevels: LX.Quality[] = ['flac', 'hires', 'master', 'atmos', 'atmos_plus'];
    console.log(`[Batch Download] Forcing cookie for ${task.musicInfo.name}`);
    try {
      const result = await wySdk.cookie.getMusicUrl(task.musicInfo, task.quality).promise;
      if (!result.url) throw new Error('Cookie 未能获取到URL');
      if (result.level === 'exhigh' && highQualityLevels.includes(task.quality)) {
        throw new Error(`请求的音质 ${task.quality} 不可用`);
      }
      url = result.url;
    } catch (error: any) {
      toast(`${task.musicInfo.name} 下载失败: ${error.message}`, 'short');
      removeTask(task.id);
      return;
    }
  } else {
    // 对于 bilibili 源，我们直接调用 SDK 来获取完整信息（包括 headers）
    if (task.musicInfo.source === 'bilibili') {
      console.log(`[Download] 处理 bilibili 源`);
      try {
        const result = await bilibiliSdk.getMusicUrl(task.musicInfo, task.quality).promise;
        url = result.url;
        if (result.headers) {
          headers = result.headers;
          console.log(`[Download] 使用 bilibili 自定义 headers`);
        }
      } catch (error: any) {
        toast(`${task.musicInfo.name} 下载失败: ${error.message}`, 'short');
        removeTask(task.id);
        return;
      }
    } else {
      // 其他源使用正常流程
      url = await getMusicUrl({ musicInfo: task.musicInfo, quality: task.quality, isRefresh: true });
    }
  }

  // 对于 bilibili 源，先以临时文件名下载，下载完成后再重命名为 mp3
  const isBilibiliSource = task.musicInfo.source === 'bilibili';
  let finalFilePath = task.filePath;

  // 获取 URL 中的真实扩展名
  const urlExtension = getFileExtensionFromUrl(url);
  const taskExt = task.filePath.substring(task.filePath.lastIndexOf('.') + 1).toLowerCase();

  // 如果是 bilibili 源，先使用临时扩展名下载
  let downloadFilePath = task.filePath;
  if (isBilibiliSource && urlExtension) {
    const downloadDir = settingState.setting['download.path'] || (RNFetchBlob.fs.dirs.MusicDir + '/LX-X Music');
    downloadFilePath = `${downloadDir}/${task.fileName}.download.${urlExtension}`;
    console.log(`[Download] Bilibili 源使用临时路径下载: ${downloadFilePath}`);
  } else if (urlExtension && urlExtension !== taskExt) {
    // 对于所有其他源，如果 URL 的真实扩展名与任务路径不一致，使用真实扩展名
    const downloadDir = settingState.setting['download.path'] || (RNFetchBlob.fs.dirs.MusicDir + '/LX-X Music');
    downloadFilePath = `${downloadDir}/${task.fileName}.download.${urlExtension}`;
    finalFilePath = `${downloadDir}/${task.fileName}.${urlExtension}`;
    console.log(`[Download] URL 扩展名(${urlExtension})与任务扩展名(${taskExt})不一致，使用真实扩展名下载: ${downloadFilePath} -> ${finalFilePath}`);
  }

  await requestStoragePermission()

  if (!task.isForceCookie) {
    toast(`${task.fileName} 正在下载...`, 'short');
  }
  let lastWritten = 0;
  let lastTime = Date.now();
  let downloadedFilePath: string;
  try {
    const downloadTask = RNFetchBlob.config({
      path: downloadFilePath,
      fileCache: true,
    }).fetch('GET', url, headers);

    currentDownloadTask = downloadTask;
    downloadTask.progress({ interval: 500 }, (written, total) => {
      const now = Date.now();
      const deltaTime = now - lastTime;
      if (deltaTime === 0) return;

      const deltaBytes = written - lastWritten;
      const speed = deltaBytes / (deltaTime / 1000);

      lastWritten = written;
      lastTime = now;
      const percent = total > 0 ? written / total : 0;
      downloadActions.updateTask(task.id, {
        progress: {
          ...task.progress,
          percent,
          downloaded: written,
          total,
          speed: `${sizeFormate(speed)}/s`,
        },
      });
    });

    const res = await downloadTask;
    downloadedFilePath = res.path();
    console.log('下载完成:', downloadedFilePath);
    
    // 下载完成后，如果最终路径与下载路径不一致，进行重命名
    if (finalFilePath !== downloadedFilePath) {
      try {
        await RNFetchBlob.fs.mv(downloadedFilePath, finalFilePath);
        downloadedFilePath = finalFilePath;
        console.log(`[Download] 重命名为最终路径: ${downloadedFilePath}`);
      } catch (renameError) {
        console.warn('[Download] 重命名失败:', renameError);
      }
    }
    
    // 对于 bilibili 源，跳过元数据处理（歌词、封面等）
    if (!isBilibiliSource) {
      await handleMetadata(task, downloadedFilePath);
    } else {
      console.log('[Download] Bilibili 源跳过元数据处理');
      downloadActions.updateTask(task.id, { metadataStatus: { cover: 'success', lyric: 'success', tags: 'success' } });
    }
    try {
      await RNFetchBlob.fs.scanFile([{ path: downloadedFilePath }]);
      console.log(`[Download Manager] Media scan requested for: ${downloadedFilePath}`);
    } catch (scanError) {
      console.error(`[Download Manager] Failed to request media scan for ${downloadedFilePath}:`, scanError);
    }
    downloadActions.updateTask(task.id, { status: 'completed', progress: { ...task.progress, percent: 1 }, filePath: downloadedFilePath });

    if (!task.isForceCookie) {
      toast(`${task.fileName} 下载完成!`, 'short');
    }
  } finally {
    currentDownloadTask = null;
  }
};

const handleMetadata = async (task: DownloadTask, filePath: string) => {
  console.log('开始处理元数据:', filePath);
  
  // 获取文件扩展名，用于后续处理
  const fileExt = filePath.substring(filePath.lastIndexOf('.') + 1).toLowerCase();
  console.log(`[Metadata] 文件格式: ${fileExt}`);
  
  // 写入标签
  if (settingState.setting['download.writeMetadata']) {
    try {
      const title = settingState.setting['download.writeAlias'] && task.musicInfo.alias
        ? `${task.musicInfo.name} (${task.musicInfo.alias})`
        : task.musicInfo.name;

      await writeMetadata(filePath, {
        name: title,
        singer: task.musicInfo.singer,
        albumName: task.musicInfo.meta.albumName,
      }, true);
      downloadActions.updateTask(task.id, { metadataStatus: { ...task.metadataStatus, tags: 'success' } });
    } catch (e: any) {
      console.error('[Metadata] 标签信息写入失败:', e?.message || e);
      toast('标签信息写入失败', 'short');
      downloadActions.updateTask(task.id, { metadataStatus: { ...task.metadataStatus, tags: 'fail' } });
    }
  }

  const downloadDir = settingState.setting['download.path'] || (RNFetchBlob.fs.dirs.MusicDir + '/LX-X Music')
  // 写入封面
  if (settingState.setting['download.writePicture']) {
    try {
      const picUrl = await getPicUrl({ musicInfo: task.musicInfo });
      const extension = getFileExtensionFromUrl(picUrl) || 'jpg'
      const picPath = `${downloadDir}/temp.${extension}`
      console.log(`[Metadata] 下载封面: ${picUrl} -> ${picPath}`);
      const res = await RNFetchBlob.config({ path: picPath }).fetch('GET', picUrl);
      console.log(`[Metadata] 封面下载完成，开始写入到音频文件`);
      await writePic(filePath, res.path());
      await unlink(res.path());
      console.log(`[Metadata] 封面写入完成`);
      downloadActions.updateTask(task.id, { metadataStatus: { ...task.metadataStatus, cover: 'success' } });
    } catch (e: any) {
      console.error('[Metadata] 封面写入失败:', e?.message || e);
      toast('封面写入失败', 'short');
      downloadActions.updateTask(task.id, { metadataStatus: { ...task.metadataStatus, cover: 'fail' } });
    }
  }

  // 写入歌词
  if (settingState.setting['download.writeLyric'] || settingState.setting['download.writeEmbedLyric']) {
    try {
      const lyrics = await getLyricInfo({ musicInfo: task.musicInfo as LX.Music.MusicInfoOnline });
      const baseFilePath = filePath.substring(0, filePath.lastIndexOf('.'));
      const romaLyric = settingState.setting['download.writeRomaLyric'] ? lyrics.rlyric : null;

      if (settingState.setting['download.writeEmbedLyric']) {
        const embedLyricContent = mergeLyrics(lyrics.lyric, lyrics.tlyric, romaLyric);
        if (embedLyricContent) {
          console.log(`[Metadata] 写入嵌入歌词`);
          await writeLyric(filePath, embedLyricContent);
        }
      }
      if (settingState.setting['download.writeLyric']) {
        const finalLyricContent = mergeLyrics(lyrics.lyric, lyrics.tlyric, romaLyric);
        if (finalLyricContent) {
          const lrcPath = `${baseFilePath}.lrc`;
          console.log(`[Metadata] 写入歌词文件: ${lrcPath}`);
          await writeFile(lrcPath, finalLyricContent);
        }
      }
      downloadActions.updateTask(task.id, { metadataStatus: { ...task.metadataStatus, lyric: 'success' } });
    } catch (e: any) {
      console.error('[Metadata] 歌词写入失败:', e?.message || e);
      toast('歌词写入失败', 'short');
      downloadActions.updateTask(task.id, { metadataStatus: { ...task.metadataStatus, lyric: 'fail' } });
    }
  }
};

export const retryMetadata = async (taskId: string) => {
  const task = downloadState.tasks.find(t => t.id === taskId);
  if (!task || !task.filePath) {
    toast('任务或文件不存在，无法重试');
    return;
  }

  console.log(`[Retry Metadata] 开始重试元数据写入，文件: ${task.filePath}`);
  toast('正在尝试重新获取元信息...');
  const filePath = task.filePath;
  const metadataStatus = { ...task.metadataStatus };

  // 获取文件扩展名
  const fileExt = filePath.substring(filePath.lastIndexOf('.') + 1).toLowerCase();
  console.log(`[Retry Metadata] 文件格式: ${fileExt}`);

  // 重试写入标签
  if (metadataStatus.tags === 'fail' && settingState.setting['download.writeMetadata']) {
    try {
      const title = settingState.setting['download.writeAlias'] && task.musicInfo.alias
        ? `${task.musicInfo.name} (${task.musicInfo.alias})`
        : task.musicInfo.name;

      console.log(`[Retry Metadata] 写入标签: title=${title}, singer=${task.musicInfo.singer}`);
      await writeMetadata(filePath, {
        name: title,
        singer: task.musicInfo.singer,
        albumName: task.musicInfo.meta.albumName,
      }, true);
      metadataStatus.tags = 'success';
      console.log(`[Retry Metadata] 标签写入成功`);
    } catch (e: any) {
      console.error(`[Retry Metadata] Write Tags Error for ${task.musicInfo.name}:`, e?.message || e);
      metadataStatus.tags = 'fail';
    }
  }

  // 重试写入封面
  if (metadataStatus.cover === 'fail' && settingState.setting['download.writePicture']) {
    try {
      const picUrl = await getPicUrl({ musicInfo: task.musicInfo as LX.Music.MusicInfoOnline });
      const extension = getFileExtensionFromUrl(picUrl) || 'jpg';
      const picPath = `${RNFetchBlob.fs.dirs.CacheDir}/lx_temp_pic_${task.id}.${extension}`;

      console.log(`[Retry Metadata] 下载封面: ${picUrl} -> ${picPath}`);
      const res = await RNFetchBlob.config({ path: picPath }).fetch('GET', picUrl);
      console.log(`[Retry Metadata] 封面下载完成，开始写入`);
      await writePic(filePath, res.path());
      await unlink(res.path());
      metadataStatus.cover = 'success';
      console.log(`[Retry Metadata] 封面写入成功`);
    } catch (e: any) {
      console.error(`[Retry Metadata] Write Cover Error for ${task.musicInfo.name}:`, e?.message || e);
      metadataStatus.cover = 'fail';
    }
  }

  // 重试写入歌词
  if (metadataStatus.lyric === 'fail' && (settingState.setting['download.writeLyric'] || settingState.setting['download.writeEmbedLyric'])) {
    try {
      const lyrics = await getLyricInfo({ musicInfo: task.musicInfo as LX.Music.MusicInfoOnline });
      const baseFilePath = filePath.substring(0, filePath.lastIndexOf('.'));
      const romaLyric = settingState.setting['download.writeRomaLyric'] ? lyrics.rlyric : null;

      if (settingState.setting['download.writeEmbedLyric']) {
        const embedLyricContent = mergeLyrics(lyrics.lyric, lyrics.tlyric, romaLyric);
        if (embedLyricContent) {
          console.log(`[Retry Metadata] 写入嵌入歌词`);
          await writeLyric(filePath, embedLyricContent);
        }
      }
      if (settingState.setting['download.writeLyric']) {
        const finalLyricContent = mergeLyrics(lyrics.lyric, lyrics.tlyric, romaLyric);
        if (finalLyricContent) {
          const lrcPath = `${baseFilePath}.lrc`;
          console.log(`[Retry Metadata] 写入歌词文件: ${lrcPath}`);
          await writeFile(lrcPath, finalLyricContent);
        }
      }
      metadataStatus.lyric = 'success';
      console.log(`[Retry Metadata] 歌词写入成功`);
    } catch (e: any) {
      console.error(`[Retry Metadata] Write Lyric Error for ${task.musicInfo.name}:`, e?.message || e);
      metadataStatus.lyric = 'fail';
    }
  }

  downloadActions.updateTask(task.id, { metadataStatus });

  if (Object.values(metadataStatus).every(s => s !== 'fail')) {
    toast('元信息已全部修复成功！');
  } else {
    toast('部分元信息修复失败，请检查日志', 'long');
  }
};

export const retryTask = (taskId: string) => {
  const task = downloadState.tasks.find(t => t.id === taskId);
  if (!task) return;

  // 如果歌曲文件下载失败，或者文件路径不存在，则重新下载整个文件
  if (task.status === 'error' || !task.filePath) {
    toast('正在重新下载...');
    // 通过先移除再添加的方式实现重新下载
    removeTask(task.id);
    // 延迟一下，确保状态更新
    setTimeout(() => {
      addTask(task.musicInfo, task.quality);
    }, 200);
  }
  // 如果文件已存在，但元信息失败，则只重试元信息
  else if (Object.values(task.metadataStatus ?? {}).includes('fail')) {
    void retryMetadata(task.id);
  }
};

export const resumeTask = async (taskId: string) => {
  const task = downloadState.tasks.find(t => t.id === taskId);
  if (!task) return;
  if (task.status !== 'paused') return;

  if (taskQueue.some(t => t.id === task.id)) {
    return;
  }

  try {
    await unlink(task.filePath);
  } catch (error) {
    // Ignore cleanup failures so we can still restart the download.
  }

  downloadActions.updateTask(task.id, {
    status: 'waiting',
    errorMsg: '',
    progress: { percent: 0, speed: '', downloaded: 0, total: 0 },
    metadataStatus: { cover: 'pending', lyric: 'pending', tags: 'pending' },
  });
  taskQueue.push(task);
  processQueue();
};

export const addTask = (musicInfo: LX.Music.MusicInfo, quality: LX.Quality, isForceCookie: boolean = false) => {
  // 对于 bilibili 源，默认使用 mp3 扩展名
  let extension = getFileExtension(quality);
  if (musicInfo.source === 'bilibili') {
    extension = 'mp3';
  }

  let finalSingerString = musicInfo.singer;
  // 文件名过长的情况下，只取前6个歌手名
  if (musicInfo.artists && musicInfo.artists.length > 6) {
    finalSingerString = musicInfo.artists.slice(0, 6).map(artist => artist.name).join('、') + '...';
  }
  let fileName = settingState.setting['download.fileName']
    .replace('歌名', musicInfo.name)
    .replace('歌手', finalSingerString);
  fileName = filterFileName(fileName);
  const downloadDir = settingState.setting['download.path'] || (RNFetchBlob.fs.dirs.MusicDir + '/LX-X Music');
  const filePath = `${downloadDir}/${fileName}.${extension}`;

  const task: DownloadTask = {
    id: toMD5(`${musicInfo.id}-${quality}`),
    musicInfo,
    quality,
    status: 'waiting',
    filePath,
    fileName,
    progress: { percent: 0, speed: '', downloaded: 0, total: 0 },
    metadataStatus: { cover: 'pending', lyric: 'pending', tags: 'pending' },
    createdAt: Date.now(),
    isForceCookie,
  };

  if (downloadState.tasks.some(t => t.id === task.id)) {
    toast('任务已存在');
    return;
  }

  downloadActions.addTask(task);
  taskQueue.push(task);
  processQueue();
};

export const removeTask = (id: string) => {
  const taskToRemove = downloadState.tasks.find(t => t.id === id);
  if (currentDownloadTask && taskToRemove && taskToRemove.status === 'downloading') {
    currentDownloadTask.cancel(async () => {
      try {
        console.log(taskToRemove)
        if (taskToRemove.filePath) {
          await unlink(taskToRemove.filePath);
          console.log(`[Download Manager] Canceled and deleted partial file: ${taskToRemove.filePath}`);
        }
      } catch (error) {
        console.error(`[Download Manager] Failed to delete partial file on remove:`, error);
      }
      currentDownloadTask = null;
    })
  } else if (taskToRemove && taskToRemove.status !== 'completed' && taskToRemove.filePath) {
    void unlink(taskToRemove.filePath).catch(() => {});
  }
  // 从队列中移除
  const taskIndex = taskQueue.findIndex(t => t.id === id);
  if (taskIndex > -1) taskQueue.splice(taskIndex, 1);
  // 从store中移除
  downloadActions.removeTask(id);
  isProcessing = false;
  processQueue();
};


/**
 * 批量下载任务 - 使用网易云源和Cookie，并间隔添加
 * @param musicInfos 选中的歌曲列表
 */
export const batchDownload = async (musicInfos: LX.Music.MusicInfo[]) => {
  const cookie = settingState.setting['common.wy_cookie'];
  if (!cookie) {
    toast('请先在设置中配置网易云 Cookie');
    return;
  }

  const wyMusicInfos = musicInfos.filter(m => m.source === 'wy');
  if (musicInfos.length > wyMusicInfos.length) {
    toast('已自动过滤非网易云音源的歌曲');
  }
  if (!wyMusicInfos.length) {
    toast('未选择任何网易云音源的歌曲');
    return;
  }

  const quality = settingState.setting['player.playQuality'];
  toast(`准备添加 ${wyMusicInfos.length} 首歌曲到下载队列...`);
  for (const musicInfo of wyMusicInfos) {
    addTask(musicInfo, quality, true);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
};
