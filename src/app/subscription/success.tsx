import { useEffect } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { SecondaryPageHeader } from '@/components/SecondaryPageHeader';
import { formatSubscriptionPlan, useSubscriptionStatus } from '@/hooks/useSubscriptionStatus';
import { PREMIUM_UNLOCKED_RIGHTS, formatPaymentAmount } from '@/lib/subscription/catalog';
import {
  doesSubscriptionStatusConfirmOrder,
  readPendingSubscriptionOrderContext,
} from '@/lib/subscription/order-context';
import { useAuth } from '@/providers/auth-provider';
import { SafeAreaView, Text, View } from '@/tw';

function pickParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatProvider(provider: string | null) {
  if (provider === 'wechat') return '微信支付';
  if (provider === 'alipay') return '支付宝';
  return provider ?? '-';
}

export default function PaymentSuccessPage() {
  const { user } = useAuth();
  const accountKey = user?.id ?? user?.phone ?? null;
  const params = useLocalSearchParams<{
    order_id?: string;
    plan?: string;
    provider?: string;
    amount?: string;
    currency?: string;
  }>();

  const orderId = pickParam(params.order_id) ?? '';
  const requestedPlan = pickParam(params.plan);
  const requestedProvider = pickParam(params.provider);
  const requestedAmount = pickParam(params.amount);
  const requestedCurrency = pickParam(params.currency);
  const { data: status, error, refetch } = useSubscriptionStatus(accountKey);
  const orderContext = orderId ? readPendingSubscriptionOrderContext(orderId, accountKey) : null;

  const hasPendingOrderContext = Boolean(orderContext);

  useEffect(() => {
    if (!orderId || !hasPendingOrderContext) return;

    void refetch();
    const refreshTimer = setTimeout(() => {
      void refetch();
    }, 250);

    return () => clearTimeout(refreshTimer);
  }, [hasPendingOrderContext, orderId, refetch]);

  const hasOrderId = Boolean(orderId);
  const isCurrentOrderActive = doesSubscriptionStatusConfirmOrder(status, orderContext);
  const planLabel = formatSubscriptionPlan(
    isCurrentOrderActive ? status?.plan ?? requestedPlan ?? 'free' : requestedPlan ?? status?.plan ?? 'free'
  );
  const amountLabel = formatPaymentAmount(requestedAmount, requestedCurrency) ?? '待支付平台确认';

  const title = !hasOrderId ? '订单信息缺失' : isCurrentOrderActive ? '订阅成功' : '订单已创建';
  const subtitle = isCurrentOrderActive
    ? '会员权益已立即生效\n感谢你支持结节档案'
    : hasOrderId
      ? '当前还未收到支付完成确认，支付完成后会自动开通（可能有延迟）'
      : '请返回上一页重新下单';

  return (
    <SafeAreaView className="flex-1 bg-page-bg px-6">
      <SecondaryPageHeader title="支付结果" fallbackHref="/subscription" />

      <View className="flex-1 items-center justify-center">
        <Text className="mb-4 text-5xl">{isCurrentOrderActive ? '✓' : hasOrderId ? '⏳' : '⚠️'}</Text>
        <Text className="mb-2 text-2xl font-bold text-primary">{title}</Text>
        {isCurrentOrderActive ? (
          <>
            <Text className="text-sm text-neutral-text">会员权益已立即生效</Text>
            <Text className="mb-8 text-sm text-neutral-text">感谢你支持结节档案</Text>
          </>
        ) : (
          <Text className="mb-8 text-sm text-neutral-text">{subtitle}</Text>
        )}

        <Card className="mb-8 w-full">
          {orderId ? (
            <View className="flex-row justify-between py-2">
              <Text className="text-sm text-neutral-text">订单号</Text>
              <Text className="font-mono text-sm text-primary">{orderId}</Text>
            </View>
          ) : null}
          <View className="flex-row justify-between py-2">
            <Text className="text-sm text-neutral-text">方案</Text>
            <Text className="text-sm font-semibold text-primary">{planLabel}</Text>
          </View>
          <View className="flex-row justify-between py-2">
            <Text className="text-sm text-neutral-text">支付方式</Text>
            <Text className="text-sm text-primary">{formatProvider(requestedProvider ?? null)}</Text>
          </View>
          <View className="flex-row justify-between py-2">
            <Text className="font-mono text-sm text-neutral-text">金额</Text>
            <Text className="font-mono text-sm text-primary">{amountLabel}</Text>
          </View>
          <View className="flex-row justify-between py-2">
            <Text className="text-sm text-neutral-text">到期时间</Text>
            <Text className="font-mono text-sm text-primary">
              {isCurrentOrderActive && status?.expiresAt ? status.expiresAt : '支付完成后更新'}
            </Text>
          </View>
        </Card>

        {isCurrentOrderActive ? (
          <Card className="mb-8 w-full">
            <Text className="text-sm font-semibold text-primary">已解锁会员权益</Text>
            <View className="mt-4 gap-3">
              <View className="flex-row items-center justify-between">
                <Text className="text-sm text-neutral-text">AI识别次数</Text>
                <Text className="text-sm font-semibold text-stable-text">无限次 ✓</Text>
              </View>
              <View className="flex-row items-center justify-between">
                <Text className="text-sm text-neutral-text">云端同步</Text>
                <Text className="text-sm font-semibold text-stable-text">已开启 ✓</Text>
              </View>
              {PREMIUM_UNLOCKED_RIGHTS.filter(
                (item) => item.label !== 'AI识别次数' && item.label !== '云端同步备份'
              ).map((item) => (
                <View key={item.label} className="flex-row items-center justify-between">
                  <Text className="text-sm text-neutral-text">{item.label}</Text>
                  <Text className={`text-sm font-semibold ${item.tone === 'positive' ? 'text-stable-text' : 'text-primary'}`}>
                    {item.value}
                    {item.tone === 'positive' ? ' ✓' : ''}
                  </Text>
                </View>
              ))}
            </View>
          </Card>
        ) : null}

        {error instanceof Error ? <Text className="mb-3 text-xs text-neutral-text">订阅状态获取失败：{error.message}</Text> : null}
        <Button title="开始使用" fullWidth onPress={() => router.replace('/(main)')} />
      </View>
    </SafeAreaView>
  );
}
