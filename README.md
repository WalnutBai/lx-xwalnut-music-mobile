<p align="center"><a href="https://github.com/lyswhut/lx-music-mobile"><img width="200" src="https://github.com/lyswhut/lx-music-mobile/blob/master/doc/images/icon.png" alt="lx-music logo"></a></p>

<h1 align="center">LX-X Music 移动版</h1>

<p align="center">
  <a href="https://github.com/WalnutBai/lx-lxwalnut-music-mobile/releases"><img src="https://img.shields.io/github/release/WalnutBai/lx-lxwalnut-music-mobile" alt="Release version"></a>
  <a href="https://github.com/WalnutBai/lx-lxwalnut-music-mobile/actions/workflows/release.yml"><img src="https://github.com/WalnutBai/lx-lxwalnut-music-mobile/workflows/Build/badge.svg" alt="Build status"></a>
  <a href="https://github.com/facebook/react-native"><img src="https://img.shields.io/github/package-json/dependency-version/WalnutBai/lx-lxwalnut-music-mobile/react-native/master" alt="React native version"></a>
</p>

<p align="center">一个基于 React Native 开发的音乐软件</p>

> **注**: 这是在三方修改版 `lx-lxnetease-music-mobile` 基础上继续改造，仅供个人自用
>
> 官方地址: [lx-lxnetease-music-mobile](https://github.com/souvenp/lx-netease-music-mobile)

> **注意**: 涉及同步、备份未充分测试，请自行备份重要文件

<p align="center">
  <b>⭐ 如果觉得不错，别光复刻了，点个 Star 吧！⭐</b>
</p>

---

## 最新发行版本更新日志：

## 26.06.12

### 新增

1. 添加播放器详情页新UI
2. 添加侧边栏，我的列表背景同步全局样式
3. 酷狗音乐平台登录
4. 酷狗歌单同步
5. 酷狗每日推荐
6. 酷狗歌手搜索、专辑搜索
7. 酷狗添加播放 MV
8. 酷狗更多设置快速跳转添加歌手详情、专辑
9. 酷狗添加音乐列表收藏、详情页收藏
10. QQ 音乐更多设置，跳转歌手详情专辑页
11. QQ 音乐歌手名快捷跳转
12. 适配点击 logo 返回我的列表

### 移除

1. 移除播放栏控件专辑显示

### 修复

1. 修复酷我歌单只显示 100 首的 bug
2. 修复在线导入不显示 bug
3. 修复收藏歌单消失 bug
4. 修复日志界面无法滑动
5. 修复部分机型启动报错 TypeError Cannot convert undefined value to object
6. 修复登录或退出网易云报错 BUG
7. 修复歌单播放全部无法使用
8. 修复部分歌单无法打开的 bug

## 26.06.10

### 新增

1. 新增QQ音乐Cookie登录、每日推荐、歌单同步功能
2. 新增歌曲详情页、歌手/专辑快捷跳转入口、QQ收藏功能
3. 新增迷你歌词功能，支持歌词对齐、封面尺寸自定义调节
4. 新增QQ相似歌曲推荐功能
5. 新增QQ网页登录获取Cookie能力
6. 新增QQ专辑搜索、歌手搜索接口
7. 新增QQ音源MV播放功能
8. 新增日志阈值配置，完善QQ歌单展示逻辑

### 优化

1. 更好的个人列表UI页面


### 移除

1. 移除QQ详情页部分无法实现的功能模块

### 修复

1. 修复展开QQ歌单闪屏问题
2. 修复QQ歌手、专辑详情多项功能缺陷及各类细小bug
3. 修复主题设置异常
4. 修复专辑歌单数量展示错误
5. 修复列表状态记忆失效Bug
6. 修复排序逻辑导致界面布局错乱问题
7. 修复哔哩哔哩分P结果展示异常、Cookie登录报错问题

## 26.06.8

### 新增

- 新增音源质量测试功能

### 修复

- 修复我的列表三点菜单无法打开报错的问题
- 修复无法歌曲换源的问题

## 26.06.7

### 新增

- 添加滑动切换歌曲功能
- 移除侧边栏我的列表中歌单排序功能
- 新增清除单曲缓存功能

### 优化

- 优化音频播放逻辑，解决URL过期、本地缓存异常引发的播放失败卡死无限加载问题
- 移除英文语言配置，修正部分繁体字显示异常问题（老外用这个？）
- 哔哩哔哩音质下载默认设置为 192K

### 修复

- 修复关闭封面旋转后封面展示位置异常问题
- 修复播放器销毁后，异步任务、动画继续运行导致视图重建报错的问题
- 修复哔哩哔哩搜索结果音质显示为未知/128k的问题

## 26.06.6

### 新增

- 哔哩哔哩音质默认改为 192K
- 添加插件排序功能
- 单个设置子选项添加背景容器
- 添加设置容器透明度设置
- 新增设置展开折叠

### 优化

- 优化排序功能，点击排序改为拖动排序

## 历史版本更新日志：

## 26.06.5

### 新增

- 内置Musicfree哔哩哔哩源，支持播放下载
- 哔哩哔哩搜索支持多P结果
- 哔哩哔哩搜索多P结果显示开关
- 添加多项日志控制开关
- 添加点击我的列表优先展开子菜单开关
- 添加音源文件单个导出功能

### 优化

- 自定义音源日志显示，删除无意义日志
- 我的列表页面新增自定义排序移除原本列表排序位置

### 修复

- 部分语言翻译问题

## 26.06.4

### 新增

- WebDAV 远程播放，支持匹配标签歌词，适配多文件夹情况下的歌单选择
- 左侧菜单排序
- 我的列表音乐列表排序（Pad 竖屏可见）
- 横向滚动界面排序
- 显示问候语开关
- 日志复制功能
- WebDAV 运行日志
- 隐藏小白条
- 上滑播放栏显示播放列表开关（搭配隐藏小白条用）

### 优化

- 底部播放栏背景样式同步设置修改
- 日志界面上下滑动卡顿 BUG
- 部分数据备份问题
- 音源播放日志

### 修复

- 部分音质无法向下兼容导致部分播放失败的BUG
- 我的歌单中音乐列表的背景样式 BUG
- 我中音乐列表的背景样式不同步设置修改的 BUG
- 每日推荐中推荐歌单背景样式不同步设置修改的 BUG
