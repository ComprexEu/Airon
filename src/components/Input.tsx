import { TextInput, TextInputProps, View } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';
import { AppText } from './AppText';

export function Input({ label, style, ...rest }: TextInputProps & { label: string }) {
  const t = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <AppText variant="small" muted>
        {label}
      </AppText>
      <TextInput
        placeholderTextColor={t.muted}
        accessibilityLabel={label}
        style={[
          {
            height: 48,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: t.line,
            backgroundColor: t.surface,
            color: t.text,
            paddingHorizontal: 14,
            fontFamily: 'Inter_400Regular',
            fontSize: 15,
          },
          style,
        ]}
        {...rest}
      />
    </View>
  );
}
