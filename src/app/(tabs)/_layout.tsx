import { Tabs } from 'expo-router';
import { tabIcon } from '@/components/TabIcon';
import { useTheme } from '@/theme/ThemeContext';

export default function TabsLayout() {
  const t = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: t.bg },
        tabBarStyle: { backgroundColor: t.surface, borderTopColor: t.line },
        tabBarActiveTintColor: t.accent,
        tabBarInactiveTintColor: t.muted,
        tabBarLabelStyle: { fontFamily: 'Inter_600SemiBold' },
      }}
    >
      <Tabs.Screen name="plans" options={{ title: 'Plans', tabBarIcon: tabIcon('clipboard-outline') }} />
      <Tabs.Screen name="index" options={{ title: 'Today', tabBarIcon: tabIcon('barbell-outline') }} />
      <Tabs.Screen name="progress" options={{ title: 'Progress', tabBarIcon: tabIcon('stats-chart-outline') }} />
      <Tabs.Screen name="agent" options={{ title: 'Agent', tabBarIcon: tabIcon('sparkles-outline') }} />
    </Tabs>
  );
}
