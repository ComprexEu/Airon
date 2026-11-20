import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { supabase } from '@/lib/supabase';
import { ACCENTS, AccentKey, darkTheme, lightTheme, Theme, ThemeMode } from './colors';

const STORAGE_KEY = 'airon.theme';

type Settings = { mode: ThemeMode; accent: AccentKey };
const DEFAULTS: Settings = { mode: 'system', accent: 'steel' };

/** Settings from storage or the profile; unknown values fall back to the defaults. */
function parseSettings(saved: { mode?: unknown; accent?: unknown }): Settings {
  return {
    mode: saved.mode === 'dark' || saved.mode === 'light' ? saved.mode : 'system',
    accent: typeof saved.accent === 'string' && saved.accent in ACCENTS ? (saved.accent as AccentKey) : DEFAULTS.accent,
  };
}

type ThemeState = {
  theme: Theme;
  isLight: boolean;
  settings: Settings;
  ready: boolean; // false until saved settings are read, so the app does not flash the default colors
  setMode: (mode: ThemeMode) => void;
  setAccent: (accent: AccentKey) => void;
};

const ThemeContext = createContext<ThemeState>({
  theme: darkTheme,
  isLight: false,
  settings: DEFAULTS,
  ready: true,
  setMode: () => {},
  setAccent: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const scheme = useColorScheme(); // 'light' | 'dark' | null | undefined
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [ready, setReady] = useState(false);

  // Settings live in two places: on the phone, so the app starts in the right theme at once,
  // and in the profile, so they follow the user to another phone after sign-in
  useEffect(() => {
    // 1. quick start from the phone's storage
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) setSettings(parseSettings(JSON.parse(raw)));
      })
      .catch(() => {}) // broken or missing data: keep the defaults
      .finally(() => setReady(true));

    // 2. after sign-in, take the settings from the profile (e.g. set on another phone)
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== 'SIGNED_IN' || !session) return;
      // not awaited inside the listener: Supabase waits for listeners before finishing the sign-in
      setTimeout(async () => {
        const { data: profile } = await supabase
          .from('profiles').select('theme_mode, accent').eq('id', session.user.id).single();
        if (!profile) return;
        const next = parseSettings({ mode: profile.theme_mode, accent: profile.accent });
        setSettings(next);
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      }, 0);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const value = useMemo<ThemeState>(() => {
    const isLight = settings.mode === 'system' ? scheme === 'light' : settings.mode === 'light';
    const base = isLight ? lightTheme : darkTheme;
    const accent = ACCENTS[settings.accent][isLight ? 'light' : 'dark'];

    const update = (patch: Partial<Settings>) => {
      const next = { ...settings, ...patch };
      setSettings(next);
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      // also to the profile; offline the choice still stays on this phone
      supabase.auth.getSession().then(({ data }) => {
        if (!data.session) return;
        supabase.from('profiles')
          .update({ theme_mode: next.mode, accent: next.accent })
          .eq('id', data.session.user.id)
          .then(() => {});
      });
    };

    return {
      theme: { ...base, ...accent },
      isLight,
      settings,
      ready,
      setMode: (mode) => update({ mode }),
      setAccent: (accentKey) => update({ accent: accentKey }),
    };
  }, [scheme, settings, ready]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** Colors of the current theme. */
export const useTheme = () => useContext(ThemeContext).theme;
/** Is the light theme on (from the system or chosen by the user)? */
export const useIsLight = () => useContext(ThemeContext).isLight;
/** The user's choice and functions to change it – for the Account screen. */
export const useThemeSettings = () => useContext(ThemeContext);
