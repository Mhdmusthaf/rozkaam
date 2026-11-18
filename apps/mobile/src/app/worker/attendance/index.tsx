import { Redirect, router } from 'expo-router';

import { dayDiff } from '@/lib/format';
import { pickActiveGig, useStore } from '@/store';
import { Empty, Header, Screen, Section } from '@/ui';
import { JobCard } from '@/ui/JobCard';

/** Centre tab button: jumps straight to check-in or check-out for today's gig. */
export default function AttendanceEntry() {
  const apps = useStore((s) => s.applications);
  const jobs = useStore((s) => s.jobs);
  const active = pickActiveGig(apps, jobs);

  if (active) return <Redirect href={`/worker/attendance/${active.app.id}?mode=${active.app.status === 'checked_in' ? 'out' : 'in'}`} />;

  const upcoming = apps
    .filter((a) => a.status === 'confirmed')
    .map((a) => ({ app: a, job: jobs.find((j) => j.id === a.jobId)! }))
    .filter((x) => x.job && dayDiff(x.job.dateISO) > 0)
    .sort((a, b) => a.job.dateISO.localeCompare(b.job.dateISO));

  return (
    <Screen header={<Header title="Check in" />}>
      <Empty
        icon="scan"
        title="Nothing to check in to today"
        text="Check-in opens on the day of a gig you are confirmed for."
        action={upcoming.length ? undefined : 'Find jobs'}
        onAction={() => router.replace('/worker')}
      />
      {upcoming.length ? (
        <Section title="Your next confirmed gigs" style={{ marginTop: 0 }}>
          {upcoming.map(({ app, job }) => (
            <JobCard key={app.id} job={job} app={app} onPress={() => router.push(`/worker/gig/${app.id}`)} />
          ))}
        </Section>
      ) : null}
    </Screen>
  );
}
