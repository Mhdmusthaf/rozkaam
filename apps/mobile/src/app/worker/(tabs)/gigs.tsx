import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { AppStatus, useStore } from '@/store';
import { Empty, Screen, Segment, T } from '@/ui';
import { JobCard } from '@/ui/JobCard';

type Tab = 'upcoming' | 'applied' | 'history';
const GROUPS: Record<Tab, AppStatus[]> = {
  upcoming: ['confirmed', 'checked_in'],
  applied: ['applied', 'waitlisted'],
  history: ['checked_out', 'paid', 'cancelled', 'late_cancel', 'no_show', 'rejected'],
};

const EMPTY: Record<Tab, { icon: 'calendar' | 'paper-plane' | 'time'; title: string; text: string }> = {
  upcoming: { icon: 'calendar', title: 'No upcoming gigs', text: 'Jobs you are confirmed for will show here with a check-in button on the day.' },
  applied: { icon: 'paper-plane', title: 'No pending applications', text: 'Apply for a job and track its review status here.' },
  history: { icon: 'time', title: 'No past gigs yet', text: 'Completed work and your earnings from each job will appear here.' },
};

export default function Gigs() {
  const apps = useStore((s) => s.applications);
  const jobs = useStore((s) => s.jobs);
  const [tab, setTab] = useState<Tab>('upcoming');

  const rows = (t: Tab) =>
    apps
      .filter((a) => GROUPS[t].includes(a.status))
      .map((a) => ({ app: a, job: jobs.find((j) => j.id === a.jobId) }))
      .filter((x) => x.job)
      .sort((a, b) => (t === 'history' ? b.job!.dateISO.localeCompare(a.job!.dateISO) : a.job!.dateISO.localeCompare(b.job!.dateISO)));

  const list = rows(tab);

  return (
    <Screen contentStyle={{ paddingBottom: 28 }}>
      <T v="h1" style={{ marginTop: 10 }}>
        My Gigs
      </T>
      <Segment
        style={{ marginTop: 16, marginBottom: 18 }}
        value={tab}
        onChange={setTab}
        options={[
          { value: 'upcoming', label: 'Upcoming', count: rows('upcoming').length },
          { value: 'applied', label: 'Applied', count: rows('applied').length },
          { value: 'history', label: 'History' },
        ]}
      />
      {list.length === 0 ? (
        <Empty {...EMPTY[tab]} action={tab === 'history' ? undefined : 'Find jobs'} onAction={() => router.push('/worker')} />
      ) : (
        <View>
          {list.map(({ app, job }) => (
            <JobCard key={app.id} job={job!} app={app} onPress={() => router.push(`/worker/gig/${app.id}`)} />
          ))}
        </View>
      )}
    </Screen>
  );
}
