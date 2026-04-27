import { useCallback, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { SecondaryPageHeader } from '@/components/SecondaryPageHeader';
import { api } from '@/lib/api';
import { isDemoSeed, PROTOTYPE_REVIEW_SUBSCRIPTION_STATUS } from '@/lib/prototype-review';
import { SUBSCRIPTION_COMPARISON_ROWS } from '@/lib/subscription/catalog';
import { savePendingSubscriptionOrderContext } from '@/lib/subscription/order-context';
import { useSubscriptionStatus } from '@/hooks/useSubscriptionStatus';
import { useAuth } from '@/providers/auth-provider';
import { Pressable, SafeAreaView, ScrollView, Text, View } from '@/tw';

type Plan = 'monthly' | 'yearly';
type Provider = 'wechat' | 'alipay';

type CreateOrderResponse = {
  order_id?: string;
  id?: string;
  amount?: number;
  currency?: string;
};

function DemoSubscriptionPage({ onSubscribe }: { onSubscribe: () => void }) {
  return (
    <div className="screen active" style={{ display: 'flex' }}>
      <div className="pay-wrap">
        <div className="pay-hero">
          <button className="tb-back">← 返回</button>
          <div className="pay-title" style={{ marginTop: 12 }}>升级会员</div>
          <div className="pay-sub">解锁完整功能，无限管理你的健康档案</div>
        </div>
        <div className="pay-body">
          <div className="plan-tabs" style={{ marginTop: 2 }}>
            <button className="plan-tab active">年付 · 最划算</button>
            <button className="plan-tab">月付</button>
          </div>
          <div>
            <div className="price-card recommended selected" style={{ marginTop: 10 }}><div className="price-rec-badge">推荐</div><div className="price-top"><div><div className="price-name">年度会员</div><div className="price-desc">12个月 · 平均每月 ¥33.25</div></div><div className="price-num"><div className="price-main">¥399</div><div className="price-unit">/年</div><div className="price-save">省 ¥79.8</div></div><div className="price-radio on"><div className="price-radio-dot"></div></div></div></div>
            <div className="compare-table"><div className="ct-header"><div className="ct-h">权益</div><div className="ct-h">免费版</div><div className="ct-h">会员</div></div><div className="ct-row"><div className="ct-cell">AI识别次数</div><div className="ct-cell ct-free">5次/月</div><div className="ct-cell ct-pro">无限次</div></div><div className="ct-row"><div className="ct-cell">档案人数</div><div className="ct-cell ct-free">3人</div><div className="ct-cell ct-pro">无限</div></div><div className="ct-row"><div className="ct-cell">图片导出</div><div className="ct-cell ct-cross">×</div><div className="ct-cell ct-check">✓</div></div><div className="ct-row"><div className="ct-cell">云端同步备份</div><div className="ct-cell ct-cross">×</div><div className="ct-cell ct-check">✓</div></div></div>
          </div>
          <div className="sec" style={{ marginBottom: 8 }}>支付方式</div>
          <div className="pay-methods">
            <div className="pay-method selected"><div className="pay-method-icon" style={{ background: '#e8f8ee' }}>💬</div><div style={{ flex: 1 }}><div className="pay-method-name">微信支付</div><div className="pay-method-sub">推荐</div></div><div className="pay-mradio on"><div className="pay-mradio-dot"></div></div></div>
            <div className="pay-method"><div className="pay-method-icon" style={{ background: '#e6f2ff' }}>支</div><div style={{ flex: 1 }}><div className="pay-method-name">支付宝</div><div className="pay-method-sub">支持花呗分期</div></div><div className="pay-mradio"></div></div>
          </div>
        </div>
        <div className="pay-footer">
          <div className="pay-summary"><div><div className="pay-total-lbl">实付金额</div></div><div><span className="pay-total">¥399</span><span className="pay-total-unit">/年</span></div></div>
          <div className="pay-agree">订阅后自动续费，可随时在设置中取消<br />继续即同意 <span>《会员服务协议》</span></div>
          <button className="pay-cta" onClick={onSubscribe}>立即订阅</button>
        </div>
      </div>
    </div>
  );
}

export default function SubscriptionPage() {
  const { prototypeUi005Seed } = useLocalSearchParams<{ prototypeUi005Seed?: string }>();
  const demoSeed = isDemoSeed(prototypeUi005Seed);
  const { user } = useAuth();
  const accountKey = user?.id ?? user?.phone ?? null;
  const [plan, setPlan] = useState<Plan>('yearly');
  const [provider, setProvider] = useState<Provider>('wechat');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const requestIdRef = useRef(0);
  const { data: storedSubscriptionStatus } = useSubscriptionStatus(accountKey);
  const subscriptionStatus = demoSeed ? PROTOTYPE_REVIEW_SUBSCRIPTION_STATUS : storedSubscriptionStatus;

  const price = plan === 'yearly' ? '¥399' : '¥39.9';
  const period = plan === 'yearly' ? '/年' : '/月';
  const planName = plan === 'yearly' ? '年度会员' : '月度会员';
  const planDescription = plan === 'yearly' ? '12个月 · 平均每月 ¥33.25' : '按月订阅，随时取消';
  const savings = plan === 'yearly' ? '比月付省17%' : '';

  const demoSubscribe = useCallback(() => {
    router.push({
      pathname: '/subscription/success',
      params: {
        order_id: 'prototype-order-399',
        plan,
        provider,
        amount: plan === 'yearly' ? '399' : '39.9',
        currency: 'CNY',
        prototypeUi005Seed: 'demo',
      },
    });
  }, [plan, provider]);

  const createOrder = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    setError('');
    setSubmitting(true);

    if (demoSeed) {
      router.push({
        pathname: '/subscription/success',
        params: {
          order_id: 'prototype-order-399',
          plan,
          provider,
          amount: plan === 'yearly' ? '399' : '39.9',
          currency: 'CNY',
          prototypeUi005Seed: 'demo',
        },
      });
      setSubmitting(false);
      return;
    }

    try {
      const data = await api.post<CreateOrderResponse>('/api/v1/subscription/order', { plan, provider });
      if (requestIdRef.current !== requestId) return;

      const orderId = typeof data?.order_id === 'string' ? data.order_id : typeof data?.id === 'string' ? data.id : '';
      if (!orderId) {
        setError('下单失败：服务端未返回订单号');
        return;
      }

      savePendingSubscriptionOrderContext({
        accountKey,
        orderId,
        plan,
        provider,
        amount: typeof data?.amount === 'number' ? String(data.amount) : null,
        currency: typeof data?.currency === 'string' ? data.currency : null,
        baseline: {
          isActive: Boolean(subscriptionStatus?.isActive),
          plan: subscriptionStatus?.plan ?? 'free',
          expiresAt: subscriptionStatus?.expiresAt ?? null,
        },
      });

      const params: Record<string, string> = {
        order_id: orderId,
        plan,
        provider,
      };
      if (typeof data?.amount === 'number') params.amount = String(data.amount);
      if (typeof data?.currency === 'string') params.currency = data.currency;

      router.push({
        pathname: '/subscription/success',
        params,
      });
    } catch (e) {
      if (requestIdRef.current !== requestId) return;
      setError(e instanceof Error ? e.message : '下单失败，请稍后重试');
    } finally {
      if (requestIdRef.current !== requestId) return;
      setSubmitting(false);
    }
  }, [accountKey, demoSeed, plan, provider, subscriptionStatus]);

  if (Platform.OS === 'web' && demoSeed) {
    return <DemoSubscriptionPage onSubscribe={demoSubscribe} />;
  }

  return (
    <SafeAreaView className="flex-1 bg-page-bg">
      <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
        <SecondaryPageHeader title="升级会员" fallbackHref="/settings" />
        <Text className="mb-6 mt-4 text-sm text-neutral-text">解锁完整功能，无限管理你的健康档案</Text>

        <View className="mb-6 flex-row rounded-xl bg-nav-bg p-1">
          <Pressable
            className={`flex-1 items-center rounded-lg py-3 ${plan === 'yearly' ? 'bg-primary' : ''}`}
            onPress={() => setPlan('yearly')}
          >
            <Text className={`font-semibold ${plan === 'yearly' ? 'text-white' : 'text-primary'}`}>年付 · 最划算</Text>
          </Pressable>
          <Pressable
            className={`flex-1 items-center rounded-lg py-3 ${plan === 'monthly' ? 'bg-primary' : ''}`}
            onPress={() => setPlan('monthly')}
          >
            <Text className={`font-semibold ${plan === 'monthly' ? 'text-white' : 'text-primary'}`}>月付</Text>
          </Pressable>
        </View>

        <Card className="mb-6 py-6">
          {plan === 'yearly' ? <Text className="mb-2 text-xs font-semibold text-new-text">推荐 · 省 79.8 元</Text> : null}
          <View className="flex-row items-start justify-between">
            <View className="flex-1 pr-3">
              <Text className="text-lg font-bold text-primary">{planName}</Text>
              <Text className="mt-1 text-sm text-neutral-text">{planDescription}</Text>
            </View>
            <View className="items-end">
              <Text className="text-4xl font-bold text-primary">
                {price}
                <Text className="text-base font-normal">{period}</Text>
              </Text>
              {savings ? <Text className="mt-1 text-sm text-stable-text">{savings}</Text> : null}
            </View>
          </View>
        </Card>

        <Card className="mb-6">
          <View className="flex-row border-b border-neutral-bg pb-3">
            <Text className="flex-1 text-sm font-semibold text-primary">功能</Text>
            <Text className="w-20 text-center text-sm font-semibold text-primary">免费版</Text>
            <Text className="w-20 text-center text-sm font-semibold text-primary">会员</Text>
          </View>
          {SUBSCRIPTION_COMPARISON_ROWS.map((feature) => (
            <View key={feature.name} className="flex-row border-b border-neutral-bg py-3">
              <Text className="flex-1 text-sm text-primary">{feature.name}</Text>
              <Text className="w-20 text-center text-xs text-neutral-text">{feature.free}</Text>
              <Text className="w-20 text-center text-xs font-semibold text-stable-text">{feature.paid}</Text>
            </View>
          ))}
        </Card>

        <Text className="mb-3 text-sm font-semibold text-primary">支付方式</Text>
        <View className="mb-6 flex-row gap-3">
          <Pressable
            className={`flex-1 items-center rounded-xl border py-4 ${
              provider === 'wechat' ? 'border-primary bg-primary/5' : 'border-neutral-bg bg-card'
            }`}
            onPress={() => setProvider('wechat')}
            disabled={submitting}
          >
            <Text className="text-sm text-primary">微信支付</Text>
          </Pressable>
          <Pressable
            className={`flex-1 items-center rounded-xl border py-4 ${
              provider === 'alipay' ? 'border-primary bg-primary/5' : 'border-neutral-bg bg-card'
            }`}
            onPress={() => setProvider('alipay')}
            disabled={submitting}
          >
            <Text className="text-sm text-primary">支付宝</Text>
          </Pressable>
        </View>

        <Card className="mb-4">
          <View className="flex-row items-center justify-between">
            <Text className="text-xs text-neutral-text">实付金额</Text>
            <Text className="text-xl font-bold text-primary">
              {price}
              <Text className="text-sm font-normal">{period}</Text>
            </Text>
          </View>
          <Text className="mt-3 text-center text-[11px] leading-4 text-neutral-text">
            订阅后自动续费，可随时在设置中取消
          </Text>
          <Text className="text-center text-[11px] leading-4 text-neutral-text">继续即同意《会员服务协议》</Text>
        </Card>

        {error ? <Text className="mb-3 text-sm text-new-text">{error}</Text> : null}
        <Button
          title={submitting ? '创建订单中...' : '立即订阅'}
          fullWidth
          disabled={submitting}
          onPress={createOrder}
        />
        <View className="h-10" />
      </ScrollView>
    </SafeAreaView>
  );
}
