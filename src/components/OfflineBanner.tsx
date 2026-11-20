import { useNetInfo } from '@react-native-community/netinfo';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeContext';
import { AppText } from './AppText';

/** Red bar at the top of the screen while the phone has no internet. */
export function OfflineBanner() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { isConnected } = useNetInfo();
  if (isConnected !== false) return null; // null = not known yet, don't alarm the user
  return (
    <View style={{ backgroundColor: t.danger, paddingTop: insets.top + 6, paddingBottom: 6, paddingHorizontal: 16, alignItems: 'center' }}
      accessibilityRole="alert">
      <AppText variant="small" style={{ color: '#FFFFFF', textAlign: 'center' }}>
        No internet – you can save changes once you&apos;re back online
      </AppText>
    </View>
  );
}
