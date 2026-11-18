import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { dayLabel, time12 } from '@/lib/format';
import { useJob } from '@/store';
import { Avatar, Banner, Bar, C, Card, Empty, Header, KV, Pill, Rating, Screen, Stars, Stat, T, Tone } from '@/ui';

const statusText: Record<string, { label: string; tone: Tone }> = {
  applied: { label: 'Applied · under review', tone: 'warn' },
  confirmed: { label: 'Confirmed', tone: 'success' },
  waitlisted: { label: 'On the waitlist', tone: 'info' },
  checked_in: { label: 'Checked in', tone: 'violet' },
  checked_out: { label: 'Checked out', tone: 'info' },
  no_show: { label: 'No-show', tone: 'danger' },
  paid: { label: 'Paid', tone: 'success' },
};

export default function WorkerProfile() {
  const { rid, job: jobId } = useLocalSearchParams<{ rid: string; job: string }>();
  const job = useJob(jobId);
  const r = job?.roster.find((x) => x.id === rid);

  if (!job || !r) {
    return (
      <Screen header={<Header title="Worker" />}>
        <Empty icon="person-outline" title="Worker not found" text="This person is no longer on the requirement." action="Go back" onAction={() => router.back()} />
      </Screen>
    );
  }

  const tag = statusText[r.status]!;
  const confirmed = !['applied', 'waitlisted'].includes(r.status);

  return (
    <Screen header={<Header title="Worker profile" />}>
      <Card style={{ alignItems: 'center' }}>
        <Avatar name={r.name} size={84} />
        <T v="h2" style={{ marginTop: 12 }}>
          {r.name}
        </T>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
          <Pill label="KYC verified" tone="success" icon="shield-checkmark" />
          <Pill label={tag.label} tone={tag.tone} />
        </View>
        <View style={{ flexDirection: 'row', marginTop: 18, alignSelf: 'stretch', paddingTop: 16, borderTopWidth: 1, borderTopColor: C.line }}>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Rating value={r.rating} />
            <T v="caption" color={C.muted}>
              Rating
            </T>
          </View>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <T v="smallM">{r.jobsDone}</T>
            <T v="caption" color={C.muted}>
              Jobs done
            </T>
          </View>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <T v="smallM">{r.reliability}%</T>
            <T v="caption" color={C.muted}>
              Reliability
            </T>
          </View>
        </View>
      </Card>

      <Card style={{ marginTop: 14 }}>
        <T v="label" color={C.muted}>
          Reliability
        </T>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 }}>
          <View style={{ flex: 1 }}>
            <Bar value={r.reliability} max={100} color={r.reliability >= 90 ? C.success : C.warn} height={8} />
          </View>
          <T v="bodyM">{r.reliability}%</T>
        </View>
        <T v="small" color={C.muted} style={{ marginTop: 8 }}>
          Based on showing up on time and not cancelling late across {r.jobsDone} jobs.
        </T>
      </Card>

      <Card style={{ marginTop: 14 }}>
        <T v="label" color={C.muted} style={{ marginBottom: 8 }}>
          Skills
        </T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {r.skills.length ? r.skills.map((s) => <Pill key={s} label={s} tone="violet" />) : <T v="small" color={C.muted}>No skills listed.</T>}
        </View>
      </Card>

      <Card style={{ marginTop: 14 }}>
        <T v="label" color={C.muted} style={{ marginBottom: 4 }}>
          On this requirement
        </T>
        <KV k="Requirement" v={job.title} />
        <KV k="Date" v={dayLabel(job.dateISO)} />
        <KV k="Status" v={tag.label} />
        {r.checkIn ? <KV k="Checked in" v={`${time12(r.checkIn)}${r.late ? ' · late' : ''}`} color={r.late ? C.warn : undefined} /> : null}
        {r.checkOut ? <KV k="Checked out" v={time12(r.checkOut)} /> : null}
        {r.flag ? <KV k="Location flag" v={r.flag} color={C.danger} /> : null}
        {r.rated ? (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 }}>
            <T v="body" color={C.muted}>
              Your rating
            </T>
            <Stars value={r.rated} size={18} />
          </View>
        ) : null}
      </Card>

      <Banner
        tone="neutral"
        icon="lock-closed"
        text={
          confirmed
            ? 'For privacy, contact goes through your venue point of contact. Rozkaam support can reach the worker directly if needed.'
            : 'Contact details are not shared before Rozkaam confirms a worker for your requirement.'
        }
        style={{ marginTop: 14 }}
      />
    </Screen>
  );
}
