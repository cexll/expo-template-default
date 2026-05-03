import { useMemo, useState, type ReactNode } from 'react';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useAuth } from '@/providers/auth-provider';
import { formatSubscriptionPlan, useSubscriptionStatus } from '@/hooks/useSubscriptionStatus';
import { useProfiles } from '@/hooks/useProfiles';
import { syncCloudArchiveIfEntitled } from '@/lib/cloud-sync';
import {
  formatLocalArchiveStorage,
  formatNotificationState,
  formatReminderContact,
  readLocalArchiveSettingsSnapshot,
} from '@/lib/settings/archive-snapshot';
import Constants from 'expo-constants';
import { Pressable, SafeAreaView, ScrollView, Text, View } from '@/tw';

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
  const accountKey = user?.id ?? user?.phone ?? null;
  const { data: subscriptionStatus, isLoading: subscriptionLoading } = useSubscriptionStatus(accountKey);
  const [cloudSyncResult, setCloudSyncResult] = useState('');
  const { data: profiles = [] } = useProfiles();
  const { data: archiveSnapshot } = useQuery({
    queryKey: ['settings', 'archive-snapshot'],
    queryFn: readLocalArchiveSettingsSnapshot,
  });

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

  const cloudSyncSubtitle = subscriptionStatus?.isCloudSyncEnabled
    ? cloudSyncResult || `会员已开启 · ${archiveSnapshot?.profileCount ?? 0}个档案可同步`
    : '会员可用 · 本地优先保存';
  const localStorageSubtitle = formatLocalArchiveStorage(archiveSnapshot);
  const reminderContactSubtitle = formatReminderContact(user);
  const notificationSubtitle = formatNotificationState();

  const profileSummary = useMemo(() => {
    if (profiles.length === 0) return '暂无档案';
    const names = profiles.map((p) => p.nickname).filter(Boolean);
    const shown = names.slice(0, 3).join('、');
    const suffix = profiles.length > 3 ? '…' : '';
    return `${shown}${suffix} · 共${profiles.length}人`;
  }, [profiles]);

  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

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
            subtitle={localStorageSubtitle}
            trailing={<Badge text="免费" variant="stable" />}
            disabled
          />
          <SettingsRow
            icon="☁️"
            title="云端同步"
            subtitle={cloudSyncSubtitle}
            onPress={() => {
              setCloudSyncResult('云端同步中…');
              void syncCloudArchiveIfEntitled(subscriptionStatus)
                .then((result) => {
                  setCloudSyncResult(
                    result.skipped
                      ? '尚未开通云端同步'
                      : `云端同步完成 · ${result.syncedCount}项${typeof result.readbackCount === 'number' ? ` · 读回${result.readbackCount}项` : ''}`
                  );
                })
                .catch((e) => {
                  setCloudSyncResult(e instanceof Error ? `同步失败：${e.message}` : '同步失败，请稍后重试');
                });
            }}
            trailing={<Badge text={subscriptionStatus?.isCloudSyncEnabled ? '同步' : '会员'} variant={subscriptionStatus?.isCloudSyncEnabled ? 'stable' : 'neutral'} />}
            disabled={!subscriptionStatus?.isCloudSyncEnabled}
          />
        </Card>

        <Text className="mb-2 text-xs font-semibold text-neutral-text">通知</Text>
        <Card className="mb-4 p-0 overflow-hidden">
          <SettingsRow
            icon="🔔"
            title="复查提醒通知"
            subtitle={notificationSubtitle}
            trailing={<Badge text={archiveSnapshot?.activeReminderCount ? '已规划' : '待设置'} variant={archiveSnapshot?.activeReminderCount ? 'stable' : 'neutral'} />}
            disabled
          />
          <SettingsRow
            icon="✉️"
            title="提醒联系方式"
            subtitle={reminderContactSubtitle}
            trailing={<Badge text={user?.phone ? '已绑定' : '未绑定'} variant={user?.phone ? 'stable' : 'neutral'} />}
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

        <Text className="mb-4 text-center text-[11px] text-neutral-text">
          结节档案 v{appVersion} · 数据仅供参考，不构成诊断
        </Text>

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
