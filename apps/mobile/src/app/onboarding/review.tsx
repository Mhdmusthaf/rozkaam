import { Image } from 'expo-image';
import { router } from 'expo-router';
import { View } from 'react-native';

import { useStore } from '@/store';
import { Banner, Btn, C, Card, IMG, Ionicons, Screen, T } from '@/ui';

/** Shown after KYC is submitted, until the Rozkaam team verifies the account. */
export default function Review() {
  const session = useStore((s) => s.session);
  const signOut = useStore((s) => s.signOut);
  const isWorker = session.role === 'worker';
  const status = isWorker ? session.workerKyc : session.businessKyc;
  const verified = status === 'verified';

  const steps = [
    { label: 'Details submitted', done: true },
    { label: isWorker ? 'Identity check by the Rozkaam team' : 'Business check by the Rozkaam team', done: verified, active: !verified },
    { label: isWorker ? 'Account activated — start applying' : 'Account activated — start posting', done: verified },
  ];

  return (
    <Screen
      footer={
        verified ? (
          <Btn title={isWorker ? 'Find jobs' : 'Go to dashboard'} iconRight="arrow-forward" onPress={() => router.replace('/')} />
        ) : (
          <Btn
            title="Sign out"
            variant="outline"
            onPress={() => {
              signOut();
              router.replace('/');
            }}
          />
        )
      }>
      <View style={{ alignItems: 'center', marginTop: 12 }}>
        <View style={{ width: 208, height: 208, borderRadius: 104, backgroundColor: '#F4EEFF', alignItems: 'center', justifyContent: 'center' }}>
          <Image source={IMG.shield} style={{ width: 184, height: 184, opacity: verified ? 1 : 0.55 }} contentFit="contain" accessibilityLabel="Verification shield" />
        </View>
        <T v="h1" center style={{ marginTop: 20 }}>
          {verified ? 'Account activated' : 'We are reviewing your details'}
        </T>
        <T v="body" color={C.muted} center style={{ marginTop: 8, maxWidth: 320 }}>
          {verified
            ? isWorker
              ? 'Your identity is verified. You can now apply for jobs near you.'
              : 'Your business is verified. You can now post workforce requirements.'
            : 'This usually takes a few hours. We will notify you as soon as it is done.'}
        </T>
      </View>

      <Card style={{ marginTop: 28 }}>
        {steps.map((s, i) => (
          <View key={s.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: C.line }}>
            <Ionicons name={s.done ? 'checkmark-circle' : s.active ? 'ellipse' : 'ellipse-outline'} size={22} color={s.done ? C.success : s.active ? C.violet : C.faint} />
            <T v={s.done || s.active ? 'bodyM' : 'body'} color={s.done || s.active ? C.text : C.muted} style={{ flex: 1 }}>
              {s.label}
            </T>
          </View>
        ))}
      </Card>

      {!verified ? <Banner tone="violet" icon="flask" title="Sandbox mode" text="In this demo the review is approved automatically after a few seconds." style={{ marginTop: 16 }} /> : null}
    </Screen>
  );
}
