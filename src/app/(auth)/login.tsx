import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Platform, StyleSheet } from 'react-native';
import { api } from '@/lib/api';
import { useAuth } from '@/providers/auth-provider';
import { Pressable, SafeAreaView, Text, TextInput, View } from '@/tw';

type WebSvgProps = {
  width: string;
  height: string;
  viewBox: string;
  fill: string;
  stroke: string;
  strokeWidth: string;
  strokeLinecap: 'round';
  children: React.ReactNode;
};

const WebSvg = 'svg' as unknown as React.ComponentType<WebSvgProps>;
const WebCircle = 'circle' as unknown as React.ComponentType<{ cx: string; cy: string; r: string }>;
const WebPath = 'path' as unknown as React.ComponentType<{ d: string }>;

const PHONE_PATTERN = /^1[3-9]\d{9}$/;

export default function LoginPage() {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState('');
  const [wechatVisible, setWechatVisible] = useState(false);
  const [wechatCode, setWechatCode] = useState('');
  const [wechatError, setWechatError] = useState('');
  const [wechatLoading, setWechatLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { signInWithSms, signInWithWechat } = useAuth();

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const startCountdown = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    setCountdown(60);
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const sendCode = useCallback(async () => {
    if (!PHONE_PATTERN.test(phone)) {
      setError('请输入正确的手机号');
      return;
    }

    try {
      await api.post('/api/v1/auth/sms/send', { phone });
      setCodeSent(true);
      setError('');
      startCountdown();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '发送验证码失败');
    }
  }, [phone, startCountdown]);

  const verify = useCallback(async () => {
    if (code.length !== 6) {
      setError('请输入6位验证码');
      return;
    }

    try {
      await signInWithSms(phone, code);
      setError('');
      // Navigation is handled by the auth guard in the layout.
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '验证失败');
    }
  }, [code, phone, signInWithSms]);

  const openWechat = useCallback(() => {
    setWechatError('');
    setWechatCode('');
    setWechatVisible(true);
  }, []);

  const closeWechat = useCallback(() => {
    if (wechatLoading) return;
    setWechatVisible(false);
  }, [wechatLoading]);

  const submitWechat = useCallback(async () => {
    if (!wechatCode.trim()) {
      setWechatError('请输入微信登录 code');
      return;
    }

    setWechatError('');
    setWechatLoading(true);
    try {
      await signInWithWechat(wechatCode.trim());
      setWechatVisible(false);
      // Navigation is handled by the auth guard in the layout.
    } catch (e: unknown) {
      setWechatError(e instanceof Error ? e.message : '微信登录失败');
    } finally {
      setWechatLoading(false);
    }
  }, [signInWithWechat, wechatCode]);

  const isPhoneValid = PHONE_PATTERN.test(phone);
  const canSendCode = isPhoneValid && countdown === 0;
  const canLogin = isPhoneValid && code.length === 6;

  if (Platform.OS === 'web') {
    return (
      <div data-testid="login-safe-area" className="screen active" style={{ display: 'flex' }}>
        <div className="login-wrap">
          <div className="login-hero">
            <div className="login-logo">
              <WebSvg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="#F5F0E6" strokeWidth="1.5" strokeLinecap="round">
                <WebCircle cx="14" cy="9" r="4" />
                <WebPath d="M5 24c0-5 4-9 9-9s9 4 9 9" />
                <WebPath d="M19 6l2 2-2 2" />
              </WebSvg>
            </div>
            <div className="login-title">结节档案</div>
            <div className="login-sub">个人与家庭结节健康管理<br />甲状腺 · 乳腺 · 肺结节</div>
          </div>
          <div className="login-body">
            <div className="input-group">
              <div className="input-label">手机号</div>
              <div className="input-wrap">
                <input className="input-field" type="tel" placeholder="请输入手机号" maxLength={11} value={phone} onChange={(event) => setPhone(event.currentTarget.value)} />
              </div>
            </div>
            <div className="input-group" id="code-group" style={{ opacity: isPhoneValid ? 1 : 0.4, pointerEvents: isPhoneValid ? 'auto' : 'none', transition: 'opacity .2s' }}>
              <div className="input-label">验证码</div>
              <div className="input-wrap">
                <input className="input-field" type="number" placeholder="6位验证码" style={{ paddingRight: 90 }} value={code} onChange={(event) => setCode(event.currentTarget.value)} />
                <button className="code-btn" onClick={() => void sendCode()}>{countdown > 0 ? `${countdown}秒` : codeSent ? '重新获取' : '获取验证码'}</button>
              </div>
            </div>
            <button className="login-btn-phone" style={{ opacity: canLogin ? 1 : 0.4, cursor: canLogin ? 'pointer' : 'not-allowed' }} onClick={() => void verify()}>登录 / 注册</button>
            <div className="or-divider"><div className="or-line" /><span className="or-txt">或</span><div className="or-line" /></div>
            <button className="login-btn-wechat" onClick={openWechat}>
              <svg className="wechat-icon" viewBox="0 0 24 24" fill="white">
                <path d="M8.5 10c-.4 0-.7-.3-.7-.7s.3-.7.7-.7.7.3.7.7-.3.7-.7.7zm4 0c-.4 0-.7-.3-.7-.7s.3-.7.7-.7.7.3.7.7-.3.7-.7.7zm3.8 3.7c-.3 0-.6-.3-.6-.6s.3-.6.6-.6.6.3.6.6-.3.6-.6.6zm2.8 0c-.3 0-.6-.3-.6-.6s.3-.6.6-.6.6.3.6.6-.3.6-.6.6zm-8.1-8.2C7 5.5 4 8 4 11c0 1.5.7 2.9 1.8 3.9L5 17l2.3-1.1c.7.2 1.4.3 2.2.3.2 0 .4 0 .7-.1-.2-.5-.3-1-.3-1.6 0-3.1 2.7-5.6 6-5.6h.3C15.4 7.1 12.9 5.5 11 5.5zM21 14.9c0-2.5-2.3-4.6-5.2-4.6s-5.2 2.1-5.2 4.6c0 2.5 2.3 4.6 5.2 4.6.6 0 1.2-.1 1.7-.3L20 20l-.6-1.8c1-.9 1.6-2 1.6-3.3z" />
              </svg>
              微信一键登录
            </button>
            <div className="login-agree">登录即同意 <span>《用户协议》</span> 和 <span>《隐私政策》</span><br />医疗数据仅存储于本设备，不上传服务器</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <SafeAreaView testID="login-safe-area" style={styles.safeArea}>
      <View style={styles.screen}>
        <View testID="login-hero" style={styles.hero}>
          <View style={styles.logo}>
            <WebSvg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="#F5F0E6" strokeWidth="1.5" strokeLinecap="round">
              <WebCircle cx="14" cy="9" r="4" />
              <WebPath d="M5 24c0-5 4-9 9-9s9 4 9 9" />
              <WebPath d="M19 6l2 2-2 2" />
            </WebSvg>
          </View>
          <Text dataSet={{ font: 'serif' }} style={styles.title}>结节档案</Text>
          <Text style={styles.subtitle}>个人与家庭结节健康管理</Text>
          <Text style={styles.subtitle}>甲状腺 · 乳腺 · 肺结节</Text>
        </View>

        <View style={styles.body}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>手机号</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              maxLength={11}
              placeholder="请输入手机号"
              placeholderTextColor="#C4BDB4"
            />
          </View>

          <View
            testID="login-code-group"
            pointerEvents={isPhoneValid ? 'auto' : 'none'}
            style={[styles.inputGroup, isPhoneValid ? styles.enabled : styles.disabled]}
          >
            <Text style={styles.label}>验证码</Text>
            <View style={styles.codeInputWrap}>
              <TextInput
                style={[styles.input, styles.codeInput]}
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                maxLength={6}
                placeholder="6位验证码"
                placeholderTextColor="#C4BDB4"
              />
              <Pressable
                testID="login-code-btn"
                onPress={sendCode}
                disabled={!canSendCode}
                accessibilityState={{ disabled: !canSendCode }}
                style={[styles.codeButton, !canSendCode && styles.codeButtonDisabled]}
              >
                <Text style={[styles.codeButtonText, !canSendCode && styles.codeButtonTextDisabled]}>
                  {countdown > 0 ? `${countdown}秒` : codeSent ? '重新获取' : '获取验证码'}
                </Text>
              </Pressable>
            </View>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            testID="login-phone-btn"
            onPress={verify}
            disabled={!canLogin}
            accessibilityState={{ disabled: !canLogin }}
            style={[styles.phoneButton, !canLogin && styles.phoneButtonDisabled]}
          >
            <Text style={styles.phoneButtonText}>登录 / 注册</Text>
          </Pressable>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>或</Text>
            <View style={styles.dividerLine} />
          </View>

          <Pressable testID="login-wechat-btn" style={styles.wechatButton} onPress={openWechat}>
            <Text style={styles.wechatIcon}>☵</Text>
            <Text style={styles.wechatText}>微信一键登录</Text>
          </Pressable>

          <View style={styles.agreement}>
            <Text style={styles.agreementText}>登录即同意 《用户协议》 和 《隐私政策》</Text>
            <Text style={styles.agreementText}>医疗数据仅存储于本设备，不上传服务器</Text>
          </View>
        </View>

        <Modal visible={wechatVisible} transparent animationType="fade" onRequestClose={closeWechat}>
          <View style={styles.modalRoot}>
            <Pressable style={styles.modalBackdrop} onPress={closeWechat} />
            <View style={styles.modalSheet}>
              <Text style={styles.modalTitle}>微信登录</Text>
              <Text style={styles.modalCopy}>当前为原型阶段：请粘贴微信登录 code</Text>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>微信登录 code</Text>
                <TextInput
                  style={styles.input}
                  value={wechatCode}
                  onChangeText={setWechatCode}
                  placeholder="请输入 code"
                  placeholderTextColor="#C4BDB4"
                />
              </View>
              {wechatError ? <Text style={styles.error}>{wechatError}</Text> : null}
              <Pressable
                onPress={submitWechat}
                disabled={wechatLoading}
                accessibilityState={{ disabled: wechatLoading }}
                style={[styles.phoneButton, wechatLoading && styles.phoneButtonDisabled]}
              >
                <Text style={styles.phoneButtonText}>{wechatLoading ? '登录中...' : '确认登录'}</Text>
              </Pressable>
              <Pressable onPress={closeWechat} style={styles.cancelButton}>
                <Text style={styles.cancelText}>取消</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FAF8F4',
  },
  screen: {
    flex: 1,
    minHeight: 640,
    backgroundColor: '#FAF8F4',
  },
  hero: {
    alignItems: 'center',
    backgroundColor: '#F5F0E6',
    borderBottomColor: '#DDD8CF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: 36,
    paddingHorizontal: 28,
    paddingTop: 52,
  },
  logo: {
    alignItems: 'center',
    backgroundColor: '#3D3528',
    borderRadius: 16,
    height: 56,
    justifyContent: 'center',
    marginBottom: 14,
    width: 56,
  },
  title: {
    color: '#3D3528',
    fontFamily: 'DM Serif Display',
    fontSize: 22,
    marginBottom: 5,
  },
  subtitle: {
    color: '#8A7D6E',
    fontSize: 12,
    lineHeight: 19,
    textAlign: 'center',
  },
  body: {
    flex: 1,
    gap: 12,
    paddingHorizontal: 22,
    paddingTop: 24,
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    color: '#8A7D6E',
    fontSize: 11,
    fontWeight: '500',
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderColor: '#DDD8CF',
    borderRadius: 9,
    borderWidth: StyleSheet.hairlineWidth,
    color: '#3D3528',
    fontFamily: 'DM Mono',
    fontSize: 14,
    minHeight: 42,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  codeInputWrap: {
    justifyContent: 'center',
  },
  codeInput: {
    paddingRight: 104,
  },
  codeButton: {
    alignSelf: 'flex-end',
    backgroundColor: '#F5F0E6',
    borderColor: '#DDD8CF',
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    marginRight: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    position: 'absolute',
  },
  codeButtonDisabled: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  codeButtonText: {
    color: '#3D3528',
    fontSize: 11,
    fontWeight: '500',
  },
  codeButtonTextDisabled: {
    color: '#3D3528',
  },
  disabled: {
    opacity: 0.4,
  },
  enabled: {
    opacity: 1,
  },
  error: {
    color: '#8B3A1A',
    fontSize: 11,
  },
  phoneButton: {
    alignItems: 'center',
    backgroundColor: '#3D3528',
    borderRadius: 10,
    marginTop: 4,
    padding: 13,
  },
  phoneButtonDisabled: {
    opacity: 0.4,
  },
  phoneButtonText: {
    color: '#F5F0E6',
    fontSize: 14,
    fontWeight: '500',
  },
  divider: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    marginVertical: 4,
  },
  dividerLine: {
    backgroundColor: '#DDD8CF',
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  dividerText: {
    color: '#C4BDB4',
    fontSize: 11,
  },
  wechatButton: {
    alignItems: 'center',
    backgroundColor: '#07C160',
    borderRadius: 10,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    padding: 13,
  },
  wechatIcon: {
    color: '#FFFFFF',
    fontSize: 18,
    lineHeight: 20,
  },
  wechatText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  agreement: {
    alignItems: 'center',
    marginTop: 4,
  },
  agreementText: {
    color: '#C4BDB4',
    fontSize: 10,
    lineHeight: 17,
    textAlign: 'center',
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    flex: 1,
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    gap: 14,
    paddingBottom: 40,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  modalTitle: {
    color: '#3D3528',
    fontSize: 18,
    fontWeight: '700',
  },
  modalCopy: {
    color: '#8A7D6E',
    fontSize: 13,
  },
  cancelButton: {
    alignItems: 'center',
    paddingTop: 2,
  },
  cancelText: {
    color: '#8A7D6E',
    fontSize: 13,
  },
});
