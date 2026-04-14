import { useMemo, useState } from 'react';
import { ScrollView, Text, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQueries } from '@tanstack/react-query';

import { LesionCard } from '@/components/LesionCard';
import { PaywallSheet } from '@/components/PaywallSheet';
import { ProfileSwitcher } from '@/components/ProfileSwitcher';
import { Button } from '@/components/ui/Button';
import { listExaminationsByLesion } from '@/lib/db/queries/examinations';
import { listLesionsByProfile } from '@/lib/db/queries/lesions';
import { listActiveRemindersByProfile } from '@/lib/db/queries/reminders';
import { useLesions } from '@/hooks/useLesions';
import { useProfiles } from '@/hooks/useProfiles';
import { useActiveReminders } from '@/hooks/useReminders';
import { useSubscriptionStatus } from '@/hooks/useSubscriptionStatus';
import { useActiveProfile } from '@/providers/active-profile-provider';

const DISEASE_LABELS = {
  thyroid: '甲状腺',
  breast: '乳腺',
  lung: '肺',
} as const;

const RADS_FALLBACK = '待补充分级';
const SIZE_FALLBACK = '待补充';
const BASELINE_FALLBACK = '—';

function formatLesionSize(sizeX: number | null, sizeY: number | null, sizeZ: number | null) {
  const values = [sizeX, sizeY, sizeZ].filter((value): value is number => value !== null);
  if (values.length === 0) {
    return SIZE_FALLBACK;
  }

  return `${values.map((value) => `${value}`).join('×')}mm`;
}

function getRadsGrade(exam: {
  tirads: string | null;
  birads: string | null;
  lung_rads: string | null;
}) {
  if (exam.tirads) return `TI-RADS ${exam.tirads}`;
  if (exam.birads) return `BI-RADS ${exam.birads}`;
  if (exam.lung_rads) return `Lung-RADS ${exam.lung_rads}`;
  return RADS_FALLBACK;
}

function getRemainingDays(nextExamDate: string | null | undefined) {
  if (!nextExamDate) {
    return undefined;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const target = new Date(nextExamDate);
  if (Number.isNaN(target.getTime())) {
    return undefined;
  }

  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
}

function getExamSizeScalar(exam: { size_x: number | null; size_y: number | null; size_z: number | null }) {
  const values = [exam.size_x, exam.size_y, exam.size_z].filter((value): value is number => value !== null);
  if (values.length === 0) return null;
  return Math.max(...values);
}

export default function HomePage() {
  const [paywallVisible, setPaywallVisible] = useState(false);

  const { data: profiles = [] } = useProfiles();
  const { data: subscriptionStatus } = useSubscriptionStatus();
  const { activeProfileId, setActiveProfileId } = useActiveProfile();

  const { data: lesions = [] } = useLesions(activeProfileId);
  const { data: reminders = [] } = useActiveReminders(activeProfileId);

  const profileLesionResults = useQueries({
    queries: profiles.map((profile) => ({
      queryKey: ['lesions', 'profile', profile.id],
      queryFn: () => listLesionsByProfile(profile.id),
      enabled: Boolean(profile.id),
    })),
  });

  const profileReminderResults = useQueries({
    queries: profiles.map((profile) => ({
      queryKey: ['reminders', 'active', profile.id],
      queryFn: () => listActiveRemindersByProfile(profile.id),
      enabled: Boolean(profile.id),
    })),
  });

  const profileLesionsById = useMemo(() => {
    return new Map(
      profiles.map((profile, index) => [profile.id, profileLesionResults[index]?.data ?? []])
    );
  }, [profileLesionResults, profiles]);

  const profileRemindersById = useMemo(() => {
    return new Map(
      profiles.map((profile, index) => [profile.id, profileReminderResults[index]?.data ?? []])
    );
  }, [profileReminderResults, profiles]);

  const activeLesions = useMemo(
    () => lesions.filter((lesion) => lesion.is_archived === 0),
    [lesions]
  );

  const examinations = useQueries({
    queries: activeLesions.map((lesion) => ({
      queryKey: ['examinations', 'lesion', lesion.id],
      queryFn: () => listExaminationsByLesion(lesion.id),
      enabled: Boolean(lesion.id),
    })),
  });

  const reminderByLesionId = useMemo(() => {
    return new Map(reminders.map((reminder) => [reminder.lesion_id, reminder]));
  }, [reminders]);

  const lesionCards = useMemo(() => {
    return activeLesions.map((lesion, index) => {
      const lesionExams = examinations[index]?.data;
      const latestExam = lesionExams?.[0];
      const baselineExam = lesionExams && lesionExams.length > 1 ? lesionExams[lesionExams.length - 1] : null;
      const reminder = reminderByLesionId.get(lesion.id);
      const reminderDays = getRemainingDays(reminder?.next_exam_date);
      const recordCount = lesionExams ? lesionExams.length : null;

      const latestSize = latestExam
        ? formatLesionSize(latestExam.size_x, latestExam.size_y, latestExam.size_z)
        : SIZE_FALLBACK;
      const radsGrade = latestExam ? getRadsGrade(latestExam) : RADS_FALLBACK;

      const latestScalar = latestExam ? getExamSizeScalar(latestExam) : null;
      const baselineScalar = baselineExam ? getExamSizeScalar(baselineExam) : null;

      const statusBadge = (() => {
        if (recordCount !== null && recordCount <= 1) {
          return { text: '新建', variant: 'new' as const };
        }

        if (latestScalar !== null && baselineScalar !== null && baselineScalar > 0) {
          const percent = (latestScalar - baselineScalar) / baselineScalar;
          const absPercent = Math.round(Math.abs(percent) * 100);
          if (absPercent >= 5) {
            return percent > 0
              ? { text: '▲ 增大', variant: 'increase' as const }
              : { text: '▼ 减小', variant: 'stable' as const };
          }
          return { text: '— 稳定', variant: 'stable' as const };
        }

        if (recordCount !== null && recordCount > 1) {
          return { text: '待补充', variant: 'neutral' as const };
        }

        return null;
      })();

      const baselineChange = (() => {
        if (recordCount === null || recordCount <= 1) return BASELINE_FALLBACK;
        if (latestScalar === null || baselineScalar === null || baselineScalar <= 0) return BASELINE_FALLBACK;

        const percent = (latestScalar - baselineScalar) / baselineScalar;
        const absPercent = Math.round(Math.abs(percent) * 100);
        if (absPercent < 5) return BASELINE_FALLBACK;
        return `${percent > 0 ? '▲' : '▼'}${absPercent}%`;
      })();

      const reminderText = (() => {
        if (reminderDays === undefined) return '未设置提醒';
        if (reminderDays < 0) return `已逾期${Math.abs(reminderDays)}天`;
        if (reminderDays === 0) return '今天复查';
        return `${reminderDays}天后复查`;
      })();

      const reminderTone =
        reminderDays !== undefined && reminderDays <= 30 ? ('urgent' as const) : ('normal' as const);

      const location = lesion.location?.trim() ? lesion.location.trim() : '待补充部位';

      return {
        id: lesion.id,
        diseaseType: lesion.disease_type,
        title: lesion.label,
        subtitle: `${DISEASE_LABELS[lesion.disease_type]} · ${location}`,
        statusBadge,
        latestSize,
        radsGrade,
        baselineChange,
        recordCount,
        reminderText,
        reminderTone,
      };
    });
  }, [activeLesions, examinations, reminderByLesionId]);

  const profileItems = useMemo(() => {
    return profiles.map((profile) => {
      const isActive = profile.id === activeProfileId;
      const profileLesions =
        isActive
          ? activeLesions
          : (profileLesionsById.get(profile.id) ?? []).filter((lesion) => lesion.is_archived === 0);

      const profileReminder =
        isActive
          ? reminders[0]
          : profileRemindersById.get(profile.id)?.[0];
      const reminderDays = getRemainingDays(profileReminder?.next_exam_date);

      return {
        id: profile.id,
        nickname: profile.nickname,
        subtitle:
          !isActive && reminderDays !== undefined && reminderDays <= 30
            ? reminderDays >= 0
              ? `${reminderDays}天后!`
              : `已逾期${Math.abs(reminderDays)}天!`
            : `${profileLesions.length}个病灶`,
        isUrgent: !isActive && reminderDays !== undefined && reminderDays <= 30,
      };
    });
  }, [activeLesions, activeProfileId, profileLesionsById, profileRemindersById, profiles, reminders]);

  const groupedLesions = useMemo(() => {
    return (Object.keys(DISEASE_LABELS) as (keyof typeof DISEASE_LABELS)[])
      .map((diseaseType) => ({
        diseaseType,
        title: DISEASE_LABELS[diseaseType],
        items: lesionCards.filter((lesion) => lesion.diseaseType === diseaseType),
      }))
      .filter((group) => group.items.length > 0);
  }, [lesionCards]);

  const alertInfo = useMemo(() => {
    const activeProfile = profiles.find((profile) => profile.id === activeProfileId);
    if (!activeProfile) return null;

    const pickReminder = (profileId: string) =>
      profileId === activeProfileId ? reminders[0] : profileRemindersById.get(profileId)?.[0];
    const pickLesions = (profileId: string) =>
      profileId === activeProfileId ? lesions : profileLesionsById.get(profileId) ?? [];

    const globalSoonest = profiles.reduce<{
      profileId: string;
      nickname: string;
      lesionId: string;
      daysUntil: number;
      diseaseType: keyof typeof DISEASE_LABELS | null;
    } | null>((best, profile) => {
      const reminder = pickReminder(profile.id);
      const daysUntil = getRemainingDays(reminder?.next_exam_date);
      if (daysUntil === undefined || !reminder) return best;

      if (best && best.daysUntil <= daysUntil) return best;

      const lesion = pickLesions(profile.id).find((item) => item.id === reminder.lesion_id);
      const diseaseType = lesion?.disease_type ?? null;

      return {
        profileId: profile.id,
        nickname: profile.nickname,
        lesionId: reminder.lesion_id,
        daysUntil,
        diseaseType,
      };
    }, null);

    const selectedReminder = reminders[0];
    const selectedDaysUntil = getRemainingDays(selectedReminder?.next_exam_date);

    if (globalSoonest && globalSoonest.daysUntil <= 30) return globalSoonest;
    if (selectedReminder && selectedDaysUntil !== undefined) {
      const selectedLesion = lesions.find((item) => item.id === selectedReminder.lesion_id);
      const diseaseType = selectedLesion?.disease_type ?? null;

      return {
        profileId: activeProfileId,
        nickname: activeProfile.nickname,
        lesionId: selectedReminder.lesion_id,
        daysUntil: selectedDaysUntil,
        diseaseType,
      };
    }

    return null;
  }, [activeProfileId, lesions, profileLesionsById, profileRemindersById, profiles, reminders]);

  const quotaInfo = useMemo(() => {
    if (!subscriptionStatus || subscriptionStatus.isActive) return null;
    const remaining = subscriptionStatus.featureRemaining?.ai_recognize;
    if (typeof remaining !== 'number') return null;
    return { remaining };
  }, [subscriptionStatus]);

  return (
    <SafeAreaView className="flex-1 bg-page-bg">
      <View className="px-4 pt-4">
        <View className="flex-row items-center justify-between">
          <Text className="text-xl font-bold text-primary">结节档案</Text>
          <Pressable
            className="h-9 w-9 items-center justify-center rounded-full border border-ink-100 bg-card"
            onPress={() => router.push('/settings')}
          >
            <Text className="text-xs font-semibold text-neutral-text">人</Text>
          </Pressable>
        </View>
      </View>

      {profileItems.length > 0 && (
        <ProfileSwitcher
          profiles={profileItems}
          activeId={activeProfileId}
          onSelect={setActiveProfileId}
          onAdd={() => router.push('/profiles/new')}
        />
      )}

      <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
        {alertInfo ? (
          <View
            className={`mt-2 flex-row items-center justify-between rounded-xl border px-4 py-3 ${
              alertInfo.daysUntil <= 30 ? 'border-new-text/20 bg-new-bg' : 'border-stable-text/20 bg-stable-bg'
            }`}
          >
            <Text
              className={`flex-1 pr-3 text-xs font-medium ${
                alertInfo.daysUntil <= 30 ? 'text-new-text' : 'text-stable-text'
              }`}
            >
              {(() => {
                const diseaseLabel =
                  alertInfo.diseaseType ? DISEASE_LABELS[alertInfo.diseaseType] : '随访';
                if (alertInfo.daysUntil < 0) {
                  return `${alertInfo.nickname}的${diseaseLabel}复查已逾期 ${Math.abs(alertInfo.daysUntil)} 天`;
                }
                if (alertInfo.daysUntil === 0) {
                  return `${alertInfo.nickname}今天需要${diseaseLabel}复查`;
                }
                return `${alertInfo.nickname}的${diseaseLabel}复查还有 ${alertInfo.daysUntil} 天`;
              })()}
            </Text>
            <Pressable
              className={`rounded-lg bg-card px-3 py-1.5 ${
                alertInfo.daysUntil <= 30 ? 'border border-new-text/20' : 'border border-stable-text/20'
              }`}
              onPress={() => router.push('/reminders')}
            >
              <Text
                className={`text-xs font-semibold ${
                  alertInfo.daysUntil <= 30 ? 'text-new-text' : 'text-stable-text'
                }`}
              >
                查看
              </Text>
            </Pressable>
          </View>
        ) : null}

        {profileItems.length === 0 ? (
          <View className="flex-1 items-center justify-center py-20">
            <Text className="mb-4 text-lg text-neutral-text">暂无档案</Text>
            <Button title="添加第一个病灶记录" onPress={() => router.push('/record/upload')} />
          </View>
        ) : groupedLesions.length === 0 ? (
          <View className="flex-1 items-center justify-center py-20">
            <Text className="mb-4 text-lg text-neutral-text">暂无病灶记录</Text>
            <Button title="添加第一个病灶记录" onPress={() => router.push('/record/upload')} />
          </View>
        ) : (
          groupedLesions.map((group) => (
            <View key={group.diseaseType}>
              <Text className="mb-2 mt-4 text-sm text-neutral-text">{group.title}</Text>
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
          <View className="mt-3 flex-row items-center justify-between rounded-xl border border-increase-text/20 bg-increase-bg px-4 py-3">
            <Text className="text-xs font-medium text-increase-text">
              {quotaInfo.remaining === 0
                ? '本月 AI 识别已用完'
                : `本月 AI 识别剩余 ${quotaInfo.remaining} 次`}
            </Text>
            <Pressable
              className="rounded-lg border border-increase-text/20 bg-card px-3 py-1.5"
              onPress={() => setPaywallVisible(true)}
            >
              <Text className="text-xs font-semibold text-increase-text">升级</Text>
            </Pressable>
          </View>
        ) : null}

        <View className="h-32" />
      </ScrollView>

      <Pressable
        className="absolute bottom-24 right-6 h-14 w-14 items-center justify-center rounded-full bg-primary shadow-lg"
        onPress={() => router.push('/record/upload')}
      >
        <Text className="text-2xl text-white">+</Text>
      </Pressable>

      <PaywallSheet
        visible={paywallVisible}
        onClose={() => setPaywallVisible(false)}
        feature="AI识别"
        title={quotaInfo?.remaining === 0 ? 'AI识别次数已用完' : '升级会员'}
        subtitle={
          quotaInfo
            ? quotaInfo.remaining === 0
              ? '本月免费额度已用尽（5次/月）\n升级会员，享受无限次AI识别'
              : `本月 AI 识别剩余 ${quotaInfo.remaining} 次\n升级会员，享受无限次AI识别`
            : undefined
        }
      />
    </SafeAreaView>
  );
}
