import { useCallback, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Button } from '@/components/ui/Button';
import { Tag } from '@/components/ui/Tag';

type DiseaseType = 'thyroid' | 'breast' | 'lung';

const DISEASE_LABELS: Record<DiseaseType, string> = {
  thyroid: '甲状腺',
  breast: '乳腺',
  lung: '肺',
};

export default function UploadPage() {
  const [images, setImages] = useState<string[]>([]);
  const [diseaseType, setDiseaseType] = useState<DiseaseType | null>(null);

  const pickFromGallery = useCallback(async () => {
    try {
      const ImagePicker = await import('expo-image-picker');
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
      const ImagePicker = await import('expo-image-picker');
      const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
      if (!result.canceled) {
        setImages((prev) => [...prev, result.assets[0].uri].slice(0, 5));
      }
    } catch (error) {
      console.warn('Camera not available:', error);
    }
  }, []);

  const removeImage = useCallback((index: number) => {
    setImages((prev) => prev.filter((_, currentIndex) => currentIndex !== index));
  }, []);

  const canProceed = images.length > 0 && diseaseType !== null;

  return (
    <SafeAreaView className="flex-1 bg-page-bg">
      <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
        <Text className="text-2xl font-bold text-primary mt-4 mb-2">上传报告</Text>
        <Text className="text-sm text-neutral-text mb-6">拍照或选择超声检查报告图片</Text>

        <View className="flex-row flex-wrap gap-3 mb-6">
          {images.map((uri, index) => (
            <View key={uri} className="relative">
              <Image source={{ uri }} className="w-24 h-24 rounded-xl" />
              <Pressable
                className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-new-text items-center justify-center"
                onPress={() => removeImage(index)}
              >
                <Text className="text-white text-xs">✕</Text>
              </Pressable>
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
