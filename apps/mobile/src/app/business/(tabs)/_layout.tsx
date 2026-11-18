import { router } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';

import { C } from '@/ui';
import { RozTabBar, TabItem } from '@/ui/TabBar';

const items: Record<string, TabItem> = {
  index: { icon: 'home-outline', iconOn: 'home', label: 'Home' },
  requirements: { icon: 'briefcase-outline', iconOn: 'briefcase', label: 'Requirements' },
  payments: { icon: 'card-outline', iconOn: 'card', label: 'Payments' },
  company: { icon: 'business-outline', iconOn: 'business', label: 'Company' },
};

export default function BusinessTabs() {
  return (
    <Tabs
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: C.bg } }}
      tabBar={(p) => <RozTabBar {...p} items={items} center={{ icon: 'add', label: 'Post', onPress: () => router.push('/business/new') }} />}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="requirements" />
      <Tabs.Screen name="payments" />
      <Tabs.Screen name="company" />
    </Tabs>
  );
}
