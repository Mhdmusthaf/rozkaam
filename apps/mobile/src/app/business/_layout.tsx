import { Stack } from 'expo-router';

import { C } from '@/ui';

export default function BusinessLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg }, animation: 'slide_from_right' }} />;
}
