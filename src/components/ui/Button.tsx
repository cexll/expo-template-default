import { Pressable, Text, type PressableProps } from '@/tw';

type ButtonProps = PressableProps & {
  title: string;
  variant?: 'primary' | 'secondary' | 'outline';
  fullWidth?: boolean;
};

export function Button({ title, variant = 'primary', fullWidth, ...props }: ButtonProps) {
  const base = 'items-center justify-center rounded-[9px] px-6 py-[10px]';
  const widthClass = fullWidth ? 'w-full' : '';
  const variantClass =
    variant === 'primary' ? 'bg-primary' :
    variant === 'secondary' ? 'bg-neutral-bg' :
    'border border-primary bg-transparent';
  const textClass =
    variant === 'primary' ? 'text-nav-bg text-xs font-medium' :
    variant === 'secondary' ? 'text-primary text-xs font-medium' :
    'text-primary text-xs font-medium';

  return (
    <Pressable className={`${base} ${widthClass} ${variantClass}`} {...props}>
      <Text className={textClass}>{title}</Text>
    </Pressable>
  );
}
