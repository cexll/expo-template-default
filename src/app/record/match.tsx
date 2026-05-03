import { useCallback, useEffect, useMemo, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { SecondaryPageHeader } from '@/components/SecondaryPageHeader';
import { buildLesionMatchSelection, scoreLesionMatch, scoreStoredLesionMatches } from '@/lib/db/matching';
import type { Lesion } from '@/lib/db/types';
import { listExaminationsByLesion } from '@/lib/db/queries/examinations';
import { parseReportImageAssetsParam } from '@/lib/report-images';
import { saveMatchRecordAtomic } from '@/lib/db/save-match-record';
import { applyReminderSideEffects } from '@/lib/reminder-side-effects';
import { useLesion, useLesions } from '@/hooks/useLesions';
import { useSubscriptionStatus } from '@/hooks/useSubscriptionStatus';
import { useActiveProfile } from '@/providers/active-profile-provider';
import { Image, Pressable, SafeAreaView, ScrollView, Text, View } from '@/tw';

type DiseaseType = Lesion['disease_type'];

const DISEASE_LABELS: Record<DiseaseType, string> = {
  thyroid: '甲状腺',
  breast: '乳腺',
  lung: '肺',
};

const DISEASE_SHORT_LABELS: Record<DiseaseType, string> = {
  thyroid: '甲',
  breast: '乳',
  lung: '肺',
};

const RADS_FIELD_BY_DISEASE: Record<DiseaseType, string> = {
  thyroid: 'tirads',
  breast: 'birads',
  lung: 'lung_rads',
};

const RADS_LABEL_BY_DISEASE: Record<DiseaseType, string> = {
  thyroid: 'TI-RADS',
  breast: 'BI-RADS',
  lung: 'Lung-RADS',
};

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

function textValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function radsValue(recognized: Record<string, unknown>, diseaseType: DiseaseType | null): string {
  if (!diseaseType) return '';
  return textValue(recognized[RADS_FIELD_BY_DISEASE[diseaseType]]);
}

function radsDisplay(value: string, diseaseType: DiseaseType | null): string {
  if (!value || !diseaseType) return '';
  return `${RADS_LABEL_BY_DISEASE[diseaseType]} ${value}${/级$/u.test(value) ? '' : '级'}`;
}

function formatMonth(value: unknown): string {
  const raw = textValue(value);
  if (!raw) return '未记录';
  return raw.slice(0, 7);
}

function lesionSide(location: string): string {
  if (location.includes('左')) return '左叶';
  if (location.includes('右')) return '右叶';
  return location || '未记录部位';
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
  const { data: subscriptionStatus, isLoading: subscriptionLoading } = useSubscriptionStatus();
  const effectiveProfileId = activeProfileId;

  const lesionIdParam = Array.isArray(params.lesionId) ? params.lesionId[0] : params.lesionId;
  const lockedLesionId = typeof lesionIdParam === 'string' && lesionIdParam ? lesionIdParam : null;

  const selectionLocked = Boolean(lockedLesionId);
  const { data: lockedLesion } = useLesion(lockedLesionId ?? '');
  const diseaseTypeParam = (params.diseaseType === 'thyroid' ||
  params.diseaseType === 'breast' ||
  params.diseaseType === 'lung'
    ? params.diseaseType
    : null) as DiseaseType | null;
  const diseaseType: DiseaseType | null = selectionLocked
    ? ((lockedLesion?.disease_type as DiseaseType | undefined) ?? diseaseTypeParam)
    : diseaseTypeParam;

  const { data: storedLesions = [] } = useLesions(effectiveProfileId);
  const lesions = storedLesions;
  const lockedLesionFromList = useMemo(() => {
    if (!selectionLocked || !lockedLesionId) return null;
    return lesions.find((lesion) => lesion.id === lockedLesionId) ?? null;
  }, [lesions, lockedLesionId, selectionLocked]);
  const lockedLesionForDisplay = lockedLesion ?? lockedLesionFromList;

  const candidateLesions = useMemo(() => {
    if (selectionLocked) {
      return lockedLesionForDisplay ? [lockedLesionForDisplay] : [];
    }
    if (!diseaseType) return lesions.filter((lesion) => lesion.is_archived === 0);
    return lesions.filter((lesion) => lesion.is_archived === 0 && lesion.disease_type === diseaseType);
  }, [diseaseType, lesions, lockedLesionForDisplay, selectionLocked]);

  useEffect(() => {
    if (!selectionLocked) return;
    if (!lockedLesionId) return;
    setSelectedId(lockedLesionId);
    setCreateNew(false);
  }, [lockedLesionId, selectionLocked]);

  const examinationResults = useQueries({
    queries: candidateLesions.map((lesion) => ({
      queryKey: ['examinations', 'lesion', lesion.id],
      queryFn: () => listExaminationsByLesion(lesion.id),
      enabled: Boolean(lesion.id),
    })),
  });

  const allCandidateExaminations = useMemo(() => {
    return candidateLesions.flatMap((lesion, index) =>
      (examinationResults[index]?.data ?? []).map((exam, examIndex) => ({
        ...exam,
        id: exam.id ?? `${lesion.id}-exam-${examIndex}`,
        lesion_id: exam.lesion_id ?? lesion.id,
        hospital: exam.hospital ?? null,
        size_y: exam.size_y ?? null,
        size_z: exam.size_z ?? null,
        tirads: exam.tirads ?? null,
        echo_type: exam.echo_type ?? null,
        border: exam.border ?? null,
        calcification: exam.calcification ?? null,
        blood_flow: exam.blood_flow ?? null,
        birads: exam.birads ?? null,
        shape: exam.shape ?? null,
        orientation: exam.orientation ?? null,
        lung_rads: exam.lung_rads ?? null,
        density: exam.density ?? null,
        morphology: exam.morphology ?? null,
        pleural_pull: exam.pleural_pull ?? null,
        ai_raw_json: exam.ai_raw_json ?? null,
        notes: exam.notes ?? null,
        created_at: exam.created_at ?? exam.exam_date ?? '',
        updated_at: exam.updated_at ?? exam.exam_date ?? '',
      }))
    );
  }, [candidateLesions, examinationResults]);

  const lesionMatchInputs = useMemo(() => {
    return candidateLesions.map((lesion, index) => ({
      id: lesion.id,
      label: lesion.label,
      location: lesion.location,
      latestSizeX: examinationResults[index]?.data?.[0]?.size_x ?? null,
    }));
  }, [candidateLesions, examinationResults]);

  const latestExamByLesionId = useMemo(() => {
    const map = new Map<string, any>();
    candidateLesions.forEach((lesion, index) => {
      map.set(lesion.id, examinationResults[index]?.data?.[0] ?? null);
    });
    return map;
  }, [candidateLesions, examinationResults]);

  const examCountByLesionId = useMemo(() => {
    const map = new Map<string, number>();
    candidateLesions.forEach((lesion, index) => {
      map.set(lesion.id, examinationResults[index]?.data?.length ?? 0);
    });
    return map;
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
  const currentRads = radsValue(recognized, diseaseType);
  const currentRadsDisplay = radsDisplay(currentRads, diseaseType);
  const diseaseLabel = diseaseType ? DISEASE_LABELS[diseaseType] : '结节';
  const diseaseShortLabel = diseaseType ? DISEASE_SHORT_LABELS[diseaseType] : '结';
  const recognizedTags = [
    sizeX !== null ? `${sizeX}mm` : '',
    textValue(recognized.echo_type) || textValue(recognized.density),
    textValue(recognized.border) || textValue(recognized.morphology),
  ].filter(Boolean);

  const imagesParam = Array.isArray(params.images) ? params.images[0] : params.images;
  const reportImages = useMemo(() => parseReportImageAssetsParam(imagesParam), [imagesParam]);
  const reportImageUris = useMemo(() => reportImages.map((img) => img.uri), [reportImages]);

  const matches = useMemo(() => {
    if (diseaseType) {
      return scoreStoredLesionMatches(
        { diseaseType, location, sizeX, rads: currentRads },
        candidateLesions as Lesion[],
        allCandidateExaminations
      );
    }
    return scoreLesionMatch(location, sizeX, lesionMatchInputs);
  }, [allCandidateExaminations, candidateLesions, currentRads, diseaseType, lesionMatchInputs, location, sizeX]);

  const matchSelection = useMemo(() => buildLesionMatchSelection(matches), [matches]);
  const autoMatch = matches.find((match) => match.lesionId === matchSelection.autoSelectedLesionId) ?? null;
  const effectiveSelected = selectionLocked ? lockedLesionId : selectedId || (!createNew ? matchSelection.autoSelectedLesionId : null);

  const lockedLabel = lockedLesionForDisplay?.label ?? (lockedLesionId || '');
  const selectedLabel = createNew ? '新建病灶' : selectionLocked ? lockedLabel : candidateLesions.find((l) => l.id === effectiveSelected)?.label || '';
  const recognizeFallback = {
    pathname: '/record/recognize' as const,
    params: {
      images: imagesParam,
      diseaseType: diseaseType ?? undefined,
      ...(lockedLesionId ? { lesionId: lockedLesionId } : {}),
    },
  };

  const save = useCallback(async () => {
    if (!effectiveProfileId) {
      setError('请先创建档案');
      return;
    }

    if (!effectiveSelected && !createNew) {
      setError('请选择病灶');
      return;
    }
    if (subscriptionLoading || !subscriptionStatus) {
      setError('权益状态加载中，请稍后再试');
      return;
    }

    setError('');
    setSaving(true);

    try {
      const debugFail = params.debugFail === 'report_images' || params.debugFail === 'reminder' ? params.debugFail : undefined;
      const result = await saveMatchRecordAtomic({
        activeProfileId: effectiveProfileId,
        createNew,
        diseaseType,
        recognized,
        rawRecognizedJson: params.recognizedData,
        reportImages,
        selectedLesionId: effectiveSelected,
        subscriptionStatus,
        debugFailStep: debugFail as any,
      });

      await queryClient.invalidateQueries({ queryKey: ['lesions'] });
      await queryClient.invalidateQueries({ queryKey: ['examinations'] });
      await queryClient.invalidateQueries({ queryKey: ['reminders'] });
      await queryClient.invalidateQueries({ queryKey: ['report_images'] });

      const shouldSideEffect = typeof recognized.exam_date === 'string' && recognized.exam_date.trim() !== '';
      if (shouldSideEffect) {
        try {
          const effects = await applyReminderSideEffects();
          if (!effects.sync.ok && /未登录/.test(effects.sync.error)) {
            router.replace(`/lesion/${result.lesionId}`);
            return;
          }
          const sync = effects.sync.ok ? 'ok' : 'fail';
          const perm = effects.notification.supported ? effects.notification.permission : 'unsupported';
          router.replace(
            `/lesion/${result.lesionId}?reminderSync=${encodeURIComponent(sync)}&reminderPerm=${encodeURIComponent(perm)}`
          );
          return;
        } catch {
          // Local reminder state remains the source of truth; never block navigation on sync failures.
        }
      }

      router.replace(`/lesion/${result.lesionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '入库失败，请重试');
    } finally {
      setSaving(false);
    }
  }, [
    createNew,
    diseaseType,
    effectiveProfileId,
    effectiveSelected,
    params.debugFail,
    params.recognizedData,
    queryClient,
    recognized,
    reportImages,
    subscriptionLoading,
    subscriptionStatus,
  ]);

  return (
    <SafeAreaView className="flex-1 bg-page-bg">
      <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
        <SecondaryPageHeader
          title="匹配病灶"
          fallbackHref={recognizeFallback}
          rightSlot={<Text className="text-xs font-medium text-neutral-text">步骤 3/3</Text>}
        />
        <View className="mb-4 mt-4 rounded-2xl bg-card p-4">
          <Text className="mb-3 text-xs font-semibold text-neutral-text">本次识别结果</Text>
          <View className="flex-row items-center gap-3">
            <View className="h-10 w-10 items-center justify-center rounded-full bg-primary">
              <Text className="text-base font-semibold text-white">{diseaseShortLabel}</Text>
            </View>
            <View className="flex-1">
              <Text className="text-sm font-semibold text-primary">{diseaseLabel}结节</Text>
              <Text className="mt-1 text-xs text-neutral-text">
                {location || '未记录部位'}{currentRadsDisplay ? ` · ${currentRadsDisplay}` : ''}
              </Text>
              {recognizedTags.length > 0 ? (
                <View className="mt-2 flex-row flex-wrap gap-2">
                  {recognizedTags.map((tag) => (
                    <View key={tag} className="rounded-full bg-neutral-bg px-3 py-1">
                      <Text className="text-xs text-primary">{tag}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          </View>
        </View>

        {selectionLocked ? (
          <Card className="mb-3">
            <Text className="text-sm font-semibold text-primary">新增记录</Text>
            <Text className="mt-1 text-xs text-neutral-text">
              本次检查将直接添加到当前病灶：{lockedLabel || lockedLesionId}
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

        {!effectiveProfileId ? (
          <Card className="mb-3">
            <Text className="text-sm font-semibold text-primary">暂无档案</Text>
            <Text className="mt-1 text-xs text-neutral-text">请先创建档案后再入库检查记录</Text>
          </Card>
        ) : null}

        {matches.length > 0 && !selectionLocked ? (
          <>
            <Text className="mb-1 text-sm font-semibold text-primary">AI 建议匹配</Text>
            <Text className="mb-2 text-[11px] text-neutral-text">根据部位和大小自动匹配，请确认</Text>
          </>
        ) : null}

        {matches.map((match, index) => {
          const latestExam = latestExamByLesionId.get(match.lesionId);
          const selected = effectiveSelected === match.lesionId;
          const recommended = autoMatch && match.lesionId === autoMatch.lesionId;
          const candidate = candidateLesions.find((lesion) => lesion.id === match.lesionId);
          return (
            <View key={match.lesionId}>
              {index === 1 ? (
                <View className="mb-3 mt-1 flex-row items-center gap-2">
                  <View className="h-px flex-1 bg-neutral-bg" />
                  <Text className="text-xs text-neutral-text">或选择其他已有病灶</Text>
                  <View className="h-px flex-1 bg-neutral-bg" />
                </View>
              ) : null}
              <Pressable
                disabled={selectionLocked}
                onPress={() => {
                  if (selectionLocked) return;
                  setSelectedId(match.lesionId);
                  setCreateNew(false);
                }}
              >
                <Card className={`mb-3 ${selected ? 'border-2 border-primary' : ''}`}>
                  <View className="mb-3 flex-row items-center justify-between">
                    <View className="flex-1">
                      <Text className="text-sm font-semibold text-primary">{match.lesionLabel}</Text>
                      <Text className="mt-1 text-xs text-neutral-text">
                        {diseaseLabel} · {lesionSide(candidate?.location ?? '')}{recommended ? ` · 已有${examCountByLesionId.get(match.lesionId) ?? 0}次记录` : ''}
                      </Text>
                    </View>
                    <View className="flex-row items-center gap-2">
                      {recommended ? <Badge text="AI推荐" variant="stable" /> : null}
                      <View className={`h-5 w-5 items-center justify-center rounded-full border ${selected ? 'border-primary' : 'border-neutral-bg'}`}>
                        {selected ? <View className="h-2.5 w-2.5 rounded-full bg-primary" /> : null}
                      </View>
                    </View>
                  </View>
                  <View className="mb-3 flex-row rounded-xl bg-page-bg py-3">
                    <View className="flex-1 px-2">
                      <Text className="text-sm font-semibold text-primary">{latestExam?.size_x ? `${latestExam.size_x}mm` : '未记录'}</Text>
                      <Text className="mt-1 text-[10px] text-neutral-text">上次大小</Text>
                    </View>
                    <View className="flex-1 border-l border-neutral-bg px-2">
                      <Text className="text-sm font-semibold text-primary">
                        {radsDisplay(textValue(latestExam?.tirads ?? latestExam?.birads ?? latestExam?.lung_rads), diseaseType)}
                      </Text>
                      <Text className="mt-1 text-[10px] text-neutral-text">上次分级</Text>
                    </View>
                    <View className="flex-1 border-l border-neutral-bg px-2">
                      <Text className="text-sm font-semibold text-primary">{formatMonth(latestExam?.exam_date)}</Text>
                      <Text className="mt-1 text-[10px] text-neutral-text">上次检查</Text>
                    </View>
                  </View>
                  {recommended ? (
                    <View className="flex-row items-center gap-2">
                      <Text className="text-xs text-neutral-text">匹配置信度</Text>
                      <View className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-bg">
                        <View className="h-2 rounded-full bg-stable-text" style={{ width: `${match.confidence}%` }} />
                      </View>
                      <Text className="text-xs font-semibold text-stable-text">{match.confidence}%</Text>
                    </View>
                  ) : null}
                </Card>
              </Pressable>
            </View>
          );
        })}

        {!selectionLocked ? (
          <>
            <View className="mb-3 mt-1 flex-row items-center gap-2">
              <View className="h-px flex-1 bg-neutral-bg" />
              <Text className="text-xs text-neutral-text">或</Text>
              <View className="h-px flex-1 bg-neutral-bg" />
            </View>
            <Pressable
              onPress={() => {
                setCreateNew(true);
                setSelectedId(null);
              }}
            >
              <Card className={`mb-3 ${createNew ? 'border-2 border-primary' : ''}`}>
                <View className="flex-row items-center">
                  <View className="mr-3 h-9 w-9 items-center justify-center rounded-full bg-neutral-bg">
                    <Text className="text-xl text-primary">+</Text>
                  </View>
                  <View>
                    <Text className="text-sm font-semibold text-primary">新建病灶</Text>
                    <Text className="mt-1 text-xs text-neutral-text">这是一个新发现的结节</Text>
                  </View>
                </View>
              </Card>
            </Pressable>
          </>
        ) : null}
      </ScrollView>

      <View className="px-4 py-4 bg-card border-t border-neutral-bg">
        <View className="mb-2 flex-row items-center">
          <View className="mr-2 h-2 w-2 rounded-full bg-primary" />
          <Text className="text-xs text-primary">已选择：{selectedLabel || '请选择病灶'}</Text>
        </View>
        {error ? <Text className="mb-2 text-xs text-new-text">{error}</Text> : null}
        <Button
          title={saving ? '入库中...' : subscriptionLoading ? '权益加载中...' : '确认匹配，完成录入'}
          fullWidth
          disabled={
            (!effectiveSelected && !createNew) ||
            !effectiveProfileId ||
            saving ||
            subscriptionLoading
          }
          onPress={() => void save()}
        />
      </View>
    </SafeAreaView>
  );
}
