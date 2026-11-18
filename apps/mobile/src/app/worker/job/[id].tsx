import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { openMaps } from '@/lib/device';
import { dayLabel, dayLong, hoursBetween, inr, time12 } from '@/lib/format';
import { CANCEL_WINDOW_HOURS, useJob, useStore, workerPay } from '@/store';
import { Avatar, Btn, C, Card, Empty, F, Header, IconBtn, Ionicons, KV, Screen, Sheet, T, venuePhoto } from '@/ui';
import { categoryIcon } from '@/ui/JobCard';

const SOFT = '#E2D3FF'; // light violet text on the violet screen

function Tile({ big, unit, label }: { big: string; unit: string; label: string }) {
  return (
    <View style={{ height: 92, borderRadius: 20, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.45)', paddingHorizontal: 14, paddingVertical: 12, justifyContent: 'space-between' }}>
      <Text style={{ fontFamily: F.medium, fontSize: 28, lineHeight: 32, color: C.white }}>
        {big} <Text style={{ fontSize: 14 }}>{unit}</Text>
      </Text>
      <Text numberOfLines={1} style={{ fontFamily: F.medium, fontSize: 12, color: SOFT }}>
        {label}
      </Text>
    </View>
  );
}

const Chip = ({ text }: { text: string }) => (
  <View style={{ backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 }}>
    <Text style={{ fontFamily: F.bold, fontSize: 12, color: C.white }}>{text}</Text>
  </View>
);

export default function JobDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const job = useJob(id);
  const apps = useStore((s) => s.applications);
  const apply = useStore((s) => s.apply);
  const toast = useStore((s) => s.showToast);
  const [confirm, setConfirm] = useState(false);

  if (!job) {
    return (
      <Screen header={<Header title="Job" />}>
        <Empty icon="alert-circle" title="Job not found" text="This job may have been filled or removed." action="Back to jobs" onAction={() => router.replace('/worker')} />
      </Screen>
    );
  }

  const mine = apps.find((a) => a.jobId === job.id && !['cancelled', 'late_cancel', 'rejected'].includes(a.status));
  const left = Math.max(0, job.needed - job.confirmed);
  const full = left === 0;
  const pay = workerPay(job);
  const photo = venuePhoto(job.category);
  const words = job.title.split(' ');
  const first = words[0]!;
  const rest = words.slice(1).join(' ');

  const doApply = async () => {
    setConfirm(false);
    const appId = await apply(job.id);
    if (!appId) return;
    toast('Application sent');
    router.replace(`/worker/gig/${appId}`);
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.violet }}>
      <StatusBar style="light" />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: insets.top + 8, paddingHorizontal: 12 }}>
        <IconBtn icon="chevron-back" tone="ghostDark" onPress={() => (router.canGoBack() ? router.back() : router.replace('/worker'))} label="Back" />
        <IconBtn icon="navigate" tone="ghostDark" onPress={() => openMaps(job.lat, job.lng, job.venue)} label="Open in maps" />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        <View style={{ paddingHorizontal: 24, paddingTop: 12 }}>
          <Text style={{ fontFamily: F.bold, fontSize: 32, lineHeight: 40, letterSpacing: -0.8, color: C.white }}>{first}</Text>
          {rest ? <Text style={{ fontFamily: F.medium, fontSize: 32, lineHeight: 40, letterSpacing: -0.8, color: SOFT }}>{rest}</Text> : null}
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 14 }}>
            <Text style={{ fontFamily: F.bold, fontSize: 32, color: C.white }}>{inr(pay)}</Text>
            <Text style={{ fontFamily: F.medium, fontSize: 14, color: SOFT }}>/ shift, paid to your wallet</Text>
          </View>
        </View>

        {/* Stat tiles on the left, venue photo bleeding off the right edge */}
        <View style={{ flexDirection: 'row', gap: 16, marginTop: 24, paddingLeft: 24 }}>
          <View style={{ width: 124, gap: 12 }}>
            <Tile big={String(hoursBetween(job.start, job.end))} unit="h" label={`${time12(job.start)} start`} />
            <Tile big={String(job.distanceKm)} unit="km" label={job.area} />
            <Tile big={String(left)} unit={`of ${job.needed}`} label={full ? 'Waitlist open' : 'Slots left'} />
          </View>
          <View style={{ flex: 1, height: 300, borderTopLeftRadius: 28, borderBottomLeftRadius: 28, overflow: 'hidden', backgroundColor: '#7B24FF', boxShadow: '0 24px 48px rgba(30, 0, 90, 0.45)' }}>
            {photo ? (
              <Image source={photo} style={{ width: '100%', height: 300 }} contentFit="cover" accessibilityLabel={job.venue} />
            ) : (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={categoryIcon[job.category]} size={96} color="rgba(255,255,255,0.35)" />
              </View>
            )}
            <View style={{ position: 'absolute', left: 12, right: 12, bottom: 12, backgroundColor: C.white, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 }}>
              <Text numberOfLines={1} style={{ fontFamily: F.bold, fontSize: 12, color: C.text }}>
                {job.venue}
              </Text>
              <Text numberOfLines={1} style={{ fontFamily: F.medium, fontSize: 12, color: C.muted }}>
                {dayLabel(job.dateISO)} · {job.category}
              </Text>
            </View>
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 24, marginTop: 24 }}>
          <Avatar name={job.business} size={44} tone="grey" />
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={{ fontFamily: F.bold, fontSize: 15, color: C.white }}>
              {job.business}
            </Text>
            <Text numberOfLines={1} style={{ fontFamily: F.medium, fontSize: 12, color: SOFT }}>
              Verified{job.businessRating ? ` · ${job.businessRating.toFixed(1)} rating` : ' · New on Rozkaam'}{job.businessJobs ? ` · ${job.businessJobs} jobs posted` : ''}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 24, marginTop: 16 }}>
          <Chip text={`Report ${time12(job.report)}`} />
          <Chip text={`Ends ${time12(job.end)}`} />
          {job.urgent ? <Chip text="Urgent" /> : null}
          {job.gender !== 'Any' ? <Chip text={job.gender} /> : null}
          {job.skills.map((s) => (
            <Chip key={s} text={s} />
          ))}
        </View>

        <View style={{ paddingHorizontal: 24, marginTop: 20, gap: 12 }}>
          {job.description ? <Text style={{ fontFamily: F.medium, fontSize: 15, lineHeight: 22, color: C.white }}>{job.description}</Text> : null}
          <Text style={{ fontFamily: F.medium, fontSize: 13, lineHeight: 19, color: SOFT }}>
            Dress code: {job.dress} {'\n'}
            {job.instructions} {'\n'}
            Cancel free up to {CANCEL_WINDOW_HOURS} hours before the start. Later cancellations add a strike.
          </Text>
        </View>
      </ScrollView>

      <View style={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: Math.max(insets.bottom, 16) + 8 }}>
        {mine ? <Btn title="View my application" onPress={() => router.push(`/worker/gig/${mine.id}`)} /> : <Btn title={full ? 'Join waitlist' : 'Apply now'} onPress={() => setConfirm(true)} />}
      </View>

      <Sheet open={confirm} onClose={() => setConfirm(false)} title={full ? 'Join the waitlist?' : 'Apply for this job?'}>
        <Card pad={14} style={{ backgroundColor: C.bg, boxShadow: 'none' }}>
          <T v="bodyM">{job.title}</T>
          <T v="small" color={C.muted}>
            {job.business}
          </T>
          <View style={{ height: 8 }} />
          <KV k="When" v={dayLong(job.dateISO)} />
          <KV k="Report by" v={time12(job.report)} />
          <KV k="Where" v={job.venue} />
          <KV k="You receive" v={inr(pay)} bold color={C.violet} />
        </Card>
        <T v="small" color={C.muted} style={{ marginVertical: 12 }}>
          {full
            ? 'All slots are confirmed right now. If someone drops out, the Rozkaam team may confirm you from the waitlist.'
            : 'The Rozkaam team reviews applications and confirms workers. By applying you agree to attend if confirmed.'}
        </T>
        <Btn title={full ? 'Join waitlist' : 'Confirm and apply'} onPress={doApply} />
        <Btn title="Not now" variant="ghost" onPress={() => setConfirm(false)} />
      </Sheet>
    </View>
  );
}
