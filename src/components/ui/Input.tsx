import { Text, TextInput, View, type TextInputProps } from '@/tw';

type InputProps = TextInputProps & {
  label?: string;
  error?: string;
};

export function Input({ label, error, ...props }: InputProps) {
  const hasError = typeof error === 'string' && error.trim().length > 0;
  return (
    <View className="gap-[6px]">
      {label && <Text className="text-[11px] font-medium text-muted">{label}</Text>}
      <TextInput
        className={`rounded-[9px] border bg-card px-[14px] py-[11px] text-sm text-primary ${hasError ? 'border-new-text' : 'border-border-strong'}`}
        placeholderTextColor="#C4BDB4"
        {...props}
      />
      {hasError ? <Text className="text-xs text-new-text">{error}</Text> : null}
    </View>
  );
}
