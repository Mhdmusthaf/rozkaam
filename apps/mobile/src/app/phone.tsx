import { router } from 'expo-router';
import { useState } from 'react';

import { useStore } from '@/store';
import { Btn, C, Field, Header, Screen, T } from '@/ui';

export default function Phone() {
  const role = useStore((s) => s.session.role);
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const digits = phone.replace(/\D/g, '');

  const next = () => {
    if (!/^[6-9]\d{9}$/.test(digits)) {
      setError('Enter a valid 10-digit mobile number.');
      return;
    }
    router.push({ pathname: '/otp', params: { phone: digits } });
  };

  return (
    <Screen header={<Header />} footer={<Btn title="Send code" onPress={next} disabled={digits.length < 10} />}>
      <T v="h1">Enter your mobile number</T>
      <T v="body" color={C.muted} style={{ marginTop: 6, marginBottom: 24 }}>
        We will send a 6-digit code to verify it. {role === 'business' ? 'Use the number your team can be reached on.' : 'Use the number you want job updates on.'}
      </T>

      <Field
        label="Mobile number"
        prefix="+91"
        icon="call"
        keyboardType="number-pad"
        maxLength={11}
        placeholder="98470 12345"
        value={phone}
        onChangeText={(t) => {
          setError('');
          setPhone(t.replace(/[^\d ]/g, ''));
        }}
        onSubmitEditing={next}
        error={error}
        autoFocus
      />

      <T v="small" color={C.muted}>
        By continuing you agree to Rozkaam's{' '}
        <T v="smallM" color={C.violet} onPress={() => router.push('/legal/terms')}>
          Terms
        </T>{' '}
        and{' '}
        <T v="smallM" color={C.violet} onPress={() => router.push('/legal/privacy')}>
          Privacy Policy
        </T>
        .
      </T>
    </Screen>
  );
}
