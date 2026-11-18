import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { pickPhoto, takePhoto } from '@/lib/device';
import { DISTRICTS, EXPERIENCE, SKILLS, useStore } from '@/store';
import { Avatar, Banner, Btn, C, Chip, Field, Header, IMG, Ionicons, PhotoBox, Screen, Select, T } from '@/ui';
import { StepHead } from '@/ui/StepHead';

const TOTAL = 4;
const ID_TYPES = ['Aadhaar', 'Driving licence', 'Voter ID', 'Passport'];

export default function WorkerOnboarding() {
  const w = useStore((s) => s.worker);
  const update = useStore((s) => s.updateWorker);
  const submit = useStore((s) => s.submitWorkerKyc);
  const [step, setStep] = useState(1);
  const [err, setErr] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (step === 1) {
      if (w.name.trim().length < 3) e.name = 'Enter your full name as on your ID.';
      if (!/^\d{2}\/\d{2}\/\d{4}$/.test(w.dob)) e.dob = 'Use the format DD/MM/YYYY.';
      else if (new Date().getFullYear() - Number(w.dob.slice(6)) < 18) e.dob = 'You must be 18 or older to work through Rozkaam.';
      if (!w.gender) e.gender = 'Select one.';
      if (!w.district) e.district = 'Select your district.';
      if (!w.area.trim()) e.area = 'Enter your area or town.';
    }
    if (step === 2) {
      if (w.skills.length === 0) e.skills = 'Pick at least one skill.';
      if (!w.experience) e.experience = 'Select your experience.';
    }
    if (step === 3) {
      if (!w.idType) e.idType = 'Select an ID type.';
      if (w.idNumber.trim().length < 6) e.idNumber = 'Enter the ID number.';
      if (!w.idPhoto) e.idPhoto = 'Add a photo of your ID.';
      if (!w.selfie) e.selfie = 'Take a selfie.';
    }
    if (step === 4) {
      if (w.bankName.trim().length < 3) e.bankName = 'Enter the account holder name.';
      if (!/^\d{9,18}$/.test(w.accountNumber)) e.accountNumber = 'Enter a valid account number.';
      if (!/^[A-Za-z]{4}0[A-Za-z0-9]{6}$/.test(w.ifsc)) e.ifsc = 'Enter a valid 11-character IFSC.';
    }
    setErr(e);
    return Object.keys(e).length === 0;
  };

  const [busy, setBusy] = useState(false);
  const next = async () => {
    if (!validate() || busy) return;
    if (step < TOTAL) return setStep(step + 1);
    setBusy(true);
    const ok = await submit();
    setBusy(false);
    if (ok) router.replace('/onboarding/review');
  };
  const back = () => (step > 1 ? setStep(step - 1) : router.replace('/role'));
  const toggleSkill = (s: string) => update({ skills: w.skills.includes(s) ? w.skills.filter((x) => x !== s) : [...w.skills, s] });
  const dobInput = (t: string) => {
    const d = t.replace(/\D/g, '').slice(0, 8);
    update({ dob: [d.slice(0, 2), d.slice(2, 4), d.slice(4)].filter(Boolean).join('/') });
  };

  return (
    <Screen header={<Header onBack={back} />} footer={<Btn title={step === TOTAL ? 'Submit for verification' : 'Continue'} loading={busy} onPress={next} iconRight={step === TOTAL ? undefined : 'arrow-forward'} />}>
      {step === 1 && (
        <>
          <StepHead step={1} total={TOTAL} title="About you" text="This is shown to businesses once you are confirmed for a job." />
          <View style={{ alignItems: 'center', marginBottom: 20 }}>
            <Pressable onPress={async () => update({ photo: (await pickPhoto()) ?? w.photo })} accessibilityRole="button" accessibilityLabel="Add profile photo">
              <Avatar name={w.name || 'You'} uri={w.photo} size={92} />
              <View style={{ position: 'absolute', right: -2, bottom: -2, width: 32, height: 32, borderRadius: 16, backgroundColor: C.violet, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: C.bg }}>
                <Ionicons name="camera" size={15} color={C.white} />
              </View>
            </Pressable>
            <T v="caption" color={C.muted} style={{ marginTop: 8 }}>
              Profile photo (optional)
            </T>
          </View>
          <Field label="Full name" icon="person" placeholder="As on your ID" value={w.name} onChangeText={(name) => update({ name })} error={err.name} autoCapitalize="words" />
          <Field label="Date of birth" icon="calendar" placeholder="DD/MM/YYYY" keyboardType="number-pad" value={w.dob} onChangeText={dobInput} error={err.dob} maxLength={10} />
          <T v="smallM" style={{ marginBottom: 8 }}>
            Gender
          </T>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: err.gender ? 4 : 16 }}>
            {['Male', 'Female', 'Other'].map((g) => (
              <Chip key={g} label={g} selected={w.gender === g} onPress={() => update({ gender: g })} />
            ))}
          </View>
          {err.gender ? (
            <T v="caption" color={C.danger} style={{ marginBottom: 14 }}>
              {err.gender}
            </T>
          ) : null}
          <Select label="District" icon="map" value={w.district} options={[...DISTRICTS]} onChange={(district) => update({ district })} placeholder="Select district" />
          {err.district ? (
            <T v="caption" color={C.danger} style={{ marginTop: -10, marginBottom: 14 }}>
              {err.district}
            </T>
          ) : null}
          <Field label="Area / town" icon="location" placeholder="e.g. Kaloor" value={w.area} onChangeText={(area) => update({ area })} error={err.area} hint="Used to show you jobs within about 15 km." />
        </>
      )}

      {step === 2 && (
        <>
          <StepHead step={2} total={TOTAL} title="Skills and experience" text="Pick the kinds of work you can do. You can change this later." />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {SKILLS.map((s) => (
              <Chip key={s} label={s} selected={w.skills.includes(s)} onPress={() => toggleSkill(s)} />
            ))}
          </View>
          <T v="caption" color={err.skills ? C.danger : C.muted} style={{ marginTop: 8, marginBottom: 22 }}>
            {err.skills ?? `${w.skills.length} selected`}
          </T>
          <T v="smallM" style={{ marginBottom: 8 }}>
            Experience
          </T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 }}>
            {EXPERIENCE.map((x) => (
              <Chip key={x} label={x} selected={w.experience === x} onPress={() => update({ experience: x })} />
            ))}
          </View>
          {err.experience ? (
            <T v="caption" color={C.danger}>
              {err.experience}
            </T>
          ) : null}
          <View style={{ height: 18 }} />
          <Field label="About you (optional)" placeholder="e.g. College student, free on evenings and weekends" value={w.about} onChangeText={(about) => update({ about })} multiline maxLength={200} />
        </>
      )}

      {step === 3 && (
        <>
          <View style={{ height: 168, borderRadius: 28, backgroundColor: '#F4EEFF', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
            <Image source={IMG.shield} style={{ width: 160, height: 160 }} contentFit="contain" accessibilityLabel="Verification shield" />
          </View>
          <StepHead step={3} total={TOTAL} title="Verify it's you" text="Two quick photos. Only the Rozkaam team sees them, never a business." />
          <Select label="ID type" icon="card" value={w.idType} options={ID_TYPES} onChange={(idType) => update({ idType })} placeholder="Select ID type" />
          {err.idType ? (
            <T v="caption" color={C.danger} style={{ marginTop: -10, marginBottom: 14 }}>
              {err.idType}
            </T>
          ) : null}
          <Field label="ID number" icon="keypad" placeholder="Enter the number on the ID" value={w.idNumber} onChangeText={(idNumber) => update({ idNumber })} error={err.idNumber} autoCapitalize="characters" />
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <PhotoBox label="Photo of ID" hint="Front side, all corners visible" icon="card" uri={w.idPhoto} onPress={async () => update({ idPhoto: (await takePhoto()) ?? w.idPhoto })} />
              {err.idPhoto ? (
                <T v="caption" color={C.danger} style={{ marginTop: 5 }}>
                  {err.idPhoto}
                </T>
              ) : null}
            </View>
            <View style={{ flex: 1 }}>
              <PhotoBox label="Selfie" hint="Face clearly visible, no cap or mask" icon="happy" uri={w.selfie} onPress={async () => update({ selfie: (await takePhoto({ front: true })) ?? w.selfie })} />
              {err.selfie ? (
                <T v="caption" color={C.danger} style={{ marginTop: 5 }}>
                  {err.selfie}
                </T>
              ) : null}
            </View>
          </View>
          <Banner tone="info" icon="lock-closed" text="Businesses never see your ID number or documents." style={{ marginTop: 18 }} />
        </>
      )}

      {step === 4 && (
        <>
          <StepHead step={4} total={TOTAL} title="Where should we pay you?" text="Your earnings go to your Rozkaam wallet. Withdrawals are sent to this account." />
          <Field label="Account holder name" icon="person" placeholder="Name on the bank account" value={w.bankName} onChangeText={(bankName) => update({ bankName })} error={err.bankName} autoCapitalize="words" />
          <Field label="Account number" icon="business" placeholder="Bank account number" keyboardType="number-pad" value={w.accountNumber} onChangeText={(t) => update({ accountNumber: t.replace(/\D/g, '') })} error={err.accountNumber} maxLength={18} />
          <Field label="IFSC code" icon="git-branch" placeholder="e.g. FDRL0001234" value={w.ifsc} onChangeText={(t) => update({ ifsc: t.toUpperCase().replace(/[^A-Z0-9]/g, '') })} error={err.ifsc} autoCapitalize="characters" maxLength={11} />
          <Field label="UPI ID (optional)" icon="flash" placeholder="name@upi" value={w.upi} onChangeText={(upi) => update({ upi: upi.trim() })} autoCapitalize="none" hint="Add a UPI ID for faster withdrawals." />
          <Banner tone="violet" icon="shield-checkmark" text="The account must be in your own name. Payouts to someone else's account are not allowed." />
        </>
      )}
    </Screen>
  );
}
