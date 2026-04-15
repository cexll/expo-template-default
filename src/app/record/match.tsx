import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { parseReportImageAssetsParam } from '@/lib/report-images';
import { saveMatchRecordAtomic } from '@/lib/db/save-match-record';
import { useLesions } from '@/hooks/useLesions';
import { useActiveProfile } from '@/providers/active-profile-provider';

type DiseaseType = Lesion['disease_type'];

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


export default function MatchPage() {
  const params = useLocalSearchParams<{
    recognizedData?: string;
    diseaseType?: string;
    images?: string;
    lesionId?: string;
    debugFail?: string;
  }>();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createNew, setCreateNew] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  const { activeProfileId } = useActiveProfile();

  const lesionIdParam = Array.isArray(params.lesionId) ? params.lesionId[0] : params.lesionId;
  const lockedLesionId = typeof lesionIdParam === 'string' && lesionIdParam ? lesionIdParam : null;

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

  const lockEligible = Boolean(lockedLesionId && candidateLesions.some((lesion) => lesion.id === lockedLesionId));
  const selectionLocked = lockEligible;

  useEffect(() => {
    if (!lockedLesionId) return;
    if (!candidateLesions.some((lesion) => lesion.id === lockedLesionId)) return;
    setSelectedId(lockedLesionId);
    setCreateNew(false);
  }, [candidateLesions, lockedLesionId]);

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
  const reportImages = useMemo(() => parseReportImageAssetsParam(imagesParam), [imagesParam]);
  const reportImageUris = useMemo(() => reportImages.map((img) => img.uri), [reportImages]);

  const matches = useMemo(() => {
    return scoreLesionMatch(location, sizeX, lesionMatchInputs);
  }, [lesionMatchInputs, location, sizeX]);

  const visibleMatches = useMemo(() => {
    if (!selectionLocked || !lockedLesionId) return matches;
    return matches.filter((match) => match.lesionId === lockedLesionId);
  }, [lockedLesionId, matches, selectionLocked]);

  // Auto-select if confidence >= 80%
  const topMatch = matches[0] ?? null;
  const autoMatch = topMatch && topMatch.confidence >= 80 ? topMatch : null;
  const effectiveSelected = selectionLocked
    ? lockedLesionId
    : selectedId || (!createNew && autoMatch ? autoMatch.lesionId : null);

  const selectedLabel = createNew
    ? '新建病灶'
    : candidateLesions.find((l) => l.id === effectiveSelected)?.label || '';

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
    setSaving(true);

    try {
      const debugFail = params.debugFail === 'report_images' || params.debugFail === 'reminder' ? params.debugFail : undefined;
      const result = await saveMatchRecordAtomic({
        activeProfileId,
        createNew,
        diseaseType,
        recognized,
        rawRecognizedJson: params.recognizedData,
        reportImages,
        selectedLesionId: effectiveSelected,
        debugFailStep: debugFail as any,
      });

      await queryClient.invalidateQueries({ queryKey: ['lesions'] });
      await queryClient.invalidateQueries({ queryKey: ['examinations'] });
      await queryClient.invalidateQueries({ queryKey: ['reminders'] });
      await queryClient.invalidateQueries({ queryKey: ['report_images'] });

      router.replace(`/lesion/${result.lesionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '入库失败，请重试');
    } finally {
      setSaving(false);
    }
  }, [
    activeProfileId,
    createNew,
    diseaseType,
    effectiveSelected,
    params.debugFail,
    params.recognizedData,
    queryClient,
    recognized,
    reportImages,
  ]);

  return (
    <SafeAreaView className="flex-1 bg-page-bg">
      <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
        <Text className="text-2xl font-bold text-primary mt-4 mb-2">匹配病灶</Text>
        <Text className="text-sm text-neutral-text mb-6">选择此次检查记录归属的病灶</Text>

        {selectionLocked ? (
          <Card className="mb-3">
            <Text className="text-sm font-semibold text-primary">新增记录</Text>
            <Text className="mt-1 text-xs text-neutral-text">
              本次检查将直接添加到当前病灶：{candidateLesions.find((l) => l.id === lockedLesionId)?.label || lockedLesionId}
            </Text>
          </Card>
        ) : null}

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

        {visibleMatches.map((match) => (
          <Pressable
            key={match.lesionId}
            disabled={selectionLocked && match.lesionId !== lockedLesionId}
            onPress={() => {
              if (selectionLocked) return;
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

        {!selectionLocked ? (
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
        ) : null}
      </ScrollView>

      <View className="px-4 py-4 bg-card border-t border-neutral-bg">
        <Text className="text-xs text-neutral-text mb-2">已选择: {selectedLabel || '请选择病灶'}</Text>
        {error ? <Text className="mb-2 text-xs text-new-text">{error}</Text> : null}
        <Button
          title={saving ? '入库中...' : '确认入库'}
          fullWidth
          disabled={
            (!effectiveSelected && !createNew) ||
            !activeProfileId ||
            saving
          }
          onPress={() => void save()}
        />
      </View>
    </SafeAreaView>
  );
}
