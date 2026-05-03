import { useLocalSearchParams, router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { SecondaryPageHeader } from '@/components/SecondaryPageHeader';
import { TimelineNode } from '@/components/TimelineNode';
import { listReportImagesByLesion } from '@/lib/db/queries/report-images';
import { useExaminations } from '@/hooks/useExaminations';
import { useLesion } from '@/hooks/useLesions';
import { useRemindersByLesion } from '@/hooks/useReminders';
import { Image, Pressable, SafeAreaView, ScrollView, Text, View } from '@/tw';

function formatMonth(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString().slice(0, 7);
}

function formatIsoDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString().slice(0, 10);
}

function formatSize(sizeX: number | null, sizeY: number | null, sizeZ: number | null) {
  const values = [sizeX, sizeY, sizeZ].filter((v): v is number => v !== null);
  if (values.length === 0) return '暂无大小';
  return `${values.map((v) => `${v}`).join('×')}mm`;
}

function formatPrimarySizeMm(exam: { size_x: number | null; size_y: number | null; size_z: number | null }) {
  if (exam.size_x !== null) return `${exam.size_x.toFixed(1)}mm`;
  return formatSize(exam.size_x, exam.size_y, exam.size_z);
}

function getRads(exam: { tirads: string | null; birads: string | null; lung_rads: string | null }) {
  if (exam.tirads) return `TI-RADS ${exam.tirads}`;
  if (exam.birads) return `BI-RADS ${exam.birads}`;
  if (exam.lung_rads) return `LUNG-RADS ${exam.lung_rads}`;
  return '待补充分级';
}

function getThirdKeyValue(exam: {
  echo_type: string | null;
  density: string | null;
  calcification: string | null;
  shape: string | null;
  morphology: string | null;
}) {
  return exam.echo_type ?? exam.density ?? exam.calcification ?? exam.shape ?? exam.morphology ?? '待补充指标';
}

function getDiseaseLabel(diseaseType: string | null) {
  if (diseaseType === 'thyroid') return '甲状腺';
  if (diseaseType === 'breast') return '乳腺';
  if (diseaseType === 'lung') return '肺';
  return '未知';
}

function getInterval(date1: string, date2: string): string {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const monthsRaw = (d1.getTime() - d2.getTime()) / (1000 * 60 * 60 * 24 * 30);
  if (!Number.isFinite(monthsRaw)) return '';
  const months = Math.max(0, Math.round(monthsRaw));
  if (months >= 12) return `${Math.round(months / 12)}年`;
  return `${months}个月`;
}

function calcSignedChange(current: number, reference: number) {
  const diff = current - reference;
  const pct = reference === 0 ? 0 : Math.round((diff / reference) * 100);
  return {
    diffText: `${diff > 0 ? '+' : ''}${diff.toFixed(1)}mm`,
    pctText: `${pct > 0 ? '+' : ''}${pct}%`,
    diff,
    pct,
  };
}

function getDaysUntil(value: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${value}T00:00:00.000`);
  if (Number.isNaN(target.getTime())) return '';
  const days = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return days >= 0 ? `还有 ${days} 天` : `已逾期 ${Math.abs(days)} 天`;
}

export default function LesionDetailPage() {
  const params = useLocalSearchParams<{ id: string; reminderSync?: string; reminderPerm?: string; recordSaved?: string }>();
  const lesionId = typeof params.id === 'string' ? params.id : '';
  const recordSaved = params.recordSaved === '1';
  const reminderSync = typeof params.reminderSync === 'string' ? params.reminderSync : '';
  const reminderPerm = typeof params.reminderPerm === 'string' ? params.reminderPerm : '';
  const reminderBannerText =
    reminderSync === 'ok'
      ? `随访提醒已同步（通知权限：${reminderPerm || 'unknown'}）`
      : reminderSync === 'fail'
        ? `随访提醒同步失败（仍以本地为准；通知权限：${reminderPerm || 'unknown'}）`
        : null;

  const { data: storedLesion } = useLesion(lesionId);
  const { data: storedExaminations = [] } = useExaminations(lesionId);
  const { data: storedReminders = [] } = useRemindersByLesion(lesionId);
  const lesion = storedLesion;
  const examinations = storedExaminations;
  const reminders = storedReminders;
  const activeReminder = reminders.find((reminder) => reminder.is_active === 1) ?? null;

  const reportImagesQuery = useQuery({
    queryKey: ['report_images', 'lesion', lesionId],
    queryFn: () => listReportImagesByLesion(lesionId),
    enabled: Boolean(lesionId),
  });

  const reportImagesByExamId = (() => {
    const map = new Map<string, { id: string; uri: string }[]>();
    const rows = reportImagesQuery.data ?? [];
    for (const row of rows) {
      const list = map.get(row.examination_id) ?? [];
      list.push({ id: row.id, uri: row.uri });
      map.set(row.examination_id, list);
    }
    return map;
  })();

  if (!lesionId) {
    return (
      <SafeAreaView className="flex-1 bg-page-bg">
        <View className="flex-1 px-4">
          <SecondaryPageHeader title="病灶详情" fallbackHref="/(main)" />
          <View className="flex-1 items-center justify-center px-6">
            <Text className="text-lg text-neutral-text">病灶 ID 无效</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (!lesion) {
    return (
      <SafeAreaView className="flex-1 bg-page-bg">
        <View className="flex-1 px-4">
          <SecondaryPageHeader title="病灶详情" fallbackHref="/(main)" />
          <View className="flex-1 items-center justify-center px-6">
            <Text className="text-lg text-neutral-text">未找到该病灶</Text>
            <View className="mt-4 w-full">
              <Button title="返回首页" onPress={() => router.replace('/(main)')} fullWidth />
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (examinations.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-page-bg">
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          <View className="px-4">
            <SecondaryPageHeader title="病灶详情" fallbackHref="/(main)" />
          </View>
          <Card className="mx-4 mt-4">
            <Text className="mb-1 text-lg font-bold text-primary">{lesion.label}</Text>
            <Text className="text-sm text-neutral-text">暂无检查记录</Text>
          </Card>
          {reminderBannerText ? (
            <Card className="mx-4 mt-3 p-3">
              <Text className="text-xs text-neutral-text">{reminderBannerText}</Text>
            </Card>
          ) : null}

          <View className="mx-4 mt-4 flex-row gap-3">
            <View className="flex-1">
              <Button
                title="新增记录"
                onPress={() =>
                  router.push({
                    pathname: '/record/upload',
                    params: { lesionId, diseaseType: lesion.disease_type },
                  })
                }
                fullWidth
              />
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const latestExam = examinations[0];
  const baselineExam = examinations.length > 0 ? examinations[examinations.length - 1] : null;
  const hasComparison = examinations.length >= 3;

  const baselineHeroChange =
    latestExam.size_x !== null && baselineExam && baselineExam.size_x !== null && examinations.length >= 2 && baselineExam.size_x > 0
      ? (() => {
          const change = calcSignedChange(latestExam.size_x, baselineExam.size_x);
          const direction = change.diff > 0 ? 'increase' : change.diff < 0 ? 'decrease' : 'unchanged';
          return {
            direction,
            pctAbsText: `${Math.abs(change.pct)}%`,
          };
        })()
      : null;

  return (
    <SafeAreaView className="flex-1 bg-page-bg">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="px-4">
          <SecondaryPageHeader title="病灶详情" fallbackHref="/(main)" />
        </View>
        <Card className="mx-4 mt-4">
          <Text className="mb-1 text-lg font-bold text-primary">{lesion.label}</Text>
          <Text className="text-xs text-neutral-text">
            {getDiseaseLabel(lesion.disease_type)} · {lesion.location || '—'} · 建档于{' '}
            {baselineExam?.exam_date ? formatMonth(baselineExam.exam_date) : formatMonth(lesion.created_at)}
          </Text>
          <View className="mt-2 flex-row items-end gap-6">
            <View>
              <Text className="text-xs text-neutral-text">当前大小</Text>
              <Text className="font-mono text-2xl font-bold text-primary">{formatPrimarySizeMm(latestExam)}</Text>
            </View>
            <View>
              <Text className="text-xs text-neutral-text">分级</Text>
              <Text className="text-lg font-semibold text-primary">{getRads(latestExam)}</Text>
            </View>
            {baselineHeroChange ? (
              <View>
                <Text className="text-xs text-neutral-text">
                  {baselineHeroChange.direction === 'increase'
                    ? '较基线增大'
                    : baselineHeroChange.direction === 'decrease'
                      ? '较基线缩小'
                      : '较基线稳定'}
                </Text>
                <Text className="font-mono text-2xl font-bold text-primary">{baselineHeroChange.pctAbsText}</Text>
              </View>
            ) : null}
          </View>
        </Card>
        {recordSaved ? (
          <Card className="mx-4 mt-3 p-3">
            <Text className="text-xs font-semibold text-primary">新检查记录已入库，时间轴已更新</Text>
          </Card>
        ) : null}
        {reminderBannerText ? (
          <Card className="mx-4 mt-3 p-3">
            <Text className="text-xs text-neutral-text">{reminderBannerText}</Text>
          </Card>
        ) : null}

        <View className="mx-4 mt-4 flex-row gap-3">
          {hasComparison ? (
            <View className="flex-1">
              <Button
                title="查看对比"
                variant="outline"
                onPress={() => router.push(`/lesion/${lesionId}/compare`)}
                fullWidth
              />
            </View>
          ) : null}
          <View className="flex-1">
            <Button
              title="新增记录"
              onPress={() =>
                router.push({
                  pathname: '/record/upload',
                  params: { lesionId, diseaseType: lesion.disease_type },
                })
              }
              fullWidth
            />
          </View>
        </View>

        <View className="mb-4 mt-6 px-4">
          <Text className="mb-4 text-sm font-semibold text-primary">检查记录</Text>
          {examinations.map((exam, idx) => (
            (() => {
              const isLatest = idx === 0;
              const isBaseline = idx === examinations.length - 1;
              const prev = idx < examinations.length - 1 ? examinations[idx + 1] : null;
              const sizeX = exam.size_x;
              const prevSizeX = prev?.size_x ?? null;
              const baselineSizeX = baselineExam?.size_x ?? null;

              const statusBadge = (() => {
                if (isBaseline) return <Badge text="首次" variant="new" />;
                if (sizeX === null || prevSizeX === null) return <Badge text="—" variant="neutral" />;
                const diff = sizeX - prevSizeX;
                if (Math.abs(diff) < 0.1) return <Badge text="— 稳定" variant="stable" />;
                if (diff > 0) return <Badge text="▲ 增大" variant="increase" />;
                return <Badge text="▼ 变小" variant="stable" />;
              })();

              const showPreviousDelta = sizeX !== null && prevSizeX !== null && examinations.length >= 2 && !isBaseline;
              const previousDelta = showPreviousDelta ? calcSignedChange(sizeX!, prevSizeX!) : null;
              const showBaselineDelta =
                isLatest && sizeX !== null && baselineSizeX !== null && examinations.length >= 2 && baselineSizeX > 0;
              const baselineDelta = showBaselineDelta ? calcSignedChange(sizeX!, baselineSizeX!) : null;

              return (
                <TimelineNode
                  key={exam.id}
                  isLatest={isLatest}
                  date={formatIsoDate(exam.exam_date)}
                  interval={
                    idx < examinations.length - 1 ? getInterval(exam.exam_date, examinations[idx + 1].exam_date) : undefined
                  }
                >
                  <Card>
                    <View className="mb-2 flex-row items-center justify-between">
                      <View className="flex-row items-center gap-2">
                        <Text className="text-xs text-neutral-text">{formatIsoDate(exam.exam_date)}</Text>
                        {isLatest ? <Badge text="最新" variant="stable" /> : null}
                      </View>
                      {statusBadge}
                    </View>

                    <View className="flex-row items-end gap-3">
                      <View className="flex-1">
                        <Text className="text-xs text-neutral-text">大小</Text>
                        <Text className="mt-1 font-mono text-base font-semibold text-primary">
                          {formatPrimarySizeMm(exam)}
                        </Text>
                      </View>
                      <View className="flex-1">
                        <Text className="text-xs text-neutral-text">分级</Text>
                        <Text className="mt-1 text-sm font-semibold text-primary">{getRads(exam)}</Text>
                      </View>
                      <View className="flex-1">
                        <Text className="text-xs text-neutral-text">关键指标</Text>
                        <Text className="mt-1 text-sm font-semibold text-primary">{getThirdKeyValue(exam)}</Text>
                      </View>
                    </View>

                    {previousDelta || baselineDelta ? (
                      <View className="mt-3 rounded-xl bg-page-bg px-3 py-2">
                        {previousDelta ? (
                          <View className="flex-row items-center justify-between">
                            <Text className="text-xs text-neutral-text">较上次</Text>
                            <View className="flex-row items-center gap-3">
                              <Text className="text-xs font-mono text-primary">{previousDelta.diffText}</Text>
                              <Text className="text-xs font-mono text-neutral-text">{previousDelta.pctText}</Text>
                            </View>
                          </View>
                        ) : null}
                        {baselineDelta ? (
                          <View className={`${previousDelta ? 'mt-1' : ''} flex-row items-center justify-between`}>
                            <Text className="text-xs text-neutral-text">较基线</Text>
                            <View className="flex-row items-center gap-3">
                              <Text className="text-xs font-mono text-primary">{baselineDelta.diffText}</Text>
                              <Text className="text-xs font-mono text-neutral-text">{baselineDelta.pctText}</Text>
                            </View>
                          </View>
                        ) : null}
                      </View>
                    ) : null}

                    {reportImagesByExamId.get(exam.id) && reportImagesByExamId.get(exam.id)!.length > 0 ? (
                      <View className="mt-3">
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                          {reportImagesByExamId.get(exam.id)!.map((img, imgIdx) => (
                            <View key={img.id} className={imgIdx === 0 ? '' : 'ml-2'}>
                              <Image
                                source={{ uri: img.uri }}
                                accessibilityLabel={`检查${exam.id}报告图片${imgIdx + 1}`}
                                className="h-16 w-16 rounded-lg bg-neutral-bg"
                              />
                            </View>
                          ))}
                        </ScrollView>
                      </View>
                    ) : null}

                    {exam.hospital ? (
                      <View className="mt-2 flex-row items-center justify-between">
                        <Text className="text-xs text-neutral-text">{exam.hospital}</Text>
                        <Text className="text-xs text-neutral-text">›</Text>
                      </View>
                    ) : null}
                  </Card>
                </TimelineNode>
              );
            })()
          ))}
          {activeReminder ? (
            <View className="mt-2 rounded-2xl bg-card p-4 shadow-sm">
              <View className="flex-row items-center justify-between">
                <View>
                  <Text className="text-xs text-neutral-text">下次建议复查</Text>
                  <Text className="mt-1 font-mono text-lg font-semibold text-primary">{activeReminder.next_exam_date}</Text>
                  <Text className="mt-1 text-xs text-increase-text">{getDaysUntil(activeReminder.next_exam_date)}</Text>
                </View>
                <Pressable
                  onPress={() => router.push(`/lesion/${lesionId}/compare`)}
                  accessibilityLabel="修改复查日期"
                >
                  <Text className="text-sm font-semibold text-primary">修改</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
