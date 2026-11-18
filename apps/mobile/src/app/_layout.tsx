import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/plus-jakarta-sans';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useStore } from '@/store';
import { C, F, Ionicons, shadowLg } from '@/ui';

SplashScreen.preventAutoHideAsync();

function ToastHost() {
  const toast = useStore((s) => s.toast);
  const insets = useSafeAreaInsets();
  if (!toast) return null;
  const color = toast.tone === 'danger' ? C.danger : toast.tone === 'info' ? C.info : C.success;
  const icon = toast.tone === 'danger' ? 'alert-circle' : toast.tone === 'info' ? 'information-circle' : 'checkmark-circle';
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: insets.top + 10, left: 16, right: 16, alignItems: 'center', zIndex: 100 }}>
      <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.ink, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12, maxWidth: 420 }, shadowLg]}>
        <Ionicons name={icon} size={18} color={color} />
        <Text style={{ fontFamily: F.semi, fontSize: 13.5, color: C.white, flexShrink: 1 }}>{toast.text}</Text>
      </View>
    </View>
  );
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
    ...Ionicons.font,
  });

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync();
  }, [loaded, error]);

  if (!loaded && !error) return null;

  // On the web the app is shown inside a phone-width column.
  return (
    <View style={{ flex: 1, backgroundColor: Platform.OS === 'web' ? '#E6E3F0' : C.bg, alignItems: 'center' }}>
      <View style={{ flex: 1, width: '100%', maxWidth: 480, backgroundColor: C.bg, overflow: 'hidden' }}>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg }, animation: 'slide_from_right' }} />
        <ToastHost />
      </View>
    </View>
  );
}
