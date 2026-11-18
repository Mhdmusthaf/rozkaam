import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { callPhone, openMaps } from '@/lib/device';
import { dayDiff, dayLong, hoursUntil, inr, time12 } from '@/lib/format';
import { appMeta, Attendance, CANCEL_WINDOW_HOURS, useStore, workerPay } from '@/store';
import { Avatar, Banner, Btn, C, Card, Empty, F, Header, IconBtn, KV, MapCard, Pill, Screen, Section, Sheet, Stars, Steps, T } from '@/ui';

const hm = (iso: string) => {
  const d = new Date(iso);
  return time12(`${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`);
};

function AttRow({ label, a }: { label: string; a?: Attendance }) {
  if (!a) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 }}>
      {a.photo ? <Image source={{ uri: a.photo }} style={{ width: 44, height: 44, borderRadius: 12 }} contentFit="cover" /> : null}
      <View style={{ flex: 1 }}>
        <T v="bodyM">
          {label} · {hm(a.at)}
        </T>
        <T v="caption" color={C.muted}>
          {a.distanceM !== undefined ? `${a.distanceM} m from the venue` : 'Location not captured'}
        </T>
      </View>
      {a.flagged ? <Pill label="Flagged for review" tone="warn" /> : <Pill label="Verified" tone="success" icon="checkmark" />}
    </View>
  );
}

export default function GigDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const app = useStore((s) => s.applications.find((a) => a.id === id));
  const job = useStore((s) => s.jobs.find((j) => j.id === app?.jobId));
  const cancel = useStore((s) => s.cancelApplication);
  const toast = useStore((s) => s.showToast);
  const [sheet, setSheet] = useState(false);

  if (!app || !job) {
    return (
      <Screen header={<Header title="Gig" />}>
        <Empty icon="alert-circle" title="Gig not found" action="My Gigs" onAction={() => router.replace('/worker/gigs')} />
      </Screen>
    );
  }

  const meta = appMeta[app.status];
  const pay = workerPay(job);
  const today = dayDiff(job.dateISO) === 0;
  const hrs = hoursUntil(job.dateISO, job.start);
  const late = app.status === 'confirmed' && hrs < CANCEL_WINDOW_HOURS;
  const ended = ['cancelled', 'late_cancel', 'rejected', 'no_show'].includes(app.status);
  const canCancel = app.status === 'applied' || app.status === 'waitlisted' || app.status === 'confirmed';
  const showContact = ['confirmed', 'checked_in'].includes(app.status);

  const doCancel = () => {
    setSheet(false);
    const res = cancel(app.id);
    toast(res === 'late_cancel' ? 'Cancelled. A strike was added.' : 'Application cancelled', res === 'late_cancel' ? 'danger' : 'info');
  };

  let footer = null;
  if (app.status === 'confirmed')
    footer = (
      <>
        <Btn title={today ? 'Check in' : `Check-in opens on ${dayLong(job.dateISO).split(',')[0]}`} icon="scan" disabled={!today} onPress={() => router.push(`/worker/attendance/${app.id}?mode=in`)} />
        <Btn title="Cancel my spot" variant="ghost" size="md" onPress={() => setSheet(true)} />
      </>
    );
  else if (app.status === 'checked_in') footer = <Btn title="Check out" icon="exit" variant="dark" onPress={() => router.push(`/worker/attendance/${app.id}?mode=out`)} />;
  else if (app.status === 'applied' || app.status === 'waitlisted') footer = <Btn title="Withdraw application" variant="outline" onPress={() => setSheet(true)} />;
  else if (app.status === 'paid' && !app.ratedBusiness) footer = <Btn title="Rate this company" icon="star" onPress={() => router.push(`/worker/rate/${app.id}`)} />;

  return (
    <Screen header={<Header title="My gig" />} footer={footer}>
      <Pill label={meta.label} tone={meta.tone} />
      <T v="h1" style={{ marginTop: 8 }}>
        {job.title}
      </T>
      <T v="body" color={C.muted}>
        {job.business}
      </T>

      {!ended ? (
        <Card style={{ marginTop: 16 }} pad={16}>
          <Steps steps={['Applied', 'Confirmed', 'On site', 'Done', 'Paid']} current={meta.step} />
        </Card>
      ) : null}

      {/* What is happening right now */}
      <View style={{ marginTop: 14 }}>
        {app.status === 'applied' ? <Banner tone="violet" icon="hourglass" title="Under review" text="The Rozkaam team is reviewing your application. In this demo a decision arrives in a few seconds." /> : null}
        {app.status === 'waitlisted' ? <Banner tone="info" icon="list" title="You are on the waitlist" text="All slots are confirmed. We will notify you straight away if one opens up." /> : null}
        {app.status === 'confirmed' ? (
          <Banner tone="success" icon="checkmark-circle" title="You're confirmed" text={`Report by ${time12(job.report)} on ${dayLong(job.dateISO)}. We will remind you 2 hours before, with the location.`} />
        ) : null}
        {app.status === 'checked_in' ? <Banner tone="violet" icon="location" title="You are checked in" text={`Shift ends at ${time12(job.end)}. Remember to check out before you leave the venue.`} /> : null}
        {app.status === 'checked_out' ? <Banner tone="info" icon="time" title="Waiting for the payout" text={`${job.business} is confirming attendance. ${inr(pay)} will be added to your wallet. In this demo it takes a few seconds.`} /> : null}
        {app.status === 'paid' ? (
          <View style={{ backgroundColor: C.successSoft, borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <T v="smallM" color={C.success}>
                Paid to your wallet
              </T>
              <Text style={{ fontFamily: F.extra, fontSize: 28, color: C.text }}>{inr(pay)}</Text>
            </View>
            <Btn title="Wallet" size="sm" variant="white" onPress={() => router.push('/worker/payments')} />
          </View>
        ) : null}
        {app.status === 'cancelled' ? <Banner tone="neutral" icon="close-circle" text="You cancelled this application. No penalty was applied." /> : null}
        {app.status === 'late_cancel' ? <Banner tone="danger" icon="alert-circle" title="Late cancellation" text={`You cancelled less than ${CANCEL_WINDOW_HOURS} hours before the start, so a strike was added. If it was a genuine emergency, message support to have it reviewed.`} /> : null}
        {app.status === 'rejected' ? <Banner tone="neutral" icon="information-circle" text="You were not selected for this job. Keep applying — new jobs are posted every day." /> : null}
        {app.status === 'no_show' ? <Banner tone="danger" icon="alert-circle" title="Marked as no-show" text="A strike was added. Contact support if this is a mistake." /> : null}
      </View>

      {app.ratedBusiness ? (
        <Card style={{ marginTop: 12 }} pad={14}>
          <T v="smallM" color={C.muted}>
            Your rating for {job.business}
          </T>
          <View style={{ marginTop: 6 }}>
            <Stars value={app.ratedBusiness} size={22} />
          </View>
        </Card>
      ) : null}

      {app.checkIn || app.checkOut ? (
        <Section title="Attendance">
          <Card pad={12}>
            <AttRow label="Check-in" a={app.checkIn} />
            <AttRow label="Check-out" a={app.checkOut} />
          </Card>
        </Section>
      ) : null}

      <Section title="Details">
        <Card pad={14}>
          <KV k="Date" v={dayLong(job.dateISO)} />
          <KV k="Report by" v={time12(job.report)} />
          <KV k="Shift" v={`${time12(job.start)} – ${time12(job.end)}`} />
          <KV k="Dress code" v={job.dress} />
          <KV k="You receive" v={inr(pay)} bold color={C.violet} />
        </Card>
      </Section>

      <Section title="Where">
        <MapCard label={job.venue} sub={job.address} onPress={() => openMaps(job.lat, job.lng, job.venue)} />
      </Section>

      {showContact ? (
        <Section title="Contact at the venue">
          <Card pad={14}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Avatar name={job.pocName} tone="grey" />
              <View style={{ flex: 1 }}>
                <T v="bodyM">{job.pocName}</T>
                <T v="small" color={C.muted}>
                  {job.pocPhone}
                </T>
              </View>
              <IconBtn icon="call" tone="violet" onPress={() => callPhone(job.pocPhone)} label="Call contact" />
            </View>
          </Card>
        </Section>
      ) : null}

      <Section title="Instructions">
        <T v="body" color={C.muted}>
          {job.instructions}
        </T>
      </Section>

      <Btn title="View full job post" variant="ghost" size="md" onPress={() => router.push(`/worker/job/${job.id}`)} style={{ marginTop: 10 }} />

      <Sheet open={sheet && canCancel} onClose={() => setSheet(false)} title={app.status === 'confirmed' ? 'Cancel your spot?' : 'Withdraw application?'}>
        {late ? (
          <Banner tone="danger" icon="alert-circle" title="This will add a strike" text={`The job starts in under ${CANCEL_WINDOW_HOURS} hours. Cancelling now is a late cancellation. Repeated strikes lead to suspension. If this is a genuine emergency, cancel and then message support.`} />
        ) : (
          <Banner tone="success" icon="checkmark-circle" title="No penalty" text={app.status === 'confirmed' ? `You are cancelling more than ${CANCEL_WINDOW_HOURS} hours before the start, so there is no strike. Your slot will go to someone on the waitlist.` : 'You have not been confirmed yet, so withdrawing has no effect on your reliability.'} />
        )}
        <View style={{ height: 14 }} />
        <Btn title={late ? 'Cancel anyway' : app.status === 'confirmed' ? 'Cancel my spot' : 'Withdraw'} variant="danger" onPress={doCancel} />
        <Btn title="Keep it" variant="ghost" onPress={() => setSheet(false)} />
      </Sheet>
    </Screen>
  );
}
