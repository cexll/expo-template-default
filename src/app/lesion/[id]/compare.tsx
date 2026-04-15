import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ChangeBadge } from '@/components/ChangeBadge';
import { ComparisonRow } from '@/components/ComparisonRow';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Tag } from '@/components/ui/Tag';
import { useExaminations } from '@/hooks/useExaminations';
import { useLesion } from '@/hooks/useLesions';
import { useCreateReminder, useDeactivateReminder, useRemindersByLesion, useUpdateReminder } from '@/hooks/useReminders';
import type { Examination, Lesion } from '@/lib/db/types';
import { parseStrictIsoCalendarDate } from '@/lib/iso-calendar-date';
import { applyReminderSideEffects } from '@/lib/reminder-side-effects';

function formatSignedDiff(value: string) {
  return Number(value) > 0 ? `+${value}` : value;
}

function calcChange(current: number, reference: number) {
  const diff = current - reference;
  const pct = reference !== 0 ? Math.round((diff / reference) * 100) : 0;

  return {
    diff: diff.toFixed(1),
    pct,
    type: diff > 0 ? 'increase' as const : diff < 0 ? 'decrease' as const : 'unchanged' as const,
  };
}

function makeId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function formatMm(value: number | null | undefined) {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  return value.toFixed(1);
}

function formatMonth(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
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

function getRadsLabel(diseaseType: Lesion['disease_type']) {
  if (diseaseType === 'thyroid') return 'TI-RADS';
  if (diseaseType === 'breast') return 'BI-RADS';
  return 'LUNG-RADS';
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

export default function ComparePage() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const lesionId = typeof id === 'string' ? id : '';
  const { data: lesion } = useLesion(lesionId);
  const { data: examinations = [] } = useExaminations(lesionId);

  const totalCount = examinations.length;

  const [windowMode, setWindowMode] = useState<'latest3' | 'latest5' | 'custom'>('latest3');
  const [customDraftStart, setCustomDraftStart] = useState('');
  const [customDraftEnd, setCustomDraftEnd] = useState('');
  const [customRangeError, setCustomRangeError] = useState('');
  const [customRange, setCustomRange] = useState<{ start: string; end: string } | null>(null);

  const { data: reminders = [] } = useRemindersByLesion(lesionId);
  const createReminder = useCreateReminder();
  const updateReminder = useUpdateReminder();
  const deactivateReminder = useDeactivateReminder();

  const activeReminder = useMemo(() => {
    return reminders.find((reminder) => reminder.is_active === 1) ?? null;
  }, [reminders]);

  const selectedExams = useMemo(() => {
    if (windowMode === 'latest5') return examinations.slice(0, 5);
    if (windowMode === 'custom' && customRange) {
      const start = new Date(customRange.start);
      const end = new Date(customRange.end);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return examinations.slice(0, 3);
      return examinations.filter((exam) => {
        const t = new Date(exam.exam_date);
        if (Number.isNaN(t.getTime())) return false;
        return t >= start && t <= end;
      });
    }
    return examinations.slice(0, 3);
  }, [customRange, examinations, windowMode]);

  const latest = selectedExams[0] ?? null;
  const baseline = selectedExams.length > 0 ? selectedExams[selectedExams.length - 1] : null;
  const previous = selectedExams.length > 1 ? selectedExams[1] : null;

  const latestSizeX = latest?.size_x ?? null;
  const baselineSizeX = baseline?.size_x ?? null;
  const previousSizeX = previous?.size_x ?? null;

  const vsBaseline =
    latestSizeX !== null && baselineSizeX !== null ? calcChange(latestSizeX, baselineSizeX) : null;
  const vsPrevious =
    latestSizeX !== null && previousSizeX !== null ? calcChange(latestSizeX, previousSizeX) : null;

  const chainExams = useMemo(() => [...selectedExams].reverse(), [selectedExams]);

  const qualitativeRows = useMemo(() => {
    if (!lesion) return [];
    const rows = getQualRows(lesion.disease_type);
    return rows.map((row) => {
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
        earliest,
        latestValue,
      };
    });
  }, [chainExams, lesion]);

  const summaryText = useMemo(() => {
    if (!lesion || !latest || !baseline || !vsBaseline || !vsPrevious) {
      return '数据不足，暂不生成变化小结。';
    }

    const baselinePhrase = `${vsBaseline.type === 'increase' ? '增大' : vsBaseline.type === 'decrease' ? '减小' : '无变化'} ${Math.abs(Number(vsBaseline.diff)).toFixed(1)}mm（${vsBaseline.pct > 0 ? '+' : ''}${vsBaseline.pct}%）`;
    const prevPhrase = `${vsPrevious.type === 'increase' ? '增大' : vsPrevious.type === 'decrease' ? '减小' : '无变化'} ${Math.abs(Number(vsPrevious.diff)).toFixed(1)}mm（${vsPrevious.pct > 0 ? '+' : ''}${vsPrevious.pct}%）`;

    const radsKey = getRadsRowKey(lesion.disease_type);
    const radsLabel = getRadsLabel(lesion.disease_type);
    const radsRow = qualitativeRows.find((row) => row.key === radsKey) ?? null;
    const otherChanged = qualitativeRows.filter((row) => row.hasChanged && row.key !== radsKey);
    const changedPart = otherChanged.length > 0
      ? otherChanged[0]!.earliest && otherChanged[0]!.earliest !== '—'
        ? `本次${otherChanged[0]!.label}由${otherChanged[0]!.earliest}变为${otherChanged[0]!.latestValue}，`
        : `本次新见${otherChanged[0]!.label}${otherChanged[0]!.latestValue === '—' ? '' : `：${otherChanged[0]!.latestValue}`}，`
      : '';

    const radsPart =
      radsRow && radsRow.earliest !== '—' && radsRow.latestValue !== '—'
        ? radsRow.earliest === radsRow.latestValue
          ? `${radsLabel} 级别未变。`
          : `${radsLabel} 由${radsRow.earliest}变为${radsRow.latestValue}。`
        : '分级待补充分级信息。';

    return `较基线${baselinePhrase}，较上次${prevPhrase}。${changedPart}${radsPart}建议按期复查。`;
  }, [baseline, lesion, latest, qualitativeRows, vsBaseline, vsPrevious]);

  const [followUpEditing, setFollowUpEditing] = useState(false);
  const [followUpDraft, setFollowUpDraft] = useState('');
  const [followUpError, setFollowUpError] = useState('');
  const [reminderSideEffectText, setReminderSideEffectText] = useState<string>('');

  useEffect(() => {
    if (windowMode !== 'custom') {
      setCustomRangeError('');
      return;
    }
    if (customRange || examinations.length === 0) return;
    const end = examinations[0]?.exam_date;
    const start = examinations[Math.min(2, examinations.length - 1)]?.exam_date;
    if (typeof start === 'string' && typeof end === 'string') {
      setCustomDraftStart(start);
      setCustomDraftEnd(end);
      setCustomRange({ start, end });
    }
  }, [customRange, customDraftEnd, customDraftStart, examinations, windowMode]);

  const applyCustomRange = useCallback(() => {
    const start = parseStrictIsoCalendarDate(customDraftStart);
    const end = parseStrictIsoCalendarDate(customDraftEnd);
    if (!start || !end) {
      setCustomRangeError('请输入正确的日期（YYYY-MM-DD）');
      return;
    }
    if (start > end) {
      setCustomRangeError('起始日期不能晚于结束日期');
      return;
    }
    setCustomRangeError('');
    setCustomRange({ start, end });
  }, [customDraftEnd, customDraftStart]);

  const followUpDisplay = activeReminder?.next_exam_date ?? '';
  const followUpSource = activeReminder?.source ?? null;

  const startEditFollowUp = useCallback(() => {
    setFollowUpError('');
    setFollowUpDraft(followUpDisplay);
    setFollowUpEditing(true);
  }, [followUpDisplay]);

  const cancelEditFollowUp = useCallback(() => {
    setFollowUpError('');
    setFollowUpDraft('');
    setFollowUpEditing(false);
  }, []);

  const saveFollowUp = useCallback(async () => {
    setFollowUpError('');
    setReminderSideEffectText('');
    const trimmed = followUpDraft.trim();

    // Clearing restores an explicit unset state by deactivating the active reminder.
    if (!trimmed) {
      if (activeReminder) {
        await deactivateReminder.mutateAsync(activeReminder.id);
        const effects = await applyReminderSideEffects();
        const perm = effects.notification.supported ? effects.notification.permission : 'unsupported';
        setReminderSideEffectText(
          effects.sync.ok
            ? `已同步提醒（通知权限：${perm}）`
            : `提醒同步失败：${effects.sync.error}（通知权限：${perm}）`
        );
      }
      setFollowUpEditing(false);
      setFollowUpDraft('');
      return;
    }

    const iso = parseStrictIsoCalendarDate(trimmed);
    if (!iso) {
      setFollowUpError('请输入正确的日期（YYYY-MM-DD）');
      return;
    }

    if (activeReminder) {
      await updateReminder.mutateAsync({
        id: activeReminder.id,
        updates: { next_exam_date: iso, source: 'manual', is_active: 1 },
      });
    } else {
      await createReminder.mutateAsync({
        id: makeId('reminder'),
        lesion_id: lesionId,
        next_exam_date: iso,
        source: 'manual',
        is_active: 1,
      });
    }

    const effects = await applyReminderSideEffects();
    const perm = effects.notification.supported ? effects.notification.permission : 'unsupported';
    setReminderSideEffectText(
      effects.sync.ok
        ? `已同步提醒（通知权限：${perm}）`
        : `提醒同步失败：${effects.sync.error}（通知权限：${perm}）`
    );

    setFollowUpEditing(false);
  }, [
    activeReminder,
    createReminder,
    deactivateReminder,
    followUpDraft,
    lesionId,
    updateReminder,
  ]);

  if (!lesionId) {
    return (
      <SafeAreaView className="flex-1 bg-page-bg">
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-lg text-neutral-text">病灶 ID 无效</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!lesion) {
    return (
      <SafeAreaView className="flex-1 bg-page-bg">
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-lg text-neutral-text">未找到该病灶</Text>
          <View className="mt-4 w-full">
            <Button title="返回首页" onPress={() => router.replace('/(main)')} fullWidth />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (totalCount < 3) {
    return (
      <SafeAreaView className="flex-1 bg-page-bg">
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-lg text-neutral-text">记录不足，无法对比</Text>
          <Text className="mt-2 text-xs text-neutral-text">至少需要3次检查记录才能生成横向对比。</Text>
          <View className="mt-4 w-full">
            <Button
              title="新增记录"
              onPress={() =>
                router.push({ pathname: '/record/upload', params: { lesionId, diseaseType: lesion.disease_type } })
              }
              fullWidth
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const radsLabel = getRadsLabel(lesion.disease_type);
  const radsValue = latest?.[getRadsRowKey(lesion.disease_type)] ?? null;
  const radsMeta = typeof radsValue === 'string' && radsValue ? `${radsLabel} ${lesion.disease_type === 'breast' ? radsValue : `${radsValue}级`}` : '';

  return (
    <SafeAreaView className="flex-1 bg-page-bg">
      <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
        <View className="mt-4 mb-4 flex-row items-center justify-between">
          <Pressable onPress={() => router.push(`/lesion/${lesionId}`)} accessibilityLabel="返回病灶详情">
            <Text className="text-sm text-neutral-text">← 档案</Text>
          </Pressable>
          <Text className="text-lg font-semibold text-primary">横向对比</Text>
          <Pressable onPress={() => router.push(`/summary/${lesion.profile_id}`)} accessibilityLabel="打开就诊摘要">
            <Text className="text-sm text-primary">就诊摘要</Text>
          </Pressable>
        </View>

        <Card className="mb-4">
          <Text className="text-base font-semibold text-primary">{lesion.label}</Text>
          <Text className="mt-1 text-xs text-neutral-text">
            {getDiseaseLabel(lesion.disease_type)}
            {radsMeta ? ` · ${radsMeta}` : ''} · 共{totalCount}次记录
          </Text>
        </Card>

        <View className="mb-4 flex-row gap-2">
          <Tag text="最近3次" selected={windowMode === 'latest3'} onPress={() => setWindowMode('latest3')} />
          <Tag text="最近5次" selected={windowMode === 'latest5'} onPress={() => setWindowMode('latest5')} />
          <Tag text="自定义" selected={windowMode === 'custom'} onPress={() => setWindowMode('custom')} />
        </View>

        {windowMode === 'custom' ? (
          <Card className="mb-4">
            <Text className="mb-2 text-xs text-neutral-text">自定义检查范围</Text>
            <View className="gap-2">
              <Input
                label="起始日期"
                value={customDraftStart}
                onChangeText={setCustomDraftStart}
                placeholder="YYYY-MM-DD"
              />
              <Input
                label="结束日期"
                value={customDraftEnd}
                onChangeText={setCustomDraftEnd}
                placeholder="YYYY-MM-DD"
                error={customRangeError}
              />
              <Button title="应用范围" variant="secondary" onPress={applyCustomRange} />
            </View>
          </Card>
        ) : null}

        {selectedExams.length < 3 ? (
          <Card className="mb-4">
            <Text className="text-sm font-semibold text-primary">记录不足，无法对比</Text>
            <Text className="mt-2 text-xs text-neutral-text">当前窗口内少于3次检查记录。</Text>
          </Card>
        ) : null}

        <Card className="mb-4">
          <Text className="mb-2 text-xs text-neutral-text">大小变化（最大径 mm）</Text>
          <View className="flex-row items-end">
            <View className="mr-4">
              <Text className="text-4xl font-bold text-primary">{formatMm(latestSizeX) ?? '—'}</Text>
              <Text className="mt-1 text-xs font-mono text-neutral-text">
                {latest ? `${formatMonth(latest.exam_date)} · ${formatMm(latest.size_x) ?? '—'}×${formatMm(latest.size_y) ?? '—'}×${formatMm(latest.size_z) ?? '—'}` : '—'}
              </Text>
            </View>
            <View className="flex-1">
              {vsPrevious ? (
                <View className="mb-1 flex-row items-center">
                  <Text className="w-12 text-xs text-neutral-text">较上次</Text>
                  <ChangeBadge
                    type={vsPrevious.type}
                    value={`${formatSignedDiff(vsPrevious.diff)}mm (${vsPrevious.pct > 0 ? '+' : ''}${vsPrevious.pct}%)`}
                  />
                </View>
              ) : null}
              <View className="flex-row items-center">
                <Text className="w-12 text-xs text-neutral-text">较基线</Text>
                {vsBaseline ? (
                  <ChangeBadge
                    type={vsBaseline.type}
                    value={`${formatSignedDiff(vsBaseline.diff)}mm (${vsBaseline.pct > 0 ? '+' : ''}${vsBaseline.pct}%)`}
                  />
                ) : (
                  <Text className="text-xs text-neutral-text">—</Text>
                )}
              </View>
            </View>
          </View>
        </Card>

        <Card className="mb-4">
          <Text className="mb-3 text-xs text-neutral-text">指标变化</Text>
          {qualitativeRows.map((row) => (
            <ComparisonRow
              key={row.label}
              label={row.label}
              values={row.values}
              changeType={row.conclusionType}
              changeValue={row.conclusionValue}
              hasChanged={row.hasChanged}
            />
          ))}
        </Card>

        <Card className="mb-4">
          <Text className="mb-1 text-xs text-neutral-text">变化小结</Text>
          <Text className="text-sm text-primary">{summaryText}</Text>
        </Card>

        <Card className="mb-8">
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-xs text-neutral-text">下次建议复查日</Text>
              <Text className="mt-1 text-base font-semibold text-primary">
                {followUpDisplay || '未设置'}
              </Text>
              {followUpSource ? (
                <Text className="mt-1 text-[10px] text-neutral-text">
                  {followUpSource === 'manual' ? '手动设置' : '自动生成'}
                </Text>
              ) : null}
              {reminderSideEffectText ? (
                <Text className="mt-1 text-[10px] text-neutral-text">{reminderSideEffectText}</Text>
              ) : null}
            </View>
            <Pressable onPress={startEditFollowUp} accessibilityLabel="修改复查日期">
              <Text className="text-sm text-primary">修改</Text>
            </Pressable>
          </View>

          {followUpEditing ? (
            <View className="mt-3 gap-2">
              <Input
                value={followUpDraft}
                onChangeText={setFollowUpDraft}
                placeholder="YYYY-MM-DD"
                error={followUpError}
              />
              <View className="flex-row gap-2">
                <View className="flex-1">
                  <Button
                    title="保存"
                    onPress={() => {
                      void saveFollowUp();
                    }}
                    disabled={createReminder.isPending || updateReminder.isPending || deactivateReminder.isPending}
                    fullWidth
                  />
                </View>
                <View className="flex-1">
                  <Button
                    title="取消"
                    variant="secondary"
                    onPress={cancelEditFollowUp}
                    disabled={createReminder.isPending || updateReminder.isPending || deactivateReminder.isPending}
                    fullWidth
                  />
                </View>
              </View>
              {activeReminder ? (
                <Button
                  title="清除设置"
                  variant="outline"
                  onPress={() => {
                    void (async () => {
                      setFollowUpError('');
                      setReminderSideEffectText('');
                      await deactivateReminder.mutateAsync(activeReminder.id);
                      const effects = await applyReminderSideEffects();
                      const perm = effects.notification.supported ? effects.notification.permission : 'unsupported';
                      setReminderSideEffectText(
                        effects.sync.ok
                          ? `已同步提醒（通知权限：${perm}）`
                          : `提醒同步失败：${effects.sync.error}（通知权限：${perm}）`
                      );
                      setFollowUpDraft('');
                      setFollowUpEditing(false);
                    })();
                  }}
                  disabled={createReminder.isPending || updateReminder.isPending || deactivateReminder.isPending}
                  fullWidth
                />
              ) : null}
            </View>
          ) : null}
        </Card>

        <View className="mb-8 flex-row gap-3">
          <View className="flex-1">
            <Button title="生成就诊摘要" onPress={() => router.push(`/summary/${lesion.profile_id}`)} fullWidth />
          </View>
          <View className="flex-1">
            <Button
              title="新增记录"
              variant="secondary"
              onPress={() =>
                router.push({ pathname: '/record/upload', params: { lesionId, diseaseType: lesion.disease_type } })
              }
              fullWidth
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
