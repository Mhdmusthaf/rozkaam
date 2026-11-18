import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { openMaps } from '@/lib/device';
import { dayLong, hoursBetween, inr, time12 } from '@/lib/format';
import { jobCost, reqMeta, RosterEntry, useJob, useStore } from '@/store';
import { Avatar, Banner, Bar, Btn, C, Card, Divider, Empty, Header, InfoLine, Ionicons, KV, MapCard, Pill, R, Rating, Screen, Segment, Sheet, T, Tone } from '@/ui';

type Tab = 'team' | 'attendance' | 'details';

const rosterTag: Record<RosterEntry['status'], { label: string; tone: Tone }> = {
  applied: { label: 'Applied', tone: 'warn' },
  confirmed: { label: 'Confirmed', tone: 'success' },
  waitlisted: { label: 'Waitlist', tone: 'info' },
  checked_in: { label: 'Checked in', tone: 'violet' },
  checked_out: { label: 'Checked out', tone: 'info' },
  no_show: { label: 'No-show', tone: 'danger' },
  paid: { label: 'Paid', tone: 'success' },
};

function Count({ n, label, tone }: { n: number; label: string; tone: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', backgroundColor: C.card, borderRadius: R.md, paddingVertical: 10, boxShadow: '0 6px 22px rgba(27, 11, 74, 0.07)' }}>
      <T v="h3" color={tone}>
        {n}
      </T>
      <T v="caption" color={C.muted} center>
        {label}
      </T>
    </View>
  );
}

export default function RequirementDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const job = useJob(id);
  const fund = useStore((s) => s.fund);
  const cancelRequirement = useStore((s) => s.cancelRequirement);
  const markNoShow = useStore((s) => s.markNoShow);
  const approveAttendance = useStore((s) => s.approveAttendance);
  const showToast = useStore((s) => s.showToast);

  const [tab, setTab] = useState<Tab | null>(null);
  const [sheet, setSheet] = useState<'cancel' | 'approve' | null>(null);
  const [noShow, setNoShow] = useState<RosterEntry | null>(null);

  if (!job || job.businessId !== 'me') {
    return (
      <Screen header={<Header title="Requirement" />}>
        <Empty icon="search-outline" title="Requirement not found" text="It may have been removed." action="Back to requirements" onAction={() => router.replace('/business/requirements')} />
      </Screen>
    );
  }

  const m = reqMeta[job.status];
  const cost = jobCost(job);
  const st = job.status;
  const live = st === 'in_progress' || st === 'completed' || st === 'paid';
  const activeTab: Tab = tab ?? (live ? 'attendance' : 'team');

  const by = (...s: RosterEntry['status'][]) => job.roster.filter((r) => s.includes(r.status));
  const team = by('confirmed', 'checked_in', 'checked_out', 'paid', 'no_show');
  const waitlist = by('waitlisted');
  const applied = by('applied');
  const present = by('checked_in', 'checked_out', 'paid');
  const absent = by('confirmed');
  const noShows = by('no_show');
  const late = job.roster.filter((r) => r.late);
  const flagged = job.roster.filter((r) => r.flag);

  const worked = by('checked_in', 'checked_out').length;
  const unused = job.needed - worked;
  const perSlot = Math.round(cost.total / job.needed);

  const openWorker = (r: RosterEntry) => router.push(`/business/worker/${r.id}?job=${job.id}`);

  const WorkerRow = ({ r, attendance }: { r: RosterEntry; attendance?: boolean }) => {
    const tag = rosterTag[r.status];
    return (
      <Pressable onPress={() => openWorker(r)} style={({ pressed }) => ({ paddingVertical: 12, opacity: pressed ? 0.6 : 1 })}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Avatar name={r.name} size={42} />
          <View style={{ flex: 1 }}>
            <T v="bodyM" numberOfLines={1}>
              {r.name}
            </T>
            {attendance ? (
              <T v="small" color={C.muted}>
                {r.checkIn ? `In ${time12(r.checkIn)}` : 'Not checked in yet'}
                {r.checkOut ? ` · Out ${time12(r.checkOut)}` : ''}
              </T>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Rating value={r.rating} />
                <T v="small" color={C.muted}>
                  {r.jobsDone} jobs · {r.reliability}% reliable
                </T>
              </View>
            )}
          </View>
          <Pill label={tag.label} tone={tag.tone} />
        </View>
        {attendance && (r.late || r.flag || (r.status === 'confirmed' && st === 'in_progress')) ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 8, marginLeft: 54 }}>
            {r.late ? <Pill label="Late" tone="warn" icon="time" /> : null}
            {r.flag ? <Pill label={r.flag} tone="danger" icon="warning" /> : null}
            {r.status === 'confirmed' && st === 'in_progress' ? <Btn title="Mark no-show" variant="danger" size="sm" onPress={() => setNoShow(r)} /> : null}
          </View>
        ) : null}
      </Pressable>
    );
  };

  const List = ({ rows, attendance }: { rows: RosterEntry[]; attendance?: boolean }) => (
    <Card pad={4} style={{ paddingHorizontal: 14 }}>
      {rows.map((r, i) => (
        <View key={r.id} style={i ? { borderTopWidth: 1, borderTopColor: C.line } : null}>
          <WorkerRow r={r} attendance={attendance} />
        </View>
      ))}
    </Card>
  );

  let footer: React.ReactNode = null;
  if (st === 'awaiting_funding')
    footer = (
      <>
        <Btn
          title={`Fund ${inr(cost.total)}`}
          icon="lock-closed"
          onPress={async () => {
            if (await fund(job.id)) router.push(`/business/funded?id=${job.id}`);
          }}
        />
        <Btn title="Delete draft" variant="ghost" size="md" onPress={() => setSheet('cancel')} />
      </>
    );
  else if (st === 'open' || st === 'filled') footer = <Btn title="Cancel requirement" variant="danger" onPress={() => setSheet('cancel')} />;
  else if (st === 'completed') footer = <Btn title="Approve and release pay" icon="checkmark-done" onPress={() => setSheet('approve')} />;
  else if (st === 'paid')
    footer = (
      <>
        <Btn title="Rate workers" icon="star" onPress={() => router.push(`/business/rate/${job.id}`)} />
        <Btn title="Download attendance" variant="outline" size="md" icon="download-outline" onPress={() => showToast('Attendance downloads arrive with the backend', 'info')} />
      </>
    );

  return (
    <Screen header={<Header title="Requirement" />} footer={footer}>
      {/* headline */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <Pill label={m.label} tone={m.tone} />
        {job.urgent ? <Pill label="Urgent" tone="danger" icon="flash" /> : null}
      </View>
      <T v="h1">{job.title}</T>
      <View style={{ gap: 5, marginTop: 8 }}>
        <InfoLine icon="calendar-outline" text={`${dayLong(job.dateISO)}`} />
        <InfoLine icon="time-outline" text={`${time12(job.start)} – ${time12(job.end)} · report ${time12(job.report)}`} />
        <InfoLine icon="location-outline" text={`${job.venue}, ${job.area}`} />
      </View>

      {/* slots */}
      <Card style={{ marginTop: 16 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10 }}>
          <View>
            <T v="caption" color={C.muted}>
              {live ? 'CHECKED IN' : 'CONFIRMED'}
            </T>
            <T v="h2">
              {live ? present.length : job.confirmed}
              <T v="body" color={C.muted}>
                {' '}
                of {live ? team.length : job.needed}
              </T>
            </T>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <T v="caption" color={C.muted}>
              PAY PER WORKER
            </T>
            <T v="h3">{inr(job.pay)}</T>
          </View>
        </View>
        <Bar value={live ? present.length : job.confirmed} max={live ? team.length || 1 : job.needed} color={C.violet} height={8} />
        {!live && st !== 'awaiting_funding' && st !== 'cancelled' ? (
          <T v="small" color={C.muted} style={{ marginTop: 8 }}>
            {job.applied} applied · {waitlist.length} on the waitlist
          </T>
        ) : null}
      </Card>

      {st === 'awaiting_funding' ? (
        <Banner tone="warn" icon="wallet" title="Not live yet" text={`Fund ${inr(cost.total)} to publish this requirement to nearby workers.`} style={{ marginTop: 14 }} />
      ) : null}
      {st === 'in_progress' ? (
        <Banner tone="info" icon="radio-button-on" title="Shift in progress" text="Check-ins update here as workers arrive. You can approve attendance once the shift ends." style={{ marginTop: 14 }} />
      ) : null}
      {st === 'completed' ? (
        <Banner tone="warn" icon="alert-circle" title="Waiting for your approval" text="Review attendance, then approve to release pay to the workers who showed up." style={{ marginTop: 14 }} />
      ) : null}
      {st === 'cancelled' ? <Banner tone="neutral" icon="close-circle" text="This requirement was cancelled. Any funding has been refunded." style={{ marginTop: 14 }} /> : null}

      <Segment<Tab>
        value={activeTab}
        onChange={setTab}
        style={{ marginTop: 18, marginBottom: 14 }}
        options={[
          { value: 'team', label: 'Team', count: team.length || undefined },
          { value: 'attendance', label: 'Attendance' },
          { value: 'details', label: 'Details' },
        ]}
      />

      {activeTab === 'team' ? (
        <>
          <Banner
            tone="violet"
            icon="shield-checkmark"
            text="Rozkaam's operations team reviews applicants and confirms the workers for you. You will see everyone who is confirmed here."
            style={{ marginBottom: 14 }}
          />
          {team.length ? (
            <>
              <T v="label" color={C.muted} style={{ marginBottom: 8 }}>
                Confirmed team · {team.length}
              </T>
              <List rows={team} />
            </>
          ) : (
            <Card>
              <Empty
                icon="people-outline"
                title={st === 'awaiting_funding' ? 'No team yet' : 'No one confirmed yet'}
                text={st === 'awaiting_funding' ? 'Workers can apply once the requirement is funded.' : `${applied.length || job.applied} workers have applied. Confirmations usually start within a few minutes.`}
              />
            </Card>
          )}
          {applied.length ? (
            <>
              <T v="label" color={C.muted} style={{ marginTop: 18, marginBottom: 8 }}>
                Under review by Rozkaam · {applied.length}
              </T>
              <List rows={applied} />
            </>
          ) : null}
          {waitlist.length ? (
            <>
              <T v="label" color={C.muted} style={{ marginTop: 18, marginBottom: 8 }}>
                Waitlist · {waitlist.length}
              </T>
              <List rows={waitlist} />
              <T v="caption" color={C.muted} style={{ marginTop: 8 }}>
                Waitlisted workers step in automatically if someone cancels.
              </T>
            </>
          ) : null}
        </>
      ) : null}

      {activeTab === 'attendance' ? (
        <>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
            <Count n={team.length} label="Confirmed" tone={C.text} />
            <Count n={present.length} label="Checked in" tone={C.success} />
            <Count n={late.length} label="Late" tone={C.warn} />
            <Count n={flagged.length} label="Flagged" tone={C.danger} />
            <Count n={noShows.length} label="No-show" tone={C.danger} />
          </View>
          {!live ? (
            <Card>
              <Empty icon="location-outline" title="Attendance starts on the day" text="Each worker checks in at the venue with a photo, live location and time. You will see it here as it happens." />
            </Card>
          ) : (
            <>
              {absent.length && st === 'in_progress' ? (
                <>
                  <T v="label" color={C.muted} style={{ marginBottom: 8 }}>
                    Not checked in · {absent.length}
                  </T>
                  <List rows={absent} attendance />
                  <View style={{ height: 18 }} />
                </>
              ) : null}
              {present.length ? (
                <>
                  <T v="label" color={C.muted} style={{ marginBottom: 8 }}>
                    Present · {present.length}
                  </T>
                  <List rows={present} attendance />
                </>
              ) : null}
              {noShows.length ? (
                <>
                  <T v="label" color={C.muted} style={{ marginTop: 18, marginBottom: 8 }}>
                    No-show · {noShows.length}
                  </T>
                  <List rows={noShows} attendance />
                </>
              ) : null}
              <T v="caption" color={C.muted} style={{ marginTop: 10 }}>
                A check-in more than 500 m from the venue is flagged for review. Check-in photos will show here once the backend is connected.
              </T>
            </>
          )}
        </>
      ) : null}

      {activeTab === 'details' ? (
        <>
          <MapCard label={job.venue} sub={job.address} onPress={() => openMaps(job.lat, job.lng, job.venue)} />
          <Card style={{ marginTop: 14 }}>
            <T v="label" color={C.muted}>
              About the work
            </T>
            <T v="body" style={{ marginTop: 6 }}>
              {job.description || 'No description added.'}
            </T>
            <Divider />
            <KV k="Category" v={job.category} />
            <KV k="Shift length" v={`${hoursBetween(job.start, job.end)} hours`} />
            <KV k="Dress code" v={job.dress || 'Not specified'} />
            <KV k="Gender" v={job.gender} />
            <KV k="Experience" v={job.experience} />
            {job.skills.length ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                {job.skills.map((s) => (
                  <Pill key={s} label={s} tone="neutral" />
                ))}
              </View>
            ) : null}
          </Card>
          <Card style={{ marginTop: 14 }}>
            <T v="label" color={C.muted}>
              Instructions for workers
            </T>
            <T v="body" style={{ marginTop: 6 }}>
              {job.instructions || 'No extra instructions.'}
            </T>
            <Divider />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name="person-circle-outline" size={22} color={C.violet} />
              <View style={{ flex: 1 }}>
                <T v="bodyM">{job.pocName}</T>
                <T v="small" color={C.muted}>
                  Point of contact · {job.pocPhone}
                </T>
              </View>
            </View>
          </Card>
          <Card style={{ marginTop: 14 }}>
            <T v="label" color={C.muted} style={{ marginBottom: 4 }}>
              Cost
            </T>
            <KV k={`${job.needed} workers × ${inr(job.pay)}`} v={inr(cost.subtotal)} />
            <KV k={`Rozkaam service fee (${Math.round(job.commissionRate * 100)}%)`} v={job.commissionMode === 'on_top' ? inr(cost.fee) : 'Included'} />
            <Divider />
            <KV k={st === 'awaiting_funding' ? 'Total to fund' : 'Total funded'} v={inr(cost.total)} bold />
          </Card>
        </>
      ) : null}

      {/* cancel */}
      <Sheet open={sheet === 'cancel'} onClose={() => setSheet(null)} title={st === 'awaiting_funding' ? 'Delete this draft?' : 'Cancel this requirement?'}>
        <T v="body" color={C.muted}>
          {st === 'awaiting_funding'
            ? 'This draft has not been funded, so nothing will be charged or refunded.'
            : `Workers who applied or were confirmed will be told the job is off. The full ${inr(cost.total)} you funded will be refunded.`}
        </T>
        {st !== 'awaiting_funding' && job.confirmed > 0 ? (
          <Banner tone="warn" icon="alert-circle" text={`${job.confirmed} confirmed ${job.confirmed === 1 ? 'worker has' : 'workers have'} kept this date free. Please cancel only if you must.`} style={{ marginTop: 12 }} />
        ) : null}
        <View style={{ gap: 10, marginTop: 18 }}>
          <Btn
            title={st === 'awaiting_funding' ? 'Delete draft' : 'Yes, cancel and refund'}
            variant="danger"
            onPress={async () => {
              setSheet(null);
              if (!(await cancelRequirement(job.id))) return;
              showToast(st === 'awaiting_funding' ? 'Draft deleted' : `Cancelled. ${inr(cost.total)} refunded`, 'info');
              router.replace('/business/requirements');
            }}
          />
          <Btn title="Keep it" variant="outline" onPress={() => setSheet(null)} />
        </View>
      </Sheet>

      {/* approve attendance */}
      <Sheet open={sheet === 'approve'} onClose={() => setSheet(null)} title="Approve attendance">
        <T v="body" color={C.muted}>
          Pay is released to every worker who checked in. This cannot be undone.
        </T>
        <View style={{ marginTop: 12 }}>
          <KV k="Workers to be paid" v={`${worked} × ${inr(job.pay)}`} />
          <KV k="No-shows (not paid)" v={String(noShows.length)} />
          {unused > 0 ? <KV k={`Refund for ${unused} unused ${unused === 1 ? 'slot' : 'slots'}`} v={inr(unused * perSlot)} color={C.success} /> : null}
          <Divider />
          <KV k="Released to workers" v={inr(worked * job.pay)} bold />
        </View>
        {late.length || flagged.length ? (
          <Banner tone="warn" icon="alert-circle" text={`${late.length} late and ${flagged.length} flagged check-in${flagged.length === 1 ? '' : 's'} are included. Contact Rozkaam support before approving if you want to dispute one.`} style={{ marginTop: 10 }} />
        ) : null}
        <View style={{ gap: 10, marginTop: 18 }}>
          <Btn
            title="Approve and release pay"
            icon="checkmark-done"
            onPress={async () => {
              setSheet(null);
              if (await approveAttendance(job.id)) showToast(`Pay released to ${worked} workers`);
            }}
          />
          <Btn title="Not yet" variant="outline" onPress={() => setSheet(null)} />
        </View>
      </Sheet>

      {/* no-show */}
      <Sheet open={!!noShow} onClose={() => setNoShow(null)} title="Mark as no-show?">
        <T v="body" color={C.muted}>
          {noShow?.name} has not checked in. Marking a no-show means they will not be paid for this shift and it counts against their reliability. Rozkaam will try to send a replacement from the waitlist.
        </T>
        <View style={{ gap: 10, marginTop: 18 }}>
          <Btn
            title="Mark no-show"
            variant="danger"
            onPress={async () => {
              const target = noShow;
              setNoShow(null);
              if (target && (await markNoShow(job.id, target.id))) showToast('Marked as no-show', 'info');
            }}
          />
          <Btn title="Wait a little longer" variant="outline" onPress={() => setNoShow(null)} />
        </View>
      </Sheet>
    </Screen>
  );
}
