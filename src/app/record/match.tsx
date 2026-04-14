import { useCallback, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { scoreLesionMatch } from '@/lib/db/matching';
import type { Lesion } from '@/lib/db/types';
import { listExaminationsByLesion } from '@/lib/db/queries/examinations';
import { createReportImage } from '@/lib/db/queries/report-images';
import { listRemindersByLesion, updateReminder } from '@/lib/db/queries/reminders';
import { persistReportImageUris } from '@/lib/report-image-storage';
import { useCreateExamination } from '@/hooks/useExaminations';
import { useCreateLesion, useLesions } from '@/hooks/useLesions';
import { useCreateReminder } from '@/hooks/useReminders';
import { useActiveProfile } from '@/providers/active-profile-provider';

type DiseaseType = Lesion['disease_type'];

function makeId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function parseNumber(value: unknown) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const num = Number(trimmed);
    return Number.isFinite(num) ? num : null;
  }
  return null;
}

function parseImageUris(value: unknown): string[] {
  const v = Array.isArray(value) ? value[0] : value;
  if (typeof v !== 'string' || !v.trim()) return [];
  try {
    const parsed = JSON.parse(v) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((uri): uri is string => typeof uri === 'string' && uri.trim() !== '').slice(0, 5);
  } catch {
    return [];
  }
}

function formatExamDate(value: unknown) {
  if (typeof value === 'string' && value.trim()) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString().slice(0, 10);
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return value;
    }
  }

  const today = new Date();
  return today.toISOString().slice(0, 10);
}

function addDays(isoDate: string, days: number) {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

const DISEASE_LABELS: Record<DiseaseType, string> = {
  thyroid: '甲状腺',
  breast: '乳腺',
  lung: '肺部',
};

export function buildExaminationInput(args: {
  id: string;
  lesionId: string;
  recognized: Record<string, unknown>;
  rawRecognizedJson: string | undefined;
}) {
  const examDate = formatExamDate(args.recognized.exam_date);

  return {
    id: args.id,
    lesion_id: args.lesionId,
    exam_date: examDate,
    hospital: typeof args.recognized.hospital === 'string' && args.recognized.hospital.trim()
      ? args.recognized.hospital.trim()
      : null,
    size_x: parseNumber(args.recognized.size_x),
    size_y: parseNumber(args.recognized.size_y),
    size_z: parseNumber(args.recognized.size_z),
    tirads: typeof args.recognized.tirads === 'string' && args.recognized.tirads.trim()
      ? args.recognized.tirads.trim()
      : null,
    echo_type: typeof args.recognized.echo_type === 'string' && args.recognized.echo_type.trim()
      ? args.recognized.echo_type.trim()
      : null,
    border: typeof args.recognized.border === 'string' && args.recognized.border.trim()
      ? args.recognized.border.trim()
      : null,
    calcification:
      typeof args.recognized.calcification === 'string' && args.recognized.calcification.trim()
        ? args.recognized.calcification.trim()
        : null,
    blood_flow: typeof args.recognized.blood_flow === 'string' && args.recognized.blood_flow.trim()
      ? args.recognized.blood_flow.trim()
      : null,
    birads: typeof args.recognized.birads === 'string' && args.recognized.birads.trim()
      ? args.recognized.birads.trim()
      : null,
    shape: typeof args.recognized.shape === 'string' && args.recognized.shape.trim()
      ? args.recognized.shape.trim()
      : null,
    orientation: typeof args.recognized.orientation === 'string' && args.recognized.orientation.trim()
      ? args.recognized.orientation.trim()
      : null,
    lung_rads: typeof args.recognized.lung_rads === 'string' && args.recognized.lung_rads.trim()
      ? args.recognized.lung_rads.trim()
      : null,
    density: typeof args.recognized.density === 'string' && args.recognized.density.trim()
      ? args.recognized.density.trim()
      : null,
    morphology: typeof args.recognized.morphology === 'string' && args.recognized.morphology.trim()
      ? args.recognized.morphology.trim()
      : null,
    pleural_pull: parseNumber(args.recognized.pleural_pull),
    ai_raw_json: args.rawRecognizedJson ?? null,
    notes: typeof args.recognized.notes === 'string' && args.recognized.notes.trim()
      ? args.recognized.notes.trim()
      : null,
  };
}

export default function MatchPage() {
  const params = useLocalSearchParams<{ recognizedData?: string; diseaseType?: string; images?: string }>();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createNew, setCreateNew] = useState(false);
  const [error, setError] = useState('');
  const queryClient = useQueryClient();

  const { activeProfileId } = useActiveProfile();

  const diseaseType = (params.diseaseType === 'thyroid' ||
  params.diseaseType === 'breast' ||
  params.diseaseType === 'lung'
    ? params.diseaseType
    : null) as DiseaseType | null;

  const { data: lesions = [] } = useLesions(activeProfileId);
  const candidateLesions = useMemo(() => {
    if (!diseaseType) return lesions.filter((lesion) => lesion.is_archived === 0);
    return lesions.filter((lesion) => lesion.is_archived === 0 && lesion.disease_type === diseaseType);
  }, [diseaseType, lesions]);

  const examinationResults = useQueries({
    queries: candidateLesions.map((lesion) => ({
      queryKey: ['examinations', 'lesion', lesion.id],
      queryFn: () => listExaminationsByLesion(lesion.id),
      enabled: Boolean(lesion.id),
    })),
  });

  const lesionMatchInputs = useMemo(() => {
    return candidateLesions.map((lesion, index) => ({
      id: lesion.id,
      label: lesion.label,
      location: lesion.location,
      latestSizeX: examinationResults[index]?.data?.[0]?.size_x ?? null,
    }));
  }, [candidateLesions, examinationResults]);

  const recognized: Record<string, unknown> = useMemo(() => {
    if (!params.recognizedData) return {};
    try {
      return JSON.parse(params.recognizedData) as Record<string, unknown>;
    } catch {
      return {};
    }
  }, [params.recognizedData]);

  const location = typeof recognized.location === 'string' ? recognized.location : '';
  const sizeX = parseNumber(recognized.size_x);

  const imagesParam = Array.isArray(params.images) ? params.images[0] : params.images;
  const reportImageUris = useMemo(() => parseImageUris(imagesParam), [imagesParam]);

  const matches = useMemo(() => {
    return scoreLesionMatch(location, sizeX, lesionMatchInputs);
  }, [lesionMatchInputs, location, sizeX]);

  // Auto-select if confidence >= 80%
  const topMatch = matches[0] ?? null;
  const autoMatch = topMatch && topMatch.confidence >= 80 ? topMatch : null;
  const effectiveSelected = selectedId || (!createNew && autoMatch ? autoMatch.lesionId : null);

  const selectedLabel = createNew
    ? '新建病灶'
    : candidateLesions.find((l) => l.id === effectiveSelected)?.label || '';

  const createLesion = useCreateLesion();
  const createExamination = useCreateExamination();
  const createReminder = useCreateReminder();

  const save = useCallback(async () => {
    if (!activeProfileId) {
      setError('请先创建档案');
      return;
    }

    if (!effectiveSelected && !createNew) {
      setError('请选择病灶');
      return;
    }

    setError('');

    const shouldCreateReminder =
      typeof recognized.exam_date === 'string' && recognized.exam_date.trim() !== '';

    try {
      let lesionId = effectiveSelected ?? '';

      if (createNew) {
        const nextDiseaseType = diseaseType ?? 'thyroid';
        const lesionLocation = typeof recognized.location === 'string' && recognized.location.trim()
          ? recognized.location.trim()
          : '未知部位';
        const lesionLabel = `${DISEASE_LABELS[nextDiseaseType]}${lesionLocation}结节`;

        const lesion = await createLesion.mutateAsync({
          id: makeId('lesion'),
          profile_id: activeProfileId,
          disease_type: nextDiseaseType,
          label: lesionLabel,
          location: lesionLocation,
          is_archived: 0,
        });

        if (!lesion) {
          throw new Error('创建病灶失败');
        }

        lesionId = lesion.id;
      }

      const examinationId = makeId('exam');
      const examination = await createExamination.mutateAsync(
        buildExaminationInput({
          id: examinationId,
          lesionId,
          recognized,
          rawRecognizedJson: params.recognizedData,
        })
      );

      if (!examination) {
        throw new Error('创建检查记录失败');
      }

      if (reportImageUris.length > 0) {
        const persistedUris = await persistReportImageUris(reportImageUris, examinationId);
        await Promise.all(
          persistedUris.map((uri, idx) =>
            createReportImage({
              id: makeId('report'),
              examination_id: examinationId,
              uri,
              sort_order: idx,
            })
          )
        );
      }

      if (shouldCreateReminder) {
        const nextExamDate = addDays(examination.exam_date, 180);
        if (nextExamDate) {
          const reminders = await listRemindersByLesion(lesionId);
          const activeReminder = reminders.find((reminder) => reminder.is_active === 1);

          if (activeReminder) {
            await updateReminder(activeReminder.id, {
              next_exam_date: nextExamDate,
              source: 'auto',
              is_active: 1,
            });
            await queryClient.invalidateQueries({ queryKey: ['reminders'] });
          } else {
            await createReminder.mutateAsync({
              id: makeId('reminder'),
              lesion_id: lesionId,
              next_exam_date: nextExamDate,
              source: 'auto',
              is_active: 1,
            });
          }
        }
      }

      router.replace(`/lesion/${lesionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '入库失败，请重试');
    }
  }, [
    activeProfileId,
    createExamination,
    createLesion,
    createNew,
    createReminder,
    diseaseType,
    effectiveSelected,
    params.recognizedData,
    queryClient,
    recognized,
    reportImageUris,
  ]);

  return (
    <SafeAreaView className="flex-1 bg-page-bg">
      <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
        <Text className="text-2xl font-bold text-primary mt-4 mb-2">匹配病灶</Text>
        <Text className="text-sm text-neutral-text mb-6">选择此次检查记录归属的病灶</Text>

        {reportImageUris.length > 0 ? (
          <View className="mb-4">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-4 px-4">
              {reportImageUris.map((uri, idx) => (
                <View key={`${uri}-${idx}`} className="mr-3">
                  <Image
                    source={{ uri }}
                    accessibilityLabel={`报告图片预览${idx + 1}`}
                    className="h-20 w-20 rounded-xl bg-neutral-bg"
                  />
                </View>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {!activeProfileId ? (
          <Card className="mb-3">
            <Text className="text-sm font-semibold text-primary">暂无档案</Text>
            <Text className="mt-1 text-xs text-neutral-text">请先创建档案后再入库检查记录</Text>
          </Card>
        ) : null}

        {matches.map((match) => (
          <Pressable
            key={match.lesionId}
            onPress={() => {
              setSelectedId(match.lesionId);
              setCreateNew(false);
            }}
          >
            <Card className={`mb-3 ${effectiveSelected === match.lesionId ? 'border-2 border-primary' : ''}`}>
              <View className="flex-row items-center justify-between">
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-primary">{match.lesionLabel}</Text>
                  {autoMatch && match.lesionId === autoMatch.lesionId && (
                    <Text className="text-xs text-stable-text mt-1">AI推荐匹配</Text>
                  )}
                </View>
                <Badge
                  text={`${match.confidence}%`}
                  variant={match.confidence >= 80 ? 'stable' : match.confidence > 0 ? 'increase' : 'neutral'}
                />
              </View>
            </Card>
          </Pressable>
        ))}

        <Pressable
          onPress={() => {
            setCreateNew(true);
            setSelectedId(null);
          }}
        >
          <Card className={`mb-3 ${createNew ? 'border-2 border-primary' : ''}`}>
            <View className="flex-row items-center">
              <Text className="text-xl mr-3">+</Text>
              <Text className="text-sm font-semibold text-primary">新建病灶</Text>
            </View>
          </Card>
        </Pressable>
      </ScrollView>

      <View className="px-4 py-4 bg-card border-t border-neutral-bg">
        <Text className="text-xs text-neutral-text mb-2">已选择: {selectedLabel || '请选择病灶'}</Text>
        {error ? <Text className="mb-2 text-xs text-new-text">{error}</Text> : null}
        <Button
          title={createLesion.isPending || createExamination.isPending ? '入库中...' : '确认入库'}
          fullWidth
          disabled={
            (!effectiveSelected && !createNew) ||
            !activeProfileId ||
            createLesion.isPending ||
            createExamination.isPending ||
            createReminder.isPending
          }
          onPress={() => void save()}
        />
      </View>
    </SafeAreaView>
  );
}
