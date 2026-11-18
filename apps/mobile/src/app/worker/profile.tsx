import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { pickPhoto } from '@/lib/device';
import { DISTRICTS, EXPERIENCE, SKILLS, useStore } from '@/store';
import { Avatar, Btn, C, Card, Chip, Field, Header, Ionicons, KV, Pill, Screen, Section, Select, T } from '@/ui';

export default function EditProfile() {
  const saved = useStore((s) => s.worker);
  const saveWorker = useStore((s) => s.saveWorker);
  const toast = useStore((s) => s.showToast);
  const [w, setW] = useState(saved);
  const [err, setErr] = useState<Record<string, string>>({});
  const set = (p: Partial<typeof w>) => setW({ ...w, ...p });

  const save = async () => {
    const e: Record<string, string> = {};
    if (w.name.trim().length < 3) e.name = 'Enter your full name.';
    if (!w.area.trim()) e.area = 'Enter your area or town.';
    if (w.skills.length === 0) e.skills = 'Pick at least one skill.';
    setErr(e);
    if (Object.keys(e).length) return;
    if (!(await saveWorker(w))) return;
    toast('Profile updated');
    router.back();
  };

  return (
    <Screen header={<Header title="Edit profile" />} footer={<Btn title="Save changes" onPress={save} />}>
      <View style={{ alignItems: 'center', marginBottom: 18 }}>
        <Pressable onPress={async () => set({ photo: (await pickPhoto()) ?? w.photo })} accessibilityRole="button" accessibilityLabel="Change profile photo">
          <Avatar name={w.name} uri={w.photo} size={92} />
          <View style={{ position: 'absolute', right: -2, bottom: -2, width: 32, height: 32, borderRadius: 16, backgroundColor: C.violet, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: C.bg }}>
            <Ionicons name="camera" size={15} color={C.white} />
          </View>
        </Pressable>
      </View>

      <Field label="Full name" icon="person" value={w.name} onChangeText={(name) => set({ name })} error={err.name} autoCapitalize="words" />
      <Select label="District" icon="map" value={w.district} options={[...DISTRICTS]} onChange={(district) => set({ district })} />
      <Field label="Area / town" icon="location" value={w.area} onChangeText={(area) => set({ area })} error={err.area} />
      <Field label="About you" value={w.about} onChangeText={(about) => set({ about })} multiline maxLength={200} placeholder="A line about your availability or experience" />

      <Section title="Skills" style={{ marginTop: 6 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {SKILLS.map((s) => (
            <Chip key={s} label={s} selected={w.skills.includes(s)} onPress={() => set({ skills: w.skills.includes(s) ? w.skills.filter((x) => x !== s) : [...w.skills, s] })} />
          ))}
        </View>
        {err.skills ? (
          <T v="caption" color={C.danger} style={{ marginTop: 6 }}>
            {err.skills}
          </T>
        ) : null}
      </Section>

      <Section title="Experience">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {EXPERIENCE.map((x) => (
            <Chip key={x} label={x} selected={w.experience === x} onPress={() => set({ experience: x })} />
          ))}
        </View>
      </Section>

      <Section title="Payout details">
        <Field label="UPI ID" icon="flash" value={w.upi} onChangeText={(upi) => set({ upi: upi.trim() })} autoCapitalize="none" placeholder="name@upi" />
        <Card pad={14}>
          <KV k="Account holder" v={w.bankName || '—'} />
          <KV k="Account number" v={w.accountNumber ? `•••• ${w.accountNumber.slice(-4)}` : '—'} />
          <KV k="IFSC" v={w.ifsc || '—'} />
          <T v="caption" color={C.muted} style={{ marginTop: 6 }}>
            To change bank details, message support. Changes are re-verified to protect your earnings.
          </T>
        </Card>
      </Section>

      <Section title="Identity">
        <Card pad={14}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <T v="bodyM">{w.idType || 'ID'}</T>
              <T v="small" color={C.muted}>
                {w.idNumber ? `•••• ${w.idNumber.replace(/\s/g, '').slice(-4)}` : 'Submitted'}
              </T>
            </View>
            <Pill label="Verified" tone="success" icon="shield-checkmark" />
          </View>
        </Card>
      </Section>
    </Screen>
  );
}
