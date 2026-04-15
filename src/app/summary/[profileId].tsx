import { useCallback, useMemo, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { ChangeBadge } from '@/components/ChangeBadge';
import { ComparisonRow } from '@/components/ComparisonRow';
import { PaywallSheet } from '@/components/PaywallSheet';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { listExaminationsByLesion } from '@/lib/db/queries/examinations';
import { useLesions } from '@/hooks/useLesions';
import { useProfile } from '@/hooks/useProfiles';
import { useActiveReminders } from '@/hooks/useReminders';
import { canUseFeature, useSubscriptionStatus } from '@/hooks/useSubscriptionStatus';
import type { Examination, Lesion } from '@/lib/db/types';
import { bumpLocalSummaryExportUsed, formatLocalMonth } from '@/lib/subscription/local-quota';

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

export default function SummaryPage() {
  const { profileId } = useLocalSearchParams<{ profileId: string }>();
  const id = typeof profileId === 'string' ? profileId : '';

  const profileQuery = useProfile(id);
  const profile = profileQuery.data;
  const { data: lesions = [] } = useLesions(id);
  const { data: reminders = [] } = useActiveReminders(id);
  const queryClient = useQueryClient();

  const viewShotRef = useRef<any>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const [paywallVisible, setPaywallVisible] = useState(false);

  const { data: subscriptionStatus, isLoading: subscriptionLoading } = useSubscriptionStatus();

  const activeLesions = useMemo(() => lesions.filter((lesion) => lesion.is_archived === 0), [lesions]);

  const examinations = useQueries({
    queries: activeLesions.map((lesion) => ({
      queryKey: ['examinations', 'lesion', lesion.id],
      queryFn: () => listExaminationsByLesion(lesion.id),
      enabled: Boolean(lesion.id),
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
      const allExams = examinations[index]?.data ?? [];
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
  }, [activeLesions, examinations, remindersByLesionId]);

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
    if (!canUseFeature(subscriptionStatus, 'summary_export')) {
      setExportError('本月导出次数已用完');
      setPaywallVisible(true);
      return;
    }

    setExportError('');
    setExporting(true);
    try {
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        throw new Error('当前设备不支持分享');
      }

      const uri = await viewShotRef.current?.capture?.();
      if (!uri || typeof uri !== 'string') {
        throw new Error('生成图片失败');
      }

      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: `${profile.nickname}的就诊摘要`,
        UTI: 'public.png',
      });

      if (!subscriptionStatus.isActive) {
        const localUsed = bumpLocalSummaryExportUsed(formatLocalMonth(), 1);
        // Force subscription observers to re-run normalization (which applies the local quota shadow).
        queryClient.setQueryData(['subscription', 'status'], (prev: unknown) => {
          if (!prev || typeof prev !== 'object') return prev;
          return { ...(prev as Record<string, unknown>), __local_summary_export_used: localUsed };
        });
      }
    } catch (e) {
      setExportError(e instanceof Error ? e.message : '导出失败，请稍后重试');
    } finally {
      setExporting(false);
    }
  }, [profile, queryClient, subscriptionLoading, subscriptionStatus]);

  if (!id) {
    return (
      <SafeAreaView className="flex-1 bg-page-bg">
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-lg text-neutral-text">档案 ID 无效</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!profile) {
    if (profileQuery.isLoading || profileQuery.isFetching) {
      return (
        <SafeAreaView className="flex-1 bg-page-bg">
          <View className="flex-1 items-center justify-center px-6">
            <Text className="text-lg text-neutral-text">加载中…</Text>
          </View>
        </SafeAreaView>
      );
    }
    return (
      <SafeAreaView className="flex-1 bg-page-bg">
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-lg text-neutral-text">未找到该档案</Text>
        </View>
      </SafeAreaView>
    );
  }

  const age = new Date().getFullYear() - profile.birth_year;

  return (
    <SafeAreaView className="flex-1 bg-page-bg">
      <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
        <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 1, result: 'tmpfile' }}>
          <Card className="mt-4 mb-4 overflow-hidden">
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

        <Button
          title={exporting ? '生成中...' : '导出为图片'}
          fullWidth
          disabled={exporting}
          onPress={exportImage}
        />
        {exportError ? <Text className="mt-2 text-sm text-new-text">{exportError}</Text> : null}
        <View className="h-10" />
      </ScrollView>

      <PaywallSheet visible={paywallVisible} onClose={() => setPaywallVisible(false)} feature="就诊摘要导出" />
    </SafeAreaView>
  );
}
