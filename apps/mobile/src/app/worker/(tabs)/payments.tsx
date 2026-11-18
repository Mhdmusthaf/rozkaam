import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { ago, inr } from '@/lib/format';
import { useStore, walletBalance, workerPay } from '@/store';
import { Btn, C, Card, Empty, F, IconTile, IMG, Pill, R, Screen, Section, shadowLg, T } from '@/ui';

export default function Payments() {
  const wallet = useStore((s) => s.wallet);
  const apps = useStore((s) => s.applications);
  const jobs = useStore((s) => s.jobs);
  const upi = useStore((s) => s.worker.upi);

  const balance = walletBalance(wallet);
  const earned = wallet.filter((t) => t.kind === 'earning').reduce((s, t) => s + t.amount, 0);
  const withdrawn = wallet.filter((t) => t.kind === 'withdrawal' && t.status !== 'rejected').reduce((s, t) => s + t.amount, 0);
  const pending = apps
    .filter((a) => a.status === 'checked_out')
    .reduce((s, a) => {
      const j = jobs.find((x) => x.id === a.jobId);
      return s + (j ? workerPay(j) : 0);
    }, 0);

  return (
    <Screen contentStyle={{ paddingBottom: 28 }}>
      <T v="h1" style={{ marginTop: 10 }}>
        Payments
      </T>

      <View style={[{ borderRadius: R.xl, padding: 24, marginTop: 16, backgroundColor: C.violet, overflow: 'hidden', minHeight: 196, justifyContent: 'space-between' }, shadowLg]}>
        <View style={{ position: 'absolute', right: -60, top: -60, width: 240, height: 240, borderRadius: 120, backgroundColor: '#7B24FF' }} />
        <Image source={IMG.wallet} style={{ position: 'absolute', right: -8, bottom: -4, width: 168, height: 168 }} contentFit="contain" />
        <T v="caption" color="#EFE6FF">
          Available to withdraw
        </T>
        <View>
          <Text style={{ fontFamily: F.bold, fontSize: 36, color: C.white, letterSpacing: -1 }}>{inr(balance)}</Text>
          <T v="caption" color="#EFE6FF">
            to {upi || 'your bank account'}
          </T>
          <Btn title="Withdraw" variant="white" icon="arrow-up-circle" size="md" style={{ marginTop: 14, alignSelf: 'flex-start' }} disabled={balance < 100} onPress={() => router.push('/worker/withdraw')} />
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
        {[
          { label: 'Total earned', value: inr(earned) },
          { label: 'Withdrawn', value: inr(withdrawn) },
          { label: 'Pay pending', value: inr(pending) },
        ].map((x) => (
          <Card key={x.label} style={{ flex: 1 }} pad={12}>
            <Text style={{ fontFamily: F.extra, fontSize: 17, color: C.text }}>{x.value}</Text>
            <T v="caption" color={C.muted}>
              {x.label}
            </T>
          </Card>
        ))}
      </View>
      {pending > 0 ? (
        <T v="caption" color={C.muted} style={{ marginTop: 8 }}>
          Pay pending is for finished gigs where the company has not completed the payout yet.
        </T>
      ) : null}

      <Section title="History">
        {wallet.length === 0 ? (
          <Empty icon="wallet" title="No payments yet" text="Your earnings appear here after each completed gig." />
        ) : (
          <Card pad={6}>
            {wallet.map((t, i) => {
              const inn = t.kind === 'earning';
              return (
                <View key={t.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderTopWidth: i ? 1 : 0, borderTopColor: C.line }}>
                  <IconTile icon={inn ? 'arrow-down' : 'arrow-up'} tone={inn ? 'success' : 'neutral'} size={40} />
                  <View style={{ flex: 1 }}>
                    <T v="bodyM" numberOfLines={1}>
                      {t.title}
                    </T>
                    <T v="caption" color={C.muted} numberOfLines={1}>
                      {t.sub} · {ago(t.at)}
                    </T>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 3 }}>
                    <Text style={{ fontFamily: F.bold, fontSize: 15, color: inn ? C.success : C.text }}>
                      {inn ? '+' : '−'}
                      {inr(t.amount)}
                    </Text>
                    {t.status !== 'completed' ? <Pill label={t.status === 'processing' ? 'Processing' : 'Rejected'} tone={t.status === 'processing' ? 'warn' : 'danger'} /> : null}
                  </View>
                </View>
              );
            })}
          </Card>
        )}
      </Section>
    </Screen>
  );
}
