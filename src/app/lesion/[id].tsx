import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ChangeBadge } from '@/components/ChangeBadge';
import { TimelineNode } from '@/components/TimelineNode';
import { useExaminations } from '@/hooks/useExaminations';
import { useLesion } from '@/hooks/useLesions';

function formatMonth(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString().slice(0, 7);
}

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

function getInterval(date1: string, date2: string): string {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const months = Math.round((d1.getTime() - d2.getTime()) / (1000 * 60 * 60 * 24 * 30));
  if (months >= 12) return `${Math.round(months / 12)}年`;
  return `${months}个月`;
}

export default function LesionDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const lesionId = typeof id === 'string' ? id : '';

  const { data: lesion } = useLesion(lesionId);
  const { data: examinations = [] } = useExaminations(lesionId);

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

  if (examinations.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-page-bg">
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          <Card className="mx-4 mt-4">
            <Text className="mb-1 text-lg font-bold text-primary">{lesion.label}</Text>
            <Text className="text-sm text-neutral-text">暂无检查记录</Text>
          </Card>

          <View className="mx-4 mt-4 flex-row gap-3">
            <View className="flex-1">
              <Button title="新增记录" onPress={() => router.push('/record/upload')} fullWidth />
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const latestExam = examinations[0];
  const previousExam = examinations.length > 1 ? examinations[1] : null;
  const hasComparison = examinations.length >= 3;

  const sizeChange =
    latestExam.size_x !== null && previousExam && previousExam.size_x !== null
      ? (() => {
          const diff = latestExam.size_x - previousExam.size_x;
          return {
            type: diff > 0 ? ('increase' as const) : diff < 0 ? ('decrease' as const) : ('unchanged' as const),
            value: `${diff > 0 ? '+' : ''}${diff.toFixed(1)}mm`,
          };
        })()
      : null;

  return (
    <SafeAreaView className="flex-1 bg-page-bg">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <Card className="mx-4 mt-4">
          <Text className="mb-1 text-lg font-bold text-primary">{lesion.label}</Text>
          <View className="mt-2 flex-row items-end gap-6">
            <View>
              <Text className="text-xs text-neutral-text">当前大小</Text>
              <Text className="font-mono text-2xl font-bold text-primary">
                {formatSize(latestExam.size_x, latestExam.size_y, latestExam.size_z)}
              </Text>
            </View>
            <View>
              <Text className="text-xs text-neutral-text">分级</Text>
              <Text className="text-lg font-semibold text-primary">{getRads(latestExam)}</Text>
            </View>
            {sizeChange ? <ChangeBadge type={sizeChange.type} value={sizeChange.value} /> : null}
          </View>
        </Card>

        <View className="mx-4 mt-4 flex-row gap-3">
          {hasComparison ? (
            <View className="flex-1">
              <Button
                title="查看对比"
                variant="outline"
                onPress={() => router.push(`/lesion/${id}/compare`)}
                fullWidth
              />
            </View>
          ) : null}
          <View className="flex-1">
            <Button title="新增记录" onPress={() => router.push('/record/upload')} fullWidth />
          </View>
        </View>

        <View className="mb-4 mt-6 px-4">
          <Text className="mb-4 text-sm font-semibold text-primary">检查时间线</Text>
          {examinations.map((exam, idx) => (
            <TimelineNode
              key={exam.id}
              isLatest={idx === 0}
              date={formatMonth(exam.exam_date)}
              interval={
                idx < examinations.length - 1
                  ? getInterval(exam.exam_date, examinations[idx + 1].exam_date)
                  : undefined
              }
            >
              <Card>
                <View className="mb-2 flex-row items-center justify-between">
                  <Badge
                    text={getRads(exam)}
                    variant={exam.tirads || exam.birads || exam.lung_rads ? 'stable' : 'neutral'}
                  />
                  {idx === 0 ? <Badge text="最新" variant="stable" /> : null}
                </View>
                <Text className="text-sm text-primary font-mono">
                  {formatSize(exam.size_x, exam.size_y, exam.size_z)}
                </Text>
                {exam.hospital ? <Text className="mt-1 text-xs text-neutral-text">{exam.hospital}</Text> : null}
              </Card>
            </TimelineNode>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
