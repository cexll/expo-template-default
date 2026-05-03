import { useCallback, useMemo, useState } from 'react';
import { router } from 'expo-router';
import { Platform, StyleSheet } from 'react-native';
import { useCreateBackendProfile, useProfiles } from '@/hooks/useProfiles';
import { useAuth } from '@/providers/auth-provider';
import { Pressable, SafeAreaView, Text, TextInput, View } from '@/tw';

export default function OnboardingPage() {
  const [nickname, setNickname] = useState('本人');
  const [gender, setGender] = useState<'male' | 'female' | null>('female');
  const [birthYear, setBirthYear] = useState('1985');
  const [error, setError] = useState('');

  const { isAuthenticated, user } = useAuth();
  const { data: profiles = [] } = useProfiles({ enabled: isAuthenticated });
  const createProfile = useCreateBackendProfile();

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
      if (!user?.id) {
        setError('无法读取登录用户，请重新登录');
        return;
      }

      await createProfile.mutateAsync({
        sessionUserId: user.id,
        nickname: nickname.trim(),
        gender,
        birthYear: Number(birthYear),
        existingCount: profiles.length,
      });

      router.replace('/(main)');
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建失败，请重试');
    }
  }, [birthYear, createProfile, gender, isAuthenticated, nickname, profiles.length, user?.id]);

  const year = Number.parseInt(birthYear, 10);
  const ageLabel = Number.isFinite(year) && year > 0 ? `（${new Date().getFullYear() - year}岁）` : '（—岁）';
  const demoPreviewMetaLabel = gender === 'male' ? '男 · 1985年 · 39岁' : gender === 'female' ? '女 · 1985年 · 39岁' : preview.metaLabel;

  if (Platform.OS === 'web') {
    return (
      <div className="screen active" style={{ display: 'flex' }}>
        <div className="onboard-wrap">
          <div data-testid="onboarding-top" className="ob-top">
            <div className="ob-step-row">
              <div className="ob-dot" />
              <div className="ob-line" />
              <div className="ob-dot-off" />
              <div className="ob-line" />
              <div className="ob-dot-off" />
            </div>
            <div className="ob-title">创建第一个档案</div>
            <div className="ob-sub">为自己或家人建立健康档案，开始管理结节数据</div>
          </div>
          <div className="ob-body">
            <div className="ob-field">
              <div className="ob-label">昵称</div>
              <input className="ob-input" placeholder="如：本人、妈妈、爸爸" value={nickname} onChange={(event) => setNickname(event.currentTarget.value)} />
            </div>
            <div className="ob-field">
              <div className="ob-label">性别</div>
              <div className="ob-seg" id="ob-sex">
                <button className={`ob-seg-btn ${gender === 'female' ? 'sel' : ''}`} onClick={() => setGender('female')}>女</button>
                <button className={`ob-seg-btn ${gender === 'male' ? 'sel' : ''}`} onClick={() => setGender('male')}>男</button>
              </div>
            </div>
            <div className="ob-field">
              <div className="ob-label">出生年份</div>
              <div className="ob-year-wrap">
                <input className="ob-year-input" type="number" placeholder="1985" value={birthYear} min="1920" max="2024" onChange={(event) => setBirthYear(event.currentTarget.value)} />
                <span className="ob-year-lbl">年</span>
                <span style={{ fontSize: 12, color: '#b0a494' }}>{ageLabel}</span>
              </div>
            </div>
            <div className="ob-preview">
              <div className="ob-preview-label">档案预览</div>
              <div className="ob-preview-row">
                <div className="ob-preview-avatar">{preview.avatarLabel}</div>
                <div>
                  <div className="ob-preview-name">{preview.nicknameLabel}</div>
                  <div className="ob-preview-meta">{demoPreviewMetaLabel}</div>
                </div>
              </div>
            </div>
          </div>
          <div className="ob-footer">
            <button className="btn-full" onClick={() => void submit()}>创建档案，开始使用</button>
            <div className="ob-skip">跳过，稍后再设置</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <SafeAreaView testID="onboarding-safe-area" style={styles.safeArea}>
      <View style={styles.screen}>
        <View testID="onboarding-top" style={styles.top}>
          <View style={styles.stepRow}>
            <View style={styles.stepDot} />
            <View style={styles.stepLine} />
            <View style={styles.stepDotOff} />
            <View style={styles.stepLine} />
            <View style={styles.stepDotOff} />
          </View>
          <Text dataSet={{ font: 'serif' }} style={styles.title}>创建第一个档案</Text>
          <Text style={styles.subtitle}>为自己或家人建立健康档案，开始管理结节数据</Text>
        </View>

        <View style={styles.body}>
          <View style={styles.field}>
            <Text style={styles.label}>昵称</Text>
            <TextInput
              style={styles.input}
              value={nickname}
              onChangeText={setNickname}
              placeholder="如：本人、妈妈、爸爸"
              placeholderTextColor="#C4BDB4"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>性别</Text>
            <View testID="onboarding-gender-segment" style={styles.segmentedControl}>
              <Pressable
                onPress={() => setGender('female')}
                accessibilityState={{ selected: gender === 'female' }}
                style={[styles.segmentButton, gender === 'female' && styles.segmentButtonSelected]}
              >
                <Text style={[styles.segmentText, gender === 'female' && styles.segmentTextSelected]}>女</Text>
              </Pressable>
              <Pressable
                onPress={() => setGender('male')}
                accessibilityState={{ selected: gender === 'male' }}
                style={[styles.segmentButton, gender === 'male' && styles.segmentButtonSelected]}
              >
                <Text style={[styles.segmentText, gender === 'male' && styles.segmentTextSelected]}>男</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>出生年份</Text>
            <View style={styles.yearRow}>
              <TextInput
                style={styles.yearInput}
                value={birthYear}
                onChangeText={setBirthYear}
                keyboardType="number-pad"
                maxLength={4}
                placeholder="1985"
                placeholderTextColor="#C4BDB4"
              />
              <Text style={styles.yearSuffix}>年</Text>
              <Text style={styles.agePreview}>{ageLabel}</Text>
            </View>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.previewCard}>
            <Text style={styles.previewLabel}>档案预览</Text>
            <View style={styles.previewRow}>
              <View style={styles.previewAvatar}>
                <Text style={styles.previewAvatarText}>{preview.avatarLabel}</Text>
              </View>
              <View>
                <Text style={styles.previewName}>{preview.nicknameLabel}</Text>
                <Text style={styles.previewMeta}>{preview.metaLabel}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.footer}>
          <Pressable
            testID="onboarding-submit-btn"
            onPress={() => void submit()}
            disabled={createProfile.isPending}
            accessibilityState={{ disabled: createProfile.isPending }}
            style={[styles.primaryButton, createProfile.isPending && styles.primaryButtonDisabled]}
          >
            <Text style={styles.primaryButtonText}>{createProfile.isPending ? '创建中...' : '创建档案，开始使用'}</Text>
          </Pressable>
          <Pressable onPress={() => router.replace('/(main)')}>
            <Text style={styles.skipText}>跳过，稍后再设置</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FAF8F4',
  },
  screen: {
    flex: 1,
    minHeight: 640,
    backgroundColor: '#FAF8F4',
  },
  top: {
    backgroundColor: '#F5F0E6',
    borderBottomColor: '#DDD8CF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: 16,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  stepRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    marginBottom: 14,
  },
  stepDot: {
    backgroundColor: '#3D3528',
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  stepDotOff: {
    backgroundColor: '#DDD8CF',
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  stepLine: {
    backgroundColor: '#DDD8CF',
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  title: {
    color: '#3D3528',
    fontFamily: 'DM Serif Display',
    fontSize: 18,
    marginBottom: 4,
  },
  subtitle: {
    color: '#8A7D6E',
    fontSize: 12,
  },
  body: {
    flex: 1,
    gap: 14,
    padding: 20,
  },
  field: {
    gap: 6,
  },
  label: {
    color: '#8A7D6E',
    fontSize: 11,
    fontWeight: '500',
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderColor: '#DDD8CF',
    borderRadius: 9,
    borderWidth: StyleSheet.hairlineWidth,
    color: '#3D3528',
    fontSize: 13,
    minHeight: 40,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  segmentedControl: {
    backgroundColor: '#FFFFFF',
    borderColor: '#DDD8CF',
    borderRadius: 9,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  segmentButton: {
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: 6,
    paddingVertical: 10,
  },
  segmentButtonSelected: {
    backgroundColor: '#3D3528',
  },
  segmentText: {
    color: '#8A7D6E',
    fontSize: 12,
    fontWeight: '500',
  },
  segmentTextSelected: {
    color: '#F5F0E6',
  },
  yearRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  yearInput: {
    backgroundColor: '#FFFFFF',
    borderColor: '#DDD8CF',
    borderRadius: 9,
    borderWidth: StyleSheet.hairlineWidth,
    color: '#3D3528',
    flex: 1,
    fontFamily: 'DM Mono',
    fontSize: 14,
    minHeight: 40,
    paddingHorizontal: 14,
    paddingVertical: 11,
    textAlign: 'center',
  },
  yearSuffix: {
    color: '#8A7D6E',
    fontSize: 12,
  },
  agePreview: {
    color: '#B0A494',
    fontSize: 12,
  },
  error: {
    color: '#8B3A1A',
    fontSize: 12,
  },
  previewCard: {
    backgroundColor: '#F5F0E6',
    borderRadius: 10,
    marginTop: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  previewLabel: {
    color: '#8A7D6E',
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 6,
  },
  previewRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  previewAvatar: {
    alignItems: 'center',
    backgroundColor: '#3D3528',
    borderRadius: 10,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  previewAvatarText: {
    color: '#F5F0E6',
    fontSize: 13,
    fontWeight: '500',
  },
  previewName: {
    color: '#3D3528',
    fontSize: 13,
    fontWeight: '500',
  },
  previewMeta: {
    color: '#8A7D6E',
    fontSize: 11,
    marginTop: 1,
  },
  footer: {
    backgroundColor: '#FAF8F4',
    borderTopColor: '#E8E2D8',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingBottom: 16,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#3D3528',
    borderRadius: 9,
    padding: 11,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: '#F5F0E6',
    fontSize: 13,
    fontWeight: '500',
  },
  skipText: {
    color: '#B0A494',
    fontSize: 11,
    marginTop: 10,
    textAlign: 'center',
  },
});
