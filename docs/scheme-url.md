# Scheme URL 支持

从 v1.6.0 起支持 Scheme URL，可以使用此功能从浏览器等场景下调用 LX Music。

调用格式：`lxmusic://<type>#<参数>`，以下为支持的 URL。

## URL 方式传参

| 描述 | URL | 参数 |
|------|-----|------|
| 打开搜索页 | `search` | 无 |
| 搜索关键词 | `search#keyword=<关键词>` | `keyword<String>`（搜索关键词，选传） |
| 搜索并指定平台 | `search#keyword=<关键词>&platform=<平台>` | `platform<String>`（平台，选传）可选值：`kw` `kg` `tx` `wy` `mg` `bilibili` `git` |
| 搜索并指定类型 | `search#keyword=<关键词>&type=<类型>` | `type<String>`（搜索类型，选传）可选值：`music` `songlist` `singer` `album` |
| 打开歌单页 | `nav?target=songlist` | 无 |
| 打开设置页 | `nav?target=setting` | 无 |
| 启动听歌识曲 | `recognition` | 无 |
| 播放 | `player/play` | 无 |
| 暂停 | `player/pause` | 无 |
| 下一首 | `player/skipNext` | 无 |
| 上一首 | `player/skipPrev` | 无 |
| 切换播放或暂停 | `player/togglePlay` | 无 |
| 收藏当前播放的歌曲 | `player/collect` | 无 |
| 取消收藏当前播放的歌曲 | `player/uncollect` | 无 |
| 不喜欢当前播放的歌曲 | `player/dislike` | 无 |

## 以 URL 传参的例子

用 `lxmusic://` 拼接上表中填充参数后的 URL 即可。

| 场景 | URL |
|------|-----|
| 打开搜索页 | `lxmusic://search` |
| 搜索周杰伦 | `lxmusic://search#keyword=周杰伦` |
| 在QQ音乐搜索周杰伦 | `lxmusic://search#keyword=周杰伦&platform=tx` |
| 在网易云搜索歌手 | `lxmusic://search#keyword=周杰伦&platform=wy&type=singer` |
| 在酷狗搜索歌单 | `lxmusic://search#keyword=周杰伦&platform=kg&type=songlist` |
| 在酷我搜索专辑 | `lxmusic://search#keyword=周杰伦&platform=kw&type=album` |
| 在哔哩哔哩搜索 | `lxmusic://search#keyword=周杰伦&platform=bilibili` |
| 在咪咕搜索 | `lxmusic://search#keyword=周杰伦&platform=mg` |
| 在Gitcode搜索 | `lxmusic://search#keyword=周杰伦&platform=git` |
| 打开歌单页 | `lxmusic://nav?target=songlist` |
| 打开设置页 | `lxmusic://nav?target=setting` |
| 启动听歌识曲 | `lxmusic://recognition` |
| 切换下一曲 | `lxmusic://player/skipNext` |
| 收藏当前歌曲 | `lxmusic://player/collect` |

## 注意事项

- 搜索 URL 中使用 `#` 分隔类型和参数，keyword 中的 `&` 无需编码
- 例如：`lxmusic://search#keyword=泷&翼&platform=wy&type=music`
