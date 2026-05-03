import { useState } from 'react';
import { useLocalSearchParams } from 'expo-router';

import { PaywallSheet, type PaywallSheetProps } from '@/components/PaywallSheet';
import { useSubscriptionStatus } from '@/hooks/useSubscriptionStatus';
import { useAuth } from '@/providers/auth-provider';
import { SafeAreaView, Text, View } from '@/tw';

function pickParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default function PaywallPage() {
  const params = useLocalSearchParams<{
    feature?: string;
  }>();
  const feature = pickParam(params.feature) ?? 'AI识别';
  const { user } = useAuth();
  const accountKey = user?.id ?? user?.phone ?? null;
  const { data: subscriptionStatus, isLoading } = useSubscriptionStatus(accountKey);
  const [paywallVisible, setPaywallVisible] = useState(true);
  const remaining = feature === '就诊摘要导出'
    ? subscriptionStatus?.featureRemaining?.summary_export
    : subscriptionStatus?.featureRemaining?.ai_recognize;

  return (
    <SafeAreaView className="flex-1 bg-page-bg">
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-lg font-semibold text-primary">会员权益预览</Text>
        <Text className="mt-2 text-center text-sm text-neutral-text">
          {isLoading
            ? '正在读取会员与额度状态…'
            : typeof remaining === 'number'
              ? `${feature}剩余额度 ${remaining} 次`
              : '额度状态以后端会员快照为准'}
        </Text>
      </View>
      <PaywallSheet
        visible={paywallVisible}
        onClose={() => setPaywallVisible(false)}
        feature={feature as PaywallSheetProps['feature']}
        status={subscriptionStatus}
      />
    </SafeAreaView>
  );
}
