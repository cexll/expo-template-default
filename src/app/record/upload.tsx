import { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Button } from '@/components/ui/Button';
import { Tag } from '@/components/ui/Tag';

type DiseaseType = 'thyroid' | 'breast' | 'lung';

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

function parseImageUris(value: unknown): string[] {
  const v = Array.isArray(value) ? value[0] : value;
  if (typeof v !== 'string' || !v.trim()) return [];
  try {
    const parsed = JSON.parse(v) as unknown;
    if (Array.isArray(parsed)) {
      return parsed
        .filter((uri): uri is string => typeof uri === 'string' && uri.trim() !== '')
        .slice(0, 5);
    }
    return [];
  } catch {
    return [];
  }
}

export default function UploadPage() {
  const params = useLocalSearchParams<{ images?: string; diseaseType?: string }>();
  const [images, setImages] = useState<string[]>(() => parseImageUris(params.images));
  const [diseaseType, setDiseaseType] = useState<DiseaseType | null>(() => parseDiseaseTypeParam(params.diseaseType));

  useEffect(() => {
    if (!diseaseType) {
      const parsed = parseDiseaseTypeParam(params.diseaseType);
      if (parsed) setDiseaseType(parsed);
    }
  }, [diseaseType, params.diseaseType]);

  useEffect(() => {
    if (images.length === 0) {
      const parsed = parseImageUris(params.images);
      if (parsed.length > 0) setImages(parsed);
    }
  }, [images.length, params.images]);

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
        setImages((prev) => [...prev, ...result.assets.map((asset) => asset.uri)].slice(0, 5));
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
        setImages((prev) => [...prev, result.assets[0].uri].slice(0, 5));
      }
    } catch (error) {
      console.warn('Camera not available:', error);
    }
  }, []);

  const removeImage = useCallback((index: number) => {
    setImages((prev) => {
      const target = prev[index];
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

  const canProceed = images.length > 0 && diseaseType !== null;

  return (
    <SafeAreaView className="flex-1 bg-page-bg">
      <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
        <Text className="text-2xl font-bold text-primary mt-4 mb-2">上传报告</Text>
        <Text className="text-sm text-neutral-text mb-6">拍照或选择超声检查报告图片</Text>

        <View className="flex-row flex-wrap gap-3 mb-6">
          {images.map((uri, index) => (
            <View key={`${uri}-${index}`} className="relative">
              <Image source={{ uri }} className="w-24 h-24 rounded-xl" />
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
        <View className="flex-row gap-3 mb-8">
          {(Object.keys(DISEASE_LABELS) as DiseaseType[]).map((type) => (
            <Tag
              key={type}
              text={DISEASE_LABELS[type]}
              selected={diseaseType === type}
              onPress={() => setDiseaseType(type)}
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
              params: { images: JSON.stringify(images), diseaseType },
            });
          }}
        />
        <View className="h-10" />
      </ScrollView>
    </SafeAreaView>
  );
}
