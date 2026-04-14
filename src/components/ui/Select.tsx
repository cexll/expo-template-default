import { View, Text, Pressable } from 'react-native';
import { useState } from 'react';

type SelectOption = { label: string; value: string };

type SelectProps = {
  label?: string;
  options: SelectOption[];
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

export function Select({ label, options, value, onChange, placeholder }: SelectProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <View className="gap-1">
      {label && <Text className="text-sm text-primary font-medium">{label}</Text>}
      <Pressable onPress={() => setOpen(!open)} className="rounded-lg border border-neutral-bg px-4 py-3">
        <Text className={selected ? 'text-primary' : 'text-neutral-text'}>
          {selected?.label || placeholder || '请选择'}
        </Text>
      </Pressable>
      {open && (
        <View className="rounded-lg border border-neutral-bg bg-card mt-1">
          {options.map((option) => (
            <Pressable
              key={option.value}
              onPress={() => { onChange(option.value); setOpen(false); }}
              className="px-4 py-3 border-b border-neutral-bg"
            >
              <Text className={`text-sm ${option.value === value ? 'text-primary font-semibold' : 'text-neutral-text'}`}>
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}
