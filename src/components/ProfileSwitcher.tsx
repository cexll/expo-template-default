import { Platform, StyleSheet } from 'react-native';
import { Pressable, ScrollView, Text, View } from '@/tw';

const chipTextStyle = { lineHeight: 'normal' } as unknown as { lineHeight: number };

type ProfileItem = {
  id: string;
  nickname: string;
  subtitle: string;
  isUrgent: boolean;
};

type ProfileSwitcherProps = {
  profiles: ProfileItem[];
  activeId: string;
  onSelect: (id: string) => void;
  onAdd?: () => void;
};

const PROFILE_SWITCHER_CONTENT_STYLE = {
  alignItems: 'flex-start' as const,
  flexDirection: 'row' as const,
  gap: 7,
};

const PROFILE_SWITCHER_WEB_STYLE = {
  backgroundColor: '#F5F0E6',
  borderBottomColor: '#DDD8CF',
  borderBottomWidth: 1,
  overflowX: 'auto' as const,
  overflowY: 'hidden' as const,
  paddingBottom: 11,
  paddingHorizontal: 14,
  paddingTop: 8,
};

const PROFILE_SWITCHER_CHIP_STYLE = {
  borderRadius: 20,
  minWidth: 70,
  paddingHorizontal: 13,
  paddingVertical: 8,
};

const PROFILE_SWITCHER_ADD_STYLE = {
  alignItems: 'center' as const,
  alignSelf: 'center' as const,
  borderColor: '#D4CDC0',
  borderRadius: 19,
  borderStyle: 'dashed' as const,
  borderWidth: 0.5,
  display: 'flex' as const,
  height: 38,
  justifyContent: 'center' as const,
  width: 38,
};

const styles = StyleSheet.create({
  activeChipSurface: {
    backgroundColor: '#3D3528',
  },
  activeChipSubtitle: {
    color: 'rgba(245,240,230,.5)',
  },
});

export function ProfileSwitcher({ profiles, activeId, onSelect, onAdd }: ProfileSwitcherProps) {
  const items = (
    <>
      {profiles.map((profile) => {
        const isActive = profile.id === activeId;
        const isAlert = !isActive && profile.isUrgent;
        const container = isActive
          ? 'bg-primary border border-primary'
          : isAlert
            ? 'bg-new-bg border border-new-border'
            : 'bg-card border border-border-strong';
        const nameColor = isActive ? 'text-nav-bg' : 'text-primary';
        const subColor = isActive ? '' : isAlert ? 'text-new-mid' : 'text-[#a8998a]';
        return (
          <Pressable
            key={profile.id}
            testID={`profile-switcher-chip-${profile.id}`}
            onPress={() => onSelect(profile.id)}
            style={Platform.OS === 'web' ? { alignSelf: 'flex-start' } : undefined}
            className=""
          >
            <View
              testID={`profile-switcher-chip-surface-${profile.id}`}
              dataSet={{ demoRole: 'chip' }}
              style={[PROFILE_SWITCHER_CHIP_STYLE, isActive ? styles.activeChipSurface : undefined]}
              className={container}
            >
              <Text className={`text-center text-xs font-medium leading-[13.2px] ${nameColor}`}>{profile.nickname}</Text>
              <Text
                className={`mt-[3px] text-center text-[10px] ${isAlert ? 'font-medium' : 'font-normal'} leading-normal ${subColor}`}
                style={[chipTextStyle, isActive ? styles.activeChipSubtitle : undefined]}
              >
                {profile.subtitle}
              </Text>
            </View>
          </Pressable>
        );
      })}

      {onAdd ? (
        <Pressable
          testID="profile-switcher-add"
          onPress={onAdd}
          className=""
        >
          <View dataSet={{ demoRole: 'chip-add' }} style={PROFILE_SWITCHER_ADD_STYLE}>
            <Text style={{ lineHeight: 22 }} className="text-[17px] font-normal text-neutral-text">+</Text>
          </View>
        </Pressable>
      ) : null}
    </>
  );

  return (
    <View testID="profile-switcher-wrapper" style={Platform.OS === 'web' ? { height: 90 } : undefined}>
      {Platform.OS === 'web' ? (
        <View testID="profile-switcher-scroll-view" dataSet={{ demoRole: 'pstrip' }} style={PROFILE_SWITCHER_WEB_STYLE}>
          <View style={PROFILE_SWITCHER_CONTENT_STYLE}>
            {items}
          </View>
        </View>
      ) : (
        <ScrollView
          testID="profile-switcher-scroll-view"
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={PROFILE_SWITCHER_CONTENT_STYLE}
          className="border-b border-border-strong bg-nav-bg px-[14px] pb-[11px] pt-2"
        >
          {items}
        </ScrollView>
      )}
    </View>
  );
}
