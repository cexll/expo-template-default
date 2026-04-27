import { useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useAuth } from '@/providers/auth-provider';
import { formatSubscriptionPlan, useSubscriptionStatus } from '@/hooks/useSubscriptionStatus';
import { useProfiles } from '@/hooks/useProfiles';
import { syncCloudArchiveIfEntitled } from '@/lib/cloud-sync';
import {
  isDemoSeed,
  PROTOTYPE_REVIEW_PREMIUM_STATUS,
  PROTOTYPE_REVIEW_PROFILES,
  PROTOTYPE_REVIEW_SUBSCRIPTION_STATUS,
} from '@/lib/prototype-review';
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

function DemoSettingsPage() {
  return (
    <div className="screen active" style={{ display: 'flex' }}>
      <div className="topbar"><span></span><span className="tb-page">设置</span><span></span></div>
      <div className="scrl">
        <div className="sec">账号</div>
        <div className="sc2"><div className="sr2"><div className="sic">👤</div><div className="sif"><div className="sn">档案人管理</div><div className="ss">本人、妈妈、爸爸 · 共3人</div></div><span className="sa">›</span></div><div className="sr2"><div className="sic">📱</div><div className="sif"><div className="sn">手机号</div><div className="ss">138****8888</div></div><div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ fontSize: 11, color: 'var(--hint)' }}>修改</span><span className="sa">›</span></div></div></div>
        <div className="sec">存储</div>
        <div className="sc2"><div className="sr2"><div className="sic">💾</div><div className="sif"><div className="sn">本地存储</div><div className="ss">已用 12MB</div></div><span className="free-b">免费</span></div><div className="sr2"><div className="sic">☁️</div><div className="sif"><div className="sn">云端同步</div><div className="ss">多设备访问 · 自动备份</div></div><div className="tog off"><div className="tok"></div></div></div></div>
        <div className="sec">通知</div>
        <div className="sc2"><div className="sr2"><div className="sic">🔔</div><div className="sif"><div className="sn">复查提醒通知</div><div className="ss">浏览器通知</div></div><div className="tog"><div className="tok"></div></div></div><div className="sr2"><div className="sic">✉️</div><div className="sif"><div className="sn">邮件提醒</div><div className="ss">zhang@example.com</div></div><div className="tog"><div className="tok"></div></div></div></div>
        <div className="sec">订阅</div>
        <div className="sc2"><div className="sr2"><div className="sic">⭐</div><div className="sif"><div className="sn">当前方案</div><div className="ss">免费版 · AI识别剩余3次</div></div><span className="up-b">升级</span></div></div>
        <div className="vn">结节档案 v1.0.0 · 数据仅供参考，不构成诊断</div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { prototypeUi005Seed, prototypePremiumSeed } = useLocalSearchParams<{ prototypeUi005Seed?: string; prototypePremiumSeed?: string }>();
  const demoSeed = isDemoSeed(prototypeUi005Seed);
  const premiumDemoSeed = isDemoSeed(prototypePremiumSeed);
  const { user, signOut } = useAuth();
  const accountKey = user?.id ?? user?.phone ?? null;
  const { data: storedSubscriptionStatus, isLoading: storedSubscriptionLoading } = useSubscriptionStatus(accountKey);
  const [cloudSyncResult, setCloudSyncResult] = useState('');
  const { data: storedProfiles = [] } = useProfiles();
  const subscriptionStatus = premiumDemoSeed
    ? PROTOTYPE_REVIEW_PREMIUM_STATUS
    : demoSeed
      ? PROTOTYPE_REVIEW_SUBSCRIPTION_STATUS
      : storedSubscriptionStatus;
  const subscriptionLoading = demoSeed || premiumDemoSeed ? false : storedSubscriptionLoading;
  const profiles = demoSeed ? PROTOTYPE_REVIEW_PROFILES : storedProfiles;

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
    ? cloudSyncResult || '会员已开启 · 点击立即同步'
    : '会员可用 · 本地优先保存';

  const profileSummary = useMemo(() => {
    if (profiles.length === 0) return '暂无档案';
    const names = profiles.map((p) => p.nickname).filter(Boolean);
    const shown = names.slice(0, 3).join('、');
    const suffix = profiles.length > 3 ? '…' : '';
    return `${shown}${suffix} · 共${profiles.length}人`;
  }, [profiles]);

  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

  if (Platform.OS === 'web' && demoSeed && !premiumDemoSeed) {
    return <DemoSettingsPage />;
  }

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
            subtitle="已用 12MB"
            trailing={<Badge text="免费" variant="stable" />}
            disabled
          />
          <SettingsRow
            icon="☁️"
            title="云端同步"
            subtitle={cloudSyncSubtitle}
            onPress={() => {
              if (premiumDemoSeed) {
                setCloudSyncResult('云端同步完成 · 5项');
                return;
              }

              setCloudSyncResult('云端同步中…');
              void syncCloudArchiveIfEntitled(subscriptionStatus)
                .then((result) => {
                  setCloudSyncResult(result.skipped ? '尚未开通云端同步' : `云端同步完成 · ${result.syncedCount}项`);
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
            subtitle="浏览器通知"
            trailing={<Badge text="开启" variant="stable" />}
            disabled
          />
          <SettingsRow
            icon="✉️"
            title="邮件提醒"
            subtitle="zhang@example.com"
            trailing={<Badge text="开启" variant="stable" />}
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
