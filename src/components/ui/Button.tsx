import { Pressable, Text, type PressableProps } from 'react-native';

type ButtonProps = PressableProps & {
  title: string;
  variant?: 'primary' | 'secondary' | 'outline';
  fullWidth?: boolean;
};

export function Button({ title, variant = 'primary', fullWidth, ...props }: ButtonProps) {
  const base = 'rounded-lg px-6 py-3 items-center justify-center';
  const widthClass = fullWidth ? 'w-full' : '';
  const variantClass =
    variant === 'primary' ? 'bg-primary' :
    variant === 'secondary' ? 'bg-neutral-bg' :
    'border border-primary bg-transparent';
  const textClass =
    variant === 'primary' ? 'text-white font-semibold' :
    variant === 'secondary' ? 'text-primary font-semibold' :
    'text-primary font-semibold';

  return (
    <Pressable className={`${base} ${widthClass} ${variantClass}`} {...props}>
      <Text className={textClass}>{title}</Text>
    </Pressable>
  );
}
