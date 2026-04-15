import { useMemo, type ReactNode } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useAuth } from '@/providers/auth-provider';
import { formatSubscriptionPlan, useSubscriptionStatus } from '@/hooks/useSubscriptionStatus';
import { useProfiles } from '@/hooks/useProfiles';
import Constants from 'expo-constants';

function SettingsRow({
  icon,
  title,
  subtitle,
  onPress,
  trailing,
  disabled,
}: {
  icon: string;
  title: string;
  subtitle: string;
  onPress?: () => void;
  trailing?: ReactNode;
  disabled?: boolean;
}) {
  const isInteractive = Boolean(onPress) && !disabled;

  return (
    <Pressable
      onPress={isInteractive ? onPress : undefined}
      className={`flex-row items-center py-4 border-b border-neutral-bg ${disabled ? 'opacity-60' : ''}`}
    >
      <View className="mr-3 h-10 w-10 items-center justify-center rounded-xl bg-neutral-bg">
        <Text className="text-base">{icon}</Text>
      </View>

      <View className="flex-1">
        <Text className="text-sm font-semibold text-primary">{title}</Text>
        <Text className="mt-1 text-xs text-neutral-text">{subtitle}</Text>
      </View>

      <View className="ml-3 flex-row items-center">
        {trailing}
        {isInteractive ? <Text className="ml-2 text-neutral-text">›</Text> : null}
      </View>
    </Pressable>
  );
}

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const { data: subscriptionStatus, isLoading: subscriptionLoading } = useSubscriptionStatus();
  const { data: profiles = [] } = useProfiles();

  const maskedPhone = user?.phone
    ? user.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
    : user
      ? '未绑定'
      : '未登录';

  const subscriptionSubtitle = (() => {
    if (subscriptionLoading) return '加载中…';
    if (!subscriptionStatus) return '-';

    if (subscriptionStatus.isActive) {
      const expires = subscriptionStatus.expiresAt ? subscriptionStatus.expiresAt.slice(0, 10) : '';
      return `${formatSubscriptionPlan(subscriptionStatus.plan)}${expires ? ` · 有效期至 ${expires}` : ' · 已开通'}`;
    }

    const aiRemaining = subscriptionStatus.featureRemaining?.ai_recognize;
    const exportRemaining = subscriptionStatus.featureRemaining?.summary_export;
    const parts = [formatSubscriptionPlan('free')];
    if (typeof aiRemaining === 'number') parts.push(`AI识别剩余${aiRemaining}次`);
    if (typeof exportRemaining === 'number') parts.push(`摘要导出剩余${exportRemaining}次`);
    return parts.join(' · ');
  })();

  const profileSummary = useMemo(() => {
    if (profiles.length === 0) return '暂无档案';
    const names = profiles.map((p) => p.nickname).filter(Boolean);
    const shown = names.slice(0, 3).join('、');
    const suffix = profiles.length > 3 ? '…' : '';
    return `${shown}${suffix} · 共${profiles.length}人`;
  }, [profiles]);

  const appVersion = Constants.expoConfig?.version ?? '-';

  return (
    <SafeAreaView className="flex-1 bg-page-bg">
      <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
        <Text className="text-2xl font-bold text-primary mt-4 mb-4">设置</Text>

        <Text className="mb-2 text-xs font-semibold text-neutral-text">账号</Text>
        <Card className="mb-4 p-0 overflow-hidden">
          <SettingsRow
            icon="👤"
            title="档案人管理"
            subtitle={profileSummary}
            trailing={<Badge text="开发中" variant="neutral" />}
            disabled
          />
          <SettingsRow
            icon="📱"
            title="手机号"
            subtitle={maskedPhone}
            trailing={<Badge text="暂不支持修改" variant="neutral" />}
            disabled
          />
        </Card>

        <Text className="mb-2 text-xs font-semibold text-neutral-text">存储</Text>
        <Card className="mb-4 p-0 overflow-hidden">
          <SettingsRow
            icon="💾"
            title="本地存储"
            subtitle="仅本机 · 暂不统计占用"
            trailing={<Badge text="免费" variant="stable" />}
            disabled
          />
          <SettingsRow
            icon="☁️"
            title="云端同步"
            subtitle="多设备访问 · 自动备份"
            trailing={<Badge text="开发中" variant="neutral" />}
            disabled
          />
        </Card>

        <Text className="mb-2 text-xs font-semibold text-neutral-text">通知</Text>
        <Card className="mb-4 p-0 overflow-hidden">
          <SettingsRow
            icon="🔔"
            title="复查提醒通知"
            subtitle="系统通知 · 开发中"
            trailing={<Badge text="开发中" variant="neutral" />}
            disabled
          />
          <SettingsRow
            icon="✉️"
            title="邮件提醒"
            subtitle="未绑定邮箱 · 开发中"
            trailing={<Badge text="开发中" variant="neutral" />}
            disabled
          />
        </Card>

        <Text className="mb-2 text-xs font-semibold text-neutral-text">订阅</Text>
        <Card className="mb-4 p-0 overflow-hidden">
          <SettingsRow
            icon="⭐"
            title="当前方案"
            subtitle={subscriptionSubtitle}
            onPress={() => router.push('/subscription')}
            trailing={
              subscriptionLoading ? (
                <Badge text="…" variant="neutral" />
              ) : subscriptionStatus?.isActive ? (
                <Badge text="管理" variant="stable" />
              ) : (
                <Badge text="升级" variant="new" />
              )
            }
          />
        </Card>

        <Card className="mb-4 p-0 overflow-hidden">
          <SettingsRow icon="ℹ️" title="关于" subtitle={`结节档案 v${appVersion}`} trailing={<Badge text="开发中" variant="neutral" />} disabled />
          <SettingsRow icon="🔒" title="隐私政策" subtitle="开发中" trailing={<Badge text="开发中" variant="neutral" />} disabled />
          <SettingsRow icon="📄" title="服务条款" subtitle="开发中" trailing={<Badge text="开发中" variant="neutral" />} disabled />
        </Card>

        <Pressable
          className="items-center py-4 mb-10"
          onPress={async () => {
            await signOut();
            router.replace('/(auth)/login');
          }}
        >
          <Text className="text-sm text-new-text">退出登录</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
