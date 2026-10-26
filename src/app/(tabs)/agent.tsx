import { AppText } from '@/components/AppText';
import { Screen } from '@/components/Screen';

export default function AgentScreen() {
  return (
    <Screen>
      <AppText variant="title">Agent</AppText>
      <AppText muted>Agent will appear here.</AppText>
    </Screen>
  );
}