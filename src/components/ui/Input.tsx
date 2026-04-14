import { View, Text, TextInput, type TextInputProps } from 'react-native';

type InputProps = TextInputProps & {
  label?: string;
  error?: string;
};

export function Input({ label, error, ...props }: InputProps) {
  return (
    <View className="gap-1">
      {label && <Text className="text-sm text-primary font-medium">{label}</Text>}
      <TextInput
        className={`rounded-lg border px-4 py-3 text-base text-primary ${error ? 'border-new-text' : 'border-neutral-bg'}`}
        placeholderTextColor="#C4BDB4"
        {...props}
      />
      {error && <Text className="text-xs text-new-text">{error}</Text>}
    </View>
  );
}
