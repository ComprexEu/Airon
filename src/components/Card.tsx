import { View, ViewProps } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';

export function Card({ style, ...rest }: ViewProps) {
  const t = useTheme();
  return <View style={[{ backgroundColor: t.surface, borderRadius: 16, padding: 16, gap: 10 }, style]} {...rest} />;
}