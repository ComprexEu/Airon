import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';
import type { Database } from '@/database.types';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// The web build is also rendered on the server (Node), where there is no
// storage, so the session is kept only on the phone / in the browser.
const isServer = Platform.OS === 'web' && typeof window === 'undefined';

export const supabase = createClient<Database>(url, anonKey, {
  auth: {
    storage: isServer ? undefined : AsyncStorage, // the session is stored on the phone
    autoRefreshToken: !isServer, // the token is refreshed automatically
    persistSession: !isServer, // the user stays signed in after restarting the app
    detectSessionInUrl: false, // a browser-only option, not needed in a mobile app
  },
});

// Refresh the token only while the app is in the foreground
AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
