import { View, Text, Pressable } from 'react-native';

type TagProps = {
  text: string;
  selected?: boolean;
  onPress?: () => void;
};

export function Tag({ text, selected, onPress }: TagProps) {
  return (
    <Pressable onPress={onPress}>
      <View className={`rounded-full px-4 py-2 ${selected ? 'bg-primary' : 'bg-neutral-bg'}`}>
        <Text className={`text-sm ${selected ? 'text-white font-semibold' : 'text-neutral-text'}`}>{text}</Text>
      </View>
    </Pressable>
  );
}
