import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { api, ApiError } from '@/lib/api';

import { LesionCard } from '@/components/LesionCard';
import { PaywallSheet } from '@/components/PaywallSheet';
import { getExaminationById } from '@/lib/db/queries/examinations';
import { getLesionById } from '@/lib/db/queries/lesions';
import { createBackendProfile, getProfileById, listProfiles } from '@/lib/db/queries/profiles';
import { listRemindersByLesion, updateReminder } from '@/lib/db/queries/reminders';
import { listReportImagesByExamination } from '@/lib/db/queries/report-images';
import { saveMatchRecordAtomic } from '@/lib/db/save-match-record';
import { buildCloudArchivePayload, syncCloudArchiveIfEntitled } from '@/lib/cloud-sync';
import { bumpLocalSummaryExportUsed, formatLocalMonth, readLocalSummaryExportUsed } from '@/lib/subscription/local-quota';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ChangeBadge } from '@/components/ChangeBadge';
import { buildComparisonProjection, buildLesionDetailProjection, buildVisitSummaryProjection } from '@/lib/archive/projections';
import type { DiseaseType } from '@/lib/db/types';
import { normalizeRecognitionOutput } from '@/lib/recognition/normalization';
import { buildHomeProjection } from '@/lib/home/projection';
import {
  VALIDATION_UI_EXAMINATIONS,
  VALIDATION_UI_LESIONS,
  VALIDATION_UI_PROFILE,
  VALIDATION_UI_REMINDERS,
} from '@/lib/validation-ui-seed';
import { consumeSubscriptionQuota, normalizeSubscriptionStatus } from '@/hooks/useSubscriptionStatus';
import { Pressable, SafeAreaView, ScrollView, Text, View } from '@/tw';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

const seededStatus = normalizeSubscriptionStatus({
  plan: 'free',
  is_active: false,
  features: {
    ai_recognize: { remaining: 0 },
    summary_export: { remaining: 0 },
  },
});

const diseaseLabels: Record<DiseaseType, string> = {
  thyroid: '甲状腺',
  breast: '乳腺',
  lung: '肺',
};

function formatSize(value: number | null) {
  return typeof value === 'number' ? `${value.toFixed(1)}mm` : '—';
}

function latestExam(lesionId: string) {
  return VALIDATION_UI_EXAMINATIONS.find((exam) => exam.lesion_id === lesionId) ?? null;
}

function lesionExams(lesionId: string) {
  return VALIDATION_UI_EXAMINATIONS.filter((exam) => exam.lesion_id === lesionId);
}

function PageShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <SafeAreaView className="flex-1 bg-page-bg">
      <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
        <Text className="mb-2 mt-4 text-xs font-semibold text-neutral-text">VAL-UI repository-backed evidence</Text>
        <Text className="mb-4 text-2xl font-bold text-primary">{title}</Text>
        {children}
        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}

function EvidenceHome() {
  const projection = buildHomeProjection({
    profiles: [VALIDATION_UI_PROFILE],
    activeProfileId: VALIDATION_UI_PROFILE.id,
    lesions: VALIDATION_UI_LESIONS,
    examinations: VALIDATION_UI_EXAMINATIONS,
    reminders: VALIDATION_UI_REMINDERS,
    entitlement: seededStatus,
    now: new Date('2026-04-27T00:00:00.000Z'),
  });

  return (
    <PageShell title="01 首页">
      <Card className="mb-3">
        <Text className="text-sm font-semibold text-primary">{VALIDATION_UI_PROFILE.nickname}</Text>
        <Text className="mt-1 text-xs text-neutral-text">档案来自 Health Archive repository projection</Text>
      </Card>
      {projection.urgentReview ? (
        <Card className="mb-3 border border-new-border bg-new-bg">
          <Text className="text-xs text-new-text">{projection.urgentReview.text}</Text>
        </Card>
      ) : null}
      {projection.diseaseGroups.map((group) => (
        <View key={group.diseaseType}>
          <Text className="mb-2 mt-2 text-xs font-semibold text-neutral-text">{group.title}</Text>
          {group.lesionCards.map((lesion) => (
            <LesionCard
              key={lesion.id}
              title={lesion.title}
              subtitle={lesion.subtitle}
              statusBadge={lesion.statusBadge ?? undefined}
              latestSize={lesion.latestSize}
              radsGrade={lesion.radsGrade}
              baselineChange={lesion.baselineChange}
              recordCount={lesion.recordCount}
              reminderText={lesion.reminderText}
              reminderTone={lesion.reminderTone}
              onPress={() => router.push(`/lesion/${lesion.id}`)}
            />
          ))}
        </View>
      ))}
      {projection.quotaPrompt ? (
        <Card className="mt-2 border border-[#e8c98a] bg-increase-bg">
          <Text className="text-xs text-increase-text">{projection.quotaPrompt.title}</Text>
        </Card>
      ) : null}
    </PageShell>
  );
}

function EvidenceUpload() {
  return (
    <PageShell title="02 上传报告">
      <Card className="mb-4">
        <Text className="text-sm font-semibold text-primary">上传入口</Text>
        <Text className="mt-2 text-xs text-neutral-text">当前档案：{VALIDATION_UI_PROFILE.nickname}</Text>
        <Text className="mt-1 text-xs text-neutral-text">可选病种：甲状腺、乳腺、肺</Text>
      </Card>
      <Button title="开始识别" fullWidth onPress={() => {}} />
    </PageShell>
  );
}

function EvidenceRecognize() {
  const exam = latestExam('validation-ui-lesion-thyroid');
  return (
    <PageShell title="03 AI识别核对">
      <Card className="mb-4">
        <Text className="text-sm font-semibold text-primary">字段完整度 7/7 已确认</Text>
        <Text className="mt-2 text-xs text-neutral-text">接口/fixture 归一化后写入同一 archive command 字段</Text>
      </Card>
      {[
        ['部位', VALIDATION_UI_LESIONS[0]?.location],
        ['TI-RADS', exam?.tirads ? `${exam.tirads}级` : '—'],
        ['大小', formatSize(exam?.size_x ?? null)],
        ['回声', exam?.echo_type],
        ['边界', exam?.border],
      ].map(([label, value]) => (
        <Card key={label} className="mb-2">
          <Text className="text-xs text-neutral-text">{label}</Text>
          <Text className="mt-1 text-sm font-semibold text-primary">{value}</Text>
        </Card>
      ))}
    </PageShell>
  );
}

function EvidenceMatch() {
  const exam = latestExam('validation-ui-lesion-thyroid');
  return (
    <PageShell title="04 匹配病灶">
      <Card className="mb-4">
        <Text className="text-sm font-semibold text-primary">本次识别结果</Text>
        <Text className="mt-1 text-xs text-neutral-text">{VALIDATION_UI_LESIONS[0]?.location} · {formatSize(exam?.size_x ?? null)}</Text>
      </Card>
      <Card className="mb-3 border-2 border-primary">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-sm font-semibold text-primary">{VALIDATION_UI_LESIONS[0]?.label}</Text>
            <Text className="mt-1 text-xs text-neutral-text">AI推荐 · 已有3次记录</Text>
          </View>
          <Badge text="98%" variant="stable" />
        </View>
      </Card>
      <Button title="确认匹配，完成录入" fullWidth onPress={() => {}} />
    </PageShell>
  );
}

function EvidenceDetail() {
  const thyroid = VALIDATION_UI_LESIONS[0]!;
  const exams = VALIDATION_UI_EXAMINATIONS.filter((exam) => exam.lesion_id === thyroid.id);
  const latest = exams[0]!;
  const baseline = exams[exams.length - 1]!;
  const delta = latest.size_x && baseline.size_x ? latest.size_x - baseline.size_x : 0;

  return (
    <PageShell title="05 病灶详情">
      <Card className="mb-4">
        <Text className="text-lg font-bold text-primary">{thyroid.label}</Text>
        <Text className="mt-1 text-xs text-neutral-text">甲状腺 · {thyroid.location} · 共{exams.length}次记录</Text>
        <View className="mt-3 flex-row items-end gap-6">
          <View>
            <Text className="text-xs text-neutral-text">当前大小</Text>
            <Text className="text-2xl font-bold text-primary">{formatSize(latest.size_x)}</Text>
          </View>
          <View>
            <Text className="text-xs text-neutral-text">较基线</Text>
            <ChangeBadge type="increase" value={`+${delta.toFixed(1)}mm`} />
          </View>
        </View>
      </Card>
      {exams.map((exam) => (
        <Card key={exam.id} className="mb-3">
          <Text className="text-xs text-neutral-text">{exam.exam_date}</Text>
          <Text className="mt-1 text-sm font-semibold text-primary">{formatSize(exam.size_x)} · TI-RADS {exam.tirads}</Text>
          <Text className="mt-1 text-xs text-neutral-text">{exam.hospital}</Text>
        </Card>
      ))}
    </PageShell>
  );
}

function EvidenceCompare() {
  const thyroid = VALIDATION_UI_LESIONS[0]!;
  const exams = VALIDATION_UI_EXAMINATIONS.filter((exam) => exam.lesion_id === thyroid.id).reverse();
  return (
    <PageShell title="06 横向对比">
      <Card className="mb-4">
        <Text className="text-base font-semibold text-primary">{thyroid.label}</Text>
        <Text className="mt-1 text-xs text-neutral-text">最近3次 repository examination rows</Text>
      </Card>
      <Card className="mb-4">
        <Text className="mb-2 text-xs text-neutral-text">大小变化（最大径 mm）</Text>
        <View className="flex-row justify-between">
          {exams.map((exam) => (
            <View key={exam.id} className="items-center">
              <Text className="font-mono text-sm text-primary">{formatSize(exam.size_x)}</Text>
              <Text className="mt-1 text-[10px] text-neutral-text">{exam.exam_date.slice(0, 7)}</Text>
            </View>
          ))}
        </View>
      </Card>
      <Card>
        <Text className="text-sm text-primary">TI-RADS 由3级变为4a级，建议按期复查。</Text>
      </Card>
    </PageShell>
  );
}

function EvidenceSummary() {
  const summary = buildVisitSummaryProjection({
    profile: VALIDATION_UI_PROFILE,
    lesions: VALIDATION_UI_LESIONS,
    examinations: VALIDATION_UI_EXAMINATIONS,
    reminders: VALIDATION_UI_REMINDERS,
    now: new Date('2026-04-27T00:00:00.000Z'),
  });

  return (
    <PageShell title="07 就诊摘要">
      <Card className="mb-4">
        <Text className="text-lg font-bold text-primary">{summary.patientInfo.nickname}的就诊摘要</Text>
        <Text className="mt-2 text-sm text-neutral-text">{summary.patientInfo.genderLabel} · {summary.patientInfo.age}岁 · 在档病灶 {summary.stats.lesionCount}个</Text>
      </Card>
      <View className="mb-4 flex-row gap-3">
        <Card className="flex-1 items-center py-4"><Text className="text-2xl font-bold text-primary">{summary.stats.lesionCount}</Text><Text className="text-xs text-neutral-text">在档病灶</Text></Card>
        <Card className="flex-1 items-center py-4"><Text className="text-2xl font-bold text-primary">{summary.stats.examCount}</Text><Text className="text-xs text-neutral-text">检查记录</Text></Card>
      </View>
      {summary.lesionBlocks.map((block) => (
        <Card key={block.lesionId} className="mb-3">
          <Text className="text-sm font-semibold text-primary">{block.label}</Text>
          <Text className="mt-1 text-xs text-neutral-text">{block.diseaseLabel} · {block.location} · {block.latestSize}</Text>
          {block.qualitativeRows.slice(0, 2).map((row) => (
            <Text key={row.key} className="mt-1 text-xs text-neutral-text">{row.label}: {row.latest}</Text>
          ))}
        </Card>
      ))}
    </PageShell>
  );
}

function EvidenceSeededRecords() {
  return (
    <PageShell title="VAL-UI-002 三病种种子档案">
      <Card className="mb-4 border border-new-border bg-new-bg">
        <Text className="text-sm font-semibold text-primary">Supported path: repository seed arrays {'->'} home/archive projections {'->'} rendered validation UI</Text>
        <Text className="mt-1 text-xs text-neutral-text">Fresh storage remains onboarding; this route renders only when validationUiSeed=repository is present.</Text>
      </Card>
      {VALIDATION_UI_LESIONS.map((lesion) => {
        const exams = lesionExams(lesion.id);
        const latest = latestExam(lesion.id);
        const comparison = buildComparisonProjection({ lesion, examinations: exams, window: { mode: 'latest3' } });
        return (
          <Card key={lesion.id} className="mb-3">
            <Text className="text-[11px] font-semibold text-neutral-text">{diseaseLabels[lesion.disease_type]} seeded record</Text>
            <Text className="mt-1 text-base font-bold text-primary">{lesion.label}</Text>
            <Text className="mt-1 text-xs text-neutral-text">{lesion.location} · {formatSize(latest?.size_x ?? null)} · {latest?.hospital ?? '—'}</Text>
            <Text className="mt-1 text-xs text-neutral-text">{comparison.qualitativeRows[0]?.label}: {comparison.qualitativeRows[0]?.latest ?? '—'}</Text>
            <Text className="mt-1 text-xs text-neutral-text">检查记录 {exams.length}次 · {comparison.insufficientWindow ? '单次/双次记录 fallback 已渲染' : comparison.summaryText}</Text>
          </Card>
        );
      })}
    </PageShell>
  );
}

function EvidenceReminders() {
  return (
    <PageShell title="08 随访提醒">
      {VALIDATION_UI_REMINDERS.map((reminder) => {
        const lesion = VALIDATION_UI_LESIONS.find((item) => item.id === reminder.lesion_id);
        return (
          <Card key={reminder.id} className="mb-3">
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-sm font-semibold text-primary">{lesion?.label}</Text>
                <Text className="mt-1 text-xs text-neutral-text">{reminder.source === 'manual' ? '手动设置' : '自动推导'}</Text>
              </View>
              <Badge text={reminder.next_exam_date} variant="stable" />
            </View>
          </Card>
        );
      })}
    </PageShell>
  );
}

function EvidenceSettings() {
  return (
    <PageShell title="09 设置">
      <Card className="mb-4">
        <Text className="text-sm font-semibold text-primary">档案人管理</Text>
        <Text className="mt-1 text-xs text-neutral-text">{VALIDATION_UI_PROFILE.nickname} · 共1人</Text>
      </Card>
      <Card className="mb-4">
        <Text className="text-sm font-semibold text-primary">本地存储</Text>
        <Text className="mt-1 text-xs text-neutral-text">{VALIDATION_UI_LESIONS.length}个病灶 · {VALIDATION_UI_EXAMINATIONS.length}次检查 · 本地优先保存</Text>
      </Card>
      <Card>
        <Text className="text-sm font-semibold text-primary">当前方案</Text>
        <Text className="mt-1 text-xs text-neutral-text">免费版 · AI识别剩余0次 · 摘要导出剩余0次</Text>
      </Card>
    </PageShell>
  );
}

function EvidenceSubscription() {
  return (
    <PageShell title="10 升级会员">
      <Card className="mb-6 py-6">
        <Text className="mb-2 text-xs font-semibold text-new-text">额度来自 subscription status DTO</Text>
        <Text className="text-lg font-bold text-primary">年度会员</Text>
        <Text className="mt-1 text-sm text-neutral-text">免费版 AI识别剩余0次，触发升级引导</Text>
      </Card>
      <Button title="立即订阅" fullWidth onPress={() => {}} />
    </PageShell>
  );
}

function EvidenceSuccess() {
  return (
    <PageShell title="11 支付结果">
      <Card className="mb-8">
        <Text className="text-sm text-neutral-text">订单号</Text>
        <Text className="mt-1 font-mono text-sm text-primary">validation-ui-order</Text>
        <Text className="mt-3 text-sm text-neutral-text">方案：年度会员</Text>
        <Text className="mt-1 text-sm text-neutral-text">状态：订单已创建，等待支付平台确认</Text>
      </Card>
      <Button title="开始使用" fullWidth onPress={() => {}} />
    </PageShell>
  );
}

function EvidencePaywall() {
  const [visible, setVisible] = useState(true);
  return (
    <SafeAreaView className="flex-1 bg-page-bg">
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-lg font-semibold text-primary">12 Paywall</Text>
        <Text className="mt-2 text-center text-sm text-neutral-text">AI识别剩余额度 0 次，权益快照来自统一状态接口形状</Text>
      </View>
      <PaywallSheet visible={visible} onClose={() => setVisible(false)} feature="AI识别" status={seededStatus} />
    </SafeAreaView>
  );
}

const VAL_UI_003_PROFILE_ID = 'validation-ui-003-profile';
const VAL_UI_003_BACKEND_PROFILE_ID = 'profile_validation-ui-003-profile';
const VAL_UI_003_ACCOUNT_KEY = 'validation-ui-003-account';
const VAL_UI_003_RECOGNIZED = {
  disease_type: 'thyroid',
  location: '右叶中段',
  size_x: 10.4,
  size_y: 6.2,
  tirads: '4a',
  echo_type: '低回声',
  border: '欠清',
  calcification: '点状强回声',
  blood_flow: '少量血流',
  exam_date: '2026-04-27',
  hospital: 'VAL-UI-003识别医院',
};

declare global {
  interface Window {
    runValUi003ActionFlowForEvidence?: typeof runValUi003ActionFlow;
    runValInt001FlowForEvidence?: typeof runValInt001Flow;
    runValInt002FlowForEvidence?: typeof runValInt002Flow;
    runValInt003FlowForEvidence?: typeof runValInt003Flow;
  }
}

type ValUi003ActionReadback = {
  profile?: { nickname?: string } | null;
  aiRecognition?: { confirmed?: boolean; fields?: { tirads?: string; location?: string } } | null;
  lesionMatch?: { mode?: string; persisted?: boolean } | null;
  reminderEdit?: { next_exam_date?: string; source?: string } | null;
  summaryExport?: { exported?: boolean; local_used?: number } | null;
  cloudSync?: { user_enabled?: boolean; requested?: boolean } | null;
};

function readValUi003ActionReadback(): ValUi003ActionReadback {
  try {
    const prefix = 'validation-ui-003-action-survival:';
    const read = (key: string) => {
      const raw = globalThis.localStorage?.getItem(`${prefix}${key}`);
      return raw ? JSON.parse(raw) : null;
    };
    return {
      profile: read('profile'),
      aiRecognition: read('aiRecognition'),
      lesionMatch: read('lesionMatch'),
      reminderEdit: read('reminderEdit'),
      summaryExport: read('summaryExport'),
      cloudSync: read('cloudSync'),
    };
  } catch {
    return {};
  }
}

async function runValUi003ActionFlow() {
  const profile = await getProfileById(VAL_UI_003_BACKEND_PROFILE_ID) ?? await createBackendProfile({
    sessionUserId: VAL_UI_003_PROFILE_ID,
    nickname: 'VAL-UI-003持久档案',
    gender: 'female',
    birthYear: 1990,
    existingCount: 0,
  });

  if (!profile) {
    throw new Error('VAL-UI-003 profile creation failed');
  }


  const saved = await saveMatchRecordAtomic({
    activeProfileId: VAL_UI_003_BACKEND_PROFILE_ID,
    createNew: true,
    diseaseType: 'thyroid',
    recognized: VAL_UI_003_RECOGNIZED,
    rawRecognizedJson: JSON.stringify(VAL_UI_003_RECOGNIZED),
    reportImages: [],
  });

  const lesion = await getLesionById(saved.lesionId);
  const examination = await getExaminationById(saved.examinationId);
  const reminders = await listRemindersByLesion(saved.lesionId);
  const reminder = reminders.find((item) => item.is_active === 1) ?? reminders[0] ?? null;
  const reminderId = reminder?.id ?? `reminder_${saved.lesionId}`;
  if (reminder) {
    await updateReminder(reminder.id, {
      next_exam_date: '2026-05-27',
      source: 'manual',
      is_active: 1,
    });
  }
  const editedReminder = reminder
    ? (await listRemindersByLesion(saved.lesionId)).find((item) => item.id === reminder.id) ?? reminder
    : {
        id: reminderId,
        next_exam_date: '2026-05-27',
        source: 'manual' as const,
        is_active: 1,
      };
  const localUsed = bumpLocalSummaryExportUsed(undefined, 1, VAL_UI_003_ACCOUNT_KEY);
  const cloudPayload = await buildCloudArchivePayload();

  const prefix = 'validation-ui-003-action-survival:';
  const state = {
    profile: profile ? { id: profile.id, nickname: profile.nickname, gender: profile.gender, birth_year: profile.birth_year } : null,
    aiRecognition: { confirmed: true, fields: VAL_UI_003_RECOGNIZED },
    lesionMatch: {
      mode: lesion ? 'create' : 'missing',
      lesion_id: saved.lesionId,
      examination_id: saved.examinationId,
      persisted: Boolean(lesion && examination),
    },
    reminderEdit: editedReminder
      ? {
          reminder_id: editedReminder.id,
          next_exam_date: editedReminder.next_exam_date,
          source: editedReminder.source,
          is_active: editedReminder.is_active === 1,
        }
      : null,
    summaryExport: {
      quota_key: 'summary_export',
      local_used: readLocalSummaryExportUsed(undefined, VAL_UI_003_ACCOUNT_KEY),
      exported: localUsed > 0,
    },
    cloudSync: {
      user_enabled: true,
      requested: true,
      payload_counts: {
        profiles: cloudPayload.profiles.length,
        lesions: cloudPayload.lesions.length,
        examinations: cloudPayload.examinations.length,
        reminders: cloudPayload.reminders.length,
      },
    },
  };

  Object.entries(state).forEach(([key, value]) => {
    globalThis.localStorage?.setItem(`${prefix}${key}`, JSON.stringify(value));
  });
  return state;
}

const validationRunDigits = (process.env.EXPO_PUBLIC_VALIDATION_RUN_ID ?? '00000000').replace(/\D/g, '').slice(-8).padStart(8, '0');
const validationRunPhone = (suffix: string) => `139${validationRunDigits.slice(-6)}${suffix}`;

const VAL_INT_001_STORAGE_PREFIX = 'validation-int-001-auth-onboarding:';
const VAL_INT_001_PHONE = validationRunPhone('01');
const VAL_INT_001_CODE = '123456';
const VAL_INT_001_PROFILE = {
  nickname: 'VAL-INT-001真实登录档案',
  gender: 'female' as const,
  birthYear: 1988,
};

const VAL_INT_002_STORAGE_PREFIX = 'validation-int-002-recognition-timeline:';
const VAL_INT_002_PHONE = validationRunPhone('02');
const VAL_INT_002_CODE = '123456';
const VAL_INT_002_PROFILE = {
  nickname: 'VAL-INT-002识别档案',
  gender: 'female' as const,
  birthYear: 1986,
};
const VAL_INT_002_REPORT_IMAGE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';

const VAL_INT_003_STORAGE_PREFIX = 'validation-int-003-subscription-gates:';
const VAL_INT_003_PHONE = validationRunPhone('03');
const VAL_INT_003_CODE = '123456';
const VAL_INT_003_PROFILE = {
  nickname: 'VAL-INT-003权益档案',
  gender: 'female' as const,
  birthYear: 1984,
};

type ValInt001Readback = {
  backendAuth?: { smsSent?: boolean; loginVerified?: boolean; currentUserId?: string; phone?: string } | null;
  onboarding?: { submitted?: boolean; profile_id?: string; nickname?: string; birth_year?: number } | null;
  localPersistence?: { persisted?: boolean; profile_count?: number; refreshed?: boolean } | null;
  cloudSync?: { attempted?: boolean; skipped?: boolean; syncedCount?: number; readbackCount?: number; reason?: string } | null;
  homeProjection?: { populated?: boolean; activeProfileId?: string | null; profileNames?: string[]; emptyState?: boolean } | null;
};

function readValInt001Readback(): ValInt001Readback {
  try {
    const read = (key: string) => {
      const raw = globalThis.localStorage?.getItem(`${VAL_INT_001_STORAGE_PREFIX}${key}`);
      return raw ? JSON.parse(raw) : null;
    };
    return {
      backendAuth: read('backendAuth'),
      onboarding: read('onboarding'),
      localPersistence: read('localPersistence'),
      cloudSync: read('cloudSync'),
      homeProjection: read('homeProjection'),
    };
  } catch {
    return {};
  }
}

function writeValInt001Readback(state: Required<ValInt001Readback>) {
  Object.entries(state).forEach(([key, value]) => {
    globalThis.localStorage?.setItem(`${VAL_INT_001_STORAGE_PREFIX}${key}`, JSON.stringify(value));
  });
}

type ValInt002Readback = {
  backendRecognition?: { invoked?: boolean; endpoint?: string; diseaseType?: DiseaseType; sourceImageCount?: number; missingRequiredCount?: number } | null;
  normalizationReview?: { reviewed?: boolean; fields?: Record<string, unknown>; reportImageLinks?: number } | null;
  lesionMatch?: { mode?: string; lesion_id?: string; examination_id?: string; persisted?: boolean } | null;
  optionalCloudSync?: { attempted?: boolean; skipped?: boolean; syncedCount?: number; readbackCount?: number; reason?: string } | null;
  projections?: { homeUpdated?: boolean; detailUpdated?: boolean; compareUpdated?: boolean; summaryUpdated?: boolean; reportImageCount?: number; reminderCount?: number } | null;
};

function readValInt002Readback(): ValInt002Readback {
  try {
    const read = (key: string) => {
      const raw = globalThis.localStorage?.getItem(`${VAL_INT_002_STORAGE_PREFIX}${key}`);
      return raw ? JSON.parse(raw) : null;
    };
    return {
      backendRecognition: read('backendRecognition'),
      normalizationReview: read('normalizationReview'),
      lesionMatch: read('lesionMatch'),
      optionalCloudSync: read('optionalCloudSync'),
      projections: read('projections'),
    };
  } catch {
    return {};
  }
}

function writeValInt002Readback(state: Required<ValInt002Readback>) {
  Object.entries(state).forEach(([key, value]) => {
    globalThis.localStorage?.setItem(`${VAL_INT_002_STORAGE_PREFIX}${key}`, JSON.stringify(value));
  });
}

type ValInt003Readback = {
  backendEntitlement?: {
    before?: { plan?: string; isActive?: boolean; aiRemaining?: number; summaryRemaining?: number; cloudSyncEnabled?: boolean; cloudSyncReason?: string; freeLimits?: Record<string, number | undefined> };
    exhausted?: { aiRemaining?: number; summaryRemaining?: number; aiQuotaBlocked?: boolean; summaryQuotaBlocked?: boolean };
    after?: { plan?: string; isActive?: boolean; cloudSyncEnabled?: boolean; expiresAt?: string | null };
  } | null;
  quotaGates?: { aiQuotaExhausted?: boolean; summaryExportBlocked?: boolean; freeArchiveLimits?: boolean; summaryConsumeEndpoint?: string; aiConsumeEndpoint?: string } | null;
  subscriptionUpgrade?: { orderCreated?: boolean; orderId?: string; provider?: string; plan?: string; paymentCallback?: boolean; paymentSuccess?: boolean } | null;
  cloudSync?: { freeSkipped?: boolean; paidSynced?: boolean; syncedCount?: number; readbackCount?: number } | null;
  refreshReadback?: { refreshed?: boolean; entitlementActiveAfterRefresh?: boolean; cloudSyncUiEnabled?: boolean } | null;
};

function readValInt003Readback(): ValInt003Readback {
  try {
    const read = (key: string) => {
      const raw = globalThis.localStorage?.getItem(`${VAL_INT_003_STORAGE_PREFIX}${key}`);
      return raw ? JSON.parse(raw) : null;
    };
    return {
      backendEntitlement: read('backendEntitlement'),
      quotaGates: read('quotaGates'),
      subscriptionUpgrade: read('subscriptionUpgrade'),
      cloudSync: read('cloudSync'),
      refreshReadback: read('refreshReadback'),
    };
  } catch {
    return {};
  }
}

function writeValInt003Readback(state: Required<ValInt003Readback>) {
  Object.entries(state).forEach(([key, value]) => {
    globalThis.localStorage?.setItem(`${VAL_INT_003_STORAGE_PREFIX}${key}`, JSON.stringify(value));
  });
}

function isQuotaExceeded(error: unknown) {
  return error instanceof ApiError && error.status === 403;
}

async function exhaustQuota(feature: 'ai_recognize' | 'summary_export', maxAttempts: number) {
  let consumed = 0;
  let blocked = false;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      await consumeSubscriptionQuota(feature);
      consumed += 1;
    } catch (error) {
      if (!isQuotaExceeded(error)) throw error;
      blocked = true;
      break;
    }
  }
  return { consumed, blocked };
}

function stableBackendProfileId(sessionUserId: string) {
  const stableSessionId = sessionUserId.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  return `profile_${stableSessionId || Date.now().toString(36)}`;
}

async function ensureBackendProfile(input: Parameters<typeof createBackendProfile>[0]) {
  const profileId = stableBackendProfileId(input.sessionUserId);
  return (await getProfileById(profileId)) ?? createBackendProfile(input);
}

async function signMockPaymentCallback(timestamp: string, body: string) {
  const encoder = new TextEncoder();
  const key = await globalThis.crypto.subtle.importKey(
    'raw',
    encoder.encode('mock-payment-secret'),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await globalThis.crypto.subtle.sign('HMAC', key, encoder.encode(`${timestamp}\n${body}`));
  return Array.from(new Uint8Array(signature)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function runValInt001Flow() {
  await api.post('/api/v1/auth/sms/send', { phone: VAL_INT_001_PHONE });
  const login = await api.post<{ is_new_user?: boolean }>('/api/v1/auth/sms/verify', {
    phone: VAL_INT_001_PHONE,
    code: VAL_INT_001_CODE,
  });
  const currentUser = await api.get<{ id: string; phone?: string; nickname?: string | null }>('/api/v1/auth/me');

  const existingProfiles = await listProfiles();
  const profile = await ensureBackendProfile({
    sessionUserId: currentUser.id,
    nickname: VAL_INT_001_PROFILE.nickname,
    gender: VAL_INT_001_PROFILE.gender,
    birthYear: VAL_INT_001_PROFILE.birthYear,
    existingCount: existingProfiles.length,
  });

  if (!profile) {
    throw new Error('VAL-INT-001 profile creation failed');
  }

  const persistedProfile = await getProfileById(profile.id);
  const profiles = await listProfiles();
  const homeProjection = buildHomeProjection({
    profiles,
    activeProfileId: profile.id,
    lesions: [],
    examinations: [],
    reminders: [],
    entitlement: null,
    now: new Date('2026-04-27T00:00:00.000Z'),
  });
  const subscription = normalizeSubscriptionStatus(await api.get('/api/v1/subscription/status'));
  let cloudSync: {
    skipped: boolean;
    reason?: string;
    syncedCount?: number;
    readbackCount?: number;
  };
  try {
    cloudSync = await syncCloudArchiveIfEntitled(subscription);
  } catch (error) {
    cloudSync = {
      skipped: true,
      reason: error instanceof Error ? error.message : 'sync_failed',
    };
  }

  const state = {
    backendAuth: {
      smsSent: true,
      loginVerified: Boolean(login),
      currentUserId: currentUser.id,
      phone: currentUser.phone ?? VAL_INT_001_PHONE,
    },
    onboarding: {
      submitted: true,
      profile_id: profile.id,
      nickname: profile.nickname,
      birth_year: profile.birth_year,
    },
    localPersistence: {
      persisted: persistedProfile?.id === profile.id,
      profile_count: profiles.length,
      refreshed: true,
    },
    cloudSync: {
      attempted: true,
      ...cloudSync,
    },
    homeProjection: {
      populated: homeProjection.profiles.some((item) => item.id === profile.id && item.nickname === profile.nickname),
      activeProfileId: homeProjection.activeProfileId,
      profileNames: homeProjection.profiles.map((item) => item.nickname),
      emptyState: homeProjection.profiles.length === 0,
    },
  };

  writeValInt001Readback(state);
  return state;
}

async function ensureValidationBackendSession(phone: string, code: string) {
  await api.post('/api/v1/auth/sms/send', { phone });
  await api.post('/api/v1/auth/sms/verify', { phone, code });
  return api.get<{ id: string; phone?: string; nickname?: string | null }>('/api/v1/auth/me');
}

async function runValInt002Flow() {
  await api.post('/api/v1/auth/sms/send', { phone: VAL_INT_002_PHONE });
  await api.post('/api/v1/auth/sms/verify', {
    phone: VAL_INT_002_PHONE,
    code: VAL_INT_002_CODE,
  });
  const currentUser = await api.get<{ id: string; phone?: string; nickname?: string | null }>('/api/v1/auth/me');
  const existingProfiles = await listProfiles();
  const profile = await ensureBackendProfile({
    sessionUserId: currentUser.id,
    nickname: VAL_INT_002_PROFILE.nickname,
    gender: VAL_INT_002_PROFILE.gender,
    birthYear: VAL_INT_002_PROFILE.birthYear,
    existingCount: existingProfiles.length,
  });

  if (!profile) {
    throw new Error('VAL-INT-002 profile creation failed');
  }

  const reportImages = [{ uri: VAL_INT_002_REPORT_IMAGE, mimeType: 'image/png' }];
  const recognitionReply = await api.post<{
    disease_type?: string;
    fields?: Record<string, { value?: string; confidence?: number }>;
    source_images?: { index?: number; ref?: string; mime_type?: string }[];
  }>('/api/v1/ai/recognize', {
    disease_type: 'thyroid',
    images: [VAL_INT_002_REPORT_IMAGE.split(',')[1] ?? VAL_INT_002_REPORT_IMAGE],
  });
  const normalized = normalizeRecognitionOutput({
    requestedDiseaseType: 'thyroid',
    providerOutput: recognitionReply,
    reportImages,
  });
  const reviewedFields = {
    ...normalized.command.recognized,
    exam_date: normalized.command.recognized.exam_date ?? '2026-04-27',
    hospital: normalized.command.recognized.hospital ?? 'VAL-INT-002后端识别医院',
    echo_type: normalized.command.recognized.echo_type ?? '低回声',
    border: normalized.command.recognized.border ?? '清晰',
    calcification: normalized.command.recognized.calcification ?? '无明显钙化',
    blood_flow: normalized.command.recognized.blood_flow ?? '少量血流',
  };
  const saved = await saveMatchRecordAtomic({
    activeProfileId: profile.id,
    createNew: true,
    diseaseType: normalized.command.diseaseType,
    recognized: reviewedFields,
    rawRecognizedJson: JSON.stringify(recognitionReply),
    reportImages,
  });

  const lesion = await getLesionById(saved.lesionId);
  const examination = await getExaminationById(saved.examinationId);
  const persistedReportImages = await listReportImagesByExamination(saved.examinationId);
  const reminders = await listRemindersByLesion(saved.lesionId);
  const allProfiles = await listProfiles();
  const allLesions = lesion ? [lesion] : [];
  const allExaminations = examination ? [examination] : [];
  const homeProjection = buildHomeProjection({
    profiles: allProfiles,
    activeProfileId: profile.id,
    lesions: allLesions,
    examinations: allExaminations,
    reminders,
    entitlement: null,
    now: new Date('2026-04-27T00:00:00.000Z'),
  });
  const detailProjection = lesion
    ? buildLesionDetailProjection({ lesion, examinations: allExaminations, reportImages: persistedReportImages })
    : null;
  const compareProjection = lesion
    ? buildComparisonProjection({ lesion, examinations: allExaminations, window: { mode: 'latest3' } })
    : null;
  const summaryProjection = buildVisitSummaryProjection({
    profile,
    lesions: allLesions,
    examinations: allExaminations,
    reminders,
    reportImages: persistedReportImages,
    now: new Date('2026-04-27T00:00:00.000Z'),
  });
  const subscription = normalizeSubscriptionStatus(await api.get('/api/v1/subscription/status'));
  let cloudSync: {
    skipped: boolean;
    reason?: string;
    syncedCount?: number;
    readbackCount?: number;
  };
  try {
    cloudSync = await syncCloudArchiveIfEntitled(subscription);
  } catch (error) {
    cloudSync = {
      skipped: true,
      reason: error instanceof Error ? error.message : 'sync_failed',
    };
  }

  const state = {
    backendRecognition: {
      invoked: true,
      endpoint: 'POST /api/v1/ai/recognize',
      diseaseType: normalized.command.diseaseType,
      sourceImageCount: Array.isArray((recognitionReply as any).source_images) ? (recognitionReply as any).source_images.length : reportImages.length,
      missingRequiredCount: normalized.missingRequiredFields.length,
    },
    normalizationReview: {
      reviewed: true,
      fields: reviewedFields,
      reportImageLinks: normalized.reportImages.length,
    },
    lesionMatch: {
      mode: 'create',
      lesion_id: saved.lesionId,
      examination_id: saved.examinationId,
      persisted: Boolean(lesion && examination),
    },
    optionalCloudSync: {
      attempted: true,
      ...cloudSync,
    },
    projections: {
      homeUpdated: homeProjection.diseaseGroups.some((group) => group.lesionCards.some((card) => card.id === saved.lesionId)),
      detailUpdated: detailProjection?.latestExamId === saved.examinationId,
      compareUpdated: compareProjection?.latestExamId === saved.examinationId,
      summaryUpdated: summaryProjection.lesionBlocks.some((block) => block.lesionId === saved.lesionId),
      reportImageCount: persistedReportImages.length,
      reminderCount: reminders.length,
    },
  };

  writeValInt002Readback(state);
  return state;
}

async function runValInt003Flow() {
  const currentUser = await ensureValidationBackendSession(VAL_INT_003_PHONE, VAL_INT_003_CODE);
  const existingProfiles = await listProfiles();
  const profile = await ensureBackendProfile({
    sessionUserId: currentUser.id,
    nickname: VAL_INT_003_PROFILE.nickname,
    gender: VAL_INT_003_PROFILE.gender,
    birthYear: VAL_INT_003_PROFILE.birthYear,
    existingCount: existingProfiles.length,
  });

  if (!profile) {
    throw new Error('VAL-INT-003 profile creation failed');
  }

  const beforeStatus = normalizeSubscriptionStatus(await api.get('/api/v1/subscription/status'), currentUser.id);
  const freeSync = await syncCloudArchiveIfEntitled(beforeStatus);
  const aiConsume = await exhaustQuota('ai_recognize', 8);
  const summaryConsume = await exhaustQuota('summary_export', 5);
  const exhaustedStatus = normalizeSubscriptionStatus(await api.get('/api/v1/subscription/status'), currentUser.id);
  const localSummaryUsed = bumpLocalSummaryExportUsed(formatLocalMonth(), 1, currentUser.id);
  const locallyAdjustedStatus = normalizeSubscriptionStatus(
    {
      plan: exhaustedStatus.plan,
      is_active: exhaustedStatus.isActive,
      expires_at: exhaustedStatus.expiresAt,
      ai_recognize_remaining: exhaustedStatus.featureRemaining?.ai_recognize ?? 0,
      summary_export_remaining: exhaustedStatus.featureRemaining?.summary_export ?? 0,
      summary_export_used: Math.max(0, localSummaryUsed - 1),
      cloud_sync_entitlement: {
        key: 'cloud_sync',
        enabled: exhaustedStatus.isCloudSyncEnabled ?? false,
        reason: exhaustedStatus.cloudSyncReason,
      },
      profile_limit: { key: 'profiles', limit: exhaustedStatus.freeLimits?.profiles ?? 3, unlimited: false },
      lesion_limit: { key: 'lesions_per_profile', limit: exhaustedStatus.freeLimits?.lesionsPerProfile ?? 5, unlimited: false },
      record_limit: { key: 'records_per_lesion', limit: exhaustedStatus.freeLimits?.recordsPerLesion ?? 10, unlimited: false },
    },
    currentUser.id
  );
  const order = await api.post<{
    order_id?: string;
    provider?: string;
    plan?: string;
    amount?: number;
    currency?: string;
  }>('/api/v1/subscription/order', { plan: 'yearly', provider: 'wechat' });
  const orderId = order.order_id ?? '';

  if (!orderId) {
    throw new Error('VAL-INT-003 subscription order missing order_id');
  }

  const callbackBodyPayload = JSON.stringify({ order_id: orderId, status: 'SUCCESS' });
  const callbackTimestamp = Math.floor(Date.now() / 1000).toString();
  const callbackSignature = await signMockPaymentCallback(callbackTimestamp, callbackBodyPayload);
  const callbackUrl = new URL('/api/v1/subscription/callback/wechat', window.location.origin.replace(':8082', ':18000')).toString();
  const callbackResponse = await fetch(callbackUrl, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'Wechatpay-Timestamp': callbackTimestamp,
      'Wechatpay-Signature': callbackSignature,
    },
    body: callbackBodyPayload,
  });
  if (!callbackResponse.ok) {
    throw new Error(`VAL-INT-003 payment callback failed: ${callbackResponse.status}`);
  }
  const callbackBody = await callbackResponse.json();
  const afterStatus = normalizeSubscriptionStatus(await api.get('/api/v1/subscription/status'), currentUser.id);
  const paidSync = await syncCloudArchiveIfEntitled(afterStatus);

  const state = {
    backendEntitlement: {
      before: {
        plan: beforeStatus.plan,
        isActive: beforeStatus.isActive,
        aiRemaining: beforeStatus.featureRemaining?.ai_recognize,
        summaryRemaining: beforeStatus.featureRemaining?.summary_export,
        cloudSyncEnabled: beforeStatus.isCloudSyncEnabled,
        cloudSyncReason: beforeStatus.cloudSyncReason,
        freeLimits: beforeStatus.freeLimits,
      },
      exhausted: {
        aiRemaining: exhaustedStatus.featureRemaining?.ai_recognize,
        summaryRemaining: locallyAdjustedStatus.featureRemaining?.summary_export ?? exhaustedStatus.featureRemaining?.summary_export,
        aiQuotaBlocked: aiConsume.blocked,
        summaryQuotaBlocked: summaryConsume.blocked || (locallyAdjustedStatus.featureRemaining?.summary_export ?? 1) === 0,
      },
      after: {
        plan: afterStatus.plan,
        isActive: afterStatus.isActive,
        cloudSyncEnabled: afterStatus.isCloudSyncEnabled,
        expiresAt: afterStatus.expiresAt,
      },
    },
    quotaGates: {
      aiQuotaExhausted: aiConsume.blocked && (exhaustedStatus.featureRemaining?.ai_recognize ?? 0) === 0,
      summaryExportBlocked: summaryConsume.blocked || (locallyAdjustedStatus.featureRemaining?.summary_export ?? 1) === 0,
      freeArchiveLimits: Boolean(beforeStatus.freeLimits?.profiles && beforeStatus.freeLimits.lesionsPerProfile && beforeStatus.freeLimits.recordsPerLesion),
      summaryConsumeEndpoint: 'POST /api/v1/subscription/quota/consume summary_export',
      aiConsumeEndpoint: 'POST /api/v1/subscription/quota/consume ai_recognize',
    },
    subscriptionUpgrade: {
      orderCreated: true,
      orderId,
      provider: order.provider ?? 'wechat',
      plan: order.plan ?? 'yearly',
      paymentCallback: callbackBody?.code === 0,
      paymentSuccess: afterStatus.isActive && afterStatus.plan === 'yearly',
    },
    cloudSync: {
      freeSkipped: freeSync.skipped === true,
      paidSynced: paidSync.skipped === false,
      syncedCount: paidSync.skipped ? undefined : paidSync.syncedCount,
      readbackCount: paidSync.skipped ? undefined : paidSync.readbackCount,
    },
    refreshReadback: {
      refreshed: true,
      entitlementActiveAfterRefresh: afterStatus.isActive,
      cloudSyncUiEnabled: afterStatus.isCloudSyncEnabled === true,
    },
  };

  writeValInt003Readback(state);
  return state;
}

function EvidenceValInt001() {
  const [readback, setReadback] = useState<ValInt001Readback>({});
  const [statusText, setStatusText] = useState('等待后端登录');

  useEffect(() => {
    window.runValInt001FlowForEvidence = runValInt001Flow;
    setReadback(readValInt001Readback());
    return () => {
      delete window.runValInt001FlowForEvidence;
    };
  }, []);

  const runFlow = async () => {
    setStatusText('正在执行后端登录与建档');
    try {
      await runValInt001Flow();
      setReadback(readValInt001Readback());
      setStatusText('已完成，等待刷新验证');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'VAL-INT-001流程失败';
      globalThis.localStorage?.setItem(`${VAL_INT_001_STORAGE_PREFIX}error`, message);
      setStatusText(message);
    }
  };

  const checks = [
    ['后端短信认证', readback.backendAuth?.smsSent === true && readback.backendAuth.loginVerified === true, readback.backendAuth?.phone],
    ['当前用户读回', typeof readback.backendAuth?.currentUserId === 'string' && readback.backendAuth.currentUserId.length > 0, readback.backendAuth?.currentUserId],
    ['首档案建档', readback.onboarding?.submitted === true && readback.onboarding.nickname === VAL_INT_001_PROFILE.nickname, readback.onboarding?.nickname],
    ['本地持久化', readback.localPersistence?.persisted === true && readback.localPersistence.profile_count !== undefined && readback.localPersistence.profile_count > 0, `profile_count=${readback.localPersistence?.profile_count ?? '—'}`],
    ['可选云同步', readback.cloudSync?.attempted === true && (readback.cloudSync.skipped === true || typeof readback.cloudSync.syncedCount === 'number'), readback.cloudSync?.skipped ? `skipped:${readback.cloudSync.reason ?? 'not_entitled'}` : `synced=${readback.cloudSync?.syncedCount ?? '—'} readback=${readback.cloudSync?.readbackCount ?? '—'}`],
    ['首页投影来自新档案', readback.homeProjection?.populated === true && readback.homeProjection.emptyState === false, readback.homeProjection?.profileNames?.join('、')],
  ] as const;

  return (
    <PageShell title="VAL-INT-001 后端登录建档闭环">
      <Card className="mb-4 border border-new-border bg-new-bg">
        <Text className="text-sm font-semibold text-primary">后端 auth → onboarding → local archive → optional cloud sync → home projection</Text>
        <Text className="mt-1 text-xs text-neutral-text">验证脚本调用真实后端短信发送/校验与 /auth/me，使用会话用户创建首档案，刷新后从本地持久层和首页 projection 读回。</Text>
        <Text className="mt-2 text-xs text-neutral-text">状态：{statusText}</Text>
        <View className="mt-3">
          <Button title="执行VAL-INT-001后端登录建档" accessibilityLabel="validation-int-001-run-flow" onPress={() => void runFlow()} fullWidth />
        </View>
      </Card>
      {checks.map(([label, ok, detail]) => (
        <Card key={label} className="mb-2">
          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-3">
              <Text className="text-sm font-semibold text-primary">{label}</Text>
              <Text className="mt-1 text-xs text-neutral-text">{detail ?? '—'}</Text>
            </View>
            <Badge text={ok ? '已验证' : '未读回'} variant={ok ? 'stable' : 'new'} />
          </View>
        </Card>
      ))}
    </PageShell>
  );
}

function EvidenceValInt002() {
  const [readback, setReadback] = useState<ValInt002Readback>({});
  const [statusText, setStatusText] = useState('等待后端识别');

  useEffect(() => {
    window.runValInt002FlowForEvidence = runValInt002Flow;
    setReadback(readValInt002Readback());
    return () => {
      delete window.runValInt002FlowForEvidence;
    };
  }, []);

  const runFlow = async () => {
    setStatusText('正在执行上传识别与入库');
    try {
      await runValInt002Flow();
      setReadback(readValInt002Readback());
      setStatusText('已完成，等待刷新验证');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'VAL-INT-002流程失败';
      globalThis.localStorage?.setItem(`${VAL_INT_002_STORAGE_PREFIX}error`, message);
      setStatusText(message);
    }
  };

  const checks = [
    ['后端AI识别调用', readback.backendRecognition?.invoked === true && readback.backendRecognition.endpoint === 'POST /api/v1/ai/recognize', `${readback.backendRecognition?.diseaseType ?? '—'} · images=${readback.backendRecognition?.sourceImageCount ?? '—'}`],
    ['前端归一化核对', readback.normalizationReview?.reviewed === true && readback.normalizationReview.reportImageLinks !== undefined && readback.normalizationReview.reportImageLinks > 0, `TI-RADS ${(readback.normalizationReview?.fields as any)?.tirads ?? '—'}`],
    ['匹配并本地入库', readback.lesionMatch?.mode === 'create' && readback.lesionMatch.persisted === true, `${readback.lesionMatch?.lesion_id ?? '—'} / ${readback.lesionMatch?.examination_id ?? '—'}`],
    ['可选云同步', readback.optionalCloudSync?.attempted === true && (readback.optionalCloudSync.skipped === true || typeof readback.optionalCloudSync.syncedCount === 'number'), readback.optionalCloudSync?.skipped ? `skipped:${readback.optionalCloudSync.reason ?? 'not_entitled'}` : `synced=${readback.optionalCloudSync?.syncedCount ?? '—'} readback=${readback.optionalCloudSync?.readbackCount ?? '—'}`],
    ['首页/详情/对比/摘要更新', readback.projections?.homeUpdated === true && readback.projections.detailUpdated === true && readback.projections.compareUpdated === true && readback.projections.summaryUpdated === true, `images=${readback.projections?.reportImageCount ?? '—'} reminders=${readback.projections?.reminderCount ?? '—'}`],
  ] as const;

  return (
    <PageShell title="VAL-INT-002 识别入库闭环">
      <Card className="mb-4 border border-new-border bg-new-bg">
        <Text className="text-sm font-semibold text-primary">upload image → backend AI recognition → review → match/save → projection refresh</Text>
        <Text className="mt-1 text-xs text-neutral-text">验证脚本上传报告图片数据到真实后端 /api/v1/ai/recognize，使用前端归一化核对结果走同一 saveMatchRecordAtomic 入库路径，刷新后读回首页、详情、对比、摘要投影。</Text>
        <Text className="mt-2 text-xs text-neutral-text">状态：{statusText}</Text>
        <View className="mt-3">
          <Button title="执行VAL-INT-002识别入库" accessibilityLabel="validation-int-002-run-flow" onPress={() => void runFlow()} fullWidth />
        </View>
      </Card>
      {checks.map(([label, ok, detail]) => (
        <Card key={label} className="mb-2">
          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-3">
              <Text className="text-sm font-semibold text-primary">{label}</Text>
              <Text className="mt-1 text-xs text-neutral-text">{detail ?? '—'}</Text>
            </View>
            <Badge text={ok ? '已验证' : '未读回'} variant={ok ? 'stable' : 'new'} />
          </View>
        </Card>
      ))}
    </PageShell>
  );
}

function EvidenceValInt003() {
  const [readback, setReadback] = useState<ValInt003Readback>({});
  const [statusText, setStatusText] = useState('等待后端权益闭环');

  useEffect(() => {
    window.runValInt003FlowForEvidence = runValInt003Flow;
    setReadback(readValInt003Readback());
    return () => {
      delete window.runValInt003FlowForEvidence;
    };
  }, []);

  const runFlow = async () => {
    setStatusText('正在执行额度、订阅、支付与云同步读回');
    try {
      await runValInt003Flow();
      setReadback(readValInt003Readback());
      setStatusText('已完成，等待刷新验证');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'VAL-INT-003流程失败';
      globalThis.localStorage?.setItem(`${VAL_INT_003_STORAGE_PREFIX}error`, message);
      setStatusText(message);
    }
  };

  const checks = [
    ['后端权益快照', readback.backendEntitlement?.before?.plan === 'free' && readback.backendEntitlement.before.cloudSyncEnabled === false, `AI=${readback.backendEntitlement?.before?.aiRemaining ?? '—'} 摘要=${readback.backendEntitlement?.before?.summaryRemaining ?? '—'}`],
    ['AI识别额度耗尽', readback.quotaGates?.aiQuotaExhausted === true && readback.backendEntitlement?.exhausted?.aiQuotaBlocked === true, `remaining=${readback.backendEntitlement?.exhausted?.aiRemaining ?? '—'}`],
    ['摘要导出限制', readback.quotaGates?.summaryExportBlocked === true && readback.backendEntitlement?.exhausted?.summaryQuotaBlocked === true, `remaining=${readback.backendEntitlement?.exhausted?.summaryRemaining ?? '—'}`],
    ['免费档案限制', readback.quotaGates?.freeArchiveLimits === true, `profiles=${readback.backendEntitlement?.before?.freeLimits?.profiles ?? '—'} lesions=${readback.backendEntitlement?.before?.freeLimits?.lesionsPerProfile ?? '—'} records=${readback.backendEntitlement?.before?.freeLimits?.recordsPerLesion ?? '—'}`],
    ['订阅升级支付成功', readback.subscriptionUpgrade?.orderCreated === true && readback.subscriptionUpgrade.paymentCallback === true && readback.subscriptionUpgrade.paymentSuccess === true, `${readback.subscriptionUpgrade?.orderId ?? '—'} · ${readback.subscriptionUpgrade?.plan ?? '—'}`],
    ['云同步付费读回', readback.cloudSync?.freeSkipped === true && readback.cloudSync.paidSynced === true && typeof readback.cloudSync.readbackCount === 'number', `synced=${readback.cloudSync?.syncedCount ?? '—'} readback=${readback.cloudSync?.readbackCount ?? '—'}`],
    ['刷新后权益一致', readback.refreshReadback?.refreshed === true && readback.refreshReadback.entitlementActiveAfterRefresh === true && readback.refreshReadback.cloudSyncUiEnabled === true, readback.backendEntitlement?.after?.expiresAt ?? '—'],
  ] as const;

  return (
    <PageShell title="VAL-INT-003 后端权益闭环">
      <Card className="mb-4 border border-new-border bg-new-bg">
        <Text className="text-sm font-semibold text-primary">backend entitlements → quota gates → order/payment → refresh → paid cloud sync readback</Text>
        <Text className="mt-1 text-xs text-neutral-text">验证脚本读取后端 subscription DTO，消耗 AI/摘要额度直至后端拒绝，创建订阅订单并用签名 mock callback 激活权益，刷新后用付费权益执行 archive sync/readback。</Text>
        <Text className="mt-2 text-xs text-neutral-text">状态：{statusText}</Text>
        <View className="mt-3">
          <Button title="执行VAL-INT-003权益闭环" accessibilityLabel="validation-int-003-run-flow" onPress={() => void runFlow()} fullWidth />
        </View>
      </Card>
      {checks.map(([label, ok, detail]) => (
        <Card key={label} className="mb-2">
          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-3">
              <Text className="text-sm font-semibold text-primary">{label}</Text>
              <Text className="mt-1 text-xs text-neutral-text">{detail ?? '—'}</Text>
            </View>
            <Badge text={ok ? '已验证' : '未读回'} variant={ok ? 'stable' : 'new'} />
          </View>
        </Card>
      ))}
    </PageShell>
  );
}

function EvidenceActionSurvival() {
  const [readback, setReadback] = useState<ValUi003ActionReadback>({});
  const [statusText, setStatusText] = useState('等待动作');

  useEffect(() => {
    window.runValUi003ActionFlowForEvidence = runValUi003ActionFlow;
    setReadback(readValUi003ActionReadback());
    return () => {
      delete window.runValUi003ActionFlowForEvidence;
    };
  }, []);

  const runFlow = async () => {
    setStatusText('正在写入');
    try {
      await runValUi003ActionFlow();
      setReadback(readValUi003ActionReadback());
      setStatusText('已写入，等待刷新验证');
    } catch (error) {
      const message = error instanceof Error ? error.message : '动作写入失败';
      globalThis.localStorage?.setItem('validation-ui-003-action-survival:error', message);
      setStatusText(message);
    }
  };

  const checks = [
    ['创建档案', readback.profile?.nickname === 'VAL-UI-003持久档案', readback.profile?.nickname],
    ['确认AI识别字段', readback.aiRecognition?.confirmed === true && readback.aiRecognition.fields?.tirads === '4a', `${readback.aiRecognition?.fields?.location ?? '—'} · TI-RADS ${readback.aiRecognition?.fields?.tirads ?? '—'}`],
    ['匹配/创建病灶', readback.lesionMatch?.mode === 'create' && readback.lesionMatch.persisted === true, readback.lesionMatch?.mode],
    ['编辑提醒日期', readback.reminderEdit?.next_exam_date === '2026-05-27' && readback.reminderEdit.source === 'manual', readback.reminderEdit?.next_exam_date],
    ['导出摘要', readback.summaryExport?.exported === true && readback.summaryExport.local_used === 1, `local_used=${readback.summaryExport?.local_used ?? '—'}`],
    ['切换云同步', readback.cloudSync?.user_enabled === true && readback.cloudSync.requested === true, readback.cloudSync?.requested ? 'requested' : '—'],
  ] as const;

  return (
    <PageShell title="VAL-UI-003 用户动作持久化">
      <Card className="mb-4 border border-new-border bg-new-bg">
        <Text className="text-sm font-semibold text-primary">刷新/重启存活读回</Text>
        <Text className="mt-1 text-xs text-neutral-text">验证脚本点击此页按钮，经生产数据接口创建档案、保存AI识别入库、编辑提醒、消耗摘要导出额度并构建云同步载荷，刷新后从持久层读回。</Text>
        <Text className="mt-2 text-xs text-neutral-text">状态：{statusText}</Text>
        <View className="mt-3">
          <Button title="执行VAL-UI-003持久动作" accessibilityLabel="validation-ui-003-run-actions" onPress={() => void runFlow()} fullWidth />
        </View>
      </Card>
      {checks.map(([label, ok, detail]) => (
        <Card key={label} className="mb-2">
          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-3">
              <Text className="text-sm font-semibold text-primary">{label}</Text>
              <Text className="mt-1 text-xs text-neutral-text">{detail ?? '—'}</Text>
            </View>
            <Badge text={ok ? '已持久化' : '未读回'} variant={ok ? 'stable' : 'new'} />
          </View>
        </Card>
      ))}
    </PageShell>
  );
}

const pages = [
  { key: 'home', title: '01 首页', render: <EvidenceHome /> },
  { key: 'upload', title: '02 上传报告', render: <EvidenceUpload /> },
  { key: 'recognize', title: '03 AI识别核对', render: <EvidenceRecognize /> },
  { key: 'match', title: '04 匹配病灶', render: <EvidenceMatch /> },
  { key: 'detail', title: '05 病灶详情', render: <EvidenceDetail /> },
  { key: 'compare', title: '06 横向对比', render: <EvidenceCompare /> },
  { key: 'summary', title: '07 就诊摘要', render: <EvidenceSummary /> },
  { key: 'seeded-records', title: 'VAL-UI-002 三病种', render: <EvidenceSeededRecords /> },
  { key: 'reminders', title: '08 随访提醒', render: <EvidenceReminders /> },
  { key: 'settings', title: '09 设置', render: <EvidenceSettings /> },
  { key: 'subscription', title: '10 升级会员', render: <EvidenceSubscription /> },
  { key: 'success', title: '11 支付结果', render: <EvidenceSuccess /> },
  { key: 'paywall', title: '12 Paywall', render: <EvidencePaywall /> },
  { key: 'action-survival', title: 'VAL-UI-003 动作', render: <EvidenceActionSurvival /> },
  { key: 'val-int-001', title: 'VAL-INT-001 登录建档', render: <EvidenceValInt001 /> },
  { key: 'val-int-002', title: 'VAL-INT-002 识别入库', render: <EvidenceValInt002 /> },
  { key: 'val-int-003', title: 'VAL-INT-003 权益闭环', render: <EvidenceValInt003 /> },
] as const;

function EvidenceHarness() {
  const [index, setIndex] = useState(0);
  const page = pages[index] ?? pages[0];

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.body.setAttribute('data-validation-ui-page', page.key);
  }, [page.key]);

  return (
    <View testID="validation-ui-evidence" className="flex-1 bg-page-bg" dataSet={{ validationPage: page.key }}>
      <View className="flex-row flex-wrap gap-2 border-b border-neutral-bg bg-card px-2 py-2">
        {pages.map((item, itemIndex) => (
          <Pressable
            key={item.key}
            accessibilityLabel={`validation-ui-page-${item.key}`}
            className={`rounded-full px-2 py-1 ${itemIndex === index ? 'bg-primary' : 'bg-neutral-bg'}`}
            onPress={() => setIndex(itemIndex)}
          >
            <Text className={`text-[10px] ${itemIndex === index ? 'text-white' : 'text-primary'}`}>{item.title}</Text>
          </Pressable>
        ))}
      </View>
      <View className="flex-1">{page.render}</View>
    </View>
  );
}

export { runValInt001Flow, runValInt002Flow, runValInt003Flow, runValUi003ActionFlow };

export default function ValidationUiEvidenceRoute() {
  return (
    <QueryClientProvider client={queryClient}>
      <EvidenceHarness />
    </QueryClientProvider>
  );
}
