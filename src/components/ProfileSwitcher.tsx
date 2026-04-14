import { ScrollView, Pressable, View, Text } from 'react-native';

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

export function ProfileSwitcher({ profiles, activeId, onSelect, onAdd }: ProfileSwitcherProps) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-4 py-3">
      {profiles.map((profile) => {
        const isActive = profile.id === activeId;
        const isAlert = !isActive && profile.isUrgent;
        const container = isActive
          ? 'bg-card border border-ink-100 shadow-sm'
          : isAlert
            ? 'bg-new-bg border border-new-text/20'
            : 'bg-nav-bg border border-ink-100/0';
        const nameColor = isAlert ? 'text-primary' : 'text-primary';
        const subColor = isAlert ? 'text-new-text' : 'text-neutral-text';
        return (
          <Pressable
            key={profile.id}
            testID={`profile-switcher-chip-${profile.id}`}
            onPress={() => onSelect(profile.id)}
            className="mr-3"
          >
            <View className={`min-w-[110px] rounded-2xl px-5 py-3 ${container}`}>
              <Text className={`text-sm font-semibold ${nameColor}`}>{profile.nickname}</Text>
              <Text className={`mt-1 text-xs font-medium ${subColor}`}>{profile.subtitle}</Text>
            </View>
          </Pressable>
        );
      })}

      {onAdd ? (
        <Pressable testID="profile-switcher-add" onPress={onAdd} className="mr-4">
          <View className="h-[54px] w-[54px] items-center justify-center rounded-2xl border border-ink-100 bg-card">
            <Text className="text-xl font-semibold text-neutral-text">+</Text>
          </View>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}
