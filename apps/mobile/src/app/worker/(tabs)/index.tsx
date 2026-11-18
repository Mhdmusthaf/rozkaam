import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';

import { dayDiff, dayLabel, inr, time12 } from '@/lib/format';
import { appMeta, CATEGORIES, Category, pickActiveGig, useStore, useUnread, workerPay } from '@/store';
import { Avatar, Btn, C, Chip, DarkTop, Empty, F, IconBtn, Ionicons, R, Screen, Section, Sheet, Stat, Steps, T } from '@/ui';
import { categoryIcon, FeaturedJob, JobCard } from '@/ui/JobCard';

type Sort = 'Nearest' | 'Highest pay' | 'Soonest';
const RADII = [5, 10, 15];
const MIN_PAY = [0, 700, 800, 900];

export default function WorkerHome() {
  const worker = useStore((s) => s.worker);
  const jobs = useStore((s) => s.jobs);
  const apps = useStore((s) => s.applications);
  const wallet = useStore((s) => s.wallet);
  const unread = useUnread('worker');

  const [q, setQ] = useState('');
  const [cat, setCat] = useState<Category | 'All'>('All');
  const [sheet, setSheet] = useState(false);
  const [sort, setSort] = useState<Sort>('Nearest');
  const [radius, setRadius] = useState(15);
  const [minPay, setMinPay] = useState(0);
  const [mySkills, setMySkills] = useState(false);

  const appliedIds = useMemo(() => new Set(apps.filter((a) => !['cancelled', 'late_cancel', 'rejected'].includes(a.status)).map((a) => a.jobId)), [apps]);
  const earned = wallet.filter((t) => t.kind === 'earning').reduce((s, t) => s + t.amount, 0);
  const active = pickActiveGig(apps, jobs);
  // The next confirmed gig that is not today's.
  const next =
    active ??
    apps
      .filter((a) => a.status === 'confirmed')
      .map((a) => ({ app: a, job: jobs.find((j) => j.id === a.jobId)! }))
      .filter((x) => x.job && dayDiff(x.job.dateISO) >= 0)
      .sort((a, b) => a.job.dateISO.localeCompare(b.job.dateISO))[0] ??
    null;

  const feed = useMemo(() => {
    const term = q.trim().toLowerCase();
    return jobs
      .filter((j) => j.businessId !== 'me' && (j.status === 'open' || j.status === 'filled') && dayDiff(j.dateISO) >= 0 && !appliedIds.has(j.id))
      .filter((j) => (cat === 'All' ? true : j.category === cat))
      .filter((j) => j.distanceKm <= radius && workerPay(j) >= minPay)
      .filter((j) => (mySkills ? j.skills.some((s) => worker.skills.includes(s)) : true))
      .filter((j) => (term ? `${j.title} ${j.business} ${j.area} ${j.category}`.toLowerCase().includes(term) : true))
      .sort((a, b) => (sort === 'Nearest' ? a.distanceKm - b.distanceKm : sort === 'Highest pay' ? b.pay - a.pay : `${a.dateISO}${a.start}`.localeCompare(`${b.dateISO}${b.start}`)));
  }, [jobs, appliedIds, cat, radius, minPay, mySkills, q, sort, worker.skills]);

  const filtersOn = sort !== 'Nearest' || radius !== 15 || minPay !== 0 || mySkills;
  const first = worker.name.split(' ')[0] || 'there';

  return (
    <Screen padded={false} topInset={false} contentStyle={{ paddingBottom: 28 }}>
      <StatusBar style="light" />
      <DarkTop>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Pressable onPress={() => router.push('/worker/account')} accessibilityLabel="Open account">
            <Avatar name={worker.name} uri={worker.photo} size={46} tone="dark" />
          </Pressable>
          <View style={{ flex: 1 }}>
            <T v="small" color="rgba(255,255,255,0.65)">
              Hello,
            </T>
            <T v="h2" color={C.white} numberOfLines={1}>
              {first}
            </T>
          </View>
          <IconBtn icon="notifications" tone="ghostDark" badge={unread > 0} onPress={() => router.push('/notifications')} label="Notifications" />
        </View>

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.white, borderRadius: R.md, paddingHorizontal: 14, height: 50 }}>
            <Ionicons name="search" size={18} color={C.faint} />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="Search jobs, places, companies"
              placeholderTextColor={C.faint}
              accessibilityLabel="Search jobs"
              style={[{ flex: 1, fontFamily: F.medium, fontSize: 14.5, color: C.text, height: 48 }, { outlineStyle: 'none' } as object]}
            />
          </View>
          <Pressable onPress={() => setSheet(true)} accessibilityRole="button" accessibilityLabel="Filters" style={{ width: 50, height: 50, borderRadius: R.md, backgroundColor: filtersOn ? C.violet : C.ink3, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="options" size={21} color={C.white} />
          </Pressable>
        </View>

        <View style={{ flexDirection: 'row', marginTop: 18, backgroundColor: C.ink2, borderRadius: R.lg, padding: 14 }}>
          <Stat dark value={String(worker.jobsDone)} label="Jobs done" />
          <Stat dark value={String(worker.hours)} label="Hours worked" />
          <Stat dark value={inr(earned)} label="Total earned" />
        </View>
      </DarkTop>

      <View style={{ paddingHorizontal: 20 }}>
        {next ? (
          <Pressable onPress={() => router.push(`/worker/gig/${next.app.id}`)} style={{ marginTop: 18, backgroundColor: C.violet, borderRadius: R.xl, padding: 18 }} accessibilityRole="button" accessibilityLabel={`Open ${next.job.title}`}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <T v="caption" color="rgba(255,255,255,0.75)">
                  {next.app.status === 'checked_in' ? 'You are checked in' : dayDiff(next.job.dateISO) === 0 ? 'Your gig today' : 'Your next gig'} · {dayLabel(next.job.dateISO)}, {time12(next.job.start)}
                </T>
                <T v="h3" color={C.white} numberOfLines={1} style={{ marginTop: 2 }}>
                  {next.job.title}
                </T>
                <T v="small" color="rgba(255,255,255,0.8)" numberOfLines={1}>
                  {next.job.venue}
                </T>
              </View>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="arrow-forward" size={19} color={C.violet} style={{ transform: [{ rotate: '-45deg' }] }} />
              </View>
            </View>
            <View style={{ marginTop: 16 }}>
              <Steps dark steps={['Applied', 'Confirmed', 'On site', 'Done', 'Paid']} current={appMeta[next.app.status].step} />
            </View>
          </Pressable>
        ) : null}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 20, marginHorizontal: -20 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
          <Chip label="All" selected={cat === 'All'} onPress={() => setCat('All')} />
          {CATEGORIES.map((c) => (
            <Chip key={c} label={c} icon={categoryIcon[c]} selected={cat === c} onPress={() => setCat(c)} />
          ))}
        </ScrollView>

        <Section title="Jobs near you" action={filtersOn ? 'Clear filters' : undefined} onAction={() => (setSort('Nearest'), setRadius(15), setMinPay(0), setMySkills(false))} style={{ marginTop: 20 }}>
          <T v="small" color={C.muted} style={{ marginTop: -8, marginBottom: 12 }}>
            {feed.length} {feed.length === 1 ? 'job' : 'jobs'} within {radius} km of {worker.area || 'you'}
          </T>
          {feed.length === 0 ? (
            <Empty icon="search" title="No jobs match" text="Try another category or widen your filters. New jobs are posted every day." />
          ) : (
            feed.map((j, k) => (k === 0 ? <FeaturedJob key={j.id} job={j} onPress={() => router.push(`/worker/job/${j.id}`)} /> : <JobCard key={j.id} job={j} onPress={() => router.push(`/worker/job/${j.id}`)} />))
          )}
        </Section>
      </View>

      <Sheet open={sheet} onClose={() => setSheet(false)} title="Filter and sort">
        <T v="smallM" style={{ marginBottom: 8 }}>
          Sort by
        </T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
          {(['Nearest', 'Highest pay', 'Soonest'] as Sort[]).map((s) => (
            <Chip key={s} label={s} selected={sort === s} onPress={() => setSort(s)} />
          ))}
        </View>
        <T v="smallM" style={{ marginBottom: 8 }}>
          Distance
        </T>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 18 }}>
          {RADII.map((r) => (
            <Chip key={r} label={`Within ${r} km`} selected={radius === r} onPress={() => setRadius(r)} />
          ))}
        </View>
        <T v="smallM" style={{ marginBottom: 8 }}>
          Minimum pay
        </T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
          {MIN_PAY.map((p) => (
            <Chip key={p} label={p === 0 ? 'Any' : `${inr(p)}+`} selected={minPay === p} onPress={() => setMinPay(p)} />
          ))}
        </View>
        <T v="smallM" style={{ marginBottom: 8 }}>
          Skills
        </T>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 22 }}>
          <Chip label="All jobs" selected={!mySkills} onPress={() => setMySkills(false)} />
          <Chip label="Match my skills" selected={mySkills} onPress={() => setMySkills(true)} />
        </View>
        <Btn title={`Show ${feed.length} ${feed.length === 1 ? 'job' : 'jobs'}`} onPress={() => setSheet(false)} />
      </Sheet>
    </Screen>
  );
}
