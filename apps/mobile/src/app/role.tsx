import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { Role, useStore } from '@/store';
import { Btn, C, F, Header, IMG, Ionicons, R, Screen, shadowLg, T } from '@/ui';

const OPTIONS: { role: Role; img: number; title: string; text: string }[] = [
  { role: 'worker', img: IMG.workerWoman, title: 'Find work', text: 'Shifts near you. Pay shown before you apply.' },
  { role: 'business', img: IMG.manager, title: 'Hire a team', text: 'Verified workers, confirmed for you.' },
];

export default function RoleSelect() {
  const role = useStore((s) => s.session.role);
  const signedIn = useStore((s) => s.session.signedIn);
  const setRole = useStore((s) => s.setRole);

  return (
    <Screen
      bg={C.white}
      header={<Header />}
      footer={<Btn title={role === 'business' ? 'Continue as a business' : role === 'worker' ? 'Continue as a worker' : 'Continue'} disabled={!role} onPress={() => (signedIn ? router.replace('/') : router.push('/phone'))} />}>
      <Text style={{ fontFamily: F.bold, fontSize: 32, lineHeight: 40, letterSpacing: -0.8, color: C.text }}>
        I'm here <Text style={{ fontFamily: F.medium, color: C.muted }}>to…</Text>
      </Text>
      <T v="body" color={C.muted} style={{ marginTop: 8, marginBottom: 24 }}>
        Pick one to set up your account.
      </T>

      {OPTIONS.map((o) => {
        const on = role === o.role;
        return (
          <Pressable
            key={o.role}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            accessibilityLabel={o.title}
            onPress={() => setRole(o.role)}
            style={[{ height: 216, borderRadius: R.xl, backgroundColor: on ? C.violet : '#F4F2FA', padding: 24, marginBottom: 16, overflow: 'hidden', justifyContent: 'space-between' }, on ? shadowLg : null]}>
            <Image source={o.img} style={{ position: 'absolute', right: -36, bottom: -8, width: 204, height: 204 }} contentFit="contain" />
            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: C.white, borderWidth: on ? 0 : 2, borderColor: C.faint, alignItems: 'center', justifyContent: 'center' }}>
              {on ? <Ionicons name="checkmark" size={20} color={C.violet} /> : null}
            </View>
            <View style={{ maxWidth: 160, gap: 4 }}>
              <Text style={{ fontFamily: F.bold, fontSize: 30, lineHeight: 34, letterSpacing: -0.8, color: on ? C.white : C.text }}>{o.title}</Text>
              <T v="small" color={on ? '#EFE6FF' : C.muted}>
                {o.text}
              </T>
            </View>
          </Pressable>
        );
      })}
    </Screen>
  );
}
