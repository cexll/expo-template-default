import { useCallback, useRef, useState } from 'react';
import { router } from 'expo-router';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
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

export default function SubscriptionPage() {
  const { user } = useAuth();
  const accountKey = user?.id ?? user?.phone ?? null;
  const [plan, setPlan] = useState<Plan>('yearly');
  const [provider, setProvider] = useState<Provider>('wechat');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const requestIdRef = useRef(0);
  const { data: subscriptionStatus } = useSubscriptionStatus(accountKey);

  const price = plan === 'yearly' ? '¥399' : '¥39.9';
  const period = plan === 'yearly' ? '/年' : '/月';
  const savings = plan === 'yearly' ? '比月付省17%' : '';

  const createOrder = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    setError('');
    setSubmitting(true);

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
  }, [accountKey, plan, provider, subscriptionStatus]);

  return (
    <SafeAreaView className="flex-1 bg-page-bg">
      <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
        <Text className="mt-4 text-2xl font-bold text-primary">升级会员</Text>
        <Text className="mt-1 mb-6 text-sm text-neutral-text">解锁完整功能，无限管理你的健康档案</Text>

        <View className="mb-6 flex-row rounded-xl bg-nav-bg p-1">
          <Pressable
            className={`flex-1 items-center rounded-lg py-3 ${plan === 'yearly' ? 'bg-primary' : ''}`}
            onPress={() => setPlan('yearly')}
          >
            <Text className={`font-semibold ${plan === 'yearly' ? 'text-white' : 'text-primary'}`}>年付</Text>
          </Pressable>
          <Pressable
            className={`flex-1 items-center rounded-lg py-3 ${plan === 'monthly' ? 'bg-primary' : ''}`}
            onPress={() => setPlan('monthly')}
          >
            <Text className={`font-semibold ${plan === 'monthly' ? 'text-white' : 'text-primary'}`}>月付</Text>
          </Pressable>
        </View>

        <Card className="mb-6 items-center py-6">
          <Text className="text-4xl font-bold text-primary">
            {price}
            <Text className="text-base font-normal">{period}</Text>
          </Text>
          {savings ? <Text className="mt-1 text-sm text-stable-text">{savings}</Text> : null}
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
