import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { inr } from '@/lib/format';
import { useStore, walletBalance } from '@/store';
import { Banner, Btn, C, Card, Chip, F, Header, IconTile, Ionicons, Screen, T } from '@/ui';

const MIN = 100;

export default function Withdraw() {
  const wallet = useStore((s) => s.wallet);
  const w = useStore((s) => s.worker);
  const withdraw = useStore((s) => s.withdraw);
  const toast = useStore((s) => s.showToast);
  const balance = walletBalance(wallet);
  const [text, setText] = useState('');
  const [dest, setDest] = useState<'upi' | 'bank'>(w.upi ? 'upi' : 'bank');
  const amount = Number(text) || 0;
  const error = amount > balance ? `You can withdraw up to ${inr(balance)}.` : amount > 0 && amount < MIN ? `The minimum withdrawal is ${inr(MIN)}.` : '';
  const ok = amount >= MIN && amount <= balance;

  const options = [
    ...(w.upi ? [{ key: 'upi' as const, icon: 'flash' as const, title: 'UPI', sub: w.upi }] : []),
    { key: 'bank' as const, icon: 'business' as const, title: 'Bank account', sub: w.accountNumber ? `${w.bankName} · ${w.accountNumber.slice(-4).padStart(w.accountNumber.length, '•')}` : 'Add bank details in your profile' },
  ];

  return (
    <Screen
      header={<Header title="Withdraw" />}
      footer={
        <Btn
          title={ok ? `Withdraw ${inr(amount)}` : 'Withdraw'}
          disabled={!ok}
          onPress={async () => {
            if (!(await withdraw(amount, dest))) return;
            toast('Withdrawal requested');
            router.back();
          }}
        />
      }>
      <T v="small" color={C.muted} center style={{ marginTop: 8 }}>
        Available balance {inr(balance)}
      </T>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 8 }}>
        <Text style={{ fontFamily: F.extra, fontSize: 44, color: amount ? C.text : C.faint }}>₹</Text>
        <TextInput
          value={text}
          onChangeText={(t) => setText(t.replace(/\D/g, '').slice(0, 6))}
          keyboardType="number-pad"
          placeholder="0"
          placeholderTextColor={C.faint}
          autoFocus
          accessibilityLabel="Amount to withdraw"
          style={[{ fontFamily: F.extra, fontSize: 44, color: C.text, minWidth: 60, maxWidth: 220, textAlign: 'left', paddingVertical: 4 }, { outlineStyle: 'none' } as object]}
        />
      </View>
      {error ? (
        <T v="small" color={C.danger} center>
          {error}
        </T>
      ) : null}

      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 16 }}>
        {[500, 1000].filter((n) => n <= balance).map((n) => (
          <Chip key={n} label={inr(n)} selected={amount === n} onPress={() => setText(String(n))} />
        ))}
        <Chip label="All" selected={amount === balance && balance > 0} onPress={() => setText(String(balance))} />
      </View>

      <T v="smallM" style={{ marginTop: 28, marginBottom: 10 }}>
        Send to
      </T>
      {options.map((o) => {
        const on = dest === o.key;
        return (
          <Pressable key={o.key} onPress={() => setDest(o.key)} accessibilityRole="radio" accessibilityState={{ selected: on }}>
            <Card pad={14} style={{ marginBottom: 10, borderWidth: 1.5, borderColor: on ? C.violet : 'transparent' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <IconTile icon={o.icon} tone={on ? 'violet' : 'neutral'} />
                <View style={{ flex: 1 }}>
                  <T v="bodyM">{o.title}</T>
                  <T v="small" color={C.muted}>
                    {o.sub}
                  </T>
                </View>
                <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={22} color={on ? C.violet : C.faint} />
              </View>
            </Card>
          </Pressable>
        );
      })}

      <Banner tone="info" icon="time" text="Withdrawals are processed by the Rozkaam team, usually within one working day." style={{ marginTop: 8 }} />
    </Screen>
  );
}
