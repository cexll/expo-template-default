import { useCallback, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Tag } from '@/components/ui/Tag';
import { useCreateProfile, useProfiles } from '@/hooks/useProfiles';
import { useAuth } from '@/providers/auth-provider';

function makeId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export default function OnboardingPage() {
  const [nickname, setNickname] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | null>(null);
  const [birthYear, setBirthYear] = useState('');
  const [error, setError] = useState('');

  const { isAuthenticated } = useAuth();
  const { data: profiles = [] } = useProfiles({ enabled: isAuthenticated });
  const createProfile = useCreateProfile();

  const preview = useMemo(() => {
    const trimmedNickname = nickname.trim();
    const nicknameLabel = trimmedNickname || '未命名';
    const avatarLabel = trimmedNickname ? trimmedNickname.slice(0, 1) : '—';

    const genderLabel = gender === 'male' ? '男' : gender === 'female' ? '女' : '—';

    const year = Number.parseInt(birthYear, 10);
    const currentYear = new Date().getFullYear();
    const birthYearLabel = Number.isFinite(year) ? `${year}年` : '—年';
    const ageLabel = Number.isFinite(year) && year > 0 ? `${currentYear - year}岁` : '—岁';

    return {
      avatarLabel,
      nicknameLabel,
      metaLabel: `${genderLabel} · ${birthYearLabel} · ${ageLabel}`,
    };
  }, [birthYear, gender, nickname]);

  const submit = useCallback(async () => {
    if (!isAuthenticated) {
      setError('请先登录');
      router.replace('/(auth)/login');
      return;
    }
    if (!nickname.trim()) {
      setError('请输入昵称');
      return;
    }
    if (!gender) {
      setError('请选择性别');
      return;
    }
    if (!birthYear || Number.isNaN(Number(birthYear))) {
      setError('请输入出生年份');
      return;
    }

    setError('');

    try {
      const profileId = makeId('profile');
      await createProfile.mutateAsync({
        id: profileId,
        nickname: nickname.trim(),
        gender,
        birth_year: Number(birthYear),
        avatar_uri: null,
        sort_order: profiles.length,
      });

      router.replace('/(main)');
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建失败，请重试');
    }
  }, [birthYear, createProfile, gender, isAuthenticated, nickname, profiles.length]);

  return (
    <SafeAreaView className="flex-1 bg-page-bg">
      <View className="flex-1 px-6 pt-12">
        <Text className="mb-2 text-2xl font-bold text-primary">创建档案</Text>
        <Text className="mb-8 text-base text-neutral-text">为自己或家人建立第一个档案</Text>

        <Input
          label="昵称"
          value={nickname}
          onChangeText={setNickname}
          placeholder="例如：本人、妈妈"
        />

        <View className="mt-4">
          <Text className="mb-2 text-sm font-medium text-primary">性别</Text>
          <View className="flex-row gap-3">
            <Tag text="男" selected={gender === 'male'} onPress={() => setGender('male')} />
            <Tag text="女" selected={gender === 'female'} onPress={() => setGender('female')} />
          </View>
        </View>

        <View className="mt-4">
          <Input
            label="出生年份"
            value={birthYear}
            onChangeText={setBirthYear}
            keyboardType="number-pad"
            maxLength={4}
            placeholder="例如：1985"
          />
        </View>

        {error ? <Text className="mt-3 text-sm text-new-text">{error}</Text> : null}

        <View className="mt-6 rounded-2xl bg-sand px-4 py-4">
          <Text className="text-sm font-semibold text-neutral-text">档案预览</Text>
          <View className="mt-3 flex-row items-center gap-3">
            <View className="h-10 w-10 items-center justify-center rounded-xl bg-primary">
              <Text className="text-sm font-semibold text-white">{preview.avatarLabel}</Text>
            </View>
            <View className="flex-1">
              <Text className="text-base font-semibold text-primary">{preview.nicknameLabel}</Text>
              <Text className="mt-1 text-xs text-neutral-text">{preview.metaLabel}</Text>
            </View>
          </View>
        </View>

        <View className="mt-8">
          <Button
            title={createProfile.isPending ? '创建中...' : '开始使用'}
            onPress={() => void submit()}
            fullWidth
            disabled={createProfile.isPending}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
