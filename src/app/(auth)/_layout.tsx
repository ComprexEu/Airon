import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/theme/ThemeContext';

export default function AuthLayout() {
  const t = useTheme();
  const { session, loading } = useAuth();

  if (loading) return null;
  if (session) return <Redirect href="/" />; // signed in -> tabs

  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bg } }} />;
}
