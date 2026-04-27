import { useCallback, useMemo, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';

import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { api } from '@/lib/api';
import { useLatestExaminationsByProfile } from '@/hooks/useExaminations';
import { useLesions } from '@/hooks/useLesions';
import { useProfiles } from '@/hooks/useProfiles';
import { useActiveReminders, useCreateReminder, useDeactivateReminder, useUpdateReminder } from '@/hooks/useReminders';
import { parseStrictIsoCalendarDate } from '@/lib/iso-calendar-date';
import {
  isDemoSeed,
  PROTOTYPE_REVIEW_EXAMINATIONS,
  PROTOTYPE_REVIEW_LESIONS,
  PROTOTYPE_REVIEW_PROFILE,
  PROTOTYPE_REVIEW_REMINDERS,
} from '@/lib/prototype-review';
import { deriveAutoReminder } from '@/lib/reminder-calculator';
import { applyReminderSideEffects } from '@/lib/reminder-side-effects';
import { useActiveProfile } from '@/providers/active-profile-provider';
import { Pressable, SafeAreaView, ScrollView, Text, View } from '@/tw';

function getStatusVariant(daysUntil: number): 'new' | 'increase' | 'stable' {
  if (daysUntil < 0) return 'new';
  if (daysUntil <= 30) return 'increase';
  return 'stable';
}

function getStatusText(daysUntil: number): string {
  if (daysUntil < 0) return `已逾期${Math.abs(daysUntil)}天`;
  if (daysUntil === 0) return '今天复查';
  if (daysUntil >= 60) return `${Math.round(daysUntil / 30)}个月后`;
  return `${daysUntil}天后`;
}

const DISEASE_ICONS: Record<string, string> = {
  thyroid: '🦋',
  breast: '🎀',
  lung: '🫁',
};

const DISEASE_LABELS: Record<string, string> = {
  thyroid: '甲状腺',
  breast: '乳腺',
  lung: '肺',
};

const DEMO_REMINDER_NODE_TEXT_STYLE = {
  fontSize: 7,
  fontWeight: '500' as const,
};

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

function buildLayerStates(daysUntil: number | undefined) {
  if (daysUntil === undefined) {
    return [
      { key: 'month', label: '月', on: false },
      { key: 'week', label: '周', on: false },
      { key: '3d', label: '3天', on: false },
      { key: 'day0', label: '当天', on: false },
    ] as const;
  }

  // Activation is windowed: only the layers that are within the upcoming window are "on".
  // - >30d: none
  // - 8-30d: 1m
  // - 4-7d: 1m + 1w
  // - 1-3d: 1m + 1w + 3d
  // - 0d or overdue: all
  if (daysUntil > 30) {
    return [
      { key: 'month', label: '月', on: false },
      { key: 'week', label: '周', on: false },
      { key: '3d', label: '3天', on: false },
      { key: 'day0', label: '当天', on: false },
    ] as const;
  }

  if (daysUntil >= 8) {
    return [
      { key: 'month', label: '月', on: true },
      { key: 'week', label: '周', on: false },
      { key: '3d', label: '3天', on: false },
      { key: 'day0', label: '当天', on: false },
    ] as const;
  }

  if (daysUntil >= 4) {
    return [
      { key: 'month', label: '月', on: true },
      { key: 'week', label: '周', on: true },
      { key: '3d', label: '3天', on: false },
      { key: 'day0', label: '当天', on: false },
    ] as const;
  }

  if (daysUntil >= 1) {
    return [
      { key: 'month', label: '月', on: true },
      { key: 'week', label: '周', on: true },
      { key: '3d', label: '3天', on: true },
      { key: 'day0', label: '当天', on: false },
    ] as const;
  }

  return [
    { key: 'month', label: '月', on: true },
    { key: 'week', label: '周', on: true },
    { key: '3d', label: '3天', on: true },
    { key: 'day0', label: '当天', on: true },
  ] as const;
}

function makeId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function ReminderNode({ label, active }: { label: string; active?: boolean }) {
  return (
    <View className={`h-[19px] w-[19px] items-center justify-center rounded-full ${active ? 'bg-primary' : 'border border-[#e0dbd2] bg-nav-bg'}`}>
      <Text dataSet={{ demoRole: 'node-text' }} style={DEMO_REMINDER_NODE_TEXT_STYLE} className={active ? 'text-nav-bg' : 'text-hint'}>{label}</Text>
    </View>
  );
}

function DemoReminderCard({ urgent, title, subtitle, badge, date, dateSub, activeNodes, footerAction, unset }: {
  urgent?: boolean;
  title: string;
  subtitle: string;
  badge: string;
  date: string;
  dateSub: string;
  activeNodes: number;
  footerAction: string;
  unset?: boolean;
}) {
  const nodes = ['月', '周', '3天', '当天'];
  return (
    <View className="mb-2 overflow-hidden rounded-[11px] border border-border bg-card">
      <View className={`flex-row items-center justify-between border-b border-[#f5f2ee] px-3 py-[9px] ${urgent ? 'bg-new-bg' : ''}`}>
        <View>
          <Text className="text-[13px] font-medium text-primary">{title}</Text>
          <Text className="mt-px text-[10px] text-muted">{subtitle}</Text>
        </View>
        <Text className={`rounded-[9px] px-[7px] py-0.5 text-[10px] font-medium ${urgent ? 'bg-[#fff0eb] text-new-text' : unset ? 'text-neutral-text' : 'bg-stable-bg text-stable-text'}`}>{badge}</Text>
      </View>
      <View className="flex-row items-center justify-between px-3 py-[9px]">
        <View>
          <Text className={`font-mono text-xs font-medium ${urgent ? 'text-new-text' : unset ? 'text-hint' : 'text-primary'}`}>{date}</Text>
          <Text className={`mt-0.5 text-[10px] ${urgent ? 'font-medium text-new-mid' : 'text-hint'}`}>{dateSub}</Text>
        </View>
        <View>
          <Text className="sr-only">层级（规划）</Text>
          <View className="flex-row gap-1">
            {nodes.map((node, index) => <ReminderNode key={node} label={node} active={index < activeNodes} />)}
          </View>
        </View>
      </View>
      <View className="flex-row items-center justify-between border-t border-[#f5f2ee] px-3 py-1.5">
        <Text className="text-[10px] text-hint">本人</Text>
        <Text className={`text-[10px] ${unset ? 'font-medium text-primary' : 'text-[#6b5f4e]'}`}>{footerAction}</Text>
      </View>
    </View>
  );
}

function DemoRemindersPage() {
  return (
    <SafeAreaView testID="reminders-demo-screen" className="flex-1 bg-page-bg">
      <View dataSet={{ demoRole: 'topbar' }}>
        <Pressable onPress={() => router.push('/?prototypeHomeSeed=demo')}>
          <Text dataSet={{ demoRole: 'topbar-text' }} className="text-xs text-muted">← 返回</Text>
        </Pressable>
        <Text className="font-serif text-sm font-normal text-primary">随访提醒</Text>
        <Text className="text-[11px] text-muted">本人 ▾</Text>
      </View>
      <ScrollView dataSet={{ demoRole: 'scroll' }} showsVerticalScrollIndicator={false}>
        <Text dataSet={{ demoRole: 'section' }}>即将到期</Text>
        <DemoReminderCard urgent title="左叶中下段结节" subtitle="甲状腺 · 本人" badge="23天后" date="2024-09-15" dateSub="提醒已开启 · 4层提醒" activeNodes={2} footerAction="修改日期 ›" />
        <View className="h-[5px]" />
        <Text className="mb-[7px] text-[10px] font-medium uppercase tracking-[0.07em] text-hint">其他提醒</Text>
        <DemoReminderCard title="右乳10点钟结节" subtitle="乳腺 · 本人" badge="5个月后" date="2025-01-10" dateSub="2025年1月10日" activeNodes={4} footerAction="修改日期 ›" />
        <DemoReminderCard title="右上叶前段结节" subtitle="肺 · 本人" badge="未设置" date="— 暂未设置" dateSub="点击设置复查提醒" activeNodes={0} footerAction="设置提醒 ›" unset />
      </ScrollView>
    </SafeAreaView>
  );
}

function RealRemindersPage({ demoSeed, int003Seed }: { demoSeed: boolean; int003Seed: boolean }) {
  const { data: storedProfiles = [] } = useProfiles();
  const { activeProfileId: storedActiveProfileId } = useActiveProfile();
  const profiles = demoSeed ? [PROTOTYPE_REVIEW_PROFILE] : storedProfiles;
  const activeProfileId = demoSeed ? PROTOTYPE_REVIEW_PROFILE.id : storedActiveProfileId;
  const activeProfile = profiles.find((profile) => profile.id === activeProfileId) ?? null;
  const activeProfileName = activeProfile?.nickname ?? '';
  const [int003Readback, setInt003Readback] = useState<{ lesion_label: string; next_exam_date: string } | null>(null);
  const [int003SyncText, setInt003SyncText] = useState('');

  const { data: storedLesions = [] } = useLesions(activeProfileId);
  const { data: storedReminders = [] } = useActiveReminders(activeProfileId);
  const { data: storedLatestExams = [] } = useLatestExaminationsByProfile(activeProfileId);
  const lesions = demoSeed ? PROTOTYPE_REVIEW_LESIONS.filter((lesion) => lesion.profile_id === activeProfileId) : storedLesions;
  const reminders = demoSeed ? PROTOTYPE_REVIEW_REMINDERS : storedReminders;
  const latestExams = demoSeed ? Object.values(PROTOTYPE_REVIEW_EXAMINATIONS).map((exams) => exams[0]).filter(Boolean) : storedLatestExams;

  const createReminder = useCreateReminder();
  const updateReminder = useUpdateReminder();
  const deactivateReminder = useDeactivateReminder();

  const [editingLesionId, setEditingLesionId] = useState<string | null>(null);
  const [followUpDraft, setFollowUpDraft] = useState('');
  const [followUpError, setFollowUpError] = useState('');
  const [sideEffectText, setSideEffectText] = useState<string>('');

  const activeLesions = useMemo(() => {
    return lesions.filter((lesion) => lesion.is_archived === 0);
  }, [lesions]);

  const latestExamByLesionId = useMemo(() => {
    const map = new Map<string, (typeof latestExams)[number]>();
    for (const exam of latestExams) {
      if (!map.has(exam.lesion_id)) map.set(exam.lesion_id, exam);
    }
    return map;
  }, [latestExams]);

  const reminderItems = useMemo(() => {
    const reminderByLesionId = new Map<string, (typeof reminders)[number]>();
    for (const reminder of reminders) {
      if (!reminderByLesionId.has(reminder.lesion_id)) {
        reminderByLesionId.set(reminder.lesion_id, reminder);
      }
    }

    return activeLesions
      .map((lesion) => {
        const reminder = reminderByLesionId.get(lesion.id);
        const nextDate = reminder?.next_exam_date;
        const daysUntil = getRemainingDays(nextDate);
        const latestExam = latestExamByLesionId.get(lesion.id);
        const derivation =
          !nextDate && latestExam
            ? deriveAutoReminder({
                diseaseType: lesion.disease_type,
                examDate: latestExam.exam_date,
                tirads: latestExam.tirads,
                birads: latestExam.birads,
                lungRads: latestExam.lung_rads,
              })
            : null;
        const noAutoReason = derivation?.kind === 'no_auto' ? derivation.reason : null;

        return {
          key: reminder?.id ?? lesion.id,
          reminderId: reminder?.id ?? null,
          lesionId: lesion.id,
          lesionLabel: lesion.label,
          diseaseType: lesion.disease_type,
          profileName: activeProfileName,
          nextDate: daysUntil === undefined ? null : nextDate ?? null,
          daysUntil,
          reminderSource: reminder?.source ?? null,
          noAutoReason,
        };
      })
      .sort((a, b) => {
        const aDays = a.daysUntil;
        const bDays = b.daysUntil;
        if (aDays === undefined && bDays === undefined) return a.lesionLabel.localeCompare(b.lesionLabel);
        if (aDays === undefined) return 1;
        if (bDays === undefined) return -1;
        return aDays - bDays;
      });
  }, [activeLesions, activeProfileName, latestExamByLesionId, reminders]);

  const dueSoonItems = useMemo(() => {
    return reminderItems.filter((item) => item.daysUntil !== undefined && item.daysUntil <= 30);
  }, [reminderItems]);

  const otherItems = useMemo(() => {
    return reminderItems.filter((item) => item.daysUntil === undefined || item.daysUntil > 30);
  }, [reminderItems]);

  const busy = createReminder.isPending || updateReminder.isPending || deactivateReminder.isPending;

  const int003Item = int003Seed
    ? reminderItems.find((item) => item.lesionLabel === '左叶中下段结节') ?? reminderItems[0]
    : undefined;

  const runInt003SyncProbe = useCallback(async () => {
    if (!int003Item) return;
    setInt003SyncText('正在同步 VAL-INT-003 提醒…');
    await api.post('/api/v1/reminders/sync', {
      reminders: [
        {
          lesion_label: int003Item.lesionLabel,
          next_exam_date: int003Item.nextDate,
        },
      ],
    });
    const readback = await api.get<{ reminders?: { lesion_label: string; next_exam_date: string }[] }>('/api/v1/reminders');
    const matched = readback.reminders?.find((item) => item.lesion_label === int003Item.lesionLabel) ?? null;
    setInt003Readback(matched);
    setInt003SyncText(matched ? 'VAL-INT-003 后端读回已更新' : 'VAL-INT-003 后端读回为空');
  }, [int003Item]);

  const startEdit = useCallback((item: (typeof reminderItems)[number]) => {
    setFollowUpError('');
    setSideEffectText('');
    setEditingLesionId(item.lesionId);
    setFollowUpDraft(item.nextDate ?? '');
  }, []);

  const cancelEdit = useCallback(() => {
    setFollowUpError('');
    setEditingLesionId(null);
    setFollowUpDraft('');
  }, []);

  const saveEdit = useCallback(
    async (item: (typeof reminderItems)[number]) => {
      setFollowUpError('');
      setSideEffectText('');
      const trimmed = followUpDraft.trim();

      if (!trimmed) {
        // Empty clears the reminder by deactivating it.
        if (item.reminderId) {
          await deactivateReminder.mutateAsync(item.reminderId);
          const effects = await applyReminderSideEffects();
          const perm = effects.notification.supported ? effects.notification.permission : 'unsupported';
          setSideEffectText(
            effects.sync.ok
              ? `已同步提醒（通知权限：${perm}）`
              : `提醒同步失败：${effects.sync.error}（通知权限：${perm}）`
          );
        }
        cancelEdit();
        return;
      }

      const iso = parseStrictIsoCalendarDate(trimmed);
      if (!iso) {
        setFollowUpError('请输入正确的日期（YYYY-MM-DD）');
        return;
      }

      if (item.reminderId) {
        await updateReminder.mutateAsync({
          id: item.reminderId,
          updates: { next_exam_date: iso, source: 'manual', is_active: 1 },
        });
      } else {
        await createReminder.mutateAsync({
          id: makeId('reminder'),
          lesion_id: item.lesionId,
          next_exam_date: iso,
          source: 'manual',
          is_active: 1,
        });
      }

      const effects = await applyReminderSideEffects();
      const perm = effects.notification.supported ? effects.notification.permission : 'unsupported';
      setSideEffectText(
        effects.sync.ok
          ? `已同步提醒（通知权限：${perm}）`
          : `提醒同步失败：${effects.sync.error}（通知权限：${perm}）`
      );

      cancelEdit();
    },
    [
      cancelEdit,
      createReminder,
      deactivateReminder,
      followUpDraft,
      updateReminder,
    ]
  );

  const deactivateItem = useCallback(
    async (item: (typeof reminderItems)[number]) => {
      if (!item.reminderId) return;
      setFollowUpError('');
      setSideEffectText('');
      await deactivateReminder.mutateAsync(item.reminderId);
      const effects = await applyReminderSideEffects();
      const perm = effects.notification.supported ? effects.notification.permission : 'unsupported';
      setSideEffectText(
        effects.sync.ok
          ? `已同步提醒（通知权限：${perm}）`
          : `提醒同步失败：${effects.sync.error}（通知权限：${perm}）`
      );
    },
    [deactivateReminder]
  );

  return (
    <SafeAreaView className="flex-1 bg-page-bg">
      <View className="mb-4 px-4 pt-4">
        <Text className="text-2xl font-bold text-primary">随访提醒</Text>
        <Text className="mt-1 text-sm text-neutral-text">
          {activeProfileName ? `${activeProfileName} · ` : ''}管理你的复查计划
        </Text>
        {sideEffectText ? <Text className="mt-2 text-xs text-neutral-text">{sideEffectText}</Text> : null}
        {int003Seed && int003Item ? (
          <View className="mt-3 rounded-xl border border-neutral-bg bg-card p-3">
            <Text className="text-xs font-semibold text-primary">VAL-INT-003 浏览器证据探针</Text>
            <Text className="mt-1 text-xs text-neutral-text">本地提醒：{int003Item.lesionLabel} · {int003Item.nextDate} · {int003Item.reminderSource === 'manual' ? '手动编辑' : '自动推导'}</Text>
            {int003Readback ? (
              <Text className="mt-1 text-xs text-new-text">后端读回：{int003Readback.lesion_label} · {int003Readback.next_exam_date}</Text>
            ) : null}
            {int003SyncText ? <Text className="mt-1 text-xs text-neutral-text">{int003SyncText}</Text> : null}
            <View className="mt-2">
              <Button title="同步并读回后端提醒" onPress={() => void runInt003SyncProbe()} disabled={busy} />
            </View>
          </View>
        ) : null}
      </View>

      <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
        {!activeProfileId ? (
          <View className="items-center py-20">
            <Text className="text-lg text-neutral-text">暂无档案</Text>
            <Text className="mt-2 text-sm text-neutral-text">创建档案后将自动生成随访提醒</Text>
          </View>
        ) : reminderItems.length === 0 ? (
          <View className="items-center py-20">
            <Text className="text-lg text-neutral-text">暂无提醒</Text>
            <Text className="mt-2 text-sm text-neutral-text">添加检查记录后将自动生成随访提醒</Text>
          </View>
        ) : (
          <View className="pb-10">
            <Text className="mb-3 text-xs font-semibold text-neutral-text">即将到期</Text>

            {dueSoonItems.length === 0 ? (
              <Text className="mb-6 text-sm text-neutral-text">暂无即将到期的提醒</Text>
            ) : null}

            {dueSoonItems.map((item) => {
              const variant = item.daysUntil === undefined ? 'neutral' : getStatusVariant(item.daysUntil);
              const statusText = item.daysUntil === undefined ? '未设置' : getStatusText(item.daysUntil);
              const diseaseLabel = DISEASE_LABELS[item.diseaseType] ?? '未知';
              const layers = buildLayerStates(item.daysUntil);
              return (
                <Card key={item.key} className="mb-3 p-3">
                    <View className="flex-row items-start justify-between">
                      <View className="flex-1 pr-3">
                        <View className="flex-row items-center">
                          <Text className="mr-2 text-base">{DISEASE_ICONS[item.diseaseType] || '📋'}</Text>
                          <View className="flex-1">
                            <Text className="text-sm font-semibold text-primary" numberOfLines={1}>
                              {item.lesionLabel}
                            </Text>
                            <Text className="mt-1 text-xs text-neutral-text" numberOfLines={1}>
                              {diseaseLabel}
                              {item.profileName ? ` · ${item.profileName}` : ''}
                            </Text>
                          </View>
                        </View>
                      </View>

                      <Badge text={statusText} variant={variant} />
                    </View>

                    <View className="mt-3 flex-row items-start justify-between">
                      <View className="flex-1 pr-3">
                        <Text className="text-sm font-mono text-primary">{item.nextDate ?? '— 暂未设置'}</Text>
                        <Text className="mt-1 text-xs text-neutral-text">
                          {item.nextDate
                            ? '提醒已开启 · 4层提醒'
                            : item.noAutoReason
                              ? item.noAutoReason
                              : '点击设置复查提醒'}
                        </Text>
                      </View>

                      <View className="items-end">
                        <Text className="mb-1 text-[10px] text-neutral-text">层级（规划）</Text>
                        <View className="flex-row flex-wrap justify-end gap-2">
                          {layers.map((layer) => (
                            <View
                              key={layer.key}
                              className={`rounded-lg px-2 py-1 ${layer.on ? 'bg-neutral-bg' : 'bg-page-bg'} border border-neutral-bg`}
                            >
                              <Text className={`text-[11px] ${layer.on ? 'text-primary' : 'text-neutral-text'}`}>
                                {layer.label}
                              </Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    </View>

                    {editingLesionId === item.lesionId ? (
                      <View className="mt-3 gap-2 border-t border-neutral-bg pt-3">
                        <Input
                          value={followUpDraft}
                          onChangeText={setFollowUpDraft}
                          placeholder="YYYY-MM-DD"
                          error={followUpError}
                        />
                        <View className="flex-row gap-2">
                          <View className="flex-1">
                            <Button title="保存" onPress={() => void saveEdit(item)} disabled={busy} fullWidth />
                          </View>
                          <View className="flex-1">
                            <Button title="取消" variant="secondary" onPress={cancelEdit} disabled={busy} fullWidth />
                          </View>
                        </View>
                      </View>
                    ) : (
                      <View className="mt-3 flex-row items-center justify-between border-t border-neutral-bg pt-2">
                        <Text className="text-xs text-neutral-text">{item.profileName || '—'}</Text>
                        <View className="flex-row items-center gap-3">
                          <Pressable onPress={() => router.push(`/lesion/${item.lesionId}`)}>
                            <Text className="text-xs text-primary">查看病灶 ›</Text>
                          </Pressable>
                          {item.nextDate ? (
                            <>
                              <Pressable onPress={() => startEdit(item)} accessibilityLabel="修改日期">
                                <Text className="text-xs text-primary">修改日期 ›</Text>
                              </Pressable>
                              <Pressable onPress={() => void deactivateItem(item)} accessibilityLabel="停用提醒" disabled={busy}>
                                <Text className="text-xs text-neutral-text">停用</Text>
                              </Pressable>
                            </>
                          ) : null}
                        </View>
                      </View>
                    )}
                  </Card>
              );
            })}

            <View className="h-2" />

            <Text className="mb-3 mt-2 text-xs font-semibold text-neutral-text">其他提醒</Text>

            {otherItems.map((item) => {
              const variant = item.daysUntil === undefined ? 'neutral' : getStatusVariant(item.daysUntil);
              const statusText = item.daysUntil === undefined ? '未设置' : getStatusText(item.daysUntil);
              const diseaseLabel = DISEASE_LABELS[item.diseaseType] ?? '未知';
              const layers = buildLayerStates(item.daysUntil);
              return (
                <Card key={item.key} className="mb-3 p-3">
                    <View className="flex-row items-start justify-between">
                      <View className="flex-1 pr-3">
                        <View className="flex-row items-center">
                          <Text className="mr-2 text-base">{DISEASE_ICONS[item.diseaseType] || '📋'}</Text>
                          <View className="flex-1">
                            <Text className="text-sm font-semibold text-primary" numberOfLines={1}>
                              {item.lesionLabel}
                            </Text>
                            <Text className="mt-1 text-xs text-neutral-text" numberOfLines={1}>
                              {diseaseLabel}
                              {item.profileName ? ` · ${item.profileName}` : ''}
                            </Text>
                          </View>
                        </View>
                      </View>

                      <Badge text={statusText} variant={variant} />
                    </View>

                    <View className="mt-3 flex-row items-start justify-between">
                      <View className="flex-1 pr-3">
                        <Text className="text-sm font-mono text-primary">{item.nextDate ?? '— 暂未设置'}</Text>
                        <Text className="mt-1 text-xs text-neutral-text">
                          {item.nextDate
                            ? '提醒已开启 · 4层提醒'
                            : item.noAutoReason
                              ? item.noAutoReason
                              : '点击设置复查提醒'}
                        </Text>
                      </View>

                      <View className="items-end">
                        <Text className="mb-1 text-[10px] text-neutral-text">层级（规划）</Text>
                        <View className="flex-row flex-wrap justify-end gap-2">
                          {layers.map((layer) => (
                            <View
                              key={layer.key}
                              className={`rounded-lg px-2 py-1 ${layer.on ? 'bg-neutral-bg' : 'bg-page-bg'} border border-neutral-bg`}
                            >
                              <Text className={`text-[11px] ${layer.on ? 'text-primary' : 'text-neutral-text'}`}>
                                {layer.label}
                              </Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    </View>

                    {editingLesionId === item.lesionId ? (
                      <View className="mt-3 gap-2 border-t border-neutral-bg pt-3">
                        <Input
                          value={followUpDraft}
                          onChangeText={setFollowUpDraft}
                          placeholder="YYYY-MM-DD"
                          error={followUpError}
                        />
                        <View className="flex-row gap-2">
                          <View className="flex-1">
                            <Button title="保存" onPress={() => void saveEdit(item)} disabled={busy} fullWidth />
                          </View>
                          <View className="flex-1">
                            <Button title="取消" variant="secondary" onPress={cancelEdit} disabled={busy} fullWidth />
                          </View>
                        </View>
                      </View>
                    ) : (
                      <View className="mt-3 flex-row items-center justify-between border-t border-neutral-bg pt-2">
                        <Text className="text-xs text-neutral-text">{item.profileName || '—'}</Text>
                        <View className="flex-row items-center gap-3">
                          {item.nextDate ? (
                            <>
                              <Pressable onPress={() => router.push(`/lesion/${item.lesionId}`)}>
                                <Text className="text-xs text-primary">查看病灶 ›</Text>
                              </Pressable>
                              <Pressable onPress={() => startEdit(item)} accessibilityLabel="修改日期">
                                <Text className="text-xs text-primary">修改日期 ›</Text>
                              </Pressable>
                              <Pressable onPress={() => void deactivateItem(item)} accessibilityLabel="停用提醒" disabled={busy}>
                                <Text className="text-xs text-neutral-text">停用</Text>
                              </Pressable>
                            </>
                          ) : (
                            <Pressable
                              onPress={() =>
                                router.push({ pathname: '/record/upload', params: { lesionId: item.lesionId, diseaseType: item.diseaseType } })
                              }
                            >
                              <Text className="text-xs text-new-text">设置提醒 ›</Text>
                            </Pressable>
                          )}
                        </View>
                      </View>
                    )}
                  </Card>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

export default function RemindersPage() {
  const { prototypeUi005Seed, prototypeInt003Seed } = useLocalSearchParams<{ prototypeUi005Seed?: string; prototypeInt003Seed?: string }>();
  const demoSeed = isDemoSeed(prototypeUi005Seed);
  const int003Seed = isDemoSeed(prototypeInt003Seed);

  if (demoSeed && !int003Seed) {
    return <DemoRemindersPage />;
  }

  return <RealRemindersPage demoSeed={demoSeed} int003Seed={int003Seed} />;
}
