import { Inter_400Regular, Inter_600SemiBold, Inter_700Bold, useFonts } from '@expo-google-fonts/inter';
import { SplashScreen, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AuthProvider } from '@/context/AuthContext';
import { ThemeProvider, useIsLight, useTheme } from '@/theme/ThemeContext';

SplashScreen.preventAutoHideAsync(); // keep the splash screen until fonts are ready

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </ThemeProvider>
  );
}

function RootNavigator() {
  const t = useTheme();
  const isLight = useIsLight();
  const [fontsLoaded] = useFonts({ Inter_400Regular, Inter_600SemiBold, Inter_700Bold });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <>
      <StatusBar style={isLight ? 'dark' : 'light'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: t.bg }, // no white flash between screens in dark mode
          headerStyle: { backgroundColor: t.bg },
          headerTintColor: t.text,
          headerTitleStyle: { fontFamily: 'Inter_600SemiBold' },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="plan/[id]" options={{ headerShown: true, title: 'Edit plan' }} />
        <Stack.Screen name="explore" options={{ headerShown: true, title: 'Explore' }} />
        <Stack.Screen
          name="exercise-picker"
          options={{ headerShown: true, title: 'Choose exercise', presentation: 'modal' }}
        />
      </Stack>
    </>
  );
}
