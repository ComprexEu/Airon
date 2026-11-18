export type Theme = {
  bg: string;       // screen background
  surface: string;  // card background
  line: string;     // lines and borders
  text: string;     // main text
  muted: string;    // secondary text
  accent: string;   // accent color (buttons, active tab)
  onAccent: string; // text on top of the accent
  danger: string;   // errors, delete actions
};

export const darkTheme: Theme = {
  bg: '#111315',
  surface: '#1B1E22',
  line: '#2E3338',
  text: '#F3F3F1',
  muted: '#A3A8AE',
  accent: '#7FA7D9',
  onAccent: '#111315',
  danger: '#F28B82',
};

export const lightTheme: Theme = {
  bg: '#F2F2EF',
  surface: '#FFFFFF',
  line: '#E4E4E0',
  text: '#17191C',
  muted: '#5F656B',
  accent: '#3D6FA8',
  onAccent: '#FFFFFF',
  danger: '#B3261E',
};

/**
 * Accent colors the user can pick on the Account screen, in the order shown there.
 * Each one has a version for the dark and the light theme, so it stays readable on both.
 */
export const ACCENTS = {
  white: { name: 'White', dark: { accent: '#F3F3F1', onAccent: '#111315' }, light: { accent: '#17191C', onAccent: '#FFFFFF' } },
  steel: { name: 'Steel', dark: { accent: '#7FA7D9', onAccent: '#111315' }, light: { accent: '#3D6FA8', onAccent: '#FFFFFF' } },
  sage: { name: 'Sage', dark: { accent: '#8FB89A', onAccent: '#111315' }, light: { accent: '#3F7A52', onAccent: '#FFFFFF' } },
  sand: { name: 'Sand', dark: { accent: '#D6B98C', onAccent: '#111315' }, light: { accent: '#8A6A35', onAccent: '#FFFFFF' } },
  terracotta: { name: 'Terracotta', dark: { accent: '#D98C6A', onAccent: '#111315' }, light: { accent: '#A9502C', onAccent: '#FFFFFF' } },
  lavender: { name: 'Lavender', dark: { accent: '#A99BD6', onAccent: '#111315' }, light: { accent: '#6A55B0', onAccent: '#FFFFFF' } },
} as const;

export type AccentKey = keyof typeof ACCENTS;
export type ThemeMode = 'system' | 'dark' | 'light';
