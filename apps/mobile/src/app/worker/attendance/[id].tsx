import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { Fix, getFix, takePhoto } from '@/lib/device';
import { metresBetween, nowHM, time12 } from '@/lib/format';
import { GEOFENCE_M, useStore } from '@/store';
import { Banner, Btn, C, Card, Empty, F, Header, IconTile, IMG, PhotoBox, Pill, Screen, T } from '@/ui';

type LocState = { kind: 'loading' } | { kind: 'ok'; fix: Fix; distanceM: number } | { kind: 'failed' } | { kind: 'demo'; distanceM: number };

const distText = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`);

export default function AttendanceCapture() {
  const { id, mode } = useLocalSearchParams<{ id: string; mode: 'in' | 'out' }>();
  const isOut = mode === 'out';
  const app = useStore((s) => s.applications.find((a) => a.id === id));
  const job = useStore((s) => s.jobs.find((j) => j.id === app?.jobId));
  const checkIn = useStore((s) => s.checkIn);
  const checkOut = useStore((s) => s.checkOut);

  const [loc, setLoc] = useState<LocState>({ kind: 'loading' });
  const [photo, setPhoto] = useState<string | null>(null);
  const [clock, setClock] = useState(nowHM());
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const locate = useCallback(async () => {
    if (!job) return;
    setLoc({ kind: 'loading' });
    const fix = await getFix();
    setLoc(fix ? { kind: 'ok', fix, distanceM: metresBetween(fix.lat, fix.lng, job.lat, job.lng) } : { kind: 'failed' });
  }, [job]);

  useEffect(() => {
    locate();
  }, [locate]);
  useEffect(() => {
    const t = setInterval(() => setClock(nowHM()), 15000);
    return () => clearInterval(t);
  }, []);

  if (!app || !job) {
    return (
      <Screen header={<Header title="Check in" />}>
        <Empty icon="alert-circle" title="Gig not found" action="My Gigs" onAction={() => router.replace('/worker/gigs')} />
      </Screen>
    );
  }

  const distanceM = loc.kind === 'ok' || loc.kind === 'demo' ? loc.distanceM : undefined;
  const far = distanceM !== undefined && distanceM > GEOFENCE_M;
  const flagged = loc.kind === 'failed' || far;

  const submit = async () => {
    const a = {
      at: new Date().toISOString(),
      photo,
      lat: loc.kind === 'ok' ? loc.fix.lat : undefined,
      lng: loc.kind === 'ok' ? loc.fix.lng : undefined,
      distanceM,
      flagged,
    };
    setBusy(true);
    const ok = isOut ? await checkOut(app.id, a) : await checkIn(app.id, a);
    setBusy(false);
    if (ok) setDone(true);
  };

  if (done) {
    return (
      <Screen bg={C.white} footer={<Btn title="Done" icon="checkmark" onPress={() => router.replace(`/worker/gig/${app.id}`)} />}>
        <View style={{ alignItems: 'center', marginTop: 8 }}>
          <View style={{ width: '100%', height: 280, borderRadius: 36, backgroundColor: '#F4EEFF', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            <View style={{ position: 'absolute', width: 250, height: 250, borderRadius: 125, backgroundColor: 'rgba(255,255,255,0.75)' }} />
            <Image source={IMG.pin} style={{ width: 236, height: 236 }} contentFit="contain" accessibilityLabel="Location pin with a check mark" />
          </View>
          <T v="h1" center style={{ marginTop: 20 }}>
            {isOut ? "You're checked out" : "You're checked in"}
          </T>
          <Text style={{ fontFamily: F.extra, fontSize: 34, color: C.violet, marginTop: 4 }}>{time12(clock)}</Text>
          <T v="body" color={C.muted} center style={{ marginTop: 8, maxWidth: 300 }}>
            {isOut ? `Thanks for your work today. Your pay is added to your wallet once ${job.business} completes the payout.` : `Have a good shift at ${job.venue}. Check out here when you finish.`}
          </T>
          {flagged ? <Banner tone="warn" icon="alert-circle" text="This was flagged for review because your location could not be matched to the venue." style={{ marginTop: 20 }} /> : null}
        </View>
      </Screen>
    );
  }

  return (
    <Screen header={<Header title={isOut ? 'Check out' : 'Check in'} />} footer={<Btn title={isOut ? 'Confirm check-out' : 'Confirm check-in'} icon="checkmark-circle" disabled={!photo || loc.kind === 'loading'} loading={busy} onPress={submit} />}>
      <T v="h2">{job.title}</T>
      <T v="body" color={C.muted}>
        {job.venue}
      </T>

      {/* 1. Location */}
      <Card style={{ marginTop: 16 }} pad={14}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <IconTile icon="location" tone={loc.kind === 'loading' ? 'neutral' : flagged ? 'warn' : 'success'} />
          <View style={{ flex: 1 }}>
            <T v="bodyM">1. Live location</T>
            <T v="small" color={C.muted}>
              {loc.kind === 'loading' && 'Finding your location…'}
              {loc.kind === 'failed' && 'Could not get your location.'}
              {(loc.kind === 'ok' || loc.kind === 'demo') && `${distText(loc.distanceM)} from the venue`}
            </T>
          </View>
          {loc.kind === 'loading' ? <ActivityIndicator color={C.violet} /> : flagged ? <Pill label="Too far" tone="warn" /> : <Pill label="At venue" tone="success" icon="checkmark" />}
        </View>
        {flagged ? (
          <>
            <Banner
              tone="warn"
              icon="alert-circle"
              text={loc.kind === 'failed' ? 'Turn on location and allow Rozkaam to use it, then try again. You can still continue, but it will be flagged for review.' : `You need to be within ${GEOFENCE_M} m of the venue. You can still continue, but it will be flagged for review.`}
              style={{ marginTop: 12 }}
            />
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
              <Btn title="Try again" size="sm" variant="soft" icon="refresh" onPress={locate} />
              <Btn title="Sandbox: I'm at the venue" size="sm" variant="outline" onPress={() => setLoc({ kind: 'demo', distanceM: 35 })} />
            </View>
          </>
        ) : null}
      </Card>

      {/* 2. Photo */}
      <Card style={{ marginTop: 12 }} pad={14}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <IconTile icon="camera" tone={photo ? 'success' : 'violet'} />
          <View style={{ flex: 1 }}>
            <T v="bodyM">2. Photo</T>
            <T v="small" color={C.muted}>
              {isOut ? 'Take a photo at the venue before you leave.' : 'Take a photo of yourself in uniform at the venue.'}
            </T>
          </View>
        </View>
        <PhotoBox label="Take photo" hint={isOut ? undefined : `Dress code: ${job.dress}`} uri={photo} height={190} onPress={async () => setPhoto((await takePhoto({ front: true })) ?? photo)} />
      </Card>

      {/* 3. Time */}
      <Card style={{ marginTop: 12 }} pad={14}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <IconTile icon="time" tone="info" />
          <View style={{ flex: 1 }}>
            <T v="bodyM">3. Time</T>
            <T v="small" color={C.muted}>
              Recorded automatically · {isOut ? `shift ends ${time12(job.end)}` : `report by ${time12(job.report)}`}
            </T>
          </View>
          <Text style={{ fontFamily: F.extra, fontSize: 20, color: C.text }}>{time12(clock)}</Text>
        </View>
      </Card>
    </Screen>
  );
}
