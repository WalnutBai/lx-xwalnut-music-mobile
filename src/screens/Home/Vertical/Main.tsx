import { useCallback, useEffect, useMemo, useRef, useState, type ComponentRef, type ReactNode } from 'react'
import {Keyboard, View} from 'react-native'
import Search from '../Views/Search'
import SongList from '../Views/SongList'
import Mylist from '../Views/Mylist'
import Leaderboard from '../Views/Leaderboard'
import Setting from '../Views/Setting'
import commonState, { type InitState as CommonState } from '@/store/common/state'
import { createStyle } from '@/utils/tools'
import PagerView, {
  type PageScrollStateChangedNativeEvent,
  type PagerViewOnPageSelectedEvent,
} from 'react-native-pager-view'
import { setNavActiveId } from '@/core/common'
import settingState from '@/store/setting/state'
import DailyRec from '../Views/DailyRec'
import TXDailyRec from '../Views/DailyRec/TXDailyRec'
import MyPlaylist from '../Views/MyPlaylist'
import FollowedArtists from '../Views/FollowedArtists'
import SubscribedAlbums from '../Views/SubscribedAlbums';
import {NAV_MENUS, type NAV_ID_Type} from "@/config/constant.ts";
import {useSettingValue} from "@/store/setting/hook.ts";
import PlayHistory from '../Views/PlayHistory'
import { useTheme } from '@/store/theme/hook'
import OneDrive from '../Views/OneDrive'
import WebDAV from '../Views/WebDAV'
import TXPlaylist from '../Views/TxPlaylist'
import KgPlaylist from '../Views/KgPlaylist'
import KgDailyRec from '../Views/KgDailyRec'

const hideKeys = ['list.isShowAlbumName', 'list.isShowInterval'] as Readonly<
  Array<keyof LX.AppSetting>
>

const SearchPage = () => {
  const [visible, setVisible] = useState(commonState.navActiveId == 'nav_search')
  const component = useMemo(() => <Search />, [])
  useEffect(() => {
    let currentId: CommonState['navActiveId'] = commonState.navActiveId
    const handleNavIdUpdate = (id: CommonState['navActiveId']) => {
      currentId = id
      if (id == 'nav_search') {
        requestAnimationFrame(() => {
          setVisible(true)
        })
      }
    }
    const handleHide = () => {
      if (currentId != 'nav_setting') return
      setVisible(false)
    }
    const handleConfigUpdated = (keys: Array<keyof LX.AppSetting>) => {
      if (keys.some((k) => hideKeys.includes(k))) handleHide()
    }
    global.state_event.on('navActiveIdUpdated', handleNavIdUpdate)
    global.state_event.on('themeUpdated', handleHide)
    global.state_event.on('languageChanged', handleHide)
    global.state_event.on('configUpdated', handleConfigUpdated)

    return () => {
      global.state_event.off('navActiveIdUpdated', handleNavIdUpdate)
      global.state_event.off('themeUpdated', handleHide)
      global.state_event.off('languageChanged', handleHide)
      global.state_event.off('configUpdated', handleConfigUpdated)
    }
  }, [])

  return visible ? component : null
}
const SongListPage = () => {
  const [visible, setVisible] = useState(commonState.navActiveId == 'nav_songlist')
  const component = useMemo(() => <SongList />, [])
  useEffect(() => {
    let currentId: CommonState['navActiveId'] = commonState.navActiveId
    const handleNavIdUpdate = (id: CommonState['navActiveId']) => {
      currentId = id
      if (id == 'nav_songlist') {
        requestAnimationFrame(() => {
          setVisible(true)
        })
      }
    }
    const handleHide = () => {
      if (currentId != 'nav_setting') return
      setVisible(false)
    }
    const handleConfigUpdated = (keys: Array<keyof LX.AppSetting>) => {
      if (keys.some((k) => hideKeys.includes(k))) handleHide()
    }
    global.state_event.on('navActiveIdUpdated', handleNavIdUpdate)
    global.state_event.on('themeUpdated', handleHide)
    global.state_event.on('languageChanged', handleHide)
    global.state_event.on('configUpdated', handleConfigUpdated)

    return () => {
      global.state_event.off('navActiveIdUpdated', handleNavIdUpdate)
      global.state_event.off('themeUpdated', handleHide)
      global.state_event.off('languageChanged', handleHide)
      global.state_event.on('configUpdated', handleConfigUpdated)
    }
  }, [])

  return visible ? component : null
  // return activeId == 1 || activeId == 0  ? SongList : null
}
const PlayHistoryOverlay = () => {
  const [visible, setVisible] = useState(commonState.navActiveId == 'nav_play_history')
  const component = useMemo(() => <PlayHistory />, [])
  const theme = useTheme()
  useEffect(() => {
    const handleNavIdUpdate = (id: CommonState['navActiveId']) => {
      requestAnimationFrame(() => {
        setVisible(id == 'nav_play_history')
      })
    }
    global.state_event.on('navActiveIdUpdated', handleNavIdUpdate)
    return () => {
      global.state_event.off('navActiveIdUpdated', handleNavIdUpdate)
    }
  }, [])

  return visible ? (
    <View style={{ ...styles.historyOverlay, backgroundColor: theme['c-content-background'] }}>
      {component}
    </View>
  ) : null
}

const isMenuVisible = (id: NAV_ID_Type, navStatus: Partial<Record<NAV_ID_Type, boolean>>) => (
  id !== 'nav_play_history' && (id === 'nav_setting' || (navStatus[id] ?? true))
)
const LeaderboardPage = () => {
  const [visible, setVisible] = useState(commonState.navActiveId == 'nav_top')
  const component = useMemo(() => <Leaderboard />, [])
  useEffect(() => {
    let currentId: CommonState['navActiveId'] = commonState.navActiveId
    const handleNavIdUpdate = (id: CommonState['navActiveId']) => {
      currentId = id
      if (id == 'nav_top') {
        requestAnimationFrame(() => {
          setVisible(true)
        })
      }
    }
    const handleHide = () => {
      if (currentId != 'nav_setting') return
      setVisible(false)
    }
    const handleConfigUpdated = (keys: Array<keyof LX.AppSetting>) => {
      if (keys.some((k) => hideKeys.includes(k))) handleHide()
    }
    global.state_event.on('navActiveIdUpdated', handleNavIdUpdate)
    global.state_event.on('themeUpdated', handleHide)
    global.state_event.on('languageChanged', handleHide)
    global.state_event.on('configUpdated', handleConfigUpdated)

    return () => {
      global.state_event.off('navActiveIdUpdated', handleNavIdUpdate)
      global.state_event.off('themeUpdated', handleHide)
      global.state_event.off('languageChanged', handleHide)
      global.state_event.on('configUpdated', handleConfigUpdated)
    }
  }, [])

  return visible ? component : null
}

const DailyRecPage = () => {
  const [visible, setVisible] = useState(commonState.navActiveId == 'nav_daily_rec')
  const component = useMemo(() => <DailyRec />, [])
  useEffect(() => {
    let currentId: CommonState['navActiveId'] = commonState.navActiveId
    const handleNavIdUpdate = (id: CommonState['navActiveId']) => {
      currentId = id
      if (id == 'nav_daily_rec') {
        requestAnimationFrame(() => {
          setVisible(true)
        })
      }
    }
    const handleHide = () => {
      if (currentId != 'nav_setting') return
      setVisible(false)
    }
    const handleConfigUpdated = (keys: Array<keyof LX.AppSetting>) => {
      if (keys.some((k) => hideKeys.includes(k))) handleHide()
    }
    global.state_event.on('navActiveIdUpdated', handleNavIdUpdate)
    global.state_event.on('themeUpdated', handleHide)
    global.state_event.on('languageChanged', handleHide)
    global.state_event.on('configUpdated', handleConfigUpdated)

    return () => {
      global.state_event.off('navActiveIdUpdated', handleNavIdUpdate)
      global.state_event.off('themeUpdated', handleHide)
      global.state_event.off('languageChanged', handleHide)
      global.state_event.on('configUpdated', handleConfigUpdated)
    }
  }, [])

  return visible ? component : null
}

const TXDailyRecPage = () => {
  const [visible, setVisible] = useState(commonState.navActiveId == 'nav_tx_daily_rec')
  const component = useMemo(() => <TXDailyRec />, [])
  useEffect(() => {
    let currentId: CommonState['navActiveId'] = commonState.navActiveId
    const handleNavIdUpdate = (id: CommonState['navActiveId']) => {
      currentId = id
      if (id == 'nav_tx_daily_rec') {
        requestAnimationFrame(() => {
          setVisible(true)
        })
      }
    }
    const handleHide = () => {
      if (currentId != 'nav_setting') return
      setVisible(false)
    }
    const handleConfigUpdated = (keys: Array<keyof LX.AppSetting>) => {
      if (keys.some((k) => hideKeys.includes(k))) handleHide()
    }
    global.state_event.on('navActiveIdUpdated', handleNavIdUpdate)
    global.state_event.on('themeUpdated', handleHide)
    global.state_event.on('languageChanged', handleHide)
    global.state_event.on('configUpdated', handleConfigUpdated)

    return () => {
      global.state_event.off('navActiveIdUpdated', handleNavIdUpdate)
      global.state_event.off('themeUpdated', handleHide)
      global.state_event.off('languageChanged', handleHide)
      global.state_event.on('configUpdated', handleConfigUpdated)
    }
  }, [])

  return visible ? component : null
}

const MylistPage = () => {
  const [visible, setVisible] = useState(commonState.navActiveId == 'nav_love')
  const component = useMemo(() => <Mylist />, [])
  useEffect(() => {
    let currentId: CommonState['navActiveId'] = commonState.navActiveId
    const handleNavIdUpdate = (id: CommonState['navActiveId']) => {
      currentId = id
      if (id == 'nav_love') {
        requestAnimationFrame(() => {
          setVisible(true)
        })
      }
    }
    const handleHide = () => {
      if (currentId != 'nav_setting') return
      setVisible(false)
    }
    const handleConfigUpdated = (keys: Array<keyof LX.AppSetting>) => {
      if (keys.some((k) => hideKeys.includes(k))) handleHide()
    }
    global.state_event.on('navActiveIdUpdated', handleNavIdUpdate)
    global.state_event.on('themeUpdated', handleHide)
    global.state_event.on('languageChanged', handleHide)
    global.state_event.on('configUpdated', handleConfigUpdated)

    return () => {
      global.state_event.off('navActiveIdUpdated', handleNavIdUpdate)
      global.state_event.off('themeUpdated', handleHide)
      global.state_event.off('languageChanged', handleHide)
      global.state_event.on('configUpdated', handleConfigUpdated)
    }
  }, [])

  return visible ? component : null
}

const MyPlaylistPage = () => {
    const [visible, setVisible] = useState(commonState.navActiveId == 'nav_my_playlist')
    const component = useMemo(() => <MyPlaylist />, [])
    useEffect(() => {
        let currentId: CommonState['navActiveId'] = commonState.navActiveId
          const handleNavIdUpdate = (id: CommonState['navActiveId']) => {
            currentId = id
              if (id == 'nav_my_playlist') {
                requestAnimationFrame(() => {
                    setVisible(true)
                  })
              }
          }
        const handleHide = () => {
            if (currentId != 'nav_setting') return
            setVisible(false)
          }
        const handleConfigUpdated = (keys: Array<keyof LX.AppSetting>) => {
            if (keys.some((k) => hideKeys.includes(k))) handleHide()
          }
        global.state_event.on('navActiveIdUpdated', handleNavIdUpdate)
        global.state_event.on('themeUpdated', handleHide)
        global.state_event.on('languageChanged', handleHide)
        global.state_event.on('configUpdated', handleConfigUpdated)

        return () => {
            global.state_event.off('navActiveIdUpdated', handleNavIdUpdate)
            global.state_event.off('themeUpdated', handleHide)
            global.state_event.off('languageChanged', handleHide)
            global.state_event.on('configUpdated', handleConfigUpdated)
          }
      }, [])

  return visible ? component : null
}

const FollowedArtistsPage = () => {
  const [visible, setVisible] = useState(commonState.navActiveId == 'nav_followed_artists')
  const component = useMemo(() => <FollowedArtists />, [])
  useEffect(() => {
    let currentId: CommonState['navActiveId'] = commonState.navActiveId
    const handleNavIdUpdate = (id: CommonState['navActiveId']) => {
      currentId = id
      if (id == 'nav_followed_artists') {
        requestAnimationFrame(() => {
          setVisible(true)
        })
      }
    }
    const handleHide = () => {
      if (currentId != 'nav_setting') return
      setVisible(false)
    }
    const handleConfigUpdated = (keys: Array<keyof LX.AppSetting>) => {
      if (keys.some((k) => hideKeys.includes(k))) handleHide()
    }
    global.state_event.on('navActiveIdUpdated', handleNavIdUpdate)
    global.state_event.on('themeUpdated', handleHide)
    global.state_event.on('languageChanged', handleHide)
    global.state_event.on('configUpdated', handleConfigUpdated)

    return () => {
      global.state_event.off('navActiveIdUpdated', handleNavIdUpdate)
      global.state_event.off('themeUpdated', handleHide)
      global.state_event.off('languageChanged', handleHide)
      global.state_event.on('configUpdated', handleConfigUpdated)
    }
  }, [])

  return visible ? component : null
}

const SubscribedAlbumsPage = () => {
  const [visible, setVisible] = useState(commonState.navActiveId == 'nav_subscribed_albums');
  const component = useMemo(() => <SubscribedAlbums />, []);
  useEffect(() => {
    let currentId: CommonState['navActiveId'] = commonState.navActiveId;
    const handleNavIdUpdate = (id: CommonState['navActiveId']) => {
      currentId = id;
      if (id == 'nav_subscribed_albums') {
        requestAnimationFrame(() => {
          setVisible(true);
        });
      }
    };
    const handleHide = () => {
      if (currentId != 'nav_setting') return;
      setVisible(false);
    };
    const handleConfigUpdated = (keys: Array<keyof LX.AppSetting>) => {
      if (keys.some((k) => hideKeys.includes(k))) handleHide()
    }
    global.state_event.on('navActiveIdUpdated', handleNavIdUpdate)
    global.state_event.on('themeUpdated', handleHide)
    global.state_event.on('languageChanged', handleHide)
    global.state_event.on('configUpdated', handleConfigUpdated)

    return () => {
      global.state_event.off('navActiveIdUpdated', handleNavIdUpdate)
      global.state_event.off('themeUpdated', handleHide)
      global.state_event.off('languageChanged', handleHide)
      global.state_event.on('configUpdated', handleConfigUpdated)
    }
  }, []);
  return visible ? component : null;
};

const OneDrivePage = () => {
  const [visible, setVisible] = useState(commonState.navActiveId == 'nav_onedrive')
  const component = useMemo(() => <OneDrive />, [])
  useEffect(() => {
    let currentId: CommonState['navActiveId'] = commonState.navActiveId
    const handleNavIdUpdate = (id: CommonState['navActiveId']) => {
      currentId = id
      if (id == 'nav_onedrive') {
        requestAnimationFrame(() => {
          setVisible(true)
        })
      }
    }
    const handleHide = () => {
      if (currentId != 'nav_setting') return
      setVisible(false)
    }
    const handleConfigUpdated = (keys: Array<keyof LX.AppSetting>) => {
      if (keys.some((k) => hideKeys.includes(k))) handleHide()
    }
    global.state_event.on('navActiveIdUpdated', handleNavIdUpdate)
    global.state_event.on('themeUpdated', handleHide)
    global.state_event.on('languageChanged', handleHide)
    global.state_event.on('configUpdated', handleConfigUpdated)

    return () => {
      global.state_event.off('navActiveIdUpdated', handleNavIdUpdate)
      global.state_event.off('themeUpdated', handleHide)
      global.state_event.off('languageChanged', handleHide)
      global.state_event.off('configUpdated', handleConfigUpdated)
    }
  }, [])

  return visible ? component : null
}

const WebDAVPage = () => {
  const [visible, setVisible] = useState(commonState.navActiveId == 'nav_webdav')
  const component = useMemo(() => <WebDAV />, [])
  useEffect(() => {
    let currentId: CommonState['navActiveId'] = commonState.navActiveId
    const handleNavIdUpdate = (id: CommonState['navActiveId']) => {
      currentId = id
      if (id == 'nav_webdav') {
        requestAnimationFrame(() => {
          setVisible(true)
        })
      }
    }
    const handleHide = () => {
      if (currentId != 'nav_setting') return
      setVisible(false)
    }
    const handleConfigUpdated = (keys: Array<keyof LX.AppSetting>) => {
      if (keys.some((k) => hideKeys.includes(k))) handleHide()
    }
    global.state_event.on('navActiveIdUpdated', handleNavIdUpdate)
    global.state_event.on('themeUpdated', handleHide)
    global.state_event.on('languageChanged', handleHide)
    global.state_event.on('configUpdated', handleConfigUpdated)

    return () => {
      global.state_event.off('navActiveIdUpdated', handleNavIdUpdate)
      global.state_event.off('themeUpdated', handleHide)
      global.state_event.off('languageChanged', handleHide)
      global.state_event.off('configUpdated', handleConfigUpdated)
    }
  }, [])

  return visible ? component : null
}

const TXPlaylistPage = () => {
  const [visible, setVisible] = useState(commonState.navActiveId == 'nav_tx_playlist')
  const component = useMemo(() => <TXPlaylist />, [])
  useEffect(() => {
    let currentId: CommonState['navActiveId'] = commonState.navActiveId
    const handleNavIdUpdate = (id: CommonState['navActiveId']) => {
      currentId = id
      if (id == 'nav_tx_playlist') {
        requestAnimationFrame(() => {
          setVisible(true)
        })
      }
    }
    const handleHide = () => {
      if (currentId != 'nav_setting') return
      setVisible(false)
    }
    const handleConfigUpdated = (keys: Array<keyof LX.AppSetting>) => {
      if (keys.some((k) => hideKeys.includes(k))) handleHide()
    }
    global.state_event.on('navActiveIdUpdated', handleNavIdUpdate)
    global.state_event.on('themeUpdated', handleHide)
    global.state_event.on('languageChanged', handleHide)
    global.state_event.on('configUpdated', handleConfigUpdated)

    return () => {
      global.state_event.off('navActiveIdUpdated', handleNavIdUpdate)
      global.state_event.off('themeUpdated', handleHide)
      global.state_event.off('languageChanged', handleHide)
      global.state_event.off('configUpdated', handleConfigUpdated)
    }
  }, [])

  return visible ? component : null
}

const KgPlaylistPage = () => {
  const [visible, setVisible] = useState(commonState.navActiveId == 'nav_kg_playlist')
  const component = useMemo(() => <KgPlaylist />, [])
  useEffect(() => {
    let currentId: CommonState['navActiveId'] = commonState.navActiveId
    const handleNavIdUpdate = (id: CommonState['navActiveId']) => {
      currentId = id
      if (id == 'nav_kg_playlist') {
        requestAnimationFrame(() => {
          setVisible(true)
        })
      }
    }
    const handleHide = () => {
      if (currentId != 'nav_setting') return
      setVisible(false)
    }
    const handleConfigUpdated = (keys: Array<keyof LX.AppSetting>) => {
      if (keys.some((k) => hideKeys.includes(k))) handleHide()
    }
    global.state_event.on('navActiveIdUpdated', handleNavIdUpdate)
    global.state_event.on('themeUpdated', handleHide)
    global.state_event.on('languageChanged', handleHide)
    global.state_event.on('configUpdated', handleConfigUpdated)

    return () => {
      global.state_event.off('navActiveIdUpdated', handleNavIdUpdate)
      global.state_event.off('themeUpdated', handleHide)
      global.state_event.off('languageChanged', handleHide)
      global.state_event.off('configUpdated', handleConfigUpdated)
    }
  }, [])

  return visible ? component : null
}

const KgDailyRecPage = () => {
  const [visible, setVisible] = useState(commonState.navActiveId == 'nav_kg_daily_rec')
  const component = useMemo(() => <KgDailyRec />, [])
  useEffect(() => {
    let currentId: CommonState['navActiveId'] = commonState.navActiveId
    const handleNavIdUpdate = (id: CommonState['navActiveId']) => {
      currentId = id
      if (id == 'nav_kg_daily_rec') {
        requestAnimationFrame(() => {
          setVisible(true)
        })
      }
    }
    const handleHide = () => {
      if (currentId != 'nav_setting') return
      setVisible(false)
    }
    const handleConfigUpdated = (keys: Array<keyof LX.AppSetting>) => {
      if (keys.some((k) => hideKeys.includes(k))) handleHide()
    }
    global.state_event.on('navActiveIdUpdated', handleNavIdUpdate)
    global.state_event.on('themeUpdated', handleHide)
    global.state_event.on('languageChanged', handleHide)
    global.state_event.on('configUpdated', handleConfigUpdated)

    return () => {
      global.state_event.off('navActiveIdUpdated', handleNavIdUpdate)
      global.state_event.off('themeUpdated', handleHide)
      global.state_event.off('languageChanged', handleHide)
      global.state_event.off('configUpdated', handleConfigUpdated)
    }
  }, [])

  return visible ? component : null
}

const SettingPage = () => {
  const [visible, setVisible] = useState(commonState.navActiveId == 'nav_setting')
  const component = useMemo(() => <Setting />, [])
  useEffect(() => {
    const handleNavIdUpdate = (id: CommonState['navActiveId']) => {
      if (id == 'nav_setting') {
        requestAnimationFrame(() => {
          setVisible(true)
        })
      }
    }
    global.state_event.on('navActiveIdUpdated', handleNavIdUpdate)

    return () => {
      global.state_event.off('navActiveIdUpdated', handleNavIdUpdate)
    }
  }, [])
  return visible ? component : null
}

const Main = () => {
  const pagerViewRef = useRef<ComponentRef<typeof PagerView>>(null);
  const [activeNavId, setActiveNavIdState] = useState(commonState.navActiveId)
  const navStatus = useSettingValue('common.navStatus'); // 获取菜单显示状态
  const navOrder = useSettingValue('common.navOrder'); // 获取菜单排序

  // 根据 navOrder 和 navStatus 动态生成可见的菜单项
  const visibleNavs = useMemo(() => {
    // 从 navOrder 中筛选，然后关联到 NAV_MENUS 中的信息
    return navOrder.filter(id => isMenuVisible(id, navStatus)).map(id => {
      const menuInfo = NAV_MENUS.find(menu => menu.id === id);
      return menuInfo || { id, icon: 'unknown' };
    });
  }, [navStatus, navOrder]);

  const { viewMap, indexMap } = useMemo(() => {
    const viewMap: Partial<Record<NAV_ID_Type, number>> = {};
    const indexMap: NAV_ID_Type[] = [];
    visibleNavs.forEach((nav, index) => {
      viewMap[nav.id] = index;
      indexMap.push(nav.id);
    });
    return { viewMap, indexMap };
  }, [visibleNavs]);

  // 获取初始索引，如果当前 activeNavId 不在可见菜单中，则使用第一个可见菜单的索引
  const getInitialIndex = () => {
    let idx = viewMap[commonState.navActiveId];
    if (idx == null && visibleNavs.length > 0) {
      idx = 0;
    }
    return idx ?? 0;
  };
  const activeIndexRef = useRef(getInitialIndex());

  const onPageSelected = useCallback(({ nativeEvent }: PagerViewOnPageSelectedEvent) => {
    activeIndexRef.current = nativeEvent.position;
    const selectedId = indexMap[activeIndexRef.current]
    if (!selectedId) return
    if (selectedId) setActiveNavIdState(selectedId)
    if (activeIndexRef.current !== viewMap[commonState.navActiveId]) {
      setNavActiveId(selectedId);
    }
  }, [indexMap, viewMap]);

  const onPageScrollStateChanged = useCallback(
    ({ nativeEvent }: PageScrollStateChangedNativeEvent) => {
      Keyboard.dismiss();
      const idle = nativeEvent.pageScrollState == 'idle';
      if (global.lx.homePagerIdle != idle) global.lx.homePagerIdle = idle;
    },
    []
  );

  // 当可见菜单改变时，确保当前页索引是有效的
  useEffect(() => {
    let index = viewMap[commonState.navActiveId];
    if (index == null && visibleNavs.length > 0) {
      index = 0;
      activeIndexRef.current = index;
      if (visibleNavs[0]) {
        setNavActiveId(visibleNavs[0].id);
      }
    } else if (index != null) {
      activeIndexRef.current = index;
      pagerViewRef.current?.setPageWithoutAnimation(index);
    }
  }, [viewMap, visibleNavs]);

  // 当菜单显示状态改变时，检查当前活跃菜单是否仍可见
  useEffect(() => {
    const handleConfigUpdated = (keys: Array<keyof LX.AppSetting>) => {
      if (keys.includes('common.navStatus')) {
        // 检查当前活跃菜单是否可见
        const isActiveVisible = isMenuVisible(commonState.navActiveId, navStatus);
        if (!isActiveVisible && visibleNavs.length > 0) {
          // 如果不可见，切换到第一个可见菜单
          setNavActiveId(visibleNavs[0].id);
        }
      }
    };
    global.state_event.on('configUpdated', handleConfigUpdated);
    return () => {
      global.state_event.off('configUpdated', handleConfigUpdated);
    };
  }, [navStatus, visibleNavs]);

  useEffect(() => {
    const handleUpdate = (id: CommonState['navActiveId']) => {
      setActiveNavIdState(id)
      pagerViewRef.current?.setScrollEnabled(!!settingState.setting['common.homePageScroll'] && id !== 'nav_play_history');
      let index = viewMap[id];
      if (index == null && visibleNavs.length > 0) {
        index = 0;
      }
      if (index != null && activeIndexRef.current !== index) {
        activeIndexRef.current = index;
        pagerViewRef.current?.setPageWithoutAnimation(index);
      }
    };
    const handleConfigUpdate = (
      keys: Array<keyof LX.AppSetting>,
      setting: Partial<LX.AppSetting>
    ) => {
      if (!keys.includes('common.homePageScroll')) return;
      pagerViewRef.current?.setScrollEnabled(!!setting['common.homePageScroll'] && commonState.navActiveId !== 'nav_play_history');
    };

    global.state_event.on('navActiveIdUpdated', handleUpdate);
    global.state_event.on('configUpdated', handleConfigUpdate);
    return () => {
      global.state_event.off('navActiveIdUpdated', handleUpdate);
      global.state_event.off('configUpdated', handleConfigUpdate);
    };
  }, [viewMap, visibleNavs]);

  // 根据 visibleNavs 动态渲染 PagerView 的子组件
  const pages = useMemo(() => {
    const pageComponents: Partial<Record<NAV_ID_Type, ReactNode>> = {
      nav_search: <SearchPage />,
      nav_songlist: <SongListPage />,
      nav_top: <LeaderboardPage />,
      nav_love: <MylistPage />,
      nav_daily_rec: <DailyRecPage />,
      nav_tx_daily_rec: <TXDailyRecPage />,
      nav_followed_artists: <FollowedArtistsPage />,
      nav_subscribed_albums: <SubscribedAlbumsPage />,
      nav_my_playlist: <MyPlaylistPage />,
      nav_onedrive: <OneDrivePage />,
      nav_webdav: <WebDAVPage />,
      nav_tx_playlist: <TXPlaylistPage />,
      nav_kg_playlist: <KgPlaylistPage />,
      nav_kg_daily_rec: <KgDailyRecPage />,
      nav_setting: <SettingPage />,
    };

    return visibleNavs.map(nav => (
      <View collapsable={false} key={nav.id} style={styles.pageStyle}>
        {pageComponents[nav.id] ?? null}
      </View>
    ));
  }, [visibleNavs]);

  return (
    <View style={styles.container}>
      <PagerView
        ref={pagerViewRef}
        initialPage={activeIndexRef.current}
        offscreenPageLimit={1}
        onPageSelected={onPageSelected}
        onPageScrollStateChanged={onPageScrollStateChanged}
        scrollEnabled={settingState.setting['common.homePageScroll'] && activeNavId !== 'nav_play_history'}
        style={styles.pagerView}
      >
        {pages}
      </PagerView>
      <PlayHistoryOverlay />
    </View>
  );
};

const styles = createStyle({
  container: {
    flex: 1,
  },
  pagerView: {
    flex: 1,
    overflow: 'hidden',
  },
  historyOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 1,
    elevation: 1,
  },
  pageStyle: {
    // alignItems: 'center',
    // padding: 20,
  },
})

export default Main
