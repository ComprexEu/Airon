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