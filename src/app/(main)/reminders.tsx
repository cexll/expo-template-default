import { useMemo } from 'react';
import { ScrollView, Text, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { useLesions } from '@/hooks/useLesions';
import { useProfiles } from '@/hooks/useProfiles';
import { useActiveReminders } from '@/hooks/useReminders';
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

  if (daysUntil <= 30) {
    return [
      { key: 'month', label: '月', on: true },
      { key: 'week', label: '周', on: true },
      { key: '3d', label: '3天', on: false },
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

export default function RemindersPage() {
  const { data: profiles = [] } = useProfiles();
  const { activeProfileId } = useActiveProfile();
  const activeProfile = profiles.find((profile) => profile.id === activeProfileId) ?? null;
  const activeProfileName = activeProfile?.nickname ?? '';

  const { data: lesions = [] } = useLesions(activeProfileId);
  const { data: reminders = [] } = useActiveReminders(activeProfileId);

  const activeLesions = useMemo(() => {
    return lesions.filter((lesion) => lesion.is_archived === 0);
  }, [lesions]);

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

        return {
          key: reminder?.id ?? lesion.id,
          lesionId: lesion.id,
          lesionLabel: lesion.label,
          diseaseType: lesion.disease_type,
          profileName: activeProfileName,
          nextDate: daysUntil === undefined ? null : nextDate ?? null,
          daysUntil,
          reminderSource: reminder?.source ?? null,
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
  }, [activeLesions, activeProfileName, reminders]);

  const dueSoonItems = useMemo(() => {
    return reminderItems.filter((item) => item.daysUntil !== undefined && item.daysUntil <= 30);
  }, [reminderItems]);

  const otherItems = useMemo(() => {
    return reminderItems.filter((item) => item.daysUntil === undefined || item.daysUntil > 30);
  }, [reminderItems]);

  return (
    <SafeAreaView className="flex-1 bg-page-bg">
      <View className="mb-4 px-4 pt-4">
        <Text className="text-2xl font-bold text-primary">随访提醒</Text>
        <Text className="mt-1 text-sm text-neutral-text">
          {activeProfileName ? `${activeProfileName} · ` : ''}管理你的复查计划
        </Text>
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
                <Pressable
                  key={item.key}
                  onPress={() => {
                    router.push(`/lesion/${item.lesionId}`);
                  }}
                >
                  <Card className="mb-3 p-3">
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
                          {item.nextDate ? `提醒来源 · ${sourceLabel}` : '新增检查记录后将自动生成复查提醒'}
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

                    <View className="mt-3 flex-row items-center justify-between border-t border-neutral-bg pt-2">
                      <Text className="text-xs text-neutral-text">{item.profileName || '—'}</Text>
                      <Text className="text-xs text-primary">查看病灶 ›</Text>
                    </View>
                  </Card>
                </Pressable>
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
                <Pressable
                  key={item.key}
                  onPress={() => {
                    router.push(`/lesion/${item.lesionId}`);
                  }}
                >
                  <Card className="mb-3 p-3">
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
                          {item.nextDate ? `提醒来源 · ${sourceLabel}` : '新增检查记录后将自动生成复查提醒'}
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

                    <View className="mt-3 flex-row items-center justify-between border-t border-neutral-bg pt-2">
                      <Text className="text-xs text-neutral-text">{item.profileName || '—'}</Text>
                      <Text className={`text-xs ${item.nextDate ? 'text-primary' : 'text-new-text'}`}>
                        {item.nextDate ? '查看病灶 ›' : '去新增记录 ›'}
                      </Text>
                    </View>
                  </Card>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
