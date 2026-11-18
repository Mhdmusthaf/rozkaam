import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { useStore, useUnread } from '@/store';
import { Avatar, Btn, C, Card, InfoLine, Pill, Rating, Row, Screen, Section, Sheet, T } from '@/ui';

export default function CompanyTab() {
  const company = useStore((s) => s.company);
  const session = useStore((s) => s.session);
  const demoLogin = useStore((s) => s.demoLogin);
  const signOut = useStore((s) => s.signOut);
  const unread = useUnread('business');
  const [confirmOut, setConfirmOut] = useState(false);

  const line = { borderTopWidth: 1, borderTopColor: C.line } as const;

  return (
    <Screen>
      <T v="h1" style={{ marginTop: 10, marginBottom: 16 }}>
        Company
      </T>

      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <Avatar name={company.name || 'Company'} size={60} />
          <View style={{ flex: 1, gap: 3 }}>
            <T v="h3" numberOfLines={2}>
              {company.name || 'Your company'}
            </T>
            <T v="small" color={C.muted}>
              {company.type || 'Business'}
            </T>
            {company.ratingCount > 0 ? <Rating value={company.rating} count={company.ratingCount} /> : null}
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
          {session.businessKyc === 'verified' ? <Pill label="Verified business" tone="success" icon="shield-checkmark" /> : <Pill label="Verification pending" tone="warn" icon="time" />}
        </View>
        <View style={{ gap: 6, marginTop: 14 }}>
          {company.contactName ? <InfoLine icon="person-outline" text={`${company.contactName}${company.contactRole ? ' · ' + company.contactRole : ''}`} /> : null}
          {session.phone ? <InfoLine icon="call-outline" text={`+91 ${session.phone}`} /> : null}
          {company.address ? <InfoLine icon="location-outline" text={company.address} /> : null}
        </View>
      </Card>

      <Section title="Account">
        <Card pad={6} style={{ paddingHorizontal: 14 }}>
          <Row icon="create-outline" title="Edit company" sub="Name, address, contact person" chevron onPress={() => router.push('/business/edit')} />
          <View style={line}>
            <Row
              icon="notifications-outline"
              title="Notifications"
              sub={unread ? `${unread} unread` : 'All caught up'}
              chevron
              onPress={() => router.push('/notifications')}
            />
          </View>
        </Card>
      </Section>

      <Section title="Support">
        <Card pad={6} style={{ paddingHorizontal: 14 }}>
          <Row icon="help-buoy-outline" tone="info" title="Help & support" chevron onPress={() => router.push('/help')} />
          <View style={line}>
            <Row icon="document-text-outline" tone="neutral" title="Terms of use" chevron onPress={() => router.push('/legal/terms')} />
          </View>
          <View style={line}>
            <Row icon="lock-closed-outline" tone="neutral" title="Privacy policy" chevron onPress={() => router.push('/legal/privacy')} />
          </View>
        </Card>
      </Section>

      <Section title="Demo">
        <Card pad={6} style={{ paddingHorizontal: 14 }}>
          <Row
            icon="swap-horizontal"
            tone="violet"
            title="Switch to worker demo"
            sub="See the app as a worker looking for jobs"
            chevron
            onPress={() => {
              demoLogin('worker');
              router.replace('/');
            }}
          />
        </Card>
      </Section>

      <Btn title="Sign out" variant="danger" icon="log-out-outline" onPress={() => setConfirmOut(true)} style={{ marginTop: 24 }} />

      <T v="caption" color={C.faint} center style={{ marginTop: 18 }}>
        Rozkaam v1.0.0 · Demo data
      </T>
      <T v="caption" color={C.faint} center>
        Businesses, people and payments shown here are sample data.
      </T>

      <Sheet open={confirmOut} onClose={() => setConfirmOut(false)} title="Sign out?">
        <T v="body" color={C.muted}>
          You will need your phone number and a one-time code to sign in again.
        </T>
        <View style={{ gap: 10, marginTop: 18 }}>
          <Btn
            title="Sign out"
            variant="dark"
            onPress={() => {
              setConfirmOut(false);
              signOut();
              router.replace('/');
            }}
          />
          <Btn title="Stay signed in" variant="outline" onPress={() => setConfirmOut(false)} />
        </View>
      </Sheet>
    </Screen>
  );
}
