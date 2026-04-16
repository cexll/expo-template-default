import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { api } from '@/lib/api';
import { useAuth } from '@/providers/auth-provider';
import { Pressable, SafeAreaView, Text, View } from '@/tw';

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

  return (
    <SafeAreaView className="flex-1 bg-page-bg">
      <View className="flex-1">
        <View className="flex-1 px-6 pt-20">
          <Text className="mb-2 text-3xl font-bold text-primary">结节档案</Text>
          <Text className="mb-10 text-base text-neutral-text">管理你的结节人生</Text>

          <Input
            label="手机号"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            maxLength={11}
            placeholder="请输入手机号"
            error={!codeSent ? error : undefined}
          />

          {codeSent ? (
            <View className="mt-4">
              <Input
                label="验证码"
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                maxLength={6}
                placeholder="请输入6位验证码"
                error={error || undefined}
              />
            </View>
          ) : null}

          <View className="mt-6">
            {codeSent ? (
              <Button title="登录" onPress={verify} fullWidth />
            ) : (
              <Button title="获取验证码" onPress={sendCode} fullWidth />
            )}
          </View>

          {codeSent && countdown > 0 ? (
            <Text className="mt-3 text-center text-sm text-neutral-text">{countdown}秒后可重新获取</Text>
          ) : null}

          {codeSent && countdown === 0 ? (
            <Pressable onPress={sendCode} className="mt-3">
              <Text className="text-center text-sm text-primary">重新获取验证码</Text>
            </Pressable>
          ) : null}

          <Pressable className="mt-8 items-center" onPress={openWechat}>
            <Text className="text-sm text-neutral-text">微信一键登录</Text>
          </Pressable>
        </View>

        <Modal visible={wechatVisible} transparent animationType="fade" onRequestClose={closeWechat}>
          <View className="flex-1 justify-end">
            <Pressable className="flex-1 bg-black/30" onPress={closeWechat} />
            <View className="rounded-t-3xl bg-card px-6 pt-6 pb-10">
              <Text className="mb-2 text-lg font-bold text-primary">微信登录</Text>
              <Text className="mb-4 text-sm text-neutral-text">当前为原型阶段：请粘贴微信登录 code</Text>
              <Input
                label="微信登录 code"
                value={wechatCode}
                onChangeText={setWechatCode}
                placeholder="请输入 code"
                error={wechatError || undefined}
              />
              <View className="mt-6">
                <Button title={wechatLoading ? '登录中...' : '确认登录'} fullWidth onPress={submitWechat} disabled={wechatLoading} />
              </View>
              <Pressable onPress={closeWechat} className="mt-4 items-center">
                <Text className="text-sm text-neutral-text">取消</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}
