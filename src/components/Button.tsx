import { ActivityIndicator, Pressable, Text } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';

type Props = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'outline';
  loading?: boolean;
  disabled?: boolean;
};

export function Button({ title, onPress, variant = 'primary', loading, disabled }: Props) {
  const t = useTheme();
  const primary = variant === 'primary';
  const inactive = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      style={({ pressed }) => ({
        minHeight: 50,
        paddingHorizontal: 16,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: primary ? t.accent : 'transparent',
        borderWidth: primary ? 0 : 1,
        borderColor: t.line,
        opacity: pressed || disabled ? 0.6 : 1,
      })}
    >
      {loading ? (
        <ActivityIndicator color={primary ? t.onAccent : t.text} />
      ) : (
        <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 16, color: primary ? t.onAccent : t.text }}>{title}</Text>
      )}
    </Pressable>
  );
}
