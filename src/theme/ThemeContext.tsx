import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { ACCENTS, AccentKey, darkTheme, lightTheme, Theme, ThemeMode } from './colors';

const STORAGE_KEY = 'airon.theme';

type Settings = { mode: ThemeMode; accent: AccentKey };
const DEFAULTS: Settings = { mode: 'system', accent: 'steel' };

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

  // Read the saved choice once on start
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!raw) return;
        const saved = JSON.parse(raw) as Partial<Settings>;
        setSettings({
          mode: saved.mode === 'dark' || saved.mode === 'light' ? saved.mode : 'system',
          accent: saved.accent && saved.accent in ACCENTS ? saved.accent : DEFAULTS.accent,
        });
      })
      .catch(() => {}) // broken or missing data: keep the defaults
      .finally(() => setReady(true));
  }, []);

  const value = useMemo<ThemeState>(() => {
    const isLight = settings.mode === 'system' ? scheme === 'light' : settings.mode === 'light';
    const base = isLight ? lightTheme : darkTheme;
    const accent = ACCENTS[settings.accent][isLight ? 'light' : 'dark'];

    const update = (patch: Partial<Settings>) => {
      const next = { ...settings, ...patch };
      setSettings(next);
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
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
