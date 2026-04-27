import { Platform } from 'react-native';
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
import type { Examination, Lesion, Reminder } from '@/lib/db/types';
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

function isDemoSeed(value: unknown): boolean {
  return (Array.isArray(value) ? value[0] : value) === 'demo';
}

const PROTOTYPE_DETAIL_LESION: Lesion = {
  id: 'lesion-1',
  profile_id: 'prototype-profile-self',
  disease_type: 'thyroid',
  label: '左叶中下段结节',
  location: '左叶中下段',
  is_archived: 0,
  created_at: '2023-03-05T00:00:00.000Z',
  updated_at: '2024-03-15T00:00:00.000Z',
};

const PROTOTYPE_DETAIL_EXAMINATIONS: Examination[] = [
  {
    id: 'prototype-exam-latest',
    lesion_id: 'lesion-1',
    exam_date: '2024-03-15',
    hospital: '重庆市第一人民医院',
    size_x: 8.3,
    size_y: 5.8,
    size_z: 6.1,
    tirads: '3',
    echo_type: '低回声',
    border: '尚清',
    calcification: '点状强回声',
    blood_flow: '少量血流',
    birads: null,
    shape: null,
    orientation: null,
    lung_rads: null,
    density: null,
    morphology: null,
    pleural_pull: null,
    ai_raw_json: null,
    notes: null,
    created_at: '2024-03-15T00:00:00.000Z',
    updated_at: '2024-03-15T00:00:00.000Z',
  },
  {
    id: 'prototype-exam-previous',
    lesion_id: 'lesion-1',
    exam_date: '2023-09-10',
    hospital: '重庆市第一人民医院',
    size_x: 7.8,
    size_y: 5.2,
    size_z: 5.8,
    tirads: '3',
    echo_type: '低回声',
    border: '尚清',
    calcification: '无明显钙化',
    blood_flow: '少量血流',
    birads: null,
    shape: null,
    orientation: null,
    lung_rads: null,
    density: null,
    morphology: null,
    pleural_pull: null,
    ai_raw_json: null,
    notes: null,
    created_at: '2023-09-10T00:00:00.000Z',
    updated_at: '2023-09-10T00:00:00.000Z',
  },
  {
    id: 'prototype-exam-baseline',
    lesion_id: 'lesion-1',
    exam_date: '2023-03-05',
    hospital: '重庆市第一人民医院',
    size_x: 7.1,
    size_y: null,
    size_z: null,
    tirads: '3',
    echo_type: '低回声',
    border: '清楚',
    calcification: '无明显钙化',
    blood_flow: '未见明显血流',
    birads: null,
    shape: null,
    orientation: null,
    lung_rads: null,
    density: null,
    morphology: null,
    pleural_pull: null,
    ai_raw_json: null,
    notes: null,
    created_at: '2023-03-05T00:00:00.000Z',
    updated_at: '2023-03-05T00:00:00.000Z',
  },
];

const PROTOTYPE_DETAIL_REMINDERS: Reminder[] = [
  {
    id: 'prototype-reminder-detail',
    lesion_id: 'lesion-1',
    next_exam_date: '2024-09-15',
    source: 'auto',
    is_active: 1,
    created_at: '2024-03-15T00:00:00.000Z',
    updated_at: '2024-03-15T00:00:00.000Z',
  },
];

export default function LesionDetailPage() {
  const params = useLocalSearchParams<{ id: string; reminderSync?: string; reminderPerm?: string; prototypeDetailSeed?: string; recordSaved?: string }>();
  const lesionId = typeof params.id === 'string' ? params.id : '';
  const demoSeed = isDemoSeed(params.prototypeDetailSeed);
  const recordSaved = isDemoSeed(params.recordSaved);
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
  const lesion = demoSeed ? PROTOTYPE_DETAIL_LESION : storedLesion;
  const examinations = demoSeed ? PROTOTYPE_DETAIL_EXAMINATIONS : storedExaminations;
  const reminders = demoSeed ? PROTOTYPE_DETAIL_REMINDERS : storedReminders;
  const activeReminder = reminders.find((reminder) => reminder.is_active === 1) ?? null;

  const reportImagesQuery = useQuery({
    queryKey: ['report_images', 'lesion', lesionId],
    queryFn: () => listReportImagesByLesion(lesionId),
    enabled: Boolean(lesionId) && !demoSeed,
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

  if (Platform.OS === 'web' && demoSeed) {
    return (
      <div className="screen active" style={{ display: 'flex' }}>
        <div className="topbar"><button className="tb-back" onClick={() => router.replace('/(main)?prototypeHomeSeed=demo')}>← 首页</button><span className="tb-page">病灶详情</span><span style={{ fontSize: 16, color: 'var(--muted)' }}>···</span></div>
        <div className="hero"><div className="hero-name">左叶中下段结节</div><div className="hero-meta">甲状腺 · 左叶 · 建档于 2023-03</div><div className="hero-stats"><div className="hst"><span className="hsv-up">8.3mm</span><span className="hsl">当前大小</span></div><div className="hst"><span className="hsv">TI-RADS 3</span><span className="hsl">当前分级</span></div><div className="hst"><div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div className="tri" /><span className="hsv-up">17%</span></div><span className="hsl">较基线增大</span></div></div></div>
        <div className="act-row"><button className="act-btn" onClick={() => router.push('/lesion/lesion-1/compare?prototypeDetailSeed=demo')}>查看对比</button><button className="act-btn-p" onClick={() => router.push('/record/recognize?prototypeRecognitionSeed=demo')}>+ 新增记录</button></div>
        <div className="scrl">
          <div className="sec">检查记录</div>
          <div className="tl"><div className="tl-spine" />
            <div className="tli"><div className="tl-dw"><div className="dot-now" /></div><div className="rc"><div className="rch"><div style={{ display: 'flex', alignItems: 'center' }}><span className="rcdt">2024-03-15</span><span className="rctag">最新</span></div><span className="bdge b-up">▲ 增大</span></div><div className="rcb"><div className="rcst"><div className="rv-up">8.3mm</div><div className="rls">大小</div></div><div className="rcst" style={{ paddingLeft: 9 }}><div className="rv">3级</div><div className="rls">TI-RADS</div></div><div className="rcst" style={{ paddingLeft: 9 }}><div className="rv" style={{ color: 'var(--coral)', fontSize: 11 }}>点状强回声</div><div className="rls">钙化</div></div></div><div className="rcd"><div className="di"><span className="dl">较上次</span><span className="dv">+0.5mm</span><span className="dp">+6%</span></div><div className="di"><span className="dl">较基线</span><span className="dv">+1.2mm</span><span className="dp">+17%</span></div></div><div className="rcf"><span className="rh">重庆市第一人民医院</span><span style={{ fontSize: 11, color: 'var(--gray)' }}>›</span></div></div></div>
            <div className="gap-row"><div className="gl" /><span className="gt">间隔 6个月</span><div className="gl" /></div>
            <div className="tli"><div className="tl-dw"><div className="dot-past" /></div><div className="rc"><div className="rch"><span className="rcdt">2023-09-10</span><span className="bdge b-ok">— 稳定</span></div><div className="rcb"><div className="rcst"><div className="rv">7.8mm</div><div className="rls">大小</div></div><div className="rcst" style={{ paddingLeft: 9 }}><div className="rv">3级</div><div className="rls">TI-RADS</div></div><div className="rcst" style={{ paddingLeft: 9 }}><div className="rv">无</div><div className="rls">钙化</div></div></div><div className="rcf"><span className="rh">重庆市第一人民医院</span><span style={{ fontSize: 11, color: 'var(--gray)' }}>›</span></div></div></div>
            <div className="gap-row"><div className="gl" /><span className="gt">间隔 6个月</span><div className="gl" /></div>
            <div className="tli"><div className="tl-dw"><div className="dot-past" /></div><div className="rc"><div className="rch"><span className="rcdt">2023-03-05</span><span className="bdge b-first">首次</span></div><div className="rcb"><div className="rcst"><div className="rv">7.1mm</div><div className="rls">大小</div></div><div className="rcst" style={{ paddingLeft: 9 }}><div className="rv">3级</div><div className="rls">TI-RADS</div></div><div className="rcst" style={{ paddingLeft: 9 }}><div className="rv">无</div><div className="rls">钙化</div></div></div><div className="rcf"><span className="rh">重庆市第一人民医院</span><span style={{ fontSize: 11, color: 'var(--gray)' }}>›</span></div></div></div>
          </div>
          <div className="remind-c"><div><div className="rlbl">下次建议复查</div><div className="rdt">2024-09-15</div><div className="rsub">还有 23 天</div></div><button className="redit">修改</button></div>
        </div>
      </div>
    );
  }

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
                onPress={() => router.push(`/lesion/${lesionId}/compare${demoSeed ? '?prototypeDetailSeed=demo' : ''}`)}
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

                    <View className="flex-row items-end gap-4">
                      <View className="min-w-[96px]">
                        <Text className="text-xs text-neutral-text">大小</Text>
                        <Text className="mt-1 font-mono text-lg font-semibold text-primary">
                          {formatPrimarySizeMm(exam)}
                        </Text>
                      </View>
                      <View className="flex-1">
                        <Text className="text-xs text-neutral-text">分级</Text>
                        <Text className="mt-1 text-sm font-semibold text-primary">{getRads(exam)}</Text>
                      </View>
                    </View>

                    {exam.calcification ? (
                      <View className="mt-2">
                        <Text className="text-xs text-neutral-text">钙化</Text>
                        <Text className="mt-1 text-sm text-primary">{exam.calcification}</Text>
                      </View>
                    ) : null}

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
                  onPress={() => router.push(`/lesion/${lesionId}/compare${demoSeed ? '?prototypeDetailSeed=demo' : ''}`)}
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
