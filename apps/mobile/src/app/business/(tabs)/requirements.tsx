import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { dayLabel, inr, time12 } from '@/lib/format';
import { Job, jobCost, reqMeta, useStore } from '@/store';
import { Bar, Btn, C, Card, Empty, InfoLine, Pill, Screen, Segment, T } from '@/ui';

type Tab = 'active' | 'past' | 'drafts';

function ReqCard({ job }: { job: Job }) {
  const m = reqMeta[job.status];
  const draft = job.status === 'awaiting_funding';
  return (
    <Card onPress={() => router.push(`/business/requirement/${job.id}`)} style={{ marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <T v="caption" color={C.violet}>
            {job.category.toUpperCase()}
          </T>
          <T v="title" numberOfLines={2}>
            {job.title}
          </T>
        </View>
        <Pill label={m.label} tone={m.tone} />
      </View>
      <View style={{ gap: 4, marginTop: 8 }}>
        <InfoLine icon="calendar-outline" text={`${dayLabel(job.dateISO)} · ${time12(job.start)} – ${time12(job.end)}`} />
        <InfoLine icon="location-outline" text={`${job.venue}, ${job.area}`} />
      </View>
      {draft ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
          <T v="small" color={C.muted}>
            {job.needed} workers · {inr(job.pay)} each
          </T>
          <Btn title={`Fund ${inr(jobCost(job).total)}`} size="sm" onPress={() => router.push(`/business/requirement/${job.id}`)} />
        </View>
      ) : (
        <View style={{ marginTop: 14 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
            <T v="smallM">
              {job.confirmed}/{job.needed} confirmed
            </T>
            <T v="small" color={C.muted}>
              {inr(job.pay)} per worker
            </T>
          </View>
          <Bar value={job.confirmed} max={job.needed} color={job.confirmed >= job.needed ? C.success : C.violet} />
        </View>
      )}
    </Card>
  );
}

export default function Requirements() {
  const jobs = useStore((s) => s.jobs);
  const [tab, setTab] = useState<Tab>('active');

  const mine = jobs.filter((j) => j.businessId === 'me');
  const groups: Record<Tab, Job[]> = {
    active: mine.filter((j) => ['open', 'filled', 'in_progress', 'completed'].includes(j.status)).sort((a, b) => a.dateISO.localeCompare(b.dateISO)),
    past: mine.filter((j) => ['paid', 'cancelled'].includes(j.status)).sort((a, b) => b.dateISO.localeCompare(a.dateISO)),
    drafts: mine.filter((j) => j.status === 'awaiting_funding'),
  };
  const list = groups[tab];

  const empty = {
    active: { icon: 'briefcase-outline' as const, title: 'No active requirements', text: 'Post a requirement to start getting verified workers.' },
    past: { icon: 'time-outline' as const, title: 'No past requirements yet', text: 'Completed and cancelled requirements will show here.' },
    drafts: { icon: 'document-outline' as const, title: 'No drafts', text: 'Requirements you save without funding wait here.' },
  }[tab];

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, marginBottom: 16 }}>
        <T v="h1">Requirements</T>
        <Btn title="New" icon="add" size="sm" onPress={() => router.push('/business/new')} />
      </View>
      <Segment<Tab>
        value={tab}
        onChange={setTab}
        options={[
          { value: 'active', label: 'Active', count: groups.active.length },
          { value: 'past', label: 'Past', count: groups.past.length },
          { value: 'drafts', label: 'Drafts', count: groups.drafts.length },
        ]}
        style={{ marginBottom: 16 }}
      />
      {list.length ? (
        list.map((j) => <ReqCard key={j.id} job={j} />)
      ) : (
        <Empty icon={empty.icon} title={empty.title} text={empty.text} action={tab === 'past' ? undefined : 'Post requirement'} onAction={() => router.push('/business/new')} />
      )}
    </Screen>
  );
}
