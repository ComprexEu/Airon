import { Text, TextProps } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';

const sizes = {
  title: { fontSize: 30, fontFamily: 'Inter_700Bold' },
  heading: { fontSize: 18, fontFamily: 'Inter_600SemiBold' },
  body: { fontSize: 15, fontFamily: 'Inter_400Regular' },
  small: { fontSize: 13, fontFamily: 'Inter_400Regular' },
};

type Props = TextProps & { variant?: keyof typeof sizes; muted?: boolean };

export function AppText({ variant = 'body', muted, style, ...rest }: Props) {
  const t = useTheme();
  return <Text style={[sizes[variant], { color: muted ? t.muted : t.text }, style]} {...rest} />;
}