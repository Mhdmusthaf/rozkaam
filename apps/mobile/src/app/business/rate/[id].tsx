import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { useJob, useStore } from '@/store';
import { Avatar, Btn, C, Card, Empty, Header, Screen, Stars, T } from '@/ui';

const WORDS = ['', 'Poor', 'Below par', 'Okay', 'Good', 'Excellent'];

export default function RateWorkers() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const job = useJob(id);
  const rateWorker = useStore((s) => s.rateWorker);
  const showToast = useStore((s) => s.showToast);
  const [draft, setDraft] = useState<Record<string, number>>({});

  const workers = job?.roster.filter((r) => r.status === 'paid') ?? [];

  if (!job || !workers.length) {
    return (
      <Screen header={<Header title="Rate workers" />}>
        <Empty icon="star-outline" title="No one to rate yet" text="You can rate workers after attendance is approved and pay is released." action="Go back" onAction={() => router.back()} />
      </Screen>
    );
  }

  const value = (rid: string, saved?: number) => draft[rid] ?? saved ?? 0;
  const changed = Object.keys(draft).length;

  const save = () => {
    Object.entries(draft).forEach(([rid, stars]) => rateWorker(job.id, rid, stars));
    showToast(`Saved ${changed} rating${changed === 1 ? '' : 's'}`);
    router.back();
  };

  return (
    <Screen header={<Header title="Rate workers" />} footer={<Btn title={changed ? `Save ${changed} rating${changed === 1 ? '' : 's'}` : 'Save ratings'} disabled={!changed} onPress={save} />}>
      <T v="h2">{job.title}</T>
      <T v="small" color={C.muted} style={{ marginTop: 4, marginBottom: 6 }}>
        One overall score for punctuality, professionalism and quality of work. Ratings help Rozkaam send you the best people next time.
      </T>
      <Btn
        title="Give everyone 5 stars"
        variant="soft"
        size="sm"
        icon="star"
        style={{ alignSelf: 'flex-start', marginTop: 8, marginBottom: 14 }}
        onPress={() => setDraft(Object.fromEntries(workers.map((w) => [w.id, 5])))}
      />
      {workers.map((w) => {
        const v = value(w.id, w.rated);
        return (
          <Card key={w.id} style={{ marginBottom: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Avatar name={w.name} size={44} />
              <View style={{ flex: 1 }}>
                <T v="bodyM" numberOfLines={1}>
                  {w.name}
                </T>
                <T v="small" color={v ? C.text : C.muted}>
                  {v ? WORDS[v] : 'Tap a star to rate'}
                  {w.late ? ' · arrived late' : ''}
                </T>
              </View>
            </View>
            <View style={{ marginTop: 12, alignItems: 'center' }}>
              <Stars value={v} size={34} onChange={(n) => setDraft((d) => ({ ...d, [w.id]: n }))} />
            </View>
          </Card>
        );
      })}
    </Screen>
  );
}
