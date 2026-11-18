import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { ago } from '@/lib/format';
import { CANCEL_WINDOW_HOURS, useStore } from '@/store';
import { Bar, Btn, C, Card, Empty, F, Header, IconTile, Pill, R, Screen, Section, T } from '@/ui';

const RULES = [
  { icon: 'checkmark-circle', tone: 'success', title: 'Cancel early, no penalty', text: `Cancel ${CANCEL_WINDOW_HOURS} hours or more before the start and nothing changes.` },
  { icon: 'alert-circle', tone: 'warn', title: 'Late cancel or no-show = 1 strike', text: 'Each strike lowers your reliability score and your priority for new jobs.' },
  { icon: 'remove-circle', tone: 'danger', title: 'Repeated strikes', text: '2 active strikes restrict you to fewer applications. 3 lead to suspension, reviewed by the Rozkaam team.' },
  { icon: 'heart', tone: 'info', title: 'Genuine emergencies', text: 'Message support with what happened. Strikes for real emergencies can be excused.' },
] as const;

export default function Reliability() {
  const w = useStore((s) => s.worker);
  const active = w.strikes.filter((s) => !s.excused).length;
  const standing = active === 0 ? { label: 'Good standing', tone: 'success' as const, color: C.success } : active === 1 ? { label: '1 active strike', tone: 'warn' as const, color: C.warn } : active === 2 ? { label: 'Restricted', tone: 'danger' as const, color: C.danger } : { label: 'Suspension review', tone: 'danger' as const, color: C.danger };

  return (
    <Screen header={<Header title="Reliability" />}>
      <View style={{ backgroundColor: C.ink, borderRadius: R.xl, padding: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
          <View style={{ flex: 1 }}>
            <T v="small" color="rgba(255,255,255,0.65)">
              Reliability score
            </T>
            <Text style={{ fontFamily: F.extra, fontSize: 52, color: C.white, letterSpacing: -1.5 }}>{w.reliability}%</Text>
          </View>
          <Pill label={standing.label} tone={standing.tone} style={{ marginBottom: 12 }} />
        </View>
        <Bar value={w.reliability} max={100} color={standing.color} track="rgba(255,255,255,0.16)" height={8} />
        <T v="small" color="rgba(255,255,255,0.7)" style={{ marginTop: 12 }}>
          Businesses and the Rozkaam team see this score. Showing up on time for every confirmed job keeps it high.
        </T>
      </View>

      <Section title="How it works">
        <Card pad={6}>
          {RULES.map((r, i) => (
            <View key={r.title} style={{ flexDirection: 'row', gap: 12, padding: 10, borderTopWidth: i ? 1 : 0, borderTopColor: C.line }}>
              <IconTile icon={r.icon} tone={r.tone} size={40} />
              <View style={{ flex: 1 }}>
                <T v="bodyM">{r.title}</T>
                <T v="small" color={C.muted}>
                  {r.text}
                </T>
              </View>
            </View>
          ))}
        </Card>
      </Section>

      <Section title="Your strikes">
        {w.strikes.length === 0 ? (
          <Empty icon="ribbon" title="No strikes" text="You have a clean record. Keep it up." />
        ) : (
          <Card pad={6}>
            {w.strikes.map((s, i) => (
              <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderTopWidth: i ? 1 : 0, borderTopColor: C.line }}>
                <View style={{ flex: 1 }}>
                  <T v="bodyM">{s.reason}</T>
                  <T v="small" color={C.muted}>
                    {s.job} · {ago(s.at)}
                  </T>
                </View>
                <Pill label={s.excused ? 'Excused' : 'Active'} tone={s.excused ? 'neutral' : 'danger'} />
              </View>
            ))}
          </Card>
        )}
        {active > 0 ? <Btn title="Ask for a review" variant="soft" size="md" icon="chatbubble-ellipses" style={{ marginTop: 12 }} onPress={() => router.push('/help')} /> : null}
      </Section>
    </Screen>
  );
}
