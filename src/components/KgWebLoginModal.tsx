import { forwardRef, useImperativeHandle, useRef, useCallback, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, TextInput, ScrollView, Dimensions } from 'react-native';
import Modal, { type ModalType } from '@/components/common/Modal';
import WebView from 'react-native-webview';
import { useTheme } from '@/store/theme/hook';
import { useStatusbarHeight } from '@/store/common/hook';
import { Icon } from '@/components/common/Icon';
import Text from '@/components/common/Text';
import { toast } from '@/utils/tools';
import { sendCaptcha, loginByPhone, buildCookieString, getVerifyInfo, verifyUserInfo } from '@/utils/kugouApi';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export interface KgWebLoginModalType {
  show: () => void;
}

const Header = ({ onClose }: { onClose: () => void }) => {
  const theme = useTheme();
  const statusBarHeight = useStatusbarHeight();

  return (
    <View style={[styles.header, { height: 56 + statusBarHeight, paddingTop: statusBarHeight, backgroundColor: theme['c-content-background'] }]}>
      <TouchableOpacity onPress={onClose} style={styles.backButton} activeOpacity={0.7}>
        <Icon name="chevron-left" size={26} color={theme['c-font']} />
      </TouchableOpacity>
      <Text size={18} weight="600">酷狗音乐登录</Text>
      <View style={styles.placeholder} />
    </View>
  );
};

// 生成悬浮验证 HTML - 直接加载验证码，无中间页
function generateVerifyHtml(txappid: string, ssaCode: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>
*{margin:0;padding:0}
body{background:transparent}
</style>
</head>
<body>
<script>
var appid='${txappid}';
var code='${ssaCode}';

// 修复触摸事件
(function() {
  var lastTouchEnd = 0;
  document.addEventListener('touchend', function(event) {
    var now = (new Date()).getTime();
    if (now - lastTouchEnd <= 300) {
      event.preventDefault();
    }
    lastTouchEnd = now;
  }, false);
})();

// 直接加载验证码
var s=document.createElement('script');
s.src='https://turing.captcha.qcloud.com/TCaptcha.js';
s.onload=function(){
var c=new TencentCaptcha(appid,function(r){
if(r.ret===0){
window.ReactNativeWebView.postMessage(JSON.stringify({type:'ok',ticket:r.ticket,randstr:r.randstr,appid:appid,code:code}));
}else{
window.ReactNativeWebView.postMessage(JSON.stringify({type:'cancel'}));
}
}, { 
  type: 'popup', 
  enableDarkMode: false, 
  themeColor: '#667eea' 
});
c.show();
};
s.onerror=function(){
window.ReactNativeWebView.postMessage(JSON.stringify({type:'cancel'}));
};
document.head.appendChild(s);
</script>
</body>
</html>`;
}

const KgWebLoginModal = forwardRef<KgWebLoginModalType, object>((props, ref) => {
  const modalRef = useRef<ModalType>(null);
  const theme = useTheme();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [cooldown, setCooldown] = useState(0);
  const [isLogging, setIsLogging] = useState(false);
  const [showVerify, setShowVerify] = useState(false);
  const [verifyHtml, setVerifyHtml] = useState('');
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const cooldownRef = useRef<NodeJS.Timeout | null>(null);
  const handleSendCodeRef = useRef<() => void>(() => {});

  // 处理验证完成
  const handleVerifyComplete = useCallback((success: boolean) => {
    setShowVerify(false);
    if (success) {
      console.log('[KgLogin] 人机验证通过，自动重新发送验证码...');
      // 验证成功后自动重新发送验证码
      setTimeout(() => {
        handleSendCodeRef.current?.();
      }, 500);
    } else {
      console.log('[KgLogin] 人机验证失败');
      toast('验证失败，请稍后重试');
    }
  }, []);

  // 处理验证消息
  const handleVerifyMessage = useCallback(async (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      console.log('[Verify] 消息:', data);

      if (data.type === 'ok') {
        const verifycode = 'KGCodeTX|' + JSON.stringify({
          ticket: data.ticket,
          randstr: data.randstr,
          txappid: data.appid,
        });

        console.log('[KgLogin] 提交验证结果...');
        const result = await verifyUserInfo(data.code, 23, verifycode, '', '');

        if (result.success) {
          handleVerifyComplete(true);
        } else {
          console.log('[KgLogin] 验证提交失败: ' + result.message);
          handleVerifyComplete(false);
        }
      } else if (data.type === 'cancel') {
        handleVerifyComplete(false);
      }
    } catch (e) {
      console.error('[Verify] 错误:', e);
      handleVerifyComplete(false);
    }
  }, [handleVerifyComplete]);

  useImperativeHandle(ref, () => ({
    show() {
      setPhone('');
      setCode('');
      setIsSendingCode(false);
      setCountdown(0);
      setCooldown(0);
      setIsLogging(false);
      setShowVerify(false);
      modalRef.current?.setVisible(true);
    },
  }));

  const handleClose = useCallback(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    if (cooldownRef.current) {
      clearInterval(cooldownRef.current);
      cooldownRef.current = null;
    }
    setShowVerify(false);
    modalRef.current?.setVisible(false);
  }, []);

  // 启动冷却时间（2秒防高频发送）
  const startCooldown = useCallback(() => {
    setCooldown(2);
    cooldownRef.current = setInterval(() => {
      setCooldown(prev => {
        if (prev <= 1) {
          if (cooldownRef.current) {
            clearInterval(cooldownRef.current);
            cooldownRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // 发送验证码
  const handleSendCode = useCallback(async () => {
    if (!phone || phone.length < 11) {
      toast('请输入正确的手机号');
      return;
    }
    if (cooldown > 0) {
      toast('请稍后再试');
      return;
    }

    setIsSendingCode(true);
    console.log('[KgLogin] 准备发送验证码到:', phone);

    try {
      const result = await sendCaptcha(phone, (msg) => console.log('[KgLogin]', msg));

      if (result.success) {
        console.log('[KgLogin] 验证码发送成功');
        toast('验证码已发送');
        let seconds = 60;
        setCountdown(seconds);
        countdownRef.current = setInterval(() => {
          seconds -= 1;
          setCountdown(seconds);
          if (seconds <= 0) {
            if (countdownRef.current) {
              clearInterval(countdownRef.current);
              countdownRef.current = null;
            }
          }
        }, 1000);
      } else if (result.ssaCode) {
        console.log('[KgLogin] 需要人机验证:', result.ssaCode);
        toast('需要人机验证');
        
        // 获取验证信息
        const verifyResult = await getVerifyInfo(result.ssaCode);
        if (verifyResult.success && verifyResult.data?.txappid) {
          console.log('[KgLogin] 获取验证信息成功, txappid:', verifyResult.data.txappid);
          // 直接显示悬浮验证
          setVerifyHtml(generateVerifyHtml(verifyResult.data.txappid, result.ssaCode));
          setShowVerify(true);
        } else {
          console.log('[KgLogin] 获取验证信息失败: ' + verifyResult.message);
        }
      } else {
        console.log('[KgLogin] 发送失败: ' + result.message);
        toast(result.message || '发送验证码失败');
      }
    } catch (err: any) {
      console.log('[KgLogin] 请求异常: ' + (err.message || err));
      toast('发送验证码失败');
    } finally {
      setIsSendingCode(false);
      startCooldown();
    }
  }, [phone, cooldown, startCooldown]);

  // 保持 ref 指向最新的 handleSendCode
  handleSendCodeRef.current = handleSendCode;

  // 登录
  const handleLogin = useCallback(async () => {
    if (!phone || phone.length < 11) {
      toast('请输入正确的手机号');
      return;
    }
    if (!code || code.length < 4) {
      toast('请输入验证码');
      return;
    }

    setIsLogging(true);
    console.log('[KgLogin] 准备登录: 手机=', phone);

    try {
      const result = await loginByPhone(phone, code, (msg) => console.log('[KgLogin]', msg));

      if (result.success && result.data) {
        console.log('[KgLogin] 登录成功: userid=', result.data.userid);
        const cookieString = buildCookieString(result.data);
        global.app_event.emit('kg-cookie-set', cookieString);
        toast('登录成功！');
        handleClose();
      } else {
        console.log('[KgLogin] 登录失败: ' + result.message);
        toast(result.message || '登录失败');
      }
    } catch (err: any) {
      console.log('[KgLogin] 请求异常: ' + (err.message || err));
      toast('登录失败');
    } finally {
      setIsLogging(false);
    }
  }, [phone, code, handleClose]);

  return (
    <Modal ref={modalRef} statusBarPadding={false} bgHide={false}>
      <View style={[styles.container, { backgroundColor: theme['c-content-background'] }]}>
        <Header onClose={handleClose} />
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.formContainer}>
            <View style={styles.titleContainer}>
              <Text size={20} weight="700" style={styles.title}>手机号登录</Text>
              <Text size={14} style={[styles.subtitle, { color: theme['c-font-label'] }]}>请使用酷狗音乐账号登录</Text>
            </View>

            {/* 手机号输入框 */}
            <View style={styles.inputGroup}>
              <Text size={13} weight="500" style={[styles.inputLabel, { color: theme['c-font-label'] }]}>手机号</Text>
              <View style={[styles.inputContainer, { borderColor: theme['c-border'], backgroundColor: theme['c-content-background'] }]}>
                <Icon name="search-2" size={18} color={theme['c-font-label']} />
                <TextInput
                  style={[styles.input, { color: theme['c-font'] }]}
                  placeholder="请输入手机号"
                  placeholderTextColor={theme['c-font-label']}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  maxLength={11}
                  editable={!isLogging}
                />
              </View>
            </View>

            {/* 验证码输入框 */}
            <View style={styles.inputGroup}>
              <Text size={13} weight="500" style={[styles.inputLabel, { color: theme['c-font-label'] }]}>验证码</Text>
              <View style={styles.codeRow}>
                <View style={[styles.codeInputContainer, { borderColor: theme['c-border'], backgroundColor: theme['c-content-background'] }]}>
                  <Icon name="setting" size={18} color={theme['c-font-label']} />
                  <TextInput
                    style={[styles.input, { color: theme['c-font'] }]}
                    placeholder="请输入验证码"
                    placeholderTextColor={theme['c-font-label']}
                    value={code}
                    onChangeText={setCode}
                    keyboardType="number-pad"
                    maxLength={6}
                    editable={!isLogging}
                  />
                </View>
                <TouchableOpacity
                  style={[styles.sendCodeBtn, { backgroundColor: (countdown > 0 || isSendingCode || cooldown > 0 || isLogging) ? 'rgba(22, 119, 255, 0.5)' : '#1677ff' }]}
                  onPress={handleSendCode}
                  disabled={countdown > 0 || isSendingCode || cooldown > 0 || isLogging}
                  activeOpacity={0.8}
                >
                  <Text size={13} color="#ffffff" weight="500">
                    {countdown > 0 ? `${countdown}s` : isSendingCode ? '发送中' : cooldown > 0 ? '请稍候' : '获取验证码'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* 登录按钮 */}
            <TouchableOpacity
              style={[styles.loginBtn, { backgroundColor: isLogging ? theme['c-border'] : '#1677ff' }]}
              onPress={handleLogin}
              disabled={isLogging}
              activeOpacity={0.8}
            >
              <Text size={16} color="#ffffff" weight="600">{isLogging ? '登录中...' : '登录'}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* 悬浮验证层 */}
        {showVerify && verifyHtml ? (
          <View style={styles.verifyOverlay}>
            <View style={styles.verifyContainer}>
              <WebView
                source={{ html: verifyHtml }}
                onMessage={handleVerifyMessage}
                style={styles.verifyWebView}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                useWebKit={true}
                cacheEnabled={false}
                incognito={true}
                nestedScrollEnabled={true}
                overScrollMode="never"
                bounces={false}
                setSupportMultipleWindows={false}
                allowsFullscreenVideo={true}
                mediaPlaybackRequiresUserAction={false}
                allowsBackForwardNavigationGestures={false}
              />
            </View>
          </View>
        ) : null}
      </View>
    </Modal>
  );
});

export default KgWebLoginModal;

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'column' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: { padding: 8, width: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  placeholder: { width: 44 },
  scrollView: { flex: 1 },
  scrollContent: { padding: 24, paddingBottom: 40 },
  formContainer: { gap: 20 },
  titleContainer: { alignItems: 'center', marginBottom: 8 },
  title: { textAlign: 'center' },
  subtitle: { textAlign: 'center', marginTop: 8 },
  inputGroup: { gap: 8 },
  inputLabel: { paddingLeft: 4 },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 46,
    gap: 8,
  },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  codeInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 46,
    gap: 8,
  },
  input: { flex: 1, fontSize: 15, padding: 0 },
  sendCodeBtn: {
    paddingHorizontal: 14,
    height: 46,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    width: 100,
  },
  loginBtn: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1677ff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
    marginTop: 8,
  },

  // 悬浮验证层
  verifyOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  verifyContainer: {
    width: '95%',
    height: 350,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'white',
  },
  verifyWebView: {
    flex: 1,
    width: SCREEN_WIDTH * 0.95,
  },
});