import { Redirect, Stack } from 'expo-router';

import { useStore } from '@/store';
import { C } from '@/ui';

export default function BusinessLayout() {
  const s = useStore((st) => st.session);
  // Only signed-in, verified businesses can open these screens.
  if (!s.signedIn || s.role !== 'business' || s.businessKyc !== 'verified') return <Redirect href="/" />;
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg }, animation: 'slide_from_right' }} />;
}
