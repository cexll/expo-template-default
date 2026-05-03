import { useEffect, useMemo, useRef, useState } from 'react';
import { router, usePathname } from 'expo-router';

import { LesionCard } from '@/components/LesionCard';
import { PaywallSheet } from '@/components/PaywallSheet';
import { ProfileSwitcher } from '@/components/ProfileSwitcher';
import { Button } from '@/components/ui/Button';
import { useHomeProjection } from '@/lib/home/useHomeProjection';
import { useActiveProfile } from '@/providers/active-profile-provider';
import { Pressable, SafeAreaView, ScrollView, Text, View } from '@/tw';

const HOME_SCROLL_CONTENT_STYLE = {
  paddingBottom: 128,
};
const HOME_EMPTY_STATE_STYLE = {
  alignItems: 'center' as const,
  paddingTop: 24,
  paddingBottom: 48,
};

export default function HomePage() {
  const [paywallVisible, setPaywallVisible] = useState(false);

  const pathname = usePathname();
  const isHomePath = pathname === '/' || pathname === '';
  const wasHomeRef = useRef(false);
  const bootstrappedForEntryRef = useRef(false);

  const { activeProfileId, setActiveProfileId, bootstrapHomeDefaultProfile } = useActiveProfile();
  const homeProjection = useHomeProjection(activeProfileId || null);
  const resolvedActiveProfileId = homeProjection.activeProfileId;
  const profileItems = homeProjection.profiles;

  useEffect(() => {
    const enteringHome = isHomePath && !wasHomeRef.current;
    if (enteringHome) {
      bootstrappedForEntryRef.current = false;
    }
    wasHomeRef.current = isHomePath;

    if (!isHomePath) return;
    if (profileItems.length === 0) return;
    if (bootstrappedForEntryRef.current) return;

    bootstrapHomeDefaultProfile(profileItems);
    bootstrappedForEntryRef.current = true;
  }, [bootstrapHomeDefaultProfile, isHomePath, profileItems]);

  const groupedLesions = useMemo(
    () => homeProjection.diseaseGroups.map((group) => ({ ...group, items: group.lesionCards })),
    [homeProjection.diseaseGroups]
  );
  const alertInfo = homeProjection.urgentReview;
  const quotaInfo = homeProjection.quotaPrompt;

  return (
    <SafeAreaView testID="home-screen" className="flex-1 bg-page-bg">
      <View testID="home-topbar" dataSet={{ demoRole: 'topbar' }}>
        <View className="w-full flex-row items-center justify-between">
          <Text className="font-serif text-[17px] font-normal text-primary">结节档案</Text>
          <Pressable onPress={() => router.push('/settings')}>
            <View className="h-[27px] w-[27px] items-center justify-center rounded-full border-[0.5px] border-[#d4cdc0] bg-card">
              <Text dataSet={{ demoRole: 'topbar-text' }} className="text-[11px] font-normal text-[#6b5f4e]">人</Text>
            </View>
          </Pressable>
        </View>
      </View>

      {profileItems.length > 0 && (
        <ProfileSwitcher
          profiles={profileItems}
          activeId={resolvedActiveProfileId ?? ''}
          onSelect={setActiveProfileId}
          onAdd={() => router.push('/profiles/new')}
        />
      )}

      <ScrollView
        testID="home-scroll-view"
        dataSet={{ demoRole: 'scroll' }}
        contentContainerStyle={HOME_SCROLL_CONTENT_STYLE}
        showsVerticalScrollIndicator={false}
      >
        {alertInfo ? (
          <View
            className={`mb-3 flex-row items-center justify-between rounded-[9px] border px-3 py-[9px] ${
              alertInfo.daysUntil <= 30 ? 'border-new-border bg-new-bg' : 'border-stable-text/40 bg-stable-bg'
            }`}
          >
            <Text
              className={`flex-1 pr-3 text-xs font-medium  ${
                alertInfo.daysUntil <= 30 ? 'text-[#712b13]' : 'text-stable-text'
              }`}
            >
              {alertInfo.text}
            </Text>
            <Pressable
              className={`rounded-[5px] bg-card px-2 py-0.5 ${
                alertInfo.daysUntil <= 30 ? 'border-[0.5px] border-[#e8997a]' : 'border-[0.5px] border-[#9fd4c4]'
              }`}
              onPress={() => router.push('/reminders')}
            >
              <Text
                className={`text-[11px] font-medium  ${
                  alertInfo.daysUntil <= 30 ? 'text-new-mid' : 'text-stable-text'
                }`}
              >
                查看
              </Text>
            </Pressable>
          </View>
        ) : null}

        {profileItems.length === 0 ? (
          <View testID="home-empty-state" style={HOME_EMPTY_STATE_STYLE}>
            <Text className="mb-4 text-lg text-neutral-text">暂无档案</Text>
            <Button title="添加第一个病灶记录" onPress={() => router.push('/record/upload')} />
          </View>
        ) : groupedLesions.length === 0 ? (
          <View testID="home-empty-state" style={HOME_EMPTY_STATE_STYLE}>
            <Text className="mb-4 text-lg text-neutral-text">暂无病灶记录</Text>
            <Button title="添加第一个病灶记录" onPress={() => router.push('/record/upload')} />
          </View>
        ) : (
          groupedLesions.map((group) => (
            <View key={group.diseaseType}>
              <Text dataSet={{ demoRole: 'section' }} className="mt-[5px]">{group.title}</Text>
              {group.items.map((lesion) => (
                <LesionCard
                  key={lesion.id}
                  title={lesion.title}
                  subtitle={lesion.subtitle}
                  statusBadge={lesion.statusBadge ?? undefined}
                  latestSize={lesion.latestSize}
                  radsGrade={lesion.radsGrade}
                  baselineChange={lesion.baselineChange}
                  recordCount={lesion.recordCount}
                  reminderText={lesion.reminderText}
                  reminderTone={lesion.reminderTone}
                  onPress={() => router.push(`/lesion/${lesion.id}`)}
                />
              ))}
            </View>
          ))
        )}

        {quotaInfo ? (
          <View className="mt-2 flex-row items-center justify-between rounded-[9px] border border-[#e8c98a] bg-increase-bg px-3 py-[9px]">
            <Text className="text-[11px] font-medium text-increase-text">
              {quotaInfo.title}
            </Text>
            <Pressable
              className="rounded-[5px] border border-[#e8c98a] bg-card px-2 py-0.5"
              onPress={() => setPaywallVisible(true)}
            >
              <Text className="text-[11px] font-medium  text-increase-text">{quotaInfo.actionLabel}</Text>
            </Pressable>
          </View>
        ) : null}

      </ScrollView>

      <View className="items-end px-[14px] pb-0 pt-1">
        <Pressable
          className="items-center rounded-[20px] bg-primary px-[18px] py-[9px]"
          onPress={() => router.push('/record/upload')}
        >
          <Text className="text-xs font-medium text-nav-bg">+ 新增检查</Text>
        </Pressable>
      </View>

      <PaywallSheet
        visible={paywallVisible}
        onClose={() => setPaywallVisible(false)}
        feature="AI识别"
        title="AI识别次数已用完"
        subtitle={
          quotaInfo
            ? quotaInfo.remaining === 0
              ? '本月免费额度已用尽（5次/月）\n升级会员，享受无限次AI识别'
              : `${quotaInfo.title}\n升级会员，享受无限次AI识别`
            : undefined
        }
      />
    </SafeAreaView>
  );
}
