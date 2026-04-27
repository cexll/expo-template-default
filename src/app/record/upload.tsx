import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SecondaryPageHeader } from '@/components/SecondaryPageHeader';
import { Button } from '@/components/ui/Button';
import { Tag } from '@/components/ui/Tag';
import { useLesion } from '@/hooks/useLesions';
import { isDemoSeed } from '@/lib/prototype-review';
import { parseReportImageAssetsParam, stringifyReportImageAssetsParam, type ReportImageAsset } from '@/lib/report-images';
import { Image, Pressable, SafeAreaView, ScrollView, Text, View } from '@/tw';

type DiseaseType = 'thyroid' | 'breast' | 'lung';

const DEMO_REPORT_IMAGES: ReportImageAsset[] = [
  { uri: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"%3E%3Crect width="96" height="96" rx="12" fill="%23f0ece6"/%3E%3Ctext x="48" y="52" text-anchor="middle" font-size="13" fill="%233D3528"%3E报告1%3C/text%3E%3C/svg%3E', mimeType: 'image/svg+xml' },
  { uri: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"%3E%3Crect width="96" height="96" rx="12" fill="%23f0ece6"/%3E%3Ctext x="48" y="52" text-anchor="middle" font-size="13" fill="%238A7D6E"%3E报告2%3C/text%3E%3C/svg%3E', mimeType: 'image/svg+xml' },
];

const DISEASE_LABELS: Record<DiseaseType, string> = {
  thyroid: '甲状腺',
  breast: '乳腺',
  lung: '肺',
};

function parseDiseaseTypeParam(value: unknown): DiseaseType | null {
  const v = Array.isArray(value) ? value[0] : value;
  if (v === 'thyroid' || v === 'breast' || v === 'lung') return v;
  return null;
}

function normalizeMimeType(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!trimmed.includes('/')) return null;
  return trimmed;
}

export default function UploadPage() {
  const params = useLocalSearchParams<{ images?: string; diseaseType?: string; lesionId?: string; prototypeRecognitionSeed?: string }>();
  const demoSeed = isDemoSeed(params.prototypeRecognitionSeed);
  const [images, setImages] = useState<ReportImageAsset[]>(() => demoSeed ? DEMO_REPORT_IMAGES : parseReportImageAssetsParam(params.images));
  const [diseaseType, setDiseaseType] = useState<DiseaseType | null>(() => demoSeed ? 'thyroid' : parseDiseaseTypeParam(params.diseaseType));
  const lesionIdParam = Array.isArray(params.lesionId) ? params.lesionId[0] : params.lesionId;
  const lesionId = typeof lesionIdParam === 'string' && lesionIdParam ? lesionIdParam : null;
  const selectionLocked = Boolean(lesionId);
  const { data: lockedLesion } = useLesion(lesionId ?? '');
  const lockedDiseaseType = lockedLesion ? (parseDiseaseTypeParam(lockedLesion.disease_type) as DiseaseType | null) : null;
  const effectiveDiseaseType: DiseaseType | null = selectionLocked
    ? lockedDiseaseType ?? parseDiseaseTypeParam(params.diseaseType) ?? diseaseType
    : diseaseType;

  useEffect(() => {
    if (selectionLocked) return;
    if (!diseaseType) {
      const parsed = parseDiseaseTypeParam(params.diseaseType);
      if (parsed) setDiseaseType(parsed);
    }
  }, [diseaseType, params.diseaseType, selectionLocked]);

  useEffect(() => {
    if (!selectionLocked) return;
    if (!lockedDiseaseType) return;
    if (diseaseType !== lockedDiseaseType) setDiseaseType(lockedDiseaseType);
  }, [diseaseType, lockedDiseaseType, selectionLocked]);

  useEffect(() => {
    if (images.length === 0) {
      if (demoSeed) {
        setImages(DEMO_REPORT_IMAGES);
        return;
      }
      const parsed = parseReportImageAssetsParam(params.images);
      if (parsed.length > 0) setImages(parsed);
    }
  }, [demoSeed, images.length, params.images]);

  const moveImage = useCallback((fromIndex: number, direction: -1 | 1) => {
    setImages((prev) => {
      const toIndex = fromIndex + direction;
      if (toIndex < 0 || toIndex >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }, []);

  const pickFromGallery = useCallback(async () => {
    try {
      // Avoid dynamic import in Jest/node; keep inside callback to stay resilient in environments
      // where `expo-image-picker` is unavailable.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const ImagePicker = require('expo-image-picker') as typeof import('expo-image-picker');
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 0.8,
        selectionLimit: 5 - images.length,
      });
      if (!result.canceled) {
        setImages((prev) =>
          [
            ...prev,
            ...result.assets.map((asset) => ({
              uri: asset.uri,
              mimeType: normalizeMimeType((asset as any).mimeType) ?? null,
            })),
          ].slice(0, 5)
        );
      }
    } catch (error) {
      console.warn('Image picker not available:', error);
    }
  }, [images.length]);

  const takePhoto = useCallback(async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const ImagePicker = require('expo-image-picker') as typeof import('expo-image-picker');
      const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
      if (!result.canceled) {
        setImages((prev) =>
          [
            ...prev,
            {
              uri: result.assets[0].uri,
              mimeType: normalizeMimeType((result.assets[0] as any).mimeType) ?? null,
            },
          ].slice(0, 5)
        );
      }
    } catch (error) {
      console.warn('Camera not available:', error);
    }
  }, []);

  const removeImage = useCallback((index: number) => {
    setImages((prev) => {
      const target = prev[index]?.uri;
      if (typeof target === 'string' && target.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(target);
        } catch {
          // ignore
        }
      }
      return prev.filter((_, currentIndex) => currentIndex !== index);
    });
  }, []);

  const canProceed = images.length > 0 && effectiveDiseaseType !== null;

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

  return (
    <SafeAreaView className="flex-1 bg-page-bg">
      <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
        <SecondaryPageHeader
          title="上传报告"
          fallbackHref={lesionId ? `/lesion/${lesionId}` : '/(main)'}
          rightSlot={<Text className="text-xs font-medium text-neutral-text">步骤 1/3</Text>}
        />
        <Text className="mb-6 mt-4 text-sm text-neutral-text">拍照或选择超声检查报告图片</Text>

        <View className="flex-row flex-wrap gap-3 mb-6">
          {images.map((img, index) => (
            <View key={`${img.uri}-${index}`} className="relative">
              <Image source={{ uri: img.uri }} className="w-24 h-24 rounded-xl" />
              <View className="absolute bottom-1 left-1 rounded bg-primary opacity-80 px-1.5 py-0.5">
                <Text className="text-[10px] text-white">{index + 1}</Text>
              </View>
              <Pressable
                className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-new-text items-center justify-center"
                accessibilityLabel={`删除图片${index + 1}`}
                onPress={() => removeImage(index)}
              >
                <Text className="text-white text-xs">✕</Text>
              </Pressable>
              {images.length > 1 ? (
                <View className="absolute -bottom-2 right-0 flex-row gap-1">
                  <Pressable
                    className={`w-7 h-7 rounded-full items-center justify-center border border-neutral-bg bg-white ${
                      index === 0 ? 'opacity-40' : ''
                    }`}
                    accessibilityLabel={`上移图片${index + 1}`}
                    disabled={index === 0}
                    onPress={() => moveImage(index, -1)}
                  >
                    <Text className="text-xs text-primary">↑</Text>
                  </Pressable>
                  <Pressable
                    className={`w-7 h-7 rounded-full items-center justify-center border border-neutral-bg bg-white ${
                      index === images.length - 1 ? 'opacity-40' : ''
                    }`}
                    accessibilityLabel={`下移图片${index + 1}`}
                    disabled={index === images.length - 1}
                    onPress={() => moveImage(index, 1)}
                  >
                    <Text className="text-xs text-primary">↓</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          ))}
          {images.length < 5 ? (
            <View className="flex-row gap-3">
              <Pressable
                className="w-24 h-24 rounded-xl border-2 border-dashed border-neutral-bg items-center justify-center"
                onPress={pickFromGallery}
              >
                <Text className="text-2xl text-neutral-text">📷</Text>
                <Text className="text-xs text-neutral-text mt-1">相册</Text>
              </Pressable>
              <Pressable
                className="w-24 h-24 rounded-xl border-2 border-dashed border-neutral-bg items-center justify-center"
                onPress={takePhoto}
              >
                <Text className="text-2xl text-neutral-text">📸</Text>
                <Text className="text-xs text-neutral-text mt-1">拍照</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
        <Text className="text-xs text-neutral-text mb-6">最多5张，支持同一次检查的多页报告</Text>

        <Text className="text-sm font-semibold text-primary mb-3">检查类型</Text>
        {selectionLocked ? (
          <Text className="text-xs text-neutral-text mb-2">已从病灶进入，本次检查类型已锁定</Text>
        ) : null}
        <View className="flex-row gap-3 mb-8">
          {(Object.keys(DISEASE_LABELS) as DiseaseType[]).map((type) => (
            <Tag
              key={type}
              text={DISEASE_LABELS[type]}
              selected={effectiveDiseaseType === type}
              onPress={() => {
                if (selectionLocked) return;
                setDiseaseType(type);
              }}
            />
          ))}
        </View>

        <Button
          title="开始识别"
          fullWidth
          disabled={!canProceed}
          onPress={() => {
            router.push({
              pathname: '/record/recognize',
              params: {
                images: stringifyReportImageAssetsParam(images),
                diseaseType: effectiveDiseaseType,
                ...(lesionId ? { lesionId } : {}),
                ...(demoSeed ? { prototypeRecognitionSeed: 'demo' } : {}),
              },
            });
          }}
        />
        <View className="h-10" />
      </ScrollView>
    </SafeAreaView>
  );
}
