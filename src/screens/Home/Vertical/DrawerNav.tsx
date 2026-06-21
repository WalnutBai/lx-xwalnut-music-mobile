import { memo, useMemo, useRef, useState, useCallback } from 'react'
import { ScrollView, TouchableOpacity, View } from 'react-native'
import { useI18n } from '@/lang'
import { useNavActiveId, useStatusbarHeight, useBgPic } from '@/store/common/hook'
import { useTheme } from '@/store/theme/hook'
import { Icon } from '@/components/common/Icon'
import { SvgIcon } from '@/components/common/SvgIcon'
import { confirmDialog, createStyle, exitApp as backHome } from '@/utils/tools'
import { NAV_MENUS } from '@/config/constant'
import type { InitState } from '@/store/common/state'
import { exitApp, setNavActiveId } from '@/core/common'
import Text from '@/components/common/Text'
import { useSettingValue } from '@/store/setting/hook'
import { Animated as AnimatedType, Easing } from 'react-native'
import { useMyList } from '@/store/list/hook'
import { setActiveList } from '@/core/list'
import { navigations } from "@/navigation"
import commonState from '@/store/common/state'
import ImageBackground from '@/components/common/ImageBackground'
import { defaultHeaders } from '@/components/common/Image'

interface MyListItemProps {
  item: LX.List.MyListInfo;
  onPress: () => void;
}

const MyListItem = memo(({
  item,
  onPress,
}: MyListItemProps) => {
  const theme = useTheme();

  return (
    <TouchableOpacity style={styles.subMenuItem} onPress={onPress}>
      <Text size={14} color={theme['c-font-label']} numberOfLines={1}>
        {item.name}
      </Text>
    </TouchableOpacity>
  );
});

const CollapsibleMyListItem = () => {
  const t = useI18n();
  const theme = useTheme();
  const allList = useMyList();
  const [isExpanded, setExpanded] = useState(false);
  const animation = useRef(new AnimatedType.Value(0)).current;
  const contentHeight = useRef(0);

  const toggleCollapse = () => {
    const toValue = isExpanded ? 0 : 1;
    AnimatedType.timing(animation, {
      toValue,
      duration: 300,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: false,
    }).start();
    setExpanded(!isExpanded);
  };

  const handleSelect = useCallback((listId: string) => {
    setNavActiveId('nav_love');
    setActiveList(listId);
    global.app_event.changeMenuVisible(false);
  }, []);

  const animatedHeight = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, contentHeight.current],
  });

  const animatedOpacity = animation.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0, 1],
  });

  return (
    <View>
      <TouchableOpacity style={styles.menuItem} onPress={toggleCollapse}>
        <View style={styles.iconContent}>
          <Icon name="love" size={20} color={theme['c-font-label']} />
        </View>
        <Text style={styles.text}>{t('nav_love')}</Text>
      </TouchableOpacity>

      <AnimatedType.View style={{ height: animatedHeight, opacity: animatedOpacity, overflow: 'hidden' }}>
        <View
          onLayout={(event) => {
            contentHeight.current = event.nativeEvent.layout.height;
          }}
          style={{ position: 'absolute', width: '100%' }}
        >
          {allList.map((list) => (
            <MyListItem
              key={list.id}
              item={list}
              onPress={() => handleSelect(list.id)}
            />
          ))}
        </View>
      </AnimatedType.View>
    </View>
  );
};

const styles = createStyle({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 40,
    paddingBottom: 50,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: {
    textAlign: 'center',
    marginLeft: 16,
  },
  menus: {
    flex: 1,
  },
  subMenuItem: {
    paddingVertical: 12,
    paddingLeft: 55,
    paddingRight: 10,
  },
  collapsibleMenuItemText: {
    flex: 1,
    paddingLeft: 20,
  },
  list: {
    paddingTop: 10,
    paddingBottom: 10,
  },
  menuItem: {
    flexDirection: 'row',
    paddingTop: 13,
    paddingBottom: 13,
    paddingLeft: 25,
    paddingRight: 25,
    alignItems: 'center',
  },
  iconContent: {
    width: 24,
    alignItems: 'center',
  },
  text: {
    paddingLeft: 20,
  },
  footer: {
    paddingVertical: 5,
    paddingHorizontal: 15,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  footerBtn: {
    padding: 10,
  },
})

const Header = () => {
  const theme = useTheme()
  const statusBarHeight = useStatusbarHeight()
  return (
    <View
      style={{
        paddingTop: statusBarHeight,
        backgroundColor: theme['c-primary-light-700-alpha-500'],
      }}
    >
      <View style={styles.header}>
        <Icon name="logo" color={theme['c-primary-dark-100-alpha-300']} size={28} />
        <Text style={styles.headerText} size={28} color={theme['c-primary-dark-100-alpha-300']}>
          LX-X Music
        </Text>
      </View>
    </View>
  )
}

type IdType = InitState['navActiveId'] | 'nav_exit' | 'back_home'

const renderIcon = (icon: string, size: number, color: string) => {
  if (icon.startsWith('svg:')) {
    return <SvgIcon name={icon.slice(4)} size={size} color={color} />
  }
  return <Icon name={icon} size={size} color={color} />
}

const MenuItem = ({
  id,
  icon,
  onPress,
}: {
  id: IdType
  icon: string
  onPress: (id: IdType) => void
}) => {
  const t = useI18n()
  const activeId = useNavActiveId()
  const theme = useTheme()

  return activeId == id ? (
    <View style={{ ...styles.menuItem, backgroundColor: theme['c-primary-background-hover'] }}>
      <View style={styles.iconContent}>
        {renderIcon(icon, 20, theme['c-primary-font-active'])}
      </View>
      <Text style={styles.text} color={theme['c-primary-font']}>
        {t(id)}
      </Text>
    </View>
  ) : (
    <TouchableOpacity
      style={styles.menuItem}
      onPress={() => {
        onPress(id)
      }}
    >
      <View style={styles.iconContent}>
        {renderIcon(icon, 20, theme['c-font-label'])}
      </View>
      <Text style={styles.text}>{t(id)}</Text>
    </TouchableOpacity>
  )
}

export default memo(() => {
  const theme = useTheme()
  const showBackBtn = useSettingValue('common.showBackBtn')
  const showExitBtn = useSettingValue('common.showExitBtn')
  const navStatus = useSettingValue('common.navStatus');
  const navOrder = useSettingValue('common.navOrder');
  const isShowMyListSubMenu = useSettingValue('list.isShowMyListSubMenu');
  const isDynamicBg = useSettingValue('theme.dynamicBg');
  const isSidebarDynamicBg = useSettingValue('theme.sidebarDynamicBg');
  const dynamicPic = useBgPic();
  const customBgPicPath = useSettingValue('theme.customBgPicPath');
  const pic = customBgPicPath || dynamicPic;
  const blur = useSettingValue('theme.blur');
  const picOpacity = useSettingValue('theme.picOpacity');

  // 只有当全局动态背景和侧边栏动态背景都启用时，才使用透明背景
  const showSidebarBg = isDynamicBg && isSidebarDynamicBg && pic;

  const handlePress = (id: IdType) => {
    switch (id) {
      case 'nav_exit':
        void confirmDialog({
          message: global.i18n.t('exit_app_tip'),
          confirmButtonText: global.i18n.t('list_remove_tip_button'),
        }).then((isExit) => {
          if (!isExit) return
          exitApp('Exit Btn')
        })
        return
      case 'back_home':
        backHome()
        return
    }
    global.app_event.changeMenuVisible(false)
    setNavActiveId(id as any)
  }

  const handleDownloadPress = () => {
    global.app_event.changeMenuVisible(false);
    navigations.pushDownloadManagerScreen(commonState.componentIds[commonState.componentIds.length - 1]?.id!);
  };
  const handleHistoryPress = () => {
    global.app_event.changeMenuVisible(false);
    setNavActiveId('nav_play_history');
  };
  const filteredNavMenus = useMemo(() => {
    if (!navOrder) return NAV_MENUS.filter(
      menu => menu.id !== 'nav_play_history' && (menu.id === 'nav_setting' || (navStatus[menu.id] ?? true))
    );

    return navOrder
      .filter(id => id !== 'nav_play_history')
      .map(id => NAV_MENUS.find(menu => menu.id === id))
      .filter((menu): menu is typeof NAV_MENUS[number] => menu !== undefined && (menu.id === 'nav_setting' || (navStatus[menu.id] ?? true)));
  }, [navStatus, navOrder]);

  return (
    <View style={{ ...styles.container, backgroundColor: showSidebarBg ? 'transparent' : theme['c-content-background'] }}>
      {showSidebarBg ? (
        <ImageBackground
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            right: 0,
          }}
          source={{ uri: pic, headers: defaultHeaders }}
          resizeMode="cover"
          blurRadius={blur}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: theme['c-content-background'],
              opacity: picOpacity / 100,
            }}
          />
        </ImageBackground>
      ) : null}
      <Header />
      <ScrollView style={styles.menus}>
        <View style={styles.list}>
          {filteredNavMenus.map((menu) => {
            if (menu.id === 'nav_love') {
              return isShowMyListSubMenu
                ? <CollapsibleMyListItem key={menu.id} />
                : <MenuItem key={menu.id} id={menu.id} icon={menu.icon} onPress={handlePress} />;
            }
            return <MenuItem key={menu.id} id={menu.id} icon={menu.icon} onPress={handlePress} />;
          })}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.footerBtn} onPress={handleHistoryPress}>
          <Icon name="music_time" size={25} color={theme['c-font-label']} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.footerBtn} onPress={handleDownloadPress}>
          <Icon name="download-2" size={22} color={theme['c-font-label']} />
        </TouchableOpacity>
      </View>

      {global.lx.isCarMode && showBackBtn ? <MenuItem id="back_home" icon="home" onPress={handlePress} /> : null}
      {global.lx.isCarMode && showExitBtn ? <MenuItem id="nav_exit" icon="exit2" onPress={handlePress} /> : null}
    </View>
  )
})
