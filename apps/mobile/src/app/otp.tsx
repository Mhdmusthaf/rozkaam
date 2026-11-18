import { router, useLocalSearchParams } from 'expo-router';
import { ComponentRef, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, Text, TextInput, View } from 'react-native';

import { useStore } from '@/store';
import { Banner, Btn, C, F, Header, R, Screen, T } from '@/ui';

const LEN = 6;

export default function Otp() {
  const { phone = '' } = useLocalSearchParams<{ phone: string }>();
  const signIn = useStore((s) => s.signIn);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(30);
  const input = useRef<ComponentRef<typeof TextInput>>(null);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const verify = (value = code) => {
    if (value.length < LEN || busy) return;
    setBusy(true);
    // Sandbox: any 6 digits are accepted. A real SMS provider replaces this.
    setTimeout(() => {
      signIn(`${phone.slice(0, 5)} ${phone.slice(5)}`);
      router.dismissAll?.();
      router.replace('/');
    }, 700);
  };

  return (
    <Screen header={<Header />} footer={<Btn title="Verify" onPress={() => verify()} disabled={code.length < LEN} loading={busy} />}>
      <T v="h1">Enter the code</T>
      <T v="body" color={C.muted} style={{ marginTop: 6, marginBottom: 24 }}>
        Sent to +91 {phone.slice(0, 5)} {phone.slice(5)}.{' '}
        <T v="bodyM" color={C.violet} onPress={() => router.back()}>
          Change number
        </T>
      </T>

      <Pressable onPress={() => input.current?.focus()} accessibilityLabel="Verification code" style={{ flexDirection: 'row', gap: 8, justifyContent: 'space-between' }}>
        {Array.from({ length: LEN }, (_, i) => {
          const ch = code[i];
          const active = i === code.length;
          return (
            <View
              key={i}
              style={{ flex: 1, height: 58, borderRadius: R.md, backgroundColor: C.card, borderWidth: 1.5, borderColor: active ? C.violet : ch ? C.ink : C.line, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: F.extra, fontSize: 24, color: C.text }}>{ch ?? ''}</Text>
            </View>
          );
        })}
      </Pressable>
      <TextInput
        ref={input}
        value={code}
        autoFocus
        keyboardType="number-pad"
        maxLength={LEN}
        onChangeText={(t) => {
          const v = t.replace(/\D/g, '').slice(0, LEN);
          setCode(v);
          if (v.length === LEN) verify(v);
        }}
        style={[{ position: 'absolute', opacity: 0.01, height: 58, left: 0, right: 0, top: 110 }, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null]}
        accessibilityLabel="Verification code input"
      />

      <View style={{ marginTop: 20, alignItems: 'center' }}>
        {wait > 0 ? (
          <T v="small" color={C.muted}>
            Resend code in {wait}s
          </T>
        ) : (
          <T v="smallM" color={C.violet} onPress={() => setWait(30)}>
            Resend code
          </T>
        )}
      </View>

      <Banner tone="violet" icon="flask" title="Sandbox mode" text="No SMS is sent yet. Enter any 6 digits to continue." style={{ marginTop: 24 }} />
    </Screen>
  );
}
