import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { useStore } from '@/store';
import { Banner, Btn, C, Card, Field, Header, Ionicons, Screen, Section, T } from '@/ui';

const FAQ = {
  worker: [
    { q: 'How do I get confirmed for a job?', a: 'Apply from the job page. The Rozkaam team reviews applications and confirms workers. You get a notification as soon as you are confirmed or added to the waitlist.' },
    { q: 'When and how am I paid?', a: 'After you check out, the business confirms attendance and your pay is added to your Rozkaam wallet. You can withdraw it to your bank account or UPI from the Payments tab.' },
    { q: 'What if I need to cancel?', a: 'You can cancel free of charge up to 12 hours before the start time. Cancelling later, or not showing up, adds a strike and can lead to suspension. Tell us if it was a genuine emergency.' },
    { q: 'Why do I need a photo and location to check in?', a: 'The check-in photo, location and time prove you were at the venue, so there is no dispute about attendance or pay. The photo is also used to check the dress code.' },
    { q: 'What are strikes?', a: 'A strike is recorded for a late cancellation or a no-show. Repeated strikes lower your priority, then restrict your account. Strikes for genuine emergencies can be excused by the Rozkaam team.' },
  ],
  business: [
    { q: 'Who picks the workers?', a: 'The Rozkaam team reviews applicants and confirms the workers for your requirement, using their ratings, reliability and skills. You can see the confirmed team at any time.' },
    { q: 'Why do I fund the requirement first?', a: 'Funding up front means workers know the pay is secured. Money is only released to workers after you approve attendance, and unused slots are refunded.' },
    { q: 'What happens if a worker does not show up?', a: 'Rozkaam moves a waitlisted worker into the slot where possible. You are not charged for a no-show, and the worker gets a strike.' },
    { q: 'How is attendance verified?', a: 'Each worker checks in and out with a photo, GPS location and timestamp. Check-ins far from the venue are flagged for you to review.' },
    { q: 'Can I cancel a requirement?', a: 'Yes. Open the requirement and choose Cancel. The funded amount is refunded. Please cancel as early as you can, because confirmed workers have kept the day free.' },
  ],
};

export default function Help() {
  const role = useStore((s) => s.session.role) ?? 'worker';
  const toast = useStore((s) => s.showToast);
  const [open, setOpen] = useState<number | null>(0);
  const [msg, setMsg] = useState('');

  return (
    <Screen header={<Header title="Help & support" />}>
      <T v="h2">How can we help?</T>

      <Section title="Common questions" style={{ marginTop: 16 }}>
        <Card pad={4}>
          {FAQ[role].map((f, i) => (
            <Pressable key={f.q} onPress={() => setOpen(open === i ? null : i)} style={{ paddingHorizontal: 14, paddingVertical: 14, borderTopWidth: i ? 1 : 0, borderTopColor: C.line }} accessibilityRole="button" accessibilityState={{ expanded: open === i }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <T v="bodyM" style={{ flex: 1 }}>
                  {f.q}
                </T>
                <Ionicons name={open === i ? 'chevron-up' : 'chevron-down'} size={18} color={C.faint} />
              </View>
              {open === i ? (
                <T v="small" color={C.muted} style={{ marginTop: 8 }}>
                  {f.a}
                </T>
              ) : null}
            </Pressable>
          ))}
        </Card>
      </Section>

      <Section title="Message the Rozkaam team">
        <Field placeholder="Describe the problem. Include the job name if it is about a job." value={msg} onChangeText={setMsg} multiline />
        <Btn
          title="Send message"
          icon="send"
          disabled={msg.trim().length < 5}
          onPress={() => {
            setMsg('');
            toast('Message sent. We will reply in the app.');
          }}
        />
        <Banner tone="neutral" icon="information-circle" text="Phone and WhatsApp support numbers will be added here before launch." style={{ marginTop: 14 }} />
      </Section>
    </Screen>
  );
}
