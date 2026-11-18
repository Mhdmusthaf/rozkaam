import { router } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';

import { RozTabBar, TabItem } from '@/ui/TabBar';

const ITEMS: Record<string, TabItem> = {
  index: { icon: 'home-outline', iconOn: 'home', label: 'Home' },
  gigs: { icon: 'briefcase-outline', iconOn: 'briefcase', label: 'My Gigs' },
  payments: { icon: 'wallet-outline', iconOn: 'wallet', label: 'Payments' },
  account: { icon: 'person-outline', iconOn: 'person', label: 'Account' },
};

export default function WorkerTabs() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(p) => <RozTabBar {...p} items={ITEMS} center={{ icon: 'scan', label: 'Check in', onPress: () => router.push('/worker/attendance') }} />}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="gigs" />
      <Tabs.Screen name="payments" />
      <Tabs.Screen name="account" />
    </Tabs>
  );
}
