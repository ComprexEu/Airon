import { Ionicons } from '@expo/vector-icons';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, TextInput, TextInputInstance, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { ProposalCard } from '@/components/ProposalCard';
import { Screen } from '@/components/Screen';
import { showError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/theme/ThemeContext';

type Message = { id: string; role: 'user' | 'assistant'; content: string; proposal_id: string | null };

export default function AgentScreen() {
  const t = useTheme();
  const { prompt } = useLocalSearchParams<{ prompt?: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const listRef = useRef<FlatList<Message>>(null);
  const inputRef = useRef<TextInputInstance>(null);

  const load = useCallback(async () => {
    // the newest 100 messages, shown oldest first
    const { data, error } = await supabase
      .from('agent_messages')
      .select('id, role, content, proposal_id')
      .order('created_at', { ascending: false })
      .order('role', { ascending: true }) // same time (older messages): the question goes before the answer
      .limit(100);
    if (error) return showError(error, 'Could not load the chat');
    setMessages(data.reverse() as Message[]);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Put the question passed from the Progress screen into the input
  // (updated during render when a new prompt arrives, no useEffect needed)
  const [shownPrompt, setShownPrompt] = useState<string | undefined>(undefined);
  if (prompt !== shownPrompt) {
    setShownPrompt(prompt);
    if (prompt) setInput(prompt);
  }

  async function send() {
    const text = input.trim();
    if (!text || thinking) return;
    setInput('');
    // also clear the native field: on Android the keyboard can put back the word it was still suggesting
    inputRef.current?.clear();
    // show the message "optimistically" right away, before the server answers
    setMessages((prev) => [...prev, { id: `tmp-${Date.now()}`, role: 'user', content: text, proposal_id: null }]);
    setThinking(true);

    const { error } = await supabase.functions.invoke('agent', { body: { message: text } });
    setThinking(false);

    if (error) {
      let msg = 'Could not reach the agent. Check your connection and try again.';
      if (error instanceof FunctionsHttpError) {
        const body = await error.context.json().catch(() => null); // message from the function, e.g. about the limit
        if (body?.error) msg = body.error;
      }
      setMessages((prev) => [...prev, { id: `err-${Date.now()}`, role: 'assistant', content: msg, proposal_id: null }]);
      setInput(text); // the text goes back into the input so it doesn't have to be retyped (NF-05)
      return;
    }
    load(); // fetch the saved messages together with any proposal
  }

  return (
    <Screen scroll={false}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: 20, gap: 10 }}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          ListHeaderComponent={<AppText variant="title">Agent</AppText>}
          ListEmptyComponent={
            <AppText muted>Ask about your plan, your progress or an exercise, or ask for a new plan.</AppText>
          }
          renderItem={({ item }) => {
            const mine = item.role === 'user';
            return (
              <View style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '85%', gap: 8 }}>
                <View style={{ padding: 12, borderRadius: 16, backgroundColor: mine ? t.accent : t.surface }}>
                  <AppText style={{ color: mine ? t.onAccent : t.text }}>{item.content}</AppText>
                </View>
                {item.proposal_id && <ProposalCard proposalId={item.proposal_id} />}
              </View>
            );
          }}
          ListFooterComponent={thinking ? <AppText muted>Agent is typing…</AppText> : undefined}
        />

        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: t.line }}>
          <TextInput
            ref={inputRef}
            value={input}
            onChangeText={setInput}
            placeholder="Write a message…"
            placeholderTextColor={t.muted}
            accessibilityLabel="Message"
            multiline
            maxLength={2000}
            style={{ flex: 1, minHeight: 44, maxHeight: 120, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10,
              backgroundColor: t.surface, color: t.text, fontFamily: 'Inter_400Regular', fontSize: 15 }}
          />
          <Pressable onPress={send} disabled={thinking || !input.trim()}
            accessibilityRole="button" accessibilityLabel="Send"
            style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: t.accent,
              alignItems: 'center', justifyContent: 'center', opacity: thinking || !input.trim() ? 0.5 : 1 }}>
            <Ionicons name="arrow-up" size={22} color={t.onAccent} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
