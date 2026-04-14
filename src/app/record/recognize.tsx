import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Tag } from '@/components/ui/Tag';
import { PaywallSheet } from '@/components/PaywallSheet';
import { canUseFeature, useSubscriptionStatus } from '@/hooks/useSubscriptionStatus';
import { api } from '@/lib/api';

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
const ECHO_OPTIONS = ['低回声', '等回声', '高回声', '混合回声'];
const BORDER_OPTIONS = ['清晰', '模糊', '不规则'];

type FieldDefinition = Omit<Field, 'value' | 'confidence' | 'confirmed'>;

const THYROID_FIELDS: FieldDefinition[] = [
  { key: 'location', label: '部位', required: true },
  { key: 'size_x', label: '大小(长)', required: true },
  { key: 'size_y', label: '大小(宽)', required: false },
  { key: 'size_z', label: '大小(高)', required: false },
  { key: 'tirads', label: 'TI-RADS', required: true, options: TIRADS_OPTIONS },
  { key: 'echo_type', label: '回声', required: false, options: ECHO_OPTIONS },
  { key: 'border', label: '边界', required: false, options: BORDER_OPTIONS },
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
  { key: 'birads', label: 'BI-RADS', required: true },
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
  { key: 'lung_rads', label: 'LUNG-RADS', required: true },
  { key: 'density', label: '密度', required: false },
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
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) return parsed.filter((uri): uri is string => typeof uri === 'string' && uri.trim() !== '');
    return [];
  } catch {
    return [];
  }
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
    value: '',
    confidence: 0,
    confirmed: false,
  }));
}

export default function RecognizePage() {
  const params = useLocalSearchParams<{ images?: string; diseaseType?: string }>();
  const diseaseType = useMemo(() => parseDiseaseType(params.diseaseType), [params.diseaseType]);
  const imagesParam = Array.isArray(params.images) ? params.images[0] : params.images;

  const [loading, setLoading] = useState(true);
  const [fields, setFields] = useState<Field[]>(() => buildInitialFields('thyroid'));
  const [error, setError] = useState('');
  const [paywallVisible, setPaywallVisible] = useState(false);

  const requestIdRef = useRef(0);
  const autoRunRef = useRef(false);

  const { data: subscriptionStatus, isLoading: subscriptionLoading } = useSubscriptionStatus();

  const runRecognize = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    if (subscriptionStatus && !canUseFeature(subscriptionStatus, 'ai_recognize')) {
      setError('本月AI识别次数已用完');
      setLoading(false);
      setPaywallVisible(true);
      return;
    }

    setError('');
    setLoading(true);
    setFields(buildInitialFields(diseaseType));

    const imageUris = parseImageUris(imagesParam);
    if (imageUris.length === 0) {
      setError('未收到可识别的图片');
      setLoading(false);
      return;
    }

    try {
      const images = await Promise.all(imageUris.map((uri) => readUriAsBase64(uri)));
      const data = await api.post<RecognizeReportReply>('/api/v1/ai/recognize', {
        disease_type: diseaseType,
        images,
      });

      if (requestIdRef.current !== requestId) return;

      const responseFields = data.fields ?? {};
      const defs = buildInitialFields(diseaseType);
      const defKeys = new Set(defs.map((field) => field.key));

      const mapped = defs.map((field) => {
        const result = responseFields[field.key];
        const value = typeof result?.value === 'string' ? result.value : '';
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
      setError(e instanceof Error ? e.message : '识别失败，请稍后重试');
    } finally {
      if (requestIdRef.current !== requestId) return;
      setLoading(false);
    }
  }, [diseaseType, imagesParam, subscriptionStatus]);

  useEffect(() => {
    if (autoRunRef.current) return;
    if (subscriptionLoading) return;
    autoRunRef.current = true;
    void runRecognize();
  }, [runRecognize, subscriptionLoading]);

  const confirmedCount = fields.filter((field) => field.confirmed || field.value.trim() !== '').length;
  const totalCount = fields.length;
  const requiredFilled = fields.filter((field) => field.required).every((field) => field.value.trim() !== '');

  const updateField = useCallback((key: string, value: string) => {
    setFields((previousFields) =>
      previousFields.map((field) => (field.key === key ? { ...field, value, confirmed: true } : field))
    );
  }, []);

  const recognized = fields.filter((field) => field.confidence > 0.5);
  const pending = fields.filter((field) => field.confidence <= 0.5);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-page-bg">
        <ActivityIndicator size="large" color="#3D3528" />
        <Text className="mt-4 text-primary">AI识别中...</Text>
        <Text className="mt-2 text-sm text-neutral-text">正在分析超声报告</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-page-bg">
      <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
        <Text className="mb-2 mt-4 text-2xl font-bold text-primary">AI识别核对</Text>

        <View className="mb-4">
          <View className="mb-1 flex-row justify-between">
            <Text className="text-xs text-neutral-text">
              {confirmedCount}/{totalCount} 已确认
            </Text>
          </View>
          <ProgressBar progress={totalCount === 0 ? 0 : confirmedCount / totalCount} />
        </View>

        {recognized.length > 0 ? (
          <>
            <Text className="mb-2 text-sm font-semibold text-primary">已识别</Text>
            {recognized.map((field) => (
              <Card key={field.key} className="mb-2">
                <View className="mb-1 flex-row items-center justify-between">
                  <Text className="text-sm font-medium text-primary">{field.label}</Text>
                  <Badge
                    text={`${Math.round(field.confidence * 100)}%`}
                    variant={field.confidence > 0.8 ? 'stable' : 'increase'}
                  />
                </View>
                {field.options ? (
                  <View className="mt-1 flex-row flex-wrap gap-2">
                    {field.options.map((option) => (
                      <Tag
                        key={option}
                        text={option}
                        selected={field.value === option}
                        onPress={() => updateField(field.key, option)}
                      />
                    ))}
                  </View>
                ) : (
                  <Input value={field.value} onChangeText={(value) => updateField(field.key, value)} />
                )}
              </Card>
            ))}
          </>
        ) : null}

        {pending.length > 0 ? (
          <>
            <Text className="mb-2 mt-4 text-sm font-semibold text-primary">待补填</Text>
            {pending.map((field) => (
              <Card key={field.key} className="mb-2">
                <View className="mb-1 flex-row items-center justify-between">
                  <Text className="text-sm font-medium text-primary">
                    {field.label}
                    {field.required ? <Text className="text-new-text"> *</Text> : null}
                  </Text>
                </View>
                <Input
                  value={field.value}
                  onChangeText={(value) => updateField(field.key, value)}
                  placeholder={`请输入${field.label}`}
                />
              </Card>
            ))}
          </>
        ) : null}

        {error ? <Text className="mt-2 text-sm text-new-text">{error}</Text> : null}
        {error ? (
          <View className="mt-3">
            <Button title="重试识别" fullWidth variant="secondary" onPress={runRecognize} />
          </View>
        ) : null}

        <View className="mb-10 mt-6">
          <Button
            title="下一步 — 匹配病灶"
            fullWidth
            disabled={!requiredFilled}
            onPress={() => {
              const data = Object.fromEntries(fields.map((field) => [field.key, field.value]));
              router.push({
                pathname: '/record/match' as any,
                params: {
                  recognizedData: JSON.stringify(data),
                  diseaseType,
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
