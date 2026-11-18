import { router } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';

import { dayDiff, dayISO, dayLabel, inr, time12 } from '@/lib/format';
import { Job, jobCost, reqMeta, useStore, useUnread } from '@/store';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

import { Avatar, Bar, C, Card, DarkTop, Empty, IconBtn, IconName, IconTile, IMG, InfoLine, Ionicons, Pill, R, Row, Section, Stat, T, Tone, venuePhoto } from '@/ui';

const firstName = (n: string) => n.trim().split(' ')[0] || 'there';

function Tile({ icon, label, tone, onPress }: { icon: IconName; label: string; tone: Tone; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({ flex: 1, backgroundColor: C.card, borderRadius: R.lg, paddingVertical: 14, paddingHorizontal: 6, alignItems: 'center', gap: 8, opacity: pressed ? 0.8 : 1, boxShadow: '0 6px 22px rgba(27, 11, 74, 0.07)' })}>
      <IconTile icon={icon} tone={tone} size={42} />
      <T v="caption" center color={C.text}>
        {label}
      </T>
    </Pressable>
  );
}

function ReqCard({ job }: { job: Job }) {
  const m = reqMeta[job.status];
  return (
    <Card onPress={() => router.push(`/business/requirement/${job.id}`)} style={{ marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <T v="title" numberOfLines={1}>
            {job.title}
          </T>
          <View style={{ gap: 4, marginTop: 6 }}>
            <InfoLine icon="calendar-outline" text={`${dayLabel(job.dateISO)} · ${time12(job.start)} – ${time12(job.end)}`} />
            <InfoLine icon="location-outline" text={`${job.venue}, ${job.area}`} />
          </View>
        </View>
        <Pill label={m.label} tone={m.tone} />
      </View>
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
    </Card>
  );
}

export default function BusinessHome() {
  const company = useStore((s) => s.company);
  const jobs = useStore((s) => s.jobs);
  const txns = useStore((s) => s.bizTxns);
  const unread = useUnread('business');

  const mine = jobs.filter((j) => j.businessId === 'me');
  const active = mine.filter((j) => ['open', 'filled', 'in_progress'].includes(j.status));
  const confirmed = active.reduce((s, j) => s + j.confirmed, 0);
  const now = new Date();
  const monthSpend = txns
    .filter((t) => {
      const d = new Date(t.at);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    })
    .reduce((s, t) => s + (t.kind === 'funding' ? t.amount : -t.amount), 0);

  const today = mine.find((j) => j.status === 'in_progress') ?? mine.find((j) => j.dateISO === dayISO() && ['open', 'filled'].includes(j.status));
  const present = today ? today.roster.filter((r) => r.status === 'checked_in' || r.status === 'checked_out').length : 0;
  const actions = mine.filter((j) => j.status === 'awaiting_funding' || j.status === 'completed');
  const upcoming = mine
    .filter((j) => ['open', 'filled'].includes(j.status) && dayDiff(j.dateISO) >= 0 && j.id !== today?.id)
    .sort((a, b) => a.dateISO.localeCompare(b.dateISO));

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 28 }}>
        <DarkTop>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Avatar name={company.contactName || company.name || 'Company'} size={48} tone="dark" />
            <View style={{ flex: 1 }}>
              <T v="small" color="rgba(255,255,255,0.65)">
                Hello,
              </T>
              <T v="h2" color={C.white} numberOfLines={1}>
                {firstName(company.contactName)}
              </T>
            </View>
            <IconBtn icon="notifications-outline" tone="ghostDark" badge={unread > 0} onPress={() => router.push('/notifications')} label="Notifications" />
          </View>
          <T v="small" color="rgba(255,255,255,0.65)" style={{ marginTop: 6 }} numberOfLines={1}>
            {company.name}
          </T>
          <View style={{ flexDirection: 'row', marginTop: 18, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: R.lg, padding: 16 }}>
            <Stat dark value={String(active.length)} label="Active requirements" />
            <Stat dark value={String(confirmed)} label="Workers confirmed" />
            <Stat dark value={inr(monthSpend)} label="Spend this month" />
          </View>
        </DarkTop>

        <View style={{ paddingHorizontal: 20 }}>
          {today ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Open ${today.title}`}
              onPress={() => router.push(`/business/requirement/${today.id}`)}
              style={({ pressed }) => ({ marginTop: 20, height: 236, borderRadius: 28, overflow: 'hidden', backgroundColor: C.ink, opacity: pressed ? 0.92 : 1, boxShadow: '0 24px 48px rgba(60, 20, 160, 0.18)' })}>
              <Image source={venuePhoto(today.category) ?? IMG.banquet} style={{ width: '100%', height: 236 }} contentFit="cover" />
              <LinearGradient colors={['rgba(15,11,26,0)', 'rgba(15,11,26,0.82)', 'rgba(15,11,26,0.96)']} locations={[0, 0.55, 1]} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 190 }} />
              <View style={{ position: 'absolute', left: 12, top: 12, backgroundColor: C.white, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }}>
                <T v="smallM">
                  Live · {time12(today.start)} – {time12(today.end)}
                </T>
              </View>
              <View style={{ position: 'absolute', left: 16, right: 16, bottom: 16, gap: 12 }}>
                <View>
                  <T v="h2" color={C.white} numberOfLines={1}>
                    {today.title}
                  </T>
                  <T v="caption" color="#E4E1EE" numberOfLines={1}>
                    {today.venue} · reporting {time12(today.report)}
                  </T>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ flexDirection: 'row' }}>
                    {today.roster.slice(0, 4).map((r, i) => (
                      <View key={r.id} style={{ marginLeft: i ? -10 : 0, borderRadius: 18, borderWidth: 2, borderColor: C.ink }}>
                        <Avatar name={r.name} size={30} />
                      </View>
                    ))}
                  </View>
                  <T v="bodyM" color={C.white} style={{ flex: 1 }}>
                    {present} of {today.confirmed} checked in
                  </T>
                  <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="arrow-forward" size={18} color={C.ink} />
                  </View>
                </View>
              </View>
            </Pressable>
          ) : null}

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
            <Tile icon="add-circle" label="Post requirement" tone="violet" onPress={() => router.push('/business/new')} />
            <Tile icon="people" label="Track attendance" tone="success" onPress={() => (today ? router.push(`/business/requirement/${today.id}`) : router.push('/business/requirements'))} />
            <Tile icon="card" label="Payments" tone="info" onPress={() => router.push('/business/payments')} />
            <Tile icon="help-buoy" label="Help" tone="warn" onPress={() => router.push('/help')} />
          </View>

          {actions.length ? (
            <Section title="Needs your action">
              <Card pad={6} style={{ paddingHorizontal: 14 }}>
                {actions.map((j, i) => (
                  <View key={j.id} style={i ? { borderTopWidth: 1, borderTopColor: C.line } : null}>
                    <Row
                      icon={j.status === 'completed' ? 'checkmark-done' : 'wallet'}
                      tone="warn"
                      title={j.status === 'completed' ? 'Approve attendance' : `Fund ${inr(jobCost(j).total)}`}
                      sub={`${j.title} · ${dayLabel(j.dateISO)}`}
                      chevron
                      onPress={() => router.push(`/business/requirement/${j.id}`)}
                    />
                  </View>
                ))}
              </Card>
            </Section>
          ) : null}

          <Section title="Upcoming" action="View all" onAction={() => router.push('/business/requirements')}>
            {upcoming.length ? (
              upcoming.slice(0, 4).map((j) => <ReqCard key={j.id} job={j} />)
            ) : (
              <Card>
                <Empty icon="calendar-outline" title="Nothing scheduled" text="Post a requirement and nearby verified workers will see it right away." action="Post requirement" onAction={() => router.push('/business/new')} />
              </Card>
            )}
          </Section>
        </View>
      </ScrollView>
    </View>
  );
}
