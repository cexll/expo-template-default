import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { router, usePathname } from 'expo-router';
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
import { Pressable, SafeAreaView, ScrollView, Text, View } from '@/tw';

const DISEASE_LABELS = {
  thyroid: '甲状腺',
  breast: '乳腺',
  lung: '肺',
} as const;

const RADS_FALLBACK = '待补充分级';
const SIZE_FALLBACK = '待补充';
const BASELINE_FALLBACK = '—';
const HOME_SCROLL_CONTENT_STYLE = {
  paddingBottom: 128,
};
const HOME_EMPTY_STATE_STYLE = {
  alignItems: 'center' as const,
  paddingTop: 24,
  paddingBottom: 48,
};
const DEMO_NOW = new Date('2026-04-25T00:00:00.000Z').getTime();

const DEMO_HOME_PROFILES = [
  { id: 'prototype-profile-self', nickname: '本人', sort_order: 0 },
  { id: 'prototype-profile-mom', nickname: '妈妈', sort_order: 1 },
  { id: 'prototype-profile-dad', nickname: '爸爸', sort_order: 2 },
] as const;

const DEMO_HOME_LESIONS = [
  {
    id: 'prototype-lesion-thyroid',
    profile_id: 'prototype-profile-self',
    disease_type: 'thyroid' as const,
    label: '左叶中下段结节',
    location: '左叶',
    is_archived: 0,
  },
  {
    id: 'prototype-lesion-breast',
    profile_id: 'prototype-profile-self',
    disease_type: 'breast' as const,
    label: '右乳10点钟结节',
    location: '右侧',
    is_archived: 0,
  },
  {
    id: 'prototype-lesion-lung',
    profile_id: 'prototype-profile-self',
    disease_type: 'lung' as const,
    label: '右上叶前段结节',
    location: '右上叶',
    is_archived: 0,
  },
  {
    id: 'prototype-lesion-mom',
    profile_id: 'prototype-profile-mom',
    disease_type: 'breast' as const,
    label: '左乳2点钟结节',
    location: '左侧',
    is_archived: 0,
  },
  {
    id: 'prototype-lesion-dad',
    profile_id: 'prototype-profile-dad',
    disease_type: 'lung' as const,
    label: '左上叶磨玻璃结节',
    location: '左上叶',
    is_archived: 0,
  },
] as const;

const DEMO_HOME_EXAMS = new Map<string, any[]>([
  [
    'prototype-lesion-thyroid',
    [
      { id: 'prototype-exam-thyroid-3', lesion_id: 'prototype-lesion-thyroid', size_x: 8.3, size_y: null, size_z: null, tirads: '3', birads: null, lung_rads: null },
      { id: 'prototype-exam-thyroid-2', lesion_id: 'prototype-lesion-thyroid', size_x: 7.9, size_y: null, size_z: null, tirads: '3', birads: null, lung_rads: null },
      { id: 'prototype-exam-thyroid-1', lesion_id: 'prototype-lesion-thyroid', size_x: 7.1, size_y: null, size_z: null, tirads: '3', birads: null, lung_rads: null },
    ],
  ],
  [
    'prototype-lesion-breast',
    [
      { id: 'prototype-exam-breast-2', lesion_id: 'prototype-lesion-breast', size_x: 12, size_y: null, size_z: null, tirads: null, birads: '3', lung_rads: null },
      { id: 'prototype-exam-breast-1', lesion_id: 'prototype-lesion-breast', size_x: 12, size_y: null, size_z: null, tirads: null, birads: '3', lung_rads: null },
    ],
  ],
  [
    'prototype-lesion-lung',
    [{ id: 'prototype-exam-lung-1', lesion_id: 'prototype-lesion-lung', size_x: 6.2, size_y: null, size_z: null, tirads: null, birads: null, lung_rads: '2' }],
  ],
  [
    'prototype-lesion-mom',
    [
      { id: 'prototype-exam-mom-2', lesion_id: 'prototype-lesion-mom', size_x: 8, size_y: null, size_z: null, tirads: null, birads: '3', lung_rads: null },
      { id: 'prototype-exam-mom-1', lesion_id: 'prototype-lesion-mom', size_x: 8, size_y: null, size_z: null, tirads: null, birads: '3', lung_rads: null },
    ],
  ],
  [
    'prototype-lesion-dad',
    [{ id: 'prototype-exam-dad-1', lesion_id: 'prototype-lesion-dad', size_x: 5.4, size_y: null, size_z: null, tirads: null, birads: null, lung_rads: '2' }],
  ],
]);

function isPrototypeHomeSeedEnabled() {
  try {
    const search = globalThis.location?.search ?? '';
    const hash = globalThis.location?.hash ?? '';
    return `${search}&${hash}`.includes('prototypeHomeSeed=demo');
  } catch {
    return false;
  }
}

function demoIsoDaysFromNow(days: number) {
  return new Date(DEMO_NOW + days * 86400000).toISOString();
}

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
  const prototypeHomeSeed = isPrototypeHomeSeedEnabled();

  const pathname = usePathname();
  const isHomePath = pathname === '/' || pathname === '';
  const wasHomeRef = useRef(false);
  const bootstrappedForEntryRef = useRef(false);

  const { data: storedProfiles = [] } = useProfiles();
  const { data: subscriptionStatus } = useSubscriptionStatus();
  const { activeProfileId, setActiveProfileId, bootstrapHomeDefaultProfile } = useActiveProfile();
  const [prototypeActiveProfileId, setPrototypeActiveProfileId] = useState<string>(DEMO_HOME_PROFILES[0].id);
  const profiles = prototypeHomeSeed ? DEMO_HOME_PROFILES : storedProfiles;
  const resolvedActiveProfileId = prototypeHomeSeed ? prototypeActiveProfileId : activeProfileId;

  useEffect(() => {
    const enteringHome = isHomePath && !wasHomeRef.current;
    if (enteringHome) {
      bootstrappedForEntryRef.current = false;
    }
    wasHomeRef.current = isHomePath;

    if (!isHomePath) return;
    if (profiles.length === 0) return;
    if (bootstrappedForEntryRef.current) return;

    bootstrapHomeDefaultProfile([...profiles]);
    bootstrappedForEntryRef.current = true;
  }, [bootstrapHomeDefaultProfile, isHomePath, profiles]);

  const { data: storedLesions = [] } = useLesions(resolvedActiveProfileId);
  const { data: storedReminders = [] } = useActiveReminders(resolvedActiveProfileId);
  const lesions = prototypeHomeSeed
    ? DEMO_HOME_LESIONS.filter((lesion) => lesion.profile_id === resolvedActiveProfileId)
    : storedLesions;
  const reminders = useMemo(() => {
    if (!prototypeHomeSeed) return storedReminders;
    return [
      ...(resolvedActiveProfileId === 'prototype-profile-self'
        ? [{ id: 'prototype-reminder-self', lesion_id: 'prototype-lesion-thyroid', next_exam_date: demoIsoDaysFromNow(23), source: 'auto' as const, is_active: 1 }]
        : []),
      ...(resolvedActiveProfileId === 'prototype-profile-mom'
        ? [{ id: 'prototype-reminder-mom', lesion_id: 'prototype-lesion-mom', next_exam_date: demoIsoDaysFromNow(3), source: 'auto' as const, is_active: 1 }]
        : []),
    ];
  }, [prototypeHomeSeed, resolvedActiveProfileId, storedReminders]);

  const profileLesionResults = useQueries({
    queries: profiles.map((profile) => ({
      queryKey: ['lesions', 'profile', profile.id],
      queryFn: () => listLesionsByProfile(profile.id),
      enabled: Boolean(profile.id) && !prototypeHomeSeed,
    })),
  });

  const profileReminderResults = useQueries({
    queries: profiles.map((profile) => ({
      queryKey: ['reminders', 'active', profile.id],
      queryFn: () => listActiveRemindersByProfile(profile.id),
      enabled: Boolean(profile.id) && !prototypeHomeSeed,
    })),
  });

  const profileLesionsById = useMemo(() => {
    if (prototypeHomeSeed) {
      return new Map(
        profiles.map((profile) => [
          profile.id,
          DEMO_HOME_LESIONS.filter((lesion) => lesion.profile_id === profile.id),
        ])
      );
    }
    return new Map(
      profiles.map((profile, index) => [profile.id, profileLesionResults[index]?.data ?? []])
    );
  }, [profileLesionResults, profiles, prototypeHomeSeed]);

  const profileRemindersById = useMemo(() => {
    if (prototypeHomeSeed) {
      return new Map([
        ['prototype-profile-self', [{ id: 'prototype-reminder-self', lesion_id: 'prototype-lesion-thyroid', next_exam_date: demoIsoDaysFromNow(23), source: 'auto' as const, is_active: 1 }]],
        ['prototype-profile-mom', [{ id: 'prototype-reminder-mom', lesion_id: 'prototype-lesion-mom', next_exam_date: demoIsoDaysFromNow(3), source: 'auto' as const, is_active: 1 }]],
        ['prototype-profile-dad', []],
      ]);
    }
    return new Map(
      profiles.map((profile, index) => [profile.id, profileReminderResults[index]?.data ?? []])
    );
  }, [profileReminderResults, profiles, prototypeHomeSeed]);

  const activeLesions = useMemo(
    () => lesions.filter((lesion) => lesion.is_archived === 0),
    [lesions]
  );

  const examinations = useQueries({
    queries: activeLesions.map((lesion) => ({
      queryKey: ['examinations', 'lesion', lesion.id],
      queryFn: () => listExaminationsByLesion(lesion.id),
      enabled: Boolean(lesion.id) && !prototypeHomeSeed,
    })),
  });

  const reminderByLesionId = useMemo(() => {
    return new Map(reminders.map((reminder) => [reminder.lesion_id, reminder]));
  }, [reminders]);

  const lesionCards = useMemo(() => {
    return activeLesions.map((lesion, index) => {
      const lesionExams = prototypeHomeSeed ? DEMO_HOME_EXAMS.get(lesion.id) : examinations[index]?.data;
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
  }, [activeLesions, examinations, prototypeHomeSeed, reminderByLesionId]);

  const profileItems = useMemo(() => {
    return profiles.map((profile) => {
      const isActive = profile.id === resolvedActiveProfileId;
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
  }, [activeLesions, resolvedActiveProfileId, profileLesionsById, profileRemindersById, profiles, reminders]);

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
    const activeProfile = profiles.find((profile) => profile.id === resolvedActiveProfileId);
    if (!activeProfile) return null;

    const pickReminder = (profileId: string) =>
      profileId === resolvedActiveProfileId ? reminders[0] : profileRemindersById.get(profileId)?.[0];
    const pickLesions = (profileId: string) =>
      profileId === resolvedActiveProfileId ? lesions : profileLesionsById.get(profileId) ?? [];

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
        profileId: resolvedActiveProfileId,
        nickname: activeProfile.nickname,
        lesionId: selectedReminder.lesion_id,
        daysUntil: selectedDaysUntil,
        diseaseType,
      };
    }

    return null;
  }, [resolvedActiveProfileId, lesions, profileLesionsById, profileRemindersById, profiles, reminders]);

  const quotaInfo = useMemo(() => {
    if (!subscriptionStatus || subscriptionStatus.isActive) return null;
    const remaining = subscriptionStatus.featureRemaining?.ai_recognize;
    if (typeof remaining !== 'number') return null;
    return { remaining };
  }, [subscriptionStatus]);

  if (Platform.OS === 'web' && prototypeHomeSeed) {
    return (
      <div data-testid="home-screen" className="screen active" style={{ display: 'flex', position: 'relative' }}>
        <PaywallSheet
          visible={paywallVisible}
          onClose={() => setPaywallVisible(false)}
          feature="AI识别"
          reviewSeed="prototypeUi005Seed=demo"
          title="AI识别次数已用完"
        />

        <div className="topbar">
          <span className="tb-app">结节档案</span>
          <div className="avatar-btn">人</div>
        </div>
        <div className="pstrip">
          <div className="chip is-on"><div className="chip-name">本人</div><div className="chip-sub">3个病灶</div></div>
          <div className="chip is-alert"><div className="chip-name">妈妈</div><div className="chip-sub">3天后!</div></div>
          <div className="chip is-off"><div className="chip-name">爸爸</div><div className="chip-sub">1个病灶</div></div>
          <div className="chip-add">+</div>
        </div>
        <div className="scrl">
          <div>
            <div className="alert-bar show-coral"><span className="ab-text-coral">妈妈的乳腺复查还有 3 天</span><button className="ab-btn coral">查看</button></div>
          </div>
          <div>
            <div className="sec">甲状腺</div>
            <div className="nc"><div className="nc-top"><div><div className="nc-name">左叶中下段结节</div><div className="nc-loc">甲状腺 · 左叶</div></div><span className="bdge b-up">▲ 增大</span></div><div className="nc-meta"><div><div className="mv">8.3mm</div><div className="ml">当前大小</div></div><div><div className="mv">TI-RADS 3</div><div className="ml">分级</div></div><div><div className="mv">▲17%</div><div className="ml">较基线</div></div></div><div className="nc-foot"><span className="fl">3次记录</span><span className="fr-soon">23天后复查</span></div></div>
            <div className="gap" />
            <div className="sec">乳腺</div>
            <div className="nc"><div className="nc-top"><div><div className="nc-name">右乳10点钟结节</div><div className="nc-loc">乳腺 · 右侧</div></div><span className="bdge b-ok">— 稳定</span></div><div className="nc-meta"><div><div className="mv">12mm</div><div className="ml">当前大小</div></div><div><div className="mv">BI-RADS 3</div><div className="ml">分级</div></div><div><div className="mv">—</div><div className="ml">较基线</div></div></div><div className="nc-foot"><span className="fl">2次记录</span><span className="fr">5个月后复查</span></div></div>
            <div className="gap" />
            <div className="sec">肺</div>
            <div className="nc"><div className="nc-top"><div><div className="nc-name">右上叶前段结节</div><div className="nc-loc">肺 · 右上叶</div></div><span className="bdge b-new">新建</span></div><div className="nc-meta"><div><div className="mv">6.2mm</div><div className="ml">当前大小</div></div><div><div className="mv">Lung-RADS 2</div><div className="ml">分级</div></div><div><div className="mv">—</div><div className="ml">较基线</div></div></div><div className="nc-foot"><span className="fl">1次记录</span><span className="fr">未设置提醒</span></div></div>
          </div>
          <div className="quota-row">
            <span className="quota-text">本月 AI 识别剩余 1 次</span>
            <button onClick={() => setPaywallVisible(true)} className="quota-btn">升级</button>
          </div>
          <div className="fab-row"><button className="fab">+ 新增检查</button></div>
        </div>
      </div>
    );
  }

  return (
    <SafeAreaView testID="home-screen" className="flex-1 bg-page-bg">
      <View testID="home-topbar" dataSet={{ demoRole: 'topbar' }}>
        <View className="w-full flex-row items-center justify-between">
          <Text className="font-serif text-[17px] font-normal text-primary">结节档案</Text>
          <Pressable
            onPress={() => router.push(prototypeHomeSeed ? '/settings?prototypeUi005Seed=demo' : '/settings')}
          >
            <View className="h-[27px] w-[27px] items-center justify-center rounded-full border-[0.5px] border-[#d4cdc0] bg-card">
              <Text dataSet={{ demoRole: 'topbar-text' }} className="text-[11px] font-normal text-[#6b5f4e]">人</Text>
            </View>
          </Pressable>
        </View>
      </View>

      {profileItems.length > 0 && (
        <ProfileSwitcher
          profiles={profileItems}
          activeId={resolvedActiveProfileId}
          onSelect={(profileId) => {
            if (prototypeHomeSeed) {
              setPrototypeActiveProfileId(profileId);
              return;
            }
            setActiveProfileId(profileId);
          }}
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
              className={`rounded-[5px] bg-card px-2 py-0.5 ${
                alertInfo.daysUntil <= 30 ? 'border-[0.5px] border-[#e8997a]' : 'border-[0.5px] border-[#9fd4c4]'
              }`}
              onPress={() => router.push(prototypeHomeSeed ? '/reminders?prototypeUi005Seed=demo' : '/reminders')}
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
                  onPress={() => router.push(prototypeHomeSeed ? `/lesion/${lesion.id}?prototypeDetailSeed=demo` : `/lesion/${lesion.id}`)}
                />
              ))}
            </View>
          ))
        )}

        {quotaInfo || prototypeHomeSeed ? (
          <View className="mt-2 flex-row items-center justify-between rounded-[9px] border border-[#e8c98a] bg-increase-bg px-3 py-[9px]">
            <Text className="text-[11px] font-medium text-increase-text">
              {quotaInfo?.remaining === 0
                ? '本月 AI 识别已用完'
                : `本月 AI 识别剩余 ${quotaInfo?.remaining ?? 1} 次`}
            </Text>
            <Pressable
              className="rounded-[5px] border border-[#e8c98a] bg-card px-2 py-0.5"
              onPress={() => setPaywallVisible(true)}
            >
              <Text className="text-[11px] font-medium  text-increase-text">升级</Text>
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
        reviewSeed={prototypeHomeSeed ? 'prototypeUi005Seed=demo' : undefined}
        title="AI识别次数已用完"
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
