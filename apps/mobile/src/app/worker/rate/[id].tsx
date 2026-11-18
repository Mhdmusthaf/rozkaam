import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { useStore } from '@/store';
import { Avatar, Btn, C, Chip, Empty, Field, Header, Screen, Stars, T } from '@/ui';

const GOOD = ['Paid on time', 'Job as described', 'Clear instructions', 'Respectful staff', 'Good food and breaks'];
const BAD = ['Pay delayed', 'Job was different', 'Unclear instructions', 'Poor treatment', 'Longer hours than stated'];
const WORDS = ['', 'Poor', 'Below average', 'Okay', 'Good', 'Excellent'];

export default function RateBusiness() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const app = useStore((s) => s.applications.find((a) => a.id === id));
  const job = useStore((s) => s.jobs.find((j) => j.id === app?.jobId));
  const rate = useStore((s) => s.rateBusiness);
  const toast = useStore((s) => s.showToast);
  const [stars, setStars] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [note, setNote] = useState('');

  if (!app || !job) {
    return (
      <Screen header={<Header title="Rate" />}>
        <Empty icon="alert-circle" title="Gig not found" />
      </Screen>
    );
  }
  const options = stars > 0 && stars <= 3 ? BAD : GOOD;

  return (
    <Screen
      header={<Header title="Rate the company" />}
      footer={
        <>
          <Btn
            title="Submit rating"
            disabled={stars === 0}
            onPress={() => {
              rate(app.id, stars);
              toast('Thanks for your rating');
              router.back();
            }}
          />
          <Btn title="Skip" variant="ghost" size="md" onPress={() => router.back()} />
        </>
      }>
      <View style={{ alignItems: 'center', marginTop: 12 }}>
        <Avatar name={job.business} tone="grey" size={72} />
        <T v="h2" center style={{ marginTop: 12 }}>
          {job.business}
        </T>
        <T v="small" color={C.muted} center>
          {job.title}
        </T>
        <View style={{ marginTop: 22 }}>
          <Stars value={stars} onChange={(n) => (setStars(n), setTags([]))} size={42} />
        </View>
        <T v="bodyM" color={stars ? C.violet : C.muted} style={{ marginTop: 10, minHeight: 22 }}>
          {stars ? WORDS[stars] : 'Tap a star to rate'}
        </T>
      </View>

      {stars > 0 ? (
        <>
          <T v="smallM" style={{ marginTop: 22, marginBottom: 10 }}>
            {stars <= 3 ? 'What went wrong?' : 'What went well?'}
          </T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
            {options.map((t) => (
              <Chip key={t} label={t} selected={tags.includes(t)} onPress={() => setTags(tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t])} />
            ))}
          </View>
          <Field label="Anything else? (optional)" placeholder="Your comment is shared with the Rozkaam team." value={note} onChangeText={setNote} multiline maxLength={300} />
        </>
      ) : null}
      <T v="caption" color={C.muted} center>
        Rating is optional. It helps other workers choose good companies.
      </T>
    </Screen>
  );
}
