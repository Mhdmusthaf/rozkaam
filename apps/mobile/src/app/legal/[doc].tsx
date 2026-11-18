import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { Banner, C, Header, Screen, T } from '@/ui';

// Plain-language outlines. The final legal text must come from a lawyer.
const DOCS: Record<string, { title: string; sections: { h: string; p: string }[] }> = {
  terms: {
    title: 'Terms of use',
    sections: [
      { h: 'What Rozkaam is', p: 'Rozkaam is a platform that connects businesses needing short-term workers with people looking for flexible work. Rozkaam verifies accounts, coordinates confirmations, records attendance and facilitates payment.' },
      { h: 'Your account', p: 'You must be 18 or older, give accurate details, and keep your account for your own use. One person, one account.' },
      { h: 'For workers', p: 'Apply only for work you can attend. Follow the reporting time, dress code and instructions. Check in and out honestly with your own photo and location.' },
      { h: 'For businesses', p: 'Post accurate details of the work, pay, timing and location. Fund each requirement before it goes live, treat workers fairly, and confirm attendance promptly.' },
      { h: 'Cancellations and reliability', p: 'Workers can cancel up to 12 hours before the start without penalty. Late cancellations and no-shows are recorded and can lead to restriction, suspension or removal. Genuine emergencies are reviewed separately.' },
      { h: 'Payments', p: 'Businesses fund the worker pay and Rozkaam’s service fee. Worker pay is released after attendance is confirmed. Unused or cancelled slots are refunded.' },
      { h: 'Conduct', p: 'Harassment, discrimination, fraud and unsafe behaviour are not allowed and can lead to removal from the platform.' },
    ],
  },
  privacy: {
    title: 'Privacy policy',
    sections: [
      { h: 'What we collect', p: 'Your phone number, profile details, identity documents for verification, bank details for payouts, and photos, location and time at check-in and check-out.' },
      { h: 'Why we collect it', p: 'To verify accounts, show nearby jobs, confirm attendance, pay workers, resolve disputes and keep the platform safe.' },
      { h: 'Who sees what', p: 'Businesses see a confirmed worker’s name, photo, rating and work history. They never see ID documents or bank details. Workers see the business name, rating, venue and contact person for confirmed jobs.' },
      { h: 'Location', p: 'Location is used to show jobs near you and is recorded only when you check in or check out. Rozkaam does not track you in the background.' },
      { h: 'Your choices', p: 'You can view and correct your details in the app, and ask us to delete your account and data, subject to records we must keep by law.' },
    ],
  },
};

export default function Legal() {
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const d = DOCS[doc ?? 'terms'] ?? DOCS.terms!;
  return (
    <Screen header={<Header title={d.title} />}>
      <Banner tone="warn" icon="document-text" text="Summary draft for the demo. The final legal text will be added before launch." style={{ marginBottom: 18 }} />
      {d.sections.map((s) => (
        <View key={s.h} style={{ marginBottom: 18 }}>
          <T v="h3">{s.h}</T>
          <T v="body" color={C.muted} style={{ marginTop: 4 }}>
            {s.p}
          </T>
        </View>
      ))}
    </Screen>
  );
}
