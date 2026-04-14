import { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { ChangeBadge } from '@/components/ChangeBadge';
import { ComparisonRow } from '@/components/ComparisonRow';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Tag } from '@/components/ui/Tag';
import { useExaminations } from '@/hooks/useExaminations';
import { useLesion } from '@/hooks/useLesions';

function formatSignedDiff(value: string) {
  return Number(value) > 0 ? `+${value}` : value;
}

function calcChange(current: number, reference: number) {
  const diff = current - reference;
  const pct = Math.round((diff / reference) * 100);

  return {
    diff: diff.toFixed(1),
    pct,
    type: diff > 0 ? 'increase' as const : diff < 0 ? 'decrease' as const : 'unchanged' as const,
  };
}

function addDays(isoDate: string, days: number) {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return null;
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatMonth(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString().slice(0, 7);
}

export default function ComparePage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [showCount, setShowCount] = useState(3);
  const [followUpDate, setFollowUpDate] = useState('');

  const lesionId = typeof id === 'string' ? id : '';
  const { data: lesion } = useLesion(lesionId);
  const { data: examinations = [] } = useExaminations(lesionId);

  const exams = useMemo(() => {
    return examinations.slice(0, Math.min(showCount, examinations.length));
  }, [examinations, showCount]);

  const latest = exams[0] ?? null;
  const baseline = exams.length > 0 ? exams[exams.length - 1] : null;
  const previous = exams.length > 1 ? exams[1] : null;

  const latestSizeX = latest?.size_x ?? null;
  const baselineSizeX = baseline?.size_x ?? null;
  const previousSizeX = previous?.size_x ?? null;

  const vsBaseline =
    latestSizeX !== null && baselineSizeX !== null ? calcChange(latestSizeX, baselineSizeX) : null;
  const vsPrevious =
    latestSizeX !== null && previousSizeX !== null ? calcChange(latestSizeX, previousSizeX) : null;

  const calcificationChanged = Boolean(
    latest?.calcification && baseline?.calcification && latest.calcification !== baseline.calcification
  );

  const summaryText =
    lesion && latest && baseline && vsBaseline
      ? `${lesion.label}最大径较基线变化${vsBaseline.diff}mm（${vsBaseline.pct}%），分级由${
          baseline.tirads ?? baseline.birads ?? baseline.lung_rads ?? '—'
        }变为${latest.tirads ?? latest.birads ?? latest.lung_rads ?? '—'}。`
      : '数据不足，暂不生成变化小结。';

  useEffect(() => {
    if (followUpDate) return;
    if (!latest?.exam_date) return;
    const suggested = addDays(latest.exam_date, 180);
    if (suggested) setFollowUpDate(suggested);
  }, [followUpDate, latest?.exam_date]);

  return (
    <SafeAreaView className="flex-1 bg-page-bg">
      <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
        <Text className="mt-4 mb-2 text-2xl font-bold text-primary">横向对比</Text>
        <Text className="mb-4 text-sm text-neutral-text">病灶 ID：{id}</Text>

        <View className="mb-4 flex-row gap-2">
          <Tag text="最近3次" selected={showCount === 3} onPress={() => setShowCount(3)} />
          <Tag text="最近5次" selected={showCount === 5} onPress={() => setShowCount(5)} />
        </View>

        {lesion && exams.length === 0 ? (
          <Card className="mb-4">
            <Text className="text-sm font-semibold text-primary">{lesion.label}</Text>
            <Text className="mt-2 text-xs text-neutral-text">暂无检查记录，无法生成对比。</Text>
          </Card>
        ) : null}

        <Card className="mb-4">
          <Text className="mb-2 text-xs text-neutral-text">大小变化（最大径 mm）</Text>
          <View className="flex-row items-end">
            <View className="mr-4">
              <Text className="text-3xl font-bold text-primary">{latestSizeX ?? '—'}</Text>
              <Text className="mt-1 text-xs font-mono text-neutral-text">
                {latest ? `${formatMonth(latest.exam_date)} · ${latest.size_x ?? '—'}×${latest.size_y ?? '—'}×${latest.size_z ?? '—'}` : '—'}
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
          <ComparisonRow
            label="TI-RADS"
            values={exams.map((exam) => exam.tirads ?? '—')}
            changeType={latest?.tirads && baseline?.tirads && latest.tirads !== baseline.tirads ? 'increase' : 'unchanged'}
            hasChanged={Boolean(latest?.tirads && baseline?.tirads && latest.tirads !== baseline.tirads)}
          />
          <ComparisonRow
            label="回声"
            values={exams.map((exam) => exam.echo_type ?? '—')}
            changeType="unchanged"
            hasChanged={false}
          />
          <ComparisonRow
            label="边界"
            values={exams.map((exam) => exam.border ?? '—')}
            changeType="unchanged"
            hasChanged={false}
          />
          <ComparisonRow
            label="钙化"
            values={exams.map((exam) => exam.calcification ?? '—')}
            changeType={calcificationChanged ? 'new' : 'unchanged'}
            changeValue={
              calcificationChanged ? latest?.calcification ?? undefined : undefined
            }
            hasChanged={calcificationChanged}
          />
        </Card>

        <Card className="mb-4">
          <Text className="mb-1 text-xs text-neutral-text">变化小结</Text>
          <Text className="text-sm text-primary">{summaryText}</Text>
        </Card>

        <Card className="mb-8">
          <Text className="mb-2 text-xs text-neutral-text">下次建议复查日</Text>
          <Input value={followUpDate} onChangeText={setFollowUpDate} placeholder="YYYY-MM-DD" />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
