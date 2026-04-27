import { useEffect } from 'react';
import { Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { isDemoSeed, PROTOTYPE_REVIEW_PREMIUM_STATUS } from '@/lib/prototype-review';
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

function DemoPaymentSuccessPage() {
  const expire = new Date();
  expire.setFullYear(expire.getFullYear() + 1);
  const expireText = `${expire.getFullYear()}-${String(expire.getMonth() + 1).padStart(2, '0')}-${String(expire.getDate()).padStart(2, '0')}`;

  return (
    <div className="screen active" style={{ display: 'flex' }}>
      <div className="success-wrap">
        <div className="success-icon">
          <svg className="success-check" viewBox="0 0 32 32">
            <path d="M8 16l6 6 12-14" />
          </svg>
        </div>
        <div className="success-title">订阅成功</div>
        <div className="success-sub">会员权益已立即生效<br />感谢你支持结节档案</div>
        <div className="success-card">
          <div className="sc-row"><span className="sc-lbl">订阅方案</span><span className="sc-val">年度会员</span></div>
          <div className="sc-row"><span className="sc-lbl">支付金额</span><span className="sc-val">¥399.00</span></div>
          <div className="sc-row"><span className="sc-lbl">有效期至</span><span className="sc-val">{expireText}</span></div>
          <div className="sc-row"><span className="sc-lbl">权益状态</span><span className="sc-val-green">已开通</span></div>
        </div>
        <button className="btn-full" style={{ width: '100%', marginBottom: 12 }}>开始使用</button>
        <div style={{ fontSize: 11, color: 'var(--hint)', marginTop: 12, cursor: 'pointer' }}>查看订阅详情</div>
      </div>
    </div>
  );
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
    prototypeUi005Seed?: string;
  }>();

  const orderId = pickParam(params.order_id) ?? '';
  const requestedPlan = pickParam(params.plan);
  const requestedProvider = pickParam(params.provider);
  const requestedAmount = pickParam(params.amount);
  const requestedCurrency = pickParam(params.currency);
  const demoSeed = isDemoSeed(params.prototypeUi005Seed);

  const { data: storedStatus, error, refetch } = useSubscriptionStatus(accountKey);
  const status = demoSeed ? PROTOTYPE_REVIEW_PREMIUM_STATUS : storedStatus;
  const orderContext = orderId ? readPendingSubscriptionOrderContext(orderId, accountKey) : null;

  const hasPendingOrderContext = Boolean(orderContext);

  useEffect(() => {
    if (demoSeed || !orderId || !hasPendingOrderContext) return;

    void refetch();
    const refreshTimer = setTimeout(() => {
      void refetch();
    }, 250);

    return () => clearTimeout(refreshTimer);
  }, [demoSeed, hasPendingOrderContext, orderId, refetch]);

  const hasOrderId = Boolean(orderId);
  const isCurrentOrderActive = demoSeed || doesSubscriptionStatusConfirmOrder(status, orderContext);
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

  if (Platform.OS === 'web' && demoSeed) {
    return <DemoPaymentSuccessPage />;
  }

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
