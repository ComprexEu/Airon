import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { ACCENTS, AccentKey, ThemeMode } from '@/theme/colors';
import { useTheme, useThemeSettings } from '@/theme/ThemeContext';

const MODES: { key: ThemeMode; label: string }[] = [
  { key: 'light', label: 'Light' },
  { key: 'dark', label: 'Dark' },
  { key: 'system', label: 'System' },
];

/** "Demo User" -> "DU"; no name -> first letter of the e-mail. */
function initials(name: string | null, email: string | undefined): string {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length > 0) return words.slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  return (email?.[0] ?? '?').toUpperCase();
}

export default function AccountScreen() {
  const t = useTheme();
  const { session } = useAuth();
  const { settings, isLight, setMode, setAccent } = useThemeSettings();
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const email = session?.user.email;

  useFocusEffect(useCallback(() => {
    if (!session) return;
    supabase
      .from('profiles')
      .select('display_name')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => setDisplayName(data?.display_name ?? null));
  }, [session]));

  function confirmDelete() {
    Alert.alert('Delete account?', 'Delete your account and all your data? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: deleteAccount },
    ]);
  }

  async function deleteAccount() {
    setDeleting(true);
    const { error } = await supabase.rpc('delete_my_account');
    if (error) {
      setDeleting(false);
      Alert.alert('Could not delete the account', error.message);
      return;
    }
    await supabase.auth.signOut(); // the tabs layout then redirects to the login screen
  }

  const bottomButton = (pressed: boolean, color: string) => ({
    flex: 1,
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: color,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    opacity: pressed ? 0.6 : 1,
  });
  const buttonText = { fontFamily: 'Inter_600SemiBold', fontSize: 16 };

  return (
    <Screen scroll={false}>
      <View style={{ flex: 1, padding: 20, paddingBottom: 16, gap: 16 }}>
        <AppText variant="title">Account</AppText>

        {/* Profile */}
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: t.accent,
            alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 18, color: t.onAccent }}>
              {initials(displayName, email)}
            </Text>
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            {displayName ? (
              <Text numberOfLines={1} style={{ fontFamily: 'Inter_600SemiBold', fontSize: 17, color: t.text }}>
                {displayName}
              </Text>
            ) : null}
            <Text numberOfLines={1} style={{ fontFamily: 'Inter_400Regular', fontSize: 13, color: t.muted }}>
              {email}
            </Text>
          </View>
        </Card>

        {/* Appearance */}
        <Card style={{ gap: 16 }}>
          {/* Light / Dark / System */}
          <View style={{ flexDirection: 'row', height: 44, borderRadius: 12, backgroundColor: t.bg, padding: 4 }}>
            {MODES.map((m) => {
              const on = settings.mode === m.key;
              return (
                <Pressable key={m.key} onPress={() => setMode(m.key)} accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  style={{ flex: 1, borderRadius: 9, alignItems: 'center', justifyContent: 'center',
                    backgroundColor: on ? t.text : 'transparent' }}>
                  <Text style={{ fontSize: 14, color: on ? t.bg : t.muted,
                    fontFamily: on ? 'Inter_600SemiBold' : 'Inter_400Regular' }}>
                    {m.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Accent color */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            {(Object.keys(ACCENTS) as AccentKey[]).map((key) => {
              const on = settings.accent === key;
              return (
                <Pressable key={key} onPress={() => setAccent(key)} accessibilityRole="button"
                  accessibilityLabel={`Accent ${ACCENTS[key].name}`} accessibilityState={{ selected: on }}
                  style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
                    borderWidth: 2, borderColor: on ? t.text : 'transparent' }}>
                  <View style={{ width: 36, height: 36, borderRadius: 18,
                    backgroundColor: ACCENTS[key][isLight ? 'light' : 'dark'].accent }} />
                </Pressable>
              );
            })}
          </View>
        </Card>

        <View style={{ flex: 1 }} />

        {/* Bottom buttons */}
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Pressable onPress={() => supabase.auth.signOut()} accessibilityRole="button"
            style={({ pressed }) => bottomButton(pressed, t.line)}>
            <Text style={[buttonText, { color: t.text }]}>Sign out</Text>
          </Pressable>
          <Pressable onPress={confirmDelete} disabled={deleting} accessibilityRole="button"
            accessibilityState={{ busy: deleting }}
            style={({ pressed }) => bottomButton(pressed, t.danger)}>
            {deleting
              ? <ActivityIndicator color={t.danger} />
              : <Text style={[buttonText, { color: t.danger }]}>Delete account</Text>}
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}
