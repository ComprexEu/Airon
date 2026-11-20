import { useState } from 'react';
import { Link } from 'expo-router';
import { showError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { Screen } from '@/components/Screen';
import { AppText } from '@/components/AppText';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function signIn() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) showError(error, 'Could not sign in');
    // on success the (auth) layout redirects after the session changes
  }

  return (
    <Screen>
      <AppText variant="title">Airon</AppText>
      <AppText muted>Sign in to see your plans.</AppText>
      <Input
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
      />
      <Input label="Password" value={password} onChangeText={setPassword} secureTextEntry />
      <Button title="Sign in" onPress={signIn} loading={loading} />
      <Link href="/register">
        <AppText muted>No account yet? Sign up</AppText>
      </Link>
    </Screen>
  );
}
