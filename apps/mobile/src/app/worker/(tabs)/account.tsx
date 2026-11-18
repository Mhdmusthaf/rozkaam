import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { useStore, useUnread } from '@/store';
import { Avatar, Btn, C, Card, Divider, Pill, Rating, Row, Screen, Sheet, Stat, T } from '@/ui';

export default function Account() {
  const w = useStore((s) => s.worker);
  const phone = useStore((s) => s.session.phone);
  const signOut = useStore((s) => s.signOut);
  const demoLogin = useStore((s) => s.demoLogin);
  const unread = useUnread('worker');
  const [out, setOut] = useState(false);
  const active = w.strikes.filter((s) => !s.excused).length;

  return (
    <Screen contentStyle={{ paddingBottom: 28 }}>
      <T v="h1" style={{ marginTop: 10 }}>
        Account
      </T>

      <Card style={{ marginTop: 16 }} onPress={() => router.push('/worker/profile')}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <Avatar name={w.name} uri={w.photo} size={64} />
          <View style={{ flex: 1, gap: 3 }}>
            <T v="h3" numberOfLines={1}>
              {w.name}
            </T>
            <T v="small" color={C.muted}>
              +91 {phone} · {w.area}
            </T>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}>
              <Pill label="KYC verified" tone="success" icon="shield-checkmark" />
              {w.ratingCount > 0 ? <Rating value={w.rating} count={w.ratingCount} /> : null}
            </View>
          </View>
        </View>
        <Divider />
        <View style={{ flexDirection: 'row' }}>
          <Stat value={String(w.jobsDone)} label="Jobs done" />
          <Stat value={String(w.hours)} label="Hours" />
          <Stat value={`${w.reliability}%`} label="Reliability" />
        </View>
      </Card>

      <Card style={{ marginTop: 14 }} pad={8}>
        <View style={{ paddingHorizontal: 8 }}>
          <Row icon="person" title="Edit profile" sub="Photo, skills, experience, payout details" chevron onPress={() => router.push('/worker/profile')} />
          <Row icon="ribbon" tone={active ? 'warn' : 'success'} title="Reliability and strikes" sub={active ? `${active} active ${active === 1 ? 'strike' : 'strikes'}` : 'Good standing'} chevron onPress={() => router.push('/worker/reliability')} />
          <Row icon="notifications" title="Notifications" sub={unread ? `${unread} unread` : 'All caught up'} chevron onPress={() => router.push('/notifications')} />
        </View>
      </Card>

      <Card style={{ marginTop: 14 }} pad={8}>
        <View style={{ paddingHorizontal: 8 }}>
          <Row icon="help-buoy" tone="info" title="Help and support" chevron onPress={() => router.push('/help')} />
          <Row icon="document-text" tone="neutral" title="Terms of use" chevron onPress={() => router.push('/legal/terms')} />
          <Row icon="lock-closed" tone="neutral" title="Privacy policy" chevron onPress={() => router.push('/legal/privacy')} />
        </View>
      </Card>

      <Card style={{ marginTop: 14 }} pad={8}>
        <View style={{ paddingHorizontal: 8 }}>
          <Row
            icon="swap-horizontal"
            tone="dark"
            title="Switch to business demo"
            sub="See how a business posts and tracks work"
            chevron
            onPress={() => {
              demoLogin('business');
              router.replace('/');
            }}
          />
          <Row icon="log-out" tone="danger" title="Sign out" onPress={() => setOut(true)} />
        </View>
      </Card>

      <T v="caption" color={C.faint} center style={{ marginTop: 18 }}>
        Rozkaam 1.0.0 · Demo data
      </T>

      <Sheet open={out} onClose={() => setOut(false)} title="Sign out?">
        <T v="body" color={C.muted} style={{ marginBottom: 16 }}>
          You will need your mobile number and a code to sign in again.
        </T>
        <Btn
          title="Sign out"
          variant="danger"
          onPress={async () => {
            setOut(false);
            await signOut();
            router.replace('/');
          }}
        />
        <Btn title="Stay signed in" variant="ghost" onPress={() => setOut(false)} />
      </Sheet>
    </Screen>
  );
}
