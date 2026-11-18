import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { dayLabel, inr, time12 } from '@/lib/format';
import { jobCost, useJob, useStore } from '@/store';
import { Btn, C, Card, IconTile, IMG, Screen, T } from '@/ui';

const NEXT = [
  { icon: 'megaphone' as const, title: 'Nearby workers see it now', text: 'Verified workers within about 15 km can view the details and apply.' },
  { icon: 'shield-checkmark' as const, title: "Rozkaam's team confirms the workers", text: 'We review applicants and confirm the right people. A waitlist covers last-minute dropouts.' },
  { icon: 'location' as const, title: 'You track attendance live', text: 'On the day, see each check-in with photo, location and time.' },
  { icon: 'cash' as const, title: 'Approve to release pay', text: 'After the shift, approve attendance. Unused slots are refunded.' },
];

export default function Funded() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const job = useJob(id);
  const demo = useStore((s) => s.mode === 'demo');

  return (
    <Screen
      footer={
        <>
          <Btn title="View requirement" onPress={() => router.replace(job ? `/business/requirement/${job.id}` : '/business/requirements')} />
          <Btn title="Back to home" variant="outline" size="md" onPress={() => router.replace('/business')} />
        </>
      }>
      <View style={{ alignItems: 'center', marginTop: 8, marginBottom: 22 }}>
        <View style={{ width: '100%', height: 232, borderRadius: 32, backgroundColor: C.violet, alignItems: 'center', justifyContent: 'flex-end', overflow: 'hidden', marginBottom: 20 }}>
          <View style={{ position: 'absolute', bottom: -90, width: 300, height: 300, borderRadius: 150, backgroundColor: '#7B24FF' }} />
          <Image source={IMG.team} style={{ width: 290, height: 222 }} contentFit="contain" contentPosition="bottom" accessibilityLabel="Three smiling service staff in black uniforms" />
        </View>
        <T v="h1" center>
          Requirement is live
        </T>
        {job ? (
          <T v="body" color={C.muted} center style={{ marginTop: 6 }}>
            {job.title} · {dayLabel(job.dateISO)}, {time12(job.start)}
            {'\n'}
            {job.needed} workers · {inr(jobCost(job).total)} funded
          </T>
        ) : null}
      </View>

      <Card>
        <T v="label" color={C.muted} style={{ marginBottom: 6 }}>
          What happens next
        </T>
        {NEXT.map((n, i) => (
          <View key={n.title} style={{ flexDirection: 'row', gap: 12, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: C.line }}>
            <IconTile icon={n.icon} size={40} />
            <View style={{ flex: 1 }}>
              <T v="bodyM">{n.title}</T>
              <T v="small" color={C.muted}>
                {n.text}
              </T>
            </View>
          </View>
        ))}
      </Card>

      <T v="caption" color={C.muted} center style={{ marginTop: 14 }}>
        Sandbox mode: this funding was simulated and no real money moved.{demo ? ' In this demo, sample applicants appear within a few seconds.' : ''}
      </T>
    </Screen>
  );
}
