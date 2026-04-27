import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Tag } from '@/components/ui/Tag';
import { PaywallSheet } from '@/components/PaywallSheet';
import { SecondaryPageHeader } from '@/components/SecondaryPageHeader';
import { canUseFeature, useSubscriptionStatus } from '@/hooks/useSubscriptionStatus';
import { useLesion } from '@/hooks/useLesions';
import { ApiError, api } from '@/lib/api';
import { parseReportImageAssetsParam, stringifyReportImageAssetsParam } from '@/lib/report-images';
import { Image, Pressable, SafeAreaView, ScrollView, Text, View } from '@/tw';

type Field = {
  key: string;
  label: string;
  value: string;
  confidence: number;
  confirmed: boolean;
  required: boolean;
  options?: string[];
};

type DiseaseType = 'thyroid' | 'breast' | 'lung';

const TIRADS_OPTIONS = ['1', '2', '3', '4a', '4b', '4c', '5'];
const BIRADS_OPTIONS = ['1', '2', '3', '4a', '4b', '4c', '5', '6'];
const ECHO_OPTIONS = ['低回声', '等回声', '高回声', '混合回声'];
const BORDER_OPTIONS = ['清晰', '模糊', '不规则'];
const LUNG_RADS_OPTIONS = ['1', '2', '3', '4a', '4b', '4x'];
const THYROID_DEMO_KEYS = ['disease_type', 'location', 'tirads', 'echo_type', 'border', 'size_x', 'calcification'];
const LUNG_DENSITY_OPTIONS = ['实性', '磨玻璃', '混合', '钙化'];

type FieldDefinition = Omit<Field, 'value' | 'confidence' | 'confirmed'>;

const THYROID_FIELDS: FieldDefinition[] = [
  { key: 'disease_type', label: '结节类型', required: false },
  { key: 'location', label: '部位', required: true },
  { key: 'tirads', label: 'TI-RADS', required: true, options: TIRADS_OPTIONS },
  { key: 'echo_type', label: '回声', required: false, options: ECHO_OPTIONS },
  { key: 'border', label: '边界', required: false, options: BORDER_OPTIONS },
  { key: 'size_x', label: '大小', required: true },
  { key: 'size_y', label: '大小(宽)', required: false },
  { key: 'size_z', label: '大小(高)', required: false },
  { key: 'calcification', label: '钙化', required: false },
  { key: 'blood_flow', label: '血流', required: false },
  { key: 'exam_date', label: '检查日期', required: false },
  { key: 'hospital', label: '医院', required: false },
];

const BREAST_FIELDS: FieldDefinition[] = [
  { key: 'location', label: '部位', required: true },
  { key: 'size_x', label: '大小(长)', required: true },
  { key: 'size_y', label: '大小(宽)', required: false },
  { key: 'size_z', label: '大小(高)', required: false },
  { key: 'birads', label: 'BI-RADS', required: true, options: BIRADS_OPTIONS },
  { key: 'shape', label: '形态', required: false },
  { key: 'orientation', label: '走向', required: false },
  { key: 'exam_date', label: '检查日期', required: false },
  { key: 'hospital', label: '医院', required: false },
];

const LUNG_FIELDS: FieldDefinition[] = [
  { key: 'location', label: '部位', required: true },
  { key: 'size_x', label: '大小(长)', required: true },
  { key: 'size_y', label: '大小(宽)', required: false },
  { key: 'size_z', label: '大小(高)', required: false },
  { key: 'lung_rads', label: 'LUNG-RADS', required: true, options: LUNG_RADS_OPTIONS },
  { key: 'density', label: '密度', required: true, options: LUNG_DENSITY_OPTIONS },
  { key: 'morphology', label: '形态', required: false },
  { key: 'pleural_pull', label: '胸膜牵拉', required: false },
  { key: 'exam_date', label: '检查日期', required: false },
  { key: 'hospital', label: '医院', required: false },
];

type RecognizeReportReply = {
  disease_type?: string;
  fields?: Record<string, { value?: string; confidence?: number }>;
  usage?: { used: number; limit: number; is_premium: boolean };
};

function parseDiseaseType(value: unknown): DiseaseType {
  if (value === 'thyroid' || value === 'breast' || value === 'lung') return value;
  return 'thyroid';
}

function parseImageUris(value: unknown): string[] {
  return parseReportImageAssetsParam(value).map((img) => img.uri);
}

function isDemoSeed(value: unknown): boolean {
  return (Array.isArray(value) ? value[0] : value) === 'demo';
}

const DEMO_REPORT_IMAGES = [
  { uri: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="48" height="61" viewBox="0 0 48 61"%3E%3Crect width="48" height="61" rx="5" fill="%23f0ece6"/%3E%3Ctext x="24" y="33" text-anchor="middle" font-size="9" fill="%233D3528"%3E报告1%3C/text%3E%3C/svg%3E', mimeType: 'image/svg+xml' },
  { uri: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="48" height="61" viewBox="0 0 48 61"%3E%3Crect width="48" height="61" rx="5" fill="%23f0ece6"/%3E%3Ctext x="24" y="33" text-anchor="middle" font-size="9" fill="%238A7D6E"%3E报告2%3C/text%3E%3C/svg%3E', mimeType: 'image/svg+xml' },
];

function buildDemoRecognitionFields(): Field[] {
  return buildInitialFields('thyroid').map((field) => {
    const demoValues: Record<string, { value: string; confidence: number }> = {
      disease_type: { value: '甲状腺', confidence: 0.95 },
      location: { value: '左叶中下段', confidence: 0.92 },
      tirads: { value: '3', confidence: 0.88 },
      echo_type: { value: '低回声', confidence: 0.86 },
      border: { value: '清晰', confidence: 0.85 },
      size_x: { value: '', confidence: 0.3 },
      calcification: { value: '', confidence: 0 },
    };
    const demo = demoValues[field.key];
    return demo ? { ...field, ...demo } : field;
  });
}

async function readUriAsBase64(uri: string): Promise<string> {
  try {
    return await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  } catch {
    // Fallback for some non-file schemes.
    const res = await fetch(uri);
    if (!res.ok) throw new Error('读取图片失败');
    const blob = await res.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('读取图片失败'));
      reader.readAsDataURL(blob);
    });
    const idx = dataUrl.indexOf(',');
    return idx >= 0 ? dataUrl.slice(idx + 1) : dataUrl;
  }
}

function buildInitialFields(diseaseType: DiseaseType): Field[] {
  const defs = diseaseType === 'breast' ? BREAST_FIELDS : diseaseType === 'lung' ? LUNG_FIELDS : THYROID_FIELDS;
  return defs.map((def) => ({
    ...def,
    value: diseaseType === 'thyroid' && def.key === 'disease_type' ? '甲状腺' : '',
    confidence: diseaseType === 'thyroid' && def.key === 'disease_type' ? 1 : 0,
    confirmed: false,
  }));
}

const CONFIDENCE_THRESHOLD = 0.5;

function parseFiniteNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const num = Number(trimmed);
  return Number.isFinite(num) ? num : null;
}

function isValidIsoDate(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return true;
  const date = new Date(trimmed);
  return !Number.isNaN(date.getTime());
}

function isValidFieldValue(field: Field): boolean {
  const trimmed = field.value.trim();
  if (!trimmed) return false;

  if (field.options) {
    return field.options.includes(trimmed);
  }

  if (field.key === 'exam_date') {
    return isValidIsoDate(trimmed);
  }

  if (field.key === 'size_x' || field.key === 'size_y' || field.key === 'size_z' || field.key === 'pleural_pull') {
    return parseFiniteNumber(trimmed) !== null;
  }

  return true;
}

function isConfirmedField(field: Field): boolean {
  if (!isValidFieldValue(field)) return false;
  return field.confirmed || field.confidence > CONFIDENCE_THRESHOLD;
}

function formatFieldValue(field: Field): string {
  const trimmed = field.value.trim();
  if (!trimmed) return '';
  if (field.key === 'tirads') return /^(?:\d|4[a-c])$/i.test(trimmed) ? `${trimmed}级` : trimmed;
  if (field.key === 'birads') return /^(?:\d|4[a-c])$/i.test(trimmed) ? `${trimmed}级` : trimmed;
  if (field.key === 'lung_rads') return /^(?:\d|4[a-cx])$/i.test(trimmed) ? `${trimmed}级` : trimmed;
  return trimmed;
}

function formatOptionLabel(field: Field, option: string): string {
  if (field.key === 'tirads' || field.key === 'birads') return `${option}级`;
  return option;
}

function displayDateFromFields(fields: Field[]): string {
  const raw = fields.find((field) => field.key === 'exam_date')?.value.trim();
  return raw || '2024-03-15';
}

function visibleReviewFields(fields: Field[], diseaseType: DiseaseType): Field[] {
  if (diseaseType !== 'thyroid') return fields;
  const byKey = new Map(fields.map((field) => [field.key, field]));
  return THYROID_DEMO_KEYS.map((key) => byKey.get(key)).filter((field): field is Field => Boolean(field));
}

function missingFieldValue(field: Field): string {
  if (field.key === 'size_x') return '识别不完整';
  return field.confidence > 0 ? formatFieldValue(field) : '未识别';
}

function normalizeOptionValue(value: string, options: string[]): string {
  const trimmed = value.trim();
  if (!trimmed) return '';

  const direct = options.find((opt) => opt === trimmed);
  if (direct) return direct;

  const lower = trimmed.toLowerCase();
  const ci = options.find((opt) => opt.toLowerCase() === lower);
  if (ci) return ci;

  // Allow values like "TI-RADS 3" / "BI-RADS 4a" / "LUNG-RADS 2".
  const cleaned = lower
    .replace(/ti-?rads/gi, '')
    .replace(/bi-?rads/gi, '')
    .replace(/lung-?rads/gi, '')
    .replace(/[^\da-z.]/gi, '')
    .trim();
  const cleanedMatch = options.find((opt) => opt.toLowerCase() === cleaned);
  return cleanedMatch ?? trimmed;
}

export default function RecognizePage() {
  const params = useLocalSearchParams<{ images?: string; diseaseType?: string; lesionId?: string; prototypeRecognitionSeed?: string }>();
  const demoSeed = isDemoSeed(params.prototypeRecognitionSeed);
  const diseaseTypeFromParams = useMemo(() => (demoSeed ? 'thyroid' : parseDiseaseType(params.diseaseType)), [demoSeed, params.diseaseType]);
  const imagesParam = Array.isArray(params.images) ? params.images[0] : params.images;
  const imageAssets = useMemo(() => (demoSeed ? DEMO_REPORT_IMAGES : parseReportImageAssetsParam(imagesParam)), [demoSeed, imagesParam]);
  const imageUris = useMemo(() => imageAssets.map((img) => img.uri), [imageAssets]);
  const lesionIdParam = Array.isArray(params.lesionId) ? params.lesionId[0] : params.lesionId;
  const lesionId = typeof lesionIdParam === 'string' && lesionIdParam ? lesionIdParam : null;
  const selectionLocked = Boolean(lesionId);
  const { data: lockedLesion, isFetched: lockedLesionFetched } = useLesion(lesionId ?? '');
  const lesionContextPending = selectionLocked && !lockedLesionFetched;
  const lesionContextMissing = selectionLocked && lockedLesionFetched && !lockedLesion;
  const lockedDiseaseType = lockedLesion ? parseDiseaseType(lockedLesion.disease_type) : null;
  const requestDiseaseType = (selectionLocked ? lockedDiseaseType : null) ?? diseaseTypeFromParams;
  const diseaseType: DiseaseType = requestDiseaseType;

  const [loading, setLoading] = useState(true);
  const [fields, setFields] = useState<Field[]>(() => buildInitialFields('thyroid'));
  const [expandedFieldKey, setExpandedFieldKey] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [quotaPaywallForced, setQuotaPaywallForced] = useState(false);

  const requestIdRef = useRef(0);
  const autoRunKeyRef = useRef<string | null>(null);

  const { data: subscriptionStatus, isLoading: subscriptionLoading } = useSubscriptionStatus();
  const quotaBlockedFromStatus = Boolean(subscriptionStatus && !canUseFeature(subscriptionStatus, 'ai_recognize'));
  const quotaBlocked = quotaBlockedFromStatus || quotaPaywallForced;

  useEffect(() => {
    if (!selectionLocked) return;
    if (!lockedLesionFetched) return;
    if (lockedLesion) return;
    setError('未找到该病灶');
    setLoading(false);
  }, [lockedLesion, lockedLesionFetched, selectionLocked]);

  useEffect(() => {
    if (!subscriptionStatus) return;
    const explicitRemaining = subscriptionStatus.featureRemaining?.ai_recognize;
    if (subscriptionStatus.isActive) {
      setQuotaPaywallForced(false);
      return;
    }
    if (typeof explicitRemaining === 'number' && explicitRemaining > 0) {
      setQuotaPaywallForced(false);
    }
  }, [subscriptionStatus]);

  const runRecognize = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    setError('');
    setFields(buildInitialFields(requestDiseaseType));

    if (demoSeed) {
      setPaywallVisible(false);
      setFields(buildDemoRecognitionFields());
      setLoading(false);
      return;
    }

    if (lesionContextMissing) {
      setError('未找到该病灶');
      setLoading(false);
      return;
    }

    if (quotaBlocked) {
      setError('本月AI识别次数已用完');
      setLoading(false);
      setPaywallVisible(true);
      return;
    }

    setPaywallVisible(false);
    setLoading(true);

    const requestImageUris = parseImageUris(imagesParam);
    if (requestImageUris.length === 0) {
      setError('未收到可识别的图片');
      setLoading(false);
      return;
    }

    try {
      const images = await Promise.all(requestImageUris.map((uri) => readUriAsBase64(uri)));
      const data = await api.post<RecognizeReportReply>('/api/v1/ai/recognize', {
        disease_type: requestDiseaseType,
        images,
      });

      if (requestIdRef.current !== requestId) return;

      const responseFields = data.fields ?? {};
      const defs = buildInitialFields(requestDiseaseType);
      const defKeys = new Set(defs.map((field) => field.key));

      const mapped = defs.map((field) => {
        const result = responseFields[field.key];
        const rawValue = typeof result?.value === 'string' ? result.value : '';
        const value = field.options ? normalizeOptionValue(rawValue, field.options) : rawValue;
        const confidence = typeof result?.confidence === 'number' ? result.confidence : 0;
        return { ...field, value, confidence, confirmed: false };
      });

      const extras = Object.entries(responseFields)
        .filter(([key]) => !defKeys.has(key))
        .map(([key, result]) => ({
          key,
          label: key,
          value: typeof result?.value === 'string' ? result.value : '',
          confidence: typeof result?.confidence === 'number' ? result.confidence : 0,
          confirmed: false,
          required: false,
        }));

      setFields([...mapped, ...extras]);
    } catch (e) {
      if (requestIdRef.current !== requestId) return;
      if (e instanceof ApiError && e.status === 403) {
        setQuotaPaywallForced(true);
        setPaywallVisible(true);
        setError('本月AI识别次数已用完');
      } else {
        setError(e instanceof Error ? e.message : '识别失败，请稍后重试');
      }
    } finally {
      if (requestIdRef.current !== requestId) return;
      setLoading(false);
    }
  }, [demoSeed, imagesParam, lesionContextMissing, quotaBlocked, requestDiseaseType]);

  useEffect(() => {
    if (!demoSeed && subscriptionLoading) return;
    if (lesionContextPending || lesionContextMissing) return;
    const key = `${diseaseType}|${imagesParam ?? ''}|${selectionLocked ? lesionId ?? '' : ''}|${demoSeed ? 'demo' : ''}`;
    if (autoRunKeyRef.current === key) return;
    autoRunKeyRef.current = key;
    void runRecognize();
  }, [
    demoSeed,
    diseaseType,
    imagesParam,
    lesionContextMissing,
    lesionContextPending,
    lesionId,
    runRecognize,
    selectionLocked,
    subscriptionLoading,
  ]);

  const confirmedCount = fields.filter(isConfirmedField).length;
  const totalCount = fields.length;
  const requiredFilled = fields.filter((field) => field.required).every(isValidFieldValue);
  const paywallActive = !demoSeed && (quotaBlocked || paywallVisible);
  const uploadFallback = {
    pathname: '/record/upload' as const,
    params: {
      images: imagesParam ?? stringifyReportImageAssetsParam(imageAssets),
      diseaseType: requestDiseaseType,
      ...(lesionId ? { lesionId } : {}),
    },
  };

  const updateField = useCallback((key: string, value: string) => {
    setFields((previousFields) =>
      previousFields.map((field) => (field.key === key ? { ...field, value, confirmed: true } : field))
    );
  }, []);

  const visibleFields = visibleReviewFields(fields, diseaseType);
  const recognized = visibleFields.filter((field) => field.confidence > CONFIDENCE_THRESHOLD && isValidFieldValue(field));
  const pending = visibleFields.filter((field) => !(field.confidence > CONFIDENCE_THRESHOLD && isValidFieldValue(field)));
  const displayTotalCount = diseaseType === 'thyroid' ? visibleFields.length : totalCount;
  const displayConfirmedCount = diseaseType === 'thyroid'
    ? visibleFields.filter(isConfirmedField).length
    : confirmedCount;
  const displayProgress = displayTotalCount === 0 ? 0 : displayConfirmedCount / displayTotalCount;
  const reportDate = displayDateFromFields(fields);

  if (Platform.OS === 'web' && demoSeed) {
    return (
      <div className="screen active" style={{ display: 'flex' }}>
        <div className="topbar"><button className="tb-back" onClick={() => router.replace('/(main)?prototypeHomeSeed=demo')}>← 取消</button><span className="tb-page">核对识别结果</span><span className="tb-step">步骤 2/3</span></div>
        <div className="scrl">
          <div style={{ background: '#fff', border: '0.5px solid var(--border)', borderRadius: 11, padding: 11, marginBottom: 11, display: 'flex', gap: 9, alignItems: 'center' }}><div style={{ display: 'flex', gap: 5 }}><div style={{ width: 48, height: 61, borderRadius: 5, background: '#f0ece6', border: '1px solid var(--dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: 'var(--dark)' }}>报告1</div><div style={{ width: 48, height: 61, borderRadius: 5, background: '#f0ece6', border: '0.5px solid #e0dbd2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: 'var(--hint)' }}>报告2</div></div><div><div style={{ fontSize: 12, fontWeight: 500, color: 'var(--dark)', marginBottom: 3 }}>超声报告</div><div style={{ fontSize: 10, color: 'var(--hint)', marginBottom: 5 }}>共2张 · 2024-03-15</div><div style={{ fontSize: 10, color: '#6b5f4e', border: '0.5px solid var(--border2)', borderRadius: 4, padding: '3px 7px', background: 'var(--page)', display: 'inline-block', cursor: 'pointer' }}>放大查看</div></div></div>
          <div className="prog-bar"><span className="prog-lbl">字段完整度</span><div className="prog-tr"><div className="prog-fill" /></div><span className="prog-ct">5/7 已确认</span></div>
          <div className="sec">已识别字段</div>
          <div className="fcard">
            <div className="frow"><span className="fn2">结节类型</span><span className="fval">甲状腺</span><div className="fchk"><div className="fchk-d" /></div><span className="far">›</span></div>
            <div className="frow"><span className="fn2">部位</span><span className="fval">左叶中下段</span><div className="fchk"><div className="fchk-d" /></div><span className="far">›</span></div>
            <div className="frow" style={{ background: 'var(--sand)', borderLeft: '2px solid var(--dark)' }}><span className="fn2">TI-RADS</span><span className="fval">3级</span><div className="fchk"><div className="fchk-d" /></div><span className="far">展开</span></div>
            <div className="frow"><span className="fn2">回声</span><span className="fval">低回声</span><div className="fchk"><div className="fchk-d" /></div><span className="far">›</span></div>
            <div className="frow"><span className="fn2">边界</span><span className="fval">清晰</span><div className="fchk"><div className="fchk-d" /></div><span className="far">›</span></div>
            <div className="ai-note"><div className="ai-dot" /><div className="ai-txt">以上字段由 AI 自动识别，点击可展开修改</div></div>
          </div>
          <div className="sec">需要补填</div>
          <div className="fcard"><div className="frow-w"><span className="fn2" style={{ color: 'var(--muted)' }}>大小</span><span className="fval-w">识别不完整</span><span className="wtag">请补填</span><span className="far" style={{ color: '#c4a882', marginLeft: 5 }}>›</span></div><div className="frow-w"><span className="fn2" style={{ color: 'var(--muted)' }}>钙化</span><span className="fval-w">未识别</span><span className="wtag">请补填</span><span className="far" style={{ color: '#c4a882', marginLeft: 5 }}>›</span></div></div>
        </div>
        <div className="bot-bar"><div className="wh"><div className="wdot" /><div className="wt">还有 <span style={{ color: 'var(--amber)', fontWeight: 500 }}>2个字段</span> 未补填，补填后可继续</div></div><button className="btn-full" onClick={() => router.push('/record/match?prototypeMatchSeed=demo&diseaseType=thyroid&recognizedData=%7B%22disease_type%22%3A%22%E7%94%B2%E7%8A%B6%E8%85%BA%22%2C%22location%22%3A%22%E5%B7%A6%E5%8F%B6%E4%B8%AD%E4%B8%8B%E6%AE%B5%22%2C%22tirads%22%3A%223%22%2C%22echo_type%22%3A%22%E4%BD%8E%E5%9B%9E%E5%A3%B0%22%2C%22border%22%3A%22%E6%B8%85%E6%99%B0%22%2C%22size_x%22%3A%228.3%22%7D')}>下一步：匹配病灶</button></div>
      </div>
    );
  }

  if (lesionContextPending) {
    return (
      <SafeAreaView className="flex-1 bg-page-bg px-4">
        <SecondaryPageHeader
          title="AI识别核对"
          fallbackHref={uploadFallback}
          rightSlot={<Text className="text-xs font-medium text-neutral-text">步骤 2/3</Text>}
        />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#3D3528" />
          <Text className="mt-4 text-primary">加载病灶信息...</Text>
          <Text className="mt-2 text-sm text-neutral-text">正在确认病灶上下文</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-page-bg px-4">
        <SecondaryPageHeader
          title="AI识别核对"
          fallbackHref={uploadFallback}
          rightSlot={<Text className="text-xs font-medium text-neutral-text">步骤 2/3</Text>}
        />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#3D3528" />
          <Text className="mt-4 text-primary">AI识别中...</Text>
          <Text className="mt-2 text-sm text-neutral-text">正在分析超声报告</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-page-bg">
      <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
        <SecondaryPageHeader
          title="AI识别核对"
          fallbackHref={uploadFallback}
          rightSlot={<Text className="text-xs font-medium text-neutral-text">步骤 2/3</Text>}
        />

        {imageUris.length > 0 ? (
          <Card className="mb-4 mt-4 flex-row items-center gap-3 border border-neutral-bg p-3">
            <View className="flex-row gap-1.5">
              {imageUris.slice(0, 2).map((uri, idx) => (
                <View
                  key={`${uri}-${idx}`}
                  className={`h-[61px] w-12 items-center justify-center rounded-md border ${idx === 0 ? 'border-primary bg-[#F0ECE6]' : 'border-neutral-bg bg-[#F0ECE6]'}`}
                >
                  <Image
                    source={{ uri }}
                    accessibilityLabel={`报告图片预览${idx + 1}`}
                    className="absolute h-[61px] w-12 rounded-md opacity-20"
                  />
                  <Text className={idx === 0 ? 'text-[9px] text-primary' : 'text-[9px] text-neutral-text'}>
                    报告{idx + 1}
                  </Text>
                </View>
              ))}
            </View>
            <View className="flex-1">
              <Text className="mb-1 text-xs font-semibold text-primary">超声报告</Text>
              <Text className="mb-1.5 text-[10px] text-neutral-text">共{imageUris.length}张 · {reportDate}</Text>
              <View className="self-start rounded border border-neutral-bg bg-page-bg px-2 py-1">
                <Text className="text-[10px] text-primary">放大查看</Text>
              </View>
            </View>
          </Card>
        ) : null}

        <View className="mb-4 rounded-xl bg-card p-3">
          <View className="mb-2 flex-row items-center justify-between">
            <Text className="text-xs font-medium text-primary">字段完整度</Text>
            <Text className="text-xs text-neutral-text">
              {displayConfirmedCount}/{displayTotalCount} 已确认
            </Text>
          </View>
          <ProgressBar progress={displayProgress} />
        </View>

        {recognized.length > 0 ? (
          <>
            <Text className="mb-2 text-sm font-semibold text-primary">已识别字段</Text>
            <Card className="mb-2 overflow-hidden p-0">
              {recognized.map((field) => {
                const expanded = expandedFieldKey === field.key;
                return (
                  <View key={field.key}>
                    <Pressable
                      className={`flex-row items-center border-b border-neutral-bg px-4 py-3 ${field.options ? 'bg-sand border-l-2 border-l-primary' : ''}`}
                      onPress={() => field.options ? setExpandedFieldKey(expanded ? null : field.key) : undefined}
                    >
                      <Text className="w-24 text-sm font-medium text-primary">{field.label}</Text>
                      <Text className="flex-1 text-sm font-semibold text-primary">{formatFieldValue(field)}</Text>
                      <View className="mr-3 h-5 w-5 items-center justify-center rounded-full border border-primary">
                        <View className="h-2.5 w-2.5 rounded-full bg-primary" />
                      </View>
                      <Text className="text-xs text-neutral-text">{field.options ? (expanded ? '收起' : '展开') : '›'}</Text>
                    </Pressable>
                    {field.options && expanded ? (
                      <View className="border-b border-neutral-bg bg-card px-4 py-3">
                        <View className="mb-2 flex-row justify-between">
                          <Text className="text-sm font-semibold text-primary">{field.label} 分级</Text>
                          <Pressable onPress={() => setExpandedFieldKey(null)}>
                            <Text className="text-[10px] text-neutral-text">收起</Text>
                          </Pressable>
                        </View>
                        <Input value={formatFieldValue(field)} editable={false} />
                        <View className="mt-2 flex-row flex-wrap gap-2">
                          {field.options.map((option) => (
                            <Tag
                              key={option}
                              text={formatOptionLabel(field, option)}
                              selected={field.value === option}
                              onPress={() => updateField(field.key, option)}
                            />
                          ))}
                        </View>
                      </View>
                    ) : null}
                  </View>
                );
              })}
              <View className="flex-row items-center gap-2 bg-page-bg px-4 py-3">
                <View className="h-2 w-2 rounded-full bg-primary" />
                <Text className="text-xs text-neutral-text">以上字段由 AI 自动识别，点击可展开修改</Text>
              </View>
            </Card>
          </>
        ) : null}

        {pending.length > 0 ? (
          <>
            <Text className="mb-2 mt-4 text-sm font-semibold text-primary">需要补填</Text>
            <Card className="mb-2 overflow-hidden p-0">
              {pending.map((field) => (
                <View key={field.key} className="border-b border-neutral-bg px-4 py-3">
                  <View className="mb-2 flex-row items-center">
                    <View className="w-24 flex-row items-center">
                      <Text className="text-sm font-medium text-neutral-text">{field.label}</Text>
                      {field.required ? <Text className="text-new-text"> *</Text> : null}
                    </View>
                    <Text className="flex-1 text-sm text-neutral-text">{missingFieldValue(field)}</Text>
                    <Badge text="请补填" variant="increase" />
                    <Text className="ml-2 text-xs text-increase-text">›</Text>
                  </View>
                  {field.options ? (
                    <View className="mt-1 flex-row flex-wrap gap-2">
                      {field.options.map((option) => (
                        <Tag
                          key={option}
                          text={formatOptionLabel(field, option)}
                          selected={field.value === option}
                          onPress={() => updateField(field.key, option)}
                        />
                      ))}
                    </View>
                  ) : (
                    <Input
                      value={field.value}
                      onChangeText={(value) => updateField(field.key, value)}
                      placeholder={`请输入${field.label}`}
                    />
                  )}
                </View>
              ))}
            </Card>
          </>
        ) : null}

        {error ? <Text className="mt-2 text-sm text-new-text">{error}</Text> : null}
        {error ? (
          <View className="mt-3">
            <Button title="重试识别" fullWidth variant="secondary" onPress={runRecognize} />
          </View>
        ) : null}

        <View className="mb-10 mt-6">
          {(!requiredFilled || paywallActive) ? (
            <View className="mb-3 flex-row items-center rounded-xl bg-increase-bg px-3 py-2">
              <View className="mr-2 h-2 w-2 rounded-full bg-increase-text" />
              <Text className="text-xs text-increase-text">
                还有 <Text className="font-semibold text-increase-text">{fields.filter((field) => field.required && !isValidFieldValue(field)).length}个字段</Text> 未补填，补填后可继续
              </Text>
            </View>
          ) : null}
          <Button
            title="下一步：匹配病灶"
            fullWidth
            disabled={!requiredFilled || paywallActive}
            onPress={() => {
              if (paywallActive) {
                setPaywallVisible(true);
                return;
              }
                if (lesionContextMissing) return;
              const data = Object.fromEntries(fields.map((field) => [field.key, field.value]));
              router.push({
                pathname: '/record/match' as any,
                params: {
                  recognizedData: JSON.stringify(data),
                    diseaseType: requestDiseaseType,
                  images: imagesParam ?? stringifyReportImageAssetsParam(imageAssets),
                  ...(demoSeed ? { prototypeMatchSeed: 'demo' } : {}),
                  ...(lesionId ? { lesionId } : {}),
                },
              });
            }}
          />
        </View>
      </ScrollView>

      <PaywallSheet visible={paywallVisible} onClose={() => setPaywallVisible(false)} feature="AI识别" />
    </SafeAreaView>
  );
}
