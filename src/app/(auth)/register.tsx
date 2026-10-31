import { useState } from 'react';
import { Alert } from 'react-native';
import { Link } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Screen } from '@/components/Screen';
import { AppText } from '@/components/AppText';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function signUp() {
    if (password.length < 6) {
      Alert.alert('Password too short', 'The password must be at least 6 characters long.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { display_name: name.trim() } }, // saved to profiles by the trigger
    });
    setLoading(false);
    if (error) Alert.alert('Could not create the account', error.message);
  }

  return (
    <Screen>
      <AppText variant="title">Create account</AppText>
      <Input label="Name" value={name} onChangeText={setName} />
      <Input
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
      />
      <Input label="Password" value={password} onChangeText={setPassword} secureTextEntry />
      <Button title="Sign up" onPress={signUp} loading={loading} />
      <Link href="/login">
        <AppText muted>Already have an account? Sign in</AppText>
      </Link>
    </Screen>
  );
}
