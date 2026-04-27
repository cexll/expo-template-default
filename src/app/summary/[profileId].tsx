import { useCallback, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import ViewShot from 'react-native-view-shot';
import { ChangeBadge } from '@/components/ChangeBadge';
import { ComparisonRow } from '@/components/ComparisonRow';
import { PaywallSheet } from '@/components/PaywallSheet';
import { SecondaryPageHeader } from '@/components/SecondaryPageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { listExaminationsByLesion } from '@/lib/db/queries/examinations';
import { useLesions } from '@/hooks/useLesions';
import { useProfile } from '@/hooks/useProfiles';
import { useActiveReminders } from '@/hooks/useReminders';
import { canUseFeature, consumeSubscriptionQuota, subscriptionKeys, useSubscriptionStatus } from '@/hooks/useSubscriptionStatus';
import type { Examination, Lesion } from '@/lib/db/types';
import {
  isDemoSeed,
  PROTOTYPE_REVIEW_EXAMINATIONS,
  PROTOTYPE_REVIEW_LESIONS,
  PROTOTYPE_REVIEW_PROFILE,
  PROTOTYPE_REVIEW_REMINDERS,
  PROTOTYPE_REVIEW_SUBSCRIPTION_STATUS,
} from '@/lib/prototype-review';
import { bumpLocalSummaryExportUsed, formatLocalMonth } from '@/lib/subscription/local-quota';
import { exportSummaryImage } from '@/lib/summary/export-image';
import { renderSummaryExportImage } from '@/lib/summary/render-export-image';
import { useAuth } from '@/providers/auth-provider';
import { SafeAreaView, ScrollView, Text, View } from '@/tw';

function formatSize(sizeX: number | null, sizeY: number | null, sizeZ: number | null) {
  const values = [sizeX, sizeY, sizeZ].filter((v): v is number => v !== null);
  if (values.length === 0) return '暂无大小';
  return `${values.map((v) => `${v}`).join('×')}mm`;
}

function getRads(exam: { tirads: string | null; birads: string | null; lung_rads: string | null }) {
  if (exam.tirads) return `TI-RADS ${exam.tirads}`;
  if (exam.birads) return `BI-RADS ${exam.birads}`;
  if (exam.lung_rads) return `LUNG-RADS ${exam.lung_rads}`;
  return '待补充分级';
}

function calcChange(current: number, reference: number) {
  const diff = current - reference;
  const pct = reference !== 0 ? Math.round((diff / reference) * 100) : 0;
  return {
    diff: diff.toFixed(1),
    pct,
    type: diff > 0 ? ('increase' as const) : diff < 0 ? ('decrease' as const) : ('unchanged' as const),
  };
}

function formatSignedDiff(value: string) {
  return Number(value) > 0 ? `+${value}` : value;
}

function formatMm(value: number | null | undefined) {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  return value.toFixed(1);
}

function formatMonth(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 7);
  return date.toISOString().slice(0, 7);
}

function getDiseaseLabel(diseaseType: Lesion['disease_type']) {
  switch (diseaseType) {
    case 'thyroid':
      return '甲状腺';
    case 'breast':
      return '乳腺';
    case 'lung':
      return '肺';
  }
}

function getRadsRowKey(diseaseType: Lesion['disease_type']) {
  if (diseaseType === 'thyroid') return 'tirads';
  if (diseaseType === 'breast') return 'birads';
  return 'lung_rads';
}

type QualRowSpec = {
  key: keyof Examination;
  label: string;
  format?: (value: unknown) => string;
};

const THYROID_ROWS: QualRowSpec[] = [
  { key: 'tirads', label: 'TI-RADS', format: (v) => (typeof v === 'string' && v ? `${v}级` : '—') },
  { key: 'calcification', label: '钙化', format: (v) => (typeof v === 'string' && v ? v : '—') },
  { key: 'echo_type', label: '回声', format: (v) => (typeof v === 'string' && v ? v : '—') },
  { key: 'border', label: '边界', format: (v) => (typeof v === 'string' && v ? v : '—') },
];

const BREAST_ROWS: QualRowSpec[] = [
  { key: 'birads', label: 'BI-RADS', format: (v) => (typeof v === 'string' && v ? v : '—') },
  { key: 'shape', label: '形状', format: (v) => (typeof v === 'string' && v ? v : '—') },
  { key: 'orientation', label: '走向', format: (v) => (typeof v === 'string' && v ? v : '—') },
];

const LUNG_ROWS: QualRowSpec[] = [
  { key: 'lung_rads', label: 'LUNG-RADS', format: (v) => (typeof v === 'string' && v ? `${v}级` : '—') },
  { key: 'density', label: '密度', format: (v) => (typeof v === 'string' && v ? v : '—') },
  { key: 'morphology', label: '形态', format: (v) => (typeof v === 'string' && v ? v : '—') },
  {
    key: 'pleural_pull',
    label: '胸膜牵拉',
    format: (v) => (v === 1 ? '有' : v === 0 ? '无' : '—'),
  },
];

function getQualRows(diseaseType: Lesion['disease_type']): QualRowSpec[] {
  switch (diseaseType) {
    case 'thyroid':
      return THYROID_ROWS;
    case 'breast':
      return BREAST_ROWS;
    case 'lung':
      return LUNG_ROWS;
  }
}

function getRemainingDays(nextExamDate: string | null | undefined) {
  if (!nextExamDate) return undefined;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const target = new Date(nextExamDate);
  if (Number.isNaN(target.getTime())) return undefined;

  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
}

function DemoSummaryPage() {
  const now = new Date();
  const age = now.getFullYear() - 1978;
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  return (
    <div className="screen active" style={{ display: 'flex' }}>
      <div className="topbar"><button className="tb-back">← 返回</button><span className="tb-page">就诊摘要</span><button className="tb-btn">导出图片</button></div>
      <div className="scrl">
        <div className="pc"><div className="ptop"><div className="pname">张女士</div><div style={{ textAlign: 'right' }}><div className="pdlbl">生成日期</div><div className="pdval">{dateStr}</div></div></div><div className="pmeta"><div className="pm"><span className="pml">性别</span><span className="pmv">女</span></div><div className="pm"><span className="pml">年龄</span><span className="pmv" style={{ fontFamily: 'var(--mono)', fontSize: 13 }}>{age}岁</span></div><div className="pm"><span className="pml">在档病灶</span><span className="pmv">共3处</span></div></div></div>
        <div className="stats-row"><div className="sc"><div className="scv">3</div><div className="scl">在档病灶</div></div><div className="sc"><div className="scv">8</div><div className="scl">检查记录</div></div><div className="sc-a"><div className="scva">1</div><div className="scl">需关注</div></div></div>
        <div className="sec">甲状腺</div>
        <div className="nblk"><div className="nbh"><div><div className="nbn">左叶中下段结节</div><div className="nbloc">甲状腺 · 左叶</div></div><span className="bdge b-up">▲ 增大</span></div><div className="nbb"><div className="sr"><div><div className="smv">8.3mm</div><div className="smu">最新大小</div></div><div className="dright"><div className="di"><span className="dl">较上次</span><span className="dv">+0.5mm</span><span className="dp">+6%</span></div><div className="di"><span className="dl">较基线</span><span className="dv">+1.2mm</span><span className="dp">+17%</span></div></div></div><div className="mini-tl" style={{ marginBottom: 9, paddingBottom: 9, borderBottom: '0.5px solid #f5f2ee' }}><div className="tl-pt"><div className="tl-v">7.1</div><div className="tl-d" /><div className="tl-dt">2023-03</div></div><div className="tl-conn" /><div className="tl-pt"><div className="tl-v">7.8</div><div className="tl-d" /><div className="tl-dt">2023-09</div></div><div className="tl-conn" /><div className="tl-pt"><div className="tl-vn">8.3</div><div className="tl-dn" /><div className="tl-dt" style={{ color: 'var(--amber)' }}>2024-03</div></div></div><div className="qrow" style={{ padding: '0 0 6px 0' }}><div className="qf">TI-RADS</div><div className="qvs"><span className="qv">3级</span><span className="qarr">→</span><span className="qv">3级</span><span className="qarr">→</span><span className="qvn">3级</span></div><span className="qtag qt-s">未变</span></div><div className="qrow" style={{ padding: '6px 0 0 0' }}><div className="qf">钙化</div><div className="qvs"><span className="qv">无</span><span className="qarr">→</span><span className="qv">无</span><span className="qarr">→</span><span className="qva">点状强回声</span></div><span className="qtag qt-n">新出现</span></div></div><div className="nbf"><span className="nfl">建议复查</span><span className="nfd-s">2024-09-15 · 还有23天</span></div></div>
        <div className="fn">本摘要由「结节档案」生成，仅供医生参考，不构成诊断意见。</div>
      </div>
      <div className="exp-bar"><button className="btn-p">保存为图片</button><button className="btn-s">分享</button></div>
    </div>
  );
}

function formatChangeBadgeValue(change: ReturnType<typeof calcChange>) {
  return `${formatSignedDiff(change.diff)}mm (${change.pct > 0 ? '+' : ''}${change.pct}%)`;
}

export default function SummaryPage() {
  const { profileId, prototypeUi005Seed } = useLocalSearchParams<{ profileId: string; prototypeUi005Seed?: string }>();
  const demoSeed = isDemoSeed(prototypeUi005Seed);
  const id = demoSeed ? PROTOTYPE_REVIEW_PROFILE.id : typeof profileId === 'string' ? profileId : '';

  const { user } = useAuth();
  const accountKey = user?.id ?? user?.phone ?? null;
  const profileQuery = useProfile(id);
  const profile = demoSeed ? PROTOTYPE_REVIEW_PROFILE : profileQuery.data;
  const { data: storedLesions = [] } = useLesions(id);
  const { data: storedReminders = [] } = useActiveReminders(id);
  const lesions = demoSeed ? PROTOTYPE_REVIEW_LESIONS.filter((lesion) => lesion.profile_id === id) : storedLesions;
  const reminders = demoSeed ? PROTOTYPE_REVIEW_REMINDERS : storedReminders;
  const queryClient = useQueryClient();

  const viewShotRef = useRef<any>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const [paywallVisible, setPaywallVisible] = useState(false);

  const { data: storedSubscriptionStatus, isLoading: storedSubscriptionLoading } = useSubscriptionStatus(accountKey);
  const subscriptionStatus = demoSeed ? PROTOTYPE_REVIEW_SUBSCRIPTION_STATUS : storedSubscriptionStatus;
  const subscriptionLoading = demoSeed ? false : storedSubscriptionLoading;

  const activeLesions = useMemo(() => lesions.filter((lesion) => lesion.is_archived === 0), [lesions]);
  const age = profile ? new Date().getFullYear() - profile.birth_year : 0;

  const examinations = useQueries({
    queries: activeLesions.map((lesion) => ({
      queryKey: ['examinations', 'lesion', lesion.id],
      queryFn: () => listExaminationsByLesion(lesion.id),
      enabled: Boolean(lesion.id) && !demoSeed,
    })),
  });

  const remindersByLesionId = useMemo(() => {
    const map = new Map<string, (typeof reminders)[number]>();
    for (const r of reminders) {
      if (r?.lesion_id) map.set(r.lesion_id, r);
    }
    return map;
  }, [reminders]);

  const lesionBlocks = useMemo(() => {
    return activeLesions.map((lesion, index) => {
      const allExams = demoSeed ? PROTOTYPE_REVIEW_EXAMINATIONS[lesion.id] ?? [] : examinations[index]?.data ?? [];
      const windowExams = allExams.slice(0, 3);

      const latest = allExams[0] ?? null;
      const previous = allExams.length > 1 ? allExams[1] : null;
      const baseline = allExams.length > 0 ? allExams[allExams.length - 1] : null;

      const latestSize = latest ? formatSize(latest.size_x, latest.size_y, latest.size_z) : '暂无检查';
      const radsGrade = latest ? getRads(latest) : '待补充分级';

      const latestSizeX = latest?.size_x ?? null;
      const baselineSizeX = baseline?.size_x ?? null;
      const previousSizeX = previous?.size_x ?? null;

      const vsBaseline =
        latestSizeX !== null && baselineSizeX !== null && allExams.length >= 2
          ? calcChange(latestSizeX, baselineSizeX)
          : null;
      const vsPrevious =
        latestSizeX !== null && previousSizeX !== null ? calcChange(latestSizeX, previousSizeX) : null;

      const chainExams = [...windowExams].reverse();
      const qualitativeRows = getQualRows(lesion.disease_type).map((row) => {
        const values = chainExams.map((exam) => {
          const raw = exam[row.key];
          return row.format ? row.format(raw) : typeof raw === 'string' && raw ? raw : '—';
        });

        const earliest = values[0] ?? '—';
        const latestValue = values[values.length - 1] ?? '—';

        const normalizedEarliest = earliest === '—' ? '' : earliest;
        const normalizedLatest = latestValue === '—' ? '' : latestValue;

        const isNew = !normalizedEarliest && Boolean(normalizedLatest);
        const hasChanged = isNew || (normalizedEarliest !== normalizedLatest && Boolean(normalizedLatest || normalizedEarliest));

        const conclusionType = isNew ? ('new' as const) : hasChanged ? ('increase' as const) : ('unchanged' as const);
        const conclusionValue = hasChanged && !isNew ? '变化' : undefined;

        return {
          key: row.key,
          label: row.label,
          values,
          hasChanged,
          conclusionType,
          conclusionValue,
        };
      });

      const radsKey = getRadsRowKey(lesion.disease_type);
      const radsRow = qualitativeRows.find((row) => row.key === radsKey) ?? null;
      const changedRows = qualitativeRows.filter((row) => row.hasChanged && row.key !== radsKey);
      const displayRows =
        windowExams.length >= 2
          ? [...(radsRow ? [radsRow] : []), ...changedRows]
          : [];

      const reminder = remindersByLesionId.get(lesion.id) ?? null;
      const remainingDays = reminder ? getRemainingDays(reminder.next_exam_date) : undefined;

      return {
        id: lesion.id,
        label: lesion.label,
        location: lesion.location,
        diseaseType: lesion.disease_type,
        diseaseLabel: getDiseaseLabel(lesion.disease_type),
        latestSize,
        radsGrade,
        examCount: allExams.length,
        windowExams,
        vsPrevious,
        vsBaseline,
        displayRows,
        reminder,
        remainingDays,
      };
    });
  }, [activeLesions, demoSeed, examinations, remindersByLesionId]);

  const totalExamCount = useMemo(() => {
    return lesionBlocks.reduce((sum, lesion) => sum + lesion.examCount, 0);
  }, [lesionBlocks]);

  const needsAttention = useMemo(() => {
    const attention = new Set<string>();

    for (const lesion of lesionBlocks) {
      if (lesion.radsGrade.includes('3') || lesion.radsGrade.includes('4')) {
        attention.add(lesion.id);
      }
      if (lesion.remainingDays !== undefined && lesion.remainingDays <= 30) {
        attention.add(lesion.id);
      }
    }

    return attention.size;
  }, [lesionBlocks]);

  const exportImage = useCallback(async () => {
    if (!profile) {
      setExportError('档案信息尚未加载，请稍后重试');
      return;
    }

    if (subscriptionLoading) {
      setExportError('正在获取会员状态，请稍后重试');
      return;
    }
    if (!subscriptionStatus) {
      setExportError('无法获取会员状态，请稍后重试');
      return;
    }
    if (demoSeed || !canUseFeature(subscriptionStatus, 'summary_export')) {
      setExportError('本月导出次数已用完');
      setPaywallVisible(true);
      return;
    }

    setExportError('');
    setExporting(true);
    try {
      const uri =
        Platform.OS === 'web'
          ? renderSummaryExportImage({
              profileId: id,
              nickname: profile.nickname,
              genderLabel: profile.gender === 'female' ? '女' : '男',
              ageLabel: `${age}岁`,
              lesionCount: lesionBlocks.length,
              totalExamCount,
              needsAttention,
              sections: (['thyroid', 'breast', 'lung'] as const)
                .map((disease) => ({
                  title: getDiseaseLabel(disease),
                  cards: lesionBlocks
                    .filter((lesion) => lesion.diseaseType === disease)
                    .map((lesion) => ({
                      label: lesion.label,
                      diseaseLabel: lesion.diseaseLabel,
                      location: lesion.location,
                      latestSize: lesion.latestSize,
                      radsGrade: lesion.radsGrade,
                      examCount: lesion.examCount,
                      vsPrevious: lesion.vsPrevious
                        ? {
                            label: '较上次',
                            value: formatChangeBadgeValue(lesion.vsPrevious),
                          }
                        : null,
                      vsBaseline: lesion.vsBaseline
                        ? {
                            label: '较基线',
                            value: formatChangeBadgeValue(lesion.vsBaseline),
                          }
                        : null,
                      qualitativeRows: lesion.displayRows.map((row) => {
                        const values = row.values.filter(Boolean).join(' → ');
                        return `${row.label}：${values || '—'}`;
                      }),
                      reminderText: lesion.reminder
                        ? `建议复查 ${lesion.reminder.next_exam_date}${
                            typeof lesion.remainingDays === 'number'
                              ? lesion.remainingDays < 0
                                ? ` · 已逾期${Math.abs(lesion.remainingDays)}天`
                                : ` · 还有${lesion.remainingDays}天`
                              : ''
                          }`
                        : null,
                    })),
                }))
                .filter((section) => section.cards.length > 0),
            })
          : await viewShotRef.current?.capture?.();
      if (!uri || typeof uri !== 'string') {
        throw new Error('生成图片失败');
      }

      await exportSummaryImage({ uri, nickname: profile.nickname });

      if (!subscriptionStatus.isActive) {
        try {
          await consumeSubscriptionQuota('summary_export');
        } catch {
          // Keep local quota shadow authoritative if backend consumption is temporarily unavailable.
        }
        const localUsed = bumpLocalSummaryExportUsed(formatLocalMonth(), 1, accountKey);
        // Force subscription observers to re-run normalization (which applies the local quota shadow).
        queryClient.setQueryData(subscriptionKeys.status(accountKey), (prev: unknown) => {
          if (!prev || typeof prev !== 'object') return prev;
          return { ...(prev as Record<string, unknown>), __local_summary_export_used: localUsed };
        });
      }
    } catch (e) {
      setExportError(e instanceof Error ? e.message : '导出失败，请稍后重试');
    } finally {
      setExporting(false);
    }
  }, [accountKey, age, demoSeed, id, lesionBlocks, needsAttention, profile, queryClient, subscriptionLoading, subscriptionStatus, totalExamCount]);

  if (Platform.OS === 'web' && demoSeed) {
    return <DemoSummaryPage />;
  }

  if (!id) {
    return (
      <SafeAreaView className="flex-1 bg-page-bg">
        <View className="flex-1 px-4">
          <SecondaryPageHeader title="就诊摘要" fallbackHref="/(main)" />
          <View className="flex-1 items-center justify-center px-6">
            <Text className="text-lg text-neutral-text">档案 ID 无效</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (!profile) {
    if (profileQuery.isLoading || profileQuery.isFetching) {
      return (
        <SafeAreaView className="flex-1 bg-page-bg">
          <View className="flex-1 px-4">
            <SecondaryPageHeader title="就诊摘要" fallbackHref="/(main)" />
            <View className="flex-1 items-center justify-center px-6">
              <Text className="text-lg text-neutral-text">加载中…</Text>
            </View>
          </View>
        </SafeAreaView>
      );
    }
    return (
      <SafeAreaView className="flex-1 bg-page-bg">
        <View className="flex-1 px-4">
          <SecondaryPageHeader title="就诊摘要" fallbackHref="/(main)" />
          <View className="flex-1 items-center justify-center px-6">
            <Text className="text-lg text-neutral-text">未找到该档案</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-page-bg">
      <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
        <SecondaryPageHeader title="就诊摘要" fallbackHref="/(main)" />
        <ViewShot
          ref={viewShotRef}
          options={{ format: 'png', quality: 1, result: Platform.OS === 'web' ? 'data-uri' : 'tmpfile' }}
        >
          <Card className="mb-4 mt-4 overflow-hidden">
            <View className="absolute -right-6 -top-8 h-24 w-24 rounded-full bg-neutral-bg opacity-60" />
            <View className="absolute -left-10 bottom-0 h-20 w-20 rounded-full bg-stable-bg opacity-30" />
            <Text className="text-lg font-bold text-primary">{profile.nickname}的就诊摘要</Text>
            <View className="mt-2 flex-row flex-wrap gap-4">
              <Text className="text-sm text-neutral-text">{profile.gender === 'female' ? '女' : '男'}</Text>
              <Text className="text-sm text-neutral-text">{age}岁</Text>
              <Text className="text-sm text-neutral-text">在档病灶 {lesionBlocks.length}个</Text>
            </View>
            <Text className="mt-3 text-xs text-neutral-text">档案编号 {id}</Text>
          </Card>

          <View className="mb-4 flex-row gap-3">
            <Card className="flex-1 items-center py-4">
              <Text className="font-mono text-2xl font-bold text-primary">{lesionBlocks.length}</Text>
              <Text className="mt-1 text-xs text-neutral-text">在档病灶</Text>
            </Card>
            <Card className="flex-1 items-center py-4">
              <Text className="font-mono text-2xl font-bold text-primary">{totalExamCount}</Text>
              <Text className="mt-1 text-xs text-neutral-text">检查记录</Text>
            </Card>
            <Card className="flex-1 items-center py-4">
              <Text className="font-mono text-2xl font-bold text-new-text">{needsAttention}</Text>
              <Text className="mt-1 text-xs text-neutral-text">需关注</Text>
            </Card>
          </View>

          {(['thyroid', 'breast', 'lung'] as const).map((disease) => {
            const blocks = lesionBlocks.filter((l) => l.diseaseType === disease);
            if (blocks.length === 0) return null;

            return (
              <View key={disease} className="mb-2">
                <Text className="mb-2 text-xs font-semibold text-neutral-text">{getDiseaseLabel(disease)}</Text>
                {blocks.map((lesion) => {
                  const latest = lesion.windowExams[0] ?? null;
                  const latestSizeX = latest?.size_x ?? null;

                  const changeType = lesion.vsBaseline?.type ?? null;
                  const changeLabel =
                    changeType === 'increase'
                      ? '增大'
                      : changeType === 'decrease'
                        ? '减小'
                        : undefined;

                  return (
                    <Card key={lesion.id} className="mb-3 overflow-hidden">
                      <View className="mb-3 flex-row items-start justify-between gap-3">
                        <View className="flex-1">
                          <Text className="text-sm font-semibold text-primary">{lesion.label}</Text>
                          <Text className="mt-1 text-xs text-neutral-text">
                            {lesion.diseaseLabel}
                            {lesion.location ? ` · ${lesion.location}` : ''}
                          </Text>
                        </View>
                        {lesion.windowExams.length >= 2 && changeType ? (
                          <ChangeBadge type={changeType} value={changeLabel} />
                        ) : null}
                      </View>

                      <View className="mb-3 flex-row items-end">
                        <View className="mr-4">
                          <Text className="text-3xl font-bold text-primary">
                            {formatMm(latestSizeX) ?? '—'}
                            <Text className="text-base font-semibold text-neutral-text">mm</Text>
                          </Text>
                          <Text className="mt-1 text-xs text-neutral-text">最新大小</Text>
                        </View>
                        <View className="flex-1">
                          {lesion.vsPrevious ? (
                            <View className="mb-1 flex-row items-center">
                              <Text className="w-12 text-xs text-neutral-text">较上次</Text>
                              <ChangeBadge
                                type={lesion.vsPrevious.type}
                                value={`${formatSignedDiff(lesion.vsPrevious.diff)}mm (${lesion.vsPrevious.pct > 0 ? '+' : ''}${lesion.vsPrevious.pct}%)`}
                              />
                            </View>
                          ) : null}
                          {lesion.vsBaseline ? (
                            <View className="flex-row items-center">
                              <Text className="w-12 text-xs text-neutral-text">较基线</Text>
                              <ChangeBadge
                                type={lesion.vsBaseline.type}
                                value={`${formatSignedDiff(lesion.vsBaseline.diff)}mm (${lesion.vsBaseline.pct > 0 ? '+' : ''}${lesion.vsBaseline.pct}%)`}
                              />
                            </View>
                          ) : null}
                        </View>
                      </View>

                      {lesion.windowExams.length > 0 ? (
                        <View className="mb-3 flex-row items-center justify-between border-b border-neutral-bg pb-3">
                          {[...lesion.windowExams].reverse().map((exam, idx, arr) => {
                            const isLatest = idx === arr.length - 1;
                            const value = formatMm(exam.size_x);
                            return (
                              <View key={`${exam.id}-${idx}`} className="items-center">
                                <Text className={`font-mono text-xs ${isLatest ? 'text-primary font-semibold' : 'text-neutral-text'}`}>
                                  {value ?? '—'}
                                </Text>
                                <Text className={`mt-1 text-[10px] ${isLatest ? 'text-increase-text' : 'text-neutral-text'}`}>
                                  {formatMonth(exam.exam_date)}
                                </Text>
                              </View>
                            );
                          })}
                        </View>
                      ) : null}

                      {lesion.displayRows.length > 0 ? (
                        <View className="mb-2">
                          {lesion.displayRows.map((row) => (
                            <ComparisonRow
                              key={String(row.key)}
                              label={row.label}
                              values={row.values}
                              changeType={row.conclusionType}
                              changeValue={row.conclusionValue}
                              hasChanged={row.hasChanged}
                            />
                          ))}
                        </View>
                      ) : null}

                      <Text className="text-xs text-neutral-text">共{lesion.examCount}次检查记录 · {lesion.radsGrade}</Text>

                      {lesion.reminder ? (
                        <View className="mt-3 flex-row items-center justify-between rounded-xl bg-neutral-bg px-3 py-2">
                          <Text className="text-xs text-neutral-text">建议复查</Text>
                          <Text className="text-xs text-primary">
                            {lesion.reminder.next_exam_date}
                            {typeof lesion.remainingDays === 'number'
                              ? lesion.remainingDays < 0
                                ? ` · 已逾期${Math.abs(lesion.remainingDays)}天`
                                : ` · 还有${lesion.remainingDays}天`
                              : ''}
                          </Text>
                        </View>
                      ) : null}
                    </Card>
                  );
                })}
              </View>
            );
          })}

          <View className="mt-4 mb-4 rounded-xl bg-neutral-bg p-3">
            <Text className="text-center text-xs text-neutral-text">
              本摘要由「结节档案」生成，仅供医生参考，不构成诊断意见。
            </Text>
          </View>
        </ViewShot>

        <View className="flex-row gap-3">
          <View className="flex-1">
            <Button
              title={exporting ? '生成中...' : '保存为图片'}
              fullWidth
              disabled={exporting}
              onPress={exportImage}
            />
          </View>
          <View className="flex-1">
            <Button
              title="分享"
              variant="secondary"
              fullWidth
              disabled={exporting}
              onPress={exportImage}
            />
          </View>
        </View>
        {exportError ? <Text className="mt-2 text-sm text-new-text">{exportError}</Text> : null}
        <View className="h-10" />
      </ScrollView>

      <PaywallSheet
        visible={paywallVisible}
        onClose={() => setPaywallVisible(false)}
        feature="就诊摘要导出"
        reviewSeed={demoSeed ? 'prototypeUi005Seed=demo' : undefined}
      />
    </SafeAreaView>
  );
}
