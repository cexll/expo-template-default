import { useCallback, useMemo, useState } from 'react';
import { ScrollView, Text, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useLatestExaminationsByProfile } from '@/hooks/useExaminations';
import { useLesions } from '@/hooks/useLesions';
import { useProfiles } from '@/hooks/useProfiles';
import { useActiveReminders, useCreateReminder, useDeactivateReminder, useUpdateReminder } from '@/hooks/useReminders';
import { parseStrictIsoCalendarDate } from '@/lib/iso-calendar-date';
import { deriveAutoReminder } from '@/lib/reminder-calculator';
import { applyReminderSideEffects } from '@/lib/reminder-side-effects';
import { useActiveProfile } from '@/providers/active-profile-provider';

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

export default function RemindersPage() {
  const { data: profiles = [] } = useProfiles();
  const { activeProfileId } = useActiveProfile();
  const activeProfile = profiles.find((profile) => profile.id === activeProfileId) ?? null;
  const activeProfileName = activeProfile?.nickname ?? '';

  const { data: lesions = [] } = useLesions(activeProfileId);
  const { data: reminders = [] } = useActiveReminders(activeProfileId);
  const { data: latestExams = [] } = useLatestExaminationsByProfile(activeProfileId);

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

  const startEdit = useCallback((item: (typeof reminderItems)[number]) => {
    setFollowUpError('');
    setSideEffectText('');
    setEditingLesionId(item.lesionId);
    setFollowUpDraft(item.nextDate ?? '');
  }, []);

  const cancelEdit = useCallback(() => {
    setFollowUpError('');
    setSideEffectText('');
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
              const sourceLabel = item.reminderSource === 'manual' ? '手动设置' : item.reminderSource === 'auto' ? '自动生成' : '未生成';

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
                        <Text className="text-sm font-mono text-primary">{item.nextDate ?? '— 暂未生成'}</Text>
                        <Text className="mt-1 text-xs text-neutral-text">
                          {item.nextDate
                            ? `提醒来源 · ${sourceLabel}`
                            : item.noAutoReason
                              ? item.noAutoReason
                              : '新增检查记录后将自动生成复查提醒'}
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
              const sourceLabel = item.reminderSource === 'manual' ? '手动设置' : item.reminderSource === 'auto' ? '自动生成' : '未生成';

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
                        <Text className="text-sm font-mono text-primary">{item.nextDate ?? '— 暂未生成'}</Text>
                        <Text className="mt-1 text-xs text-neutral-text">
                          {item.nextDate
                            ? `提醒来源 · ${sourceLabel}`
                            : item.noAutoReason
                              ? item.noAutoReason
                              : '新增检查记录后将自动生成复查提醒'}
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
                              <Text className="text-xs text-new-text">去新增记录 ›</Text>
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
