import { forwardRef, useImperativeHandle, useRef, useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import Modal, { type ModalType } from '@/components/common/Modal';
import WebView, { type WebViewNavigation } from 'react-native-webview';
import { useTheme } from '@/store/theme/hook';
import { useStatusbarHeight } from '@/store/common/hook';
import { Icon } from '@/components/common/Icon';
import Text from '@/components/common/Text';
import { toast } from '@/utils/tools';
import CookieManager from '@react-native-cookies/cookies';

const LOGIN_URL = 'https://y.qq.com/n/ryqq/login';

export interface QQWebLoginModalType {
  show: () => void;
}

const Header = ({ onClose, onLogout }: { onClose: () => void; onLogout: () => void }) => {
  const theme = useTheme();
  const statusBarHeight = useStatusbarHeight();

  return (
    <View style={[styles.header, { height: 56 + statusBarHeight, paddingTop: statusBarHeight, backgroundColor: theme['c-content-background'] }]}>
      <TouchableOpacity onPress={onClose} style={styles.backButton} activeOpacity={0.7}>
        <Icon name="chevron-left" size={26} color={theme['c-font']} />
      </TouchableOpacity>
      <Text size={18} weight="600">QQ音乐登录</Text>
      <TouchableOpacity onPress={onLogout} style={styles.logoutButton} activeOpacity={0.8}>
        <Icon name="exit" size={14} color="#ffffff" />
        <Text size={14} color="#ffffff" weight="500">退出登录</Text>
      </TouchableOpacity>
    </View>
  );
};

const LoadingSpinner = () => {
  const spinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      })
    ).start();
  }, [spinAnim]);

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View style={[styles.loadingSpinner, { transform: [{ rotate: spin }] }]} />
  );
};

const QQWebLoginModal = forwardRef<QQWebLoginModalType, object>((props, ref) => {
  const modalRef = useRef<ModalType>(null);
  const webViewRef = useRef<WebView>(null);
  const theme = useTheme();
  const [isLoading, setIsLoading] = useState(true);

  useImperativeHandle(ref, () => ({
    show() {
      setIsLoading(true);
      modalRef.current?.setVisible(true);
    },
  }));

  const handleClose = useCallback(() => {
    modalRef.current?.setVisible(false);
  }, []);

  const handleNavigationStateChange = (navState: WebViewNavigation) => {
    console.log('QQ登录: 页面导航状态变化:', navState.url);
    setIsLoading(false);
  };

  const handleLoadStart = () => {
    setIsLoading(true);
  };

  const handleLoadEnd = () => {
    setIsLoading(false);
  };

  const handleGetCookie = async () => {
    console.log('QQ登录: 用户手动点击获取Cookie');
    if (!webViewRef.current) return;

    try {
      const cookies = await CookieManager.get(LOGIN_URL, true);
      const cookieString = Object.values(cookies)
        .map(c => `${c.name}=${c.value}`)
        .join('; ');
      console.log('QQ登录: CookieManager captured cookies:', cookieString);

      if (!cookieString || cookieString.length < 10) {
        toast('未获取到Cookie，可能是Cookie已失效，请重新登录');
        return;
      }

      global.app_event.emit('tx-cookie-set', cookieString);
      toast('Cookie获取成功！');
      handleClose();
    } catch (err) {
      console.error('QQ登录: Cookie获取失败:', err);
      toast('Cookie获取失败，请手动输入');
    }
  };

  const handleLogout = async () => {
    console.log('QQ登录: 用户点击退出登录');
    try {
      await CookieManager.clearAll();
      global.app_event.emit('tx-cookie-set', '');
      toast('已退出登录');
      if (webViewRef.current) {
        webViewRef.current.reload();
      }
    } catch (err) {
      console.error('QQ登录: 退出登录失败:', err);
      toast('退出登录失败');
    }
  };

  return (
    <Modal ref={modalRef} statusBarPadding={false} bgHide={false}>
      <View style={[styles.container, { backgroundColor: theme['c-content-background'] }]}>
        <Header onClose={handleClose} onLogout={handleLogout} />
        <View style={styles.webViewContainer}>
          <WebView
            ref={webViewRef}
            source={{ uri: LOGIN_URL }}
            onNavigationStateChange={handleNavigationStateChange}
            onLoadStart={handleLoadStart}
            onLoadEnd={handleLoadEnd}
            userAgent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            style={styles.webView}
          />
          {isLoading && (
            <View style={styles.loadingOverlay}>
              <LoadingSpinner />
              <Text size={14} style={{ color: theme['c-font-label'], marginTop: 12 }}>正在加载登录页面...</Text>
            </View>
          )}
        </View>
        <View style={[styles.footer, { backgroundColor: theme['c-content-background'], borderTopColor: theme['c-border'] }]}>
          <View style={[styles.footerCard, { backgroundColor: '#fff5f5', borderColor: '#ffd6d6' }]}>
            <Icon name="help" size={14} color="#ff6b6b" />
            <Text style={[styles.tip, { color: '#ff6b6b' }]} size={13}>请等待登录完全完成后再获取Cookie，否则会获取错误（约等待3秒）</Text>
          </View>
          <TouchableOpacity
            onPress={handleGetCookie}
            style={[styles.getCookieBtn, { backgroundColor: '#1677ff' }]}
            activeOpacity={0.8}
          >
            <Text size={16} color="#ffffff" weight="600">获取Cookie</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
});

export default QQWebLoginModal;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'column',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    padding: 8,
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#ff6b6b',
    borderRadius: 16,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  qqIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#1677ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  webViewContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
    position: 'relative',
  },
  webView: {
    flex: 1,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    zIndex: 100,
  },
  loadingSpinner: {
    width: 40,
    height: 40,
    borderWidth: 3,
    borderColor: '#e8e8e8',
    borderTopColor: '#1677ff',
    borderRadius: 20,
  },
  footer: {
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
  },
  footerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: '#fff5f5',
  },
  tip: {
    flex: 1,
  },
  getCookieBtn: {
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1677ff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
});
