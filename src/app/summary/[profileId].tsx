import { useCallback, useMemo, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { ChangeBadge } from '@/components/ChangeBadge';
import { PaywallSheet } from '@/components/PaywallSheet';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useQueries } from '@tanstack/react-query';
import { listExaminationsByLesion } from '@/lib/db/queries/examinations';
import { useLesions } from '@/hooks/useLesions';
import { useProfile } from '@/hooks/useProfiles';
import { useActiveReminders } from '@/hooks/useReminders';
import { canUseFeature, useSubscriptionStatus } from '@/hooks/useSubscriptionStatus';

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
  const pct = Math.round((diff / reference) * 100);
  return {
    diff: diff.toFixed(1),
    pct,
    type: diff > 0 ? ('increase' as const) : diff < 0 ? ('decrease' as const) : ('unchanged' as const),
  };
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

  const { data: profile } = useProfile(id);
  const { data: lesions = [] } = useLesions(id);
  const { data: reminders = [] } = useActiveReminders(id);

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

  const lesionSummaries = useMemo(() => {
    return activeLesions.map((lesion, index) => {
      const exams = examinations[index]?.data ?? [];
      const latest = exams[0];
      const baseline = exams.length > 0 ? exams[exams.length - 1] : null;

      const latestSize = latest ? formatSize(latest.size_x, latest.size_y, latest.size_z) : '暂无检查';
      const radsGrade = latest ? getRads(latest) : '待补充分级';

      const baselineSize = baseline?.size_x !== null && baseline?.size_x !== undefined ? `${baseline.size_x}mm` : null;

      const change =
        latest?.size_x !== null &&
        latest?.size_x !== undefined &&
        baseline?.size_x !== null &&
        baseline?.size_x !== undefined &&
        exams.length >= 2
          ? calcChange(latest.size_x, baseline.size_x)
          : null;

      const changeValue = change ? `${change.diff.startsWith('-') ? '' : '+'}${change.diff}mm (${change.pct > 0 ? '+' : ''}${change.pct}%)` : null;

      return {
        label: lesion.label,
        diseaseType: lesion.disease_type,
        latestSize,
        radsGrade,
        baselineSize,
        changeType: change?.type ?? null,
        changeValue,
        examCount: exams.length,
      };
    });
  }, [activeLesions, examinations]);

  const totalExamCount = useMemo(() => {
    return lesionSummaries.reduce((sum, lesion) => sum + lesion.examCount, 0);
  }, [lesionSummaries]);

  const needsAttention = useMemo(() => {
    const gradeCount = lesionSummaries.filter(
      (lesion) => lesion.radsGrade.includes('3') || lesion.radsGrade.includes('4')
    ).length;

    const urgentReminderCount = reminders.filter((reminder) => {
      const days = getRemainingDays(reminder.next_exam_date);
      return days !== undefined && days <= 30;
    }).length;

    return Math.max(gradeCount, urgentReminderCount);
  }, [lesionSummaries, reminders]);

  const exportImage = useCallback(async () => {
    if (!profile) {
      setExportError('档案信息尚未加载，请稍后重试');
      return;
    }

    if (subscriptionLoading) {
      setExportError('正在获取会员状态，请稍后重试');
      return;
    }
    if (subscriptionStatus && !canUseFeature(subscriptionStatus, 'summary_export')) {
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
    } catch (e) {
      setExportError(e instanceof Error ? e.message : '导出失败，请稍后重试');
    } finally {
      setExporting(false);
    }
  }, [profile, subscriptionLoading, subscriptionStatus]);

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
              <Text className="text-sm text-neutral-text">在档病灶 {lesionSummaries.length}个</Text>
            </View>
            <Text className="mt-3 text-xs text-neutral-text">档案编号 {id}</Text>
          </Card>

          <View className="mb-4 flex-row gap-3">
            <Card className="flex-1 items-center py-4">
              <Text className="font-mono text-2xl font-bold text-primary">{lesionSummaries.length}</Text>
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

          {lesionSummaries.map((lesion) => {
            const badgeVariant =
              lesion.radsGrade.includes('4') ? 'new' :
              lesion.radsGrade.includes('3') ? 'increase' :
              'stable';

            return (
              <Card key={lesion.label} className="mb-3">
                <View className="mb-3 flex-row items-start justify-between gap-3">
                  <View className="flex-1">
                    <Text className="text-sm font-semibold text-primary">{lesion.label}</Text>
                    <Text className="mt-1 text-xs uppercase tracking-[1.5px] text-neutral-text">
                      {lesion.diseaseType}
                    </Text>
                  </View>
                  <Badge text={lesion.radsGrade} variant={badgeVariant} />
                </View>

                <View className="flex-row flex-wrap gap-4">
                  <View className="min-w-[108px]">
                    <Text className="text-xs text-neutral-text">当前大小</Text>
                    <Text className="mt-1 font-mono text-sm text-primary">{lesion.latestSize}</Text>
                  </View>
                  {lesion.changeType && lesion.changeValue ? (
                    <View>
                      <Text className="text-xs text-neutral-text">较基线</Text>
                      <View className="mt-1">
                        <ChangeBadge type={lesion.changeType} value={lesion.changeValue} />
                      </View>
                    </View>
                  ) : null}
                  {lesion.baselineSize ? (
                    <View className="min-w-[96px]">
                      <Text className="text-xs text-neutral-text">基线大小</Text>
                      <Text className="mt-1 font-mono text-sm text-primary">{lesion.baselineSize}</Text>
                    </View>
                  ) : null}
                </View>

                <Text className="mt-3 text-xs text-neutral-text">共{lesion.examCount}次检查记录</Text>
              </Card>
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
