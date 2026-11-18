import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { takePhoto } from '@/lib/device';
import { BUSINESS_TYPES, DISTRICTS, useStore } from '@/store';
import { Banner, Btn, C, Field, Header, PhotoBox, Screen, Select, T } from '@/ui';
import { StepHead } from '@/ui/StepHead';

const TOTAL = 3;

export default function BusinessOnboarding() {
  const c = useStore((s) => s.company);
  const update = useStore((s) => s.updateCompany);
  const submit = useStore((s) => s.submitBusinessKyc);
  const [step, setStep] = useState(1);
  const [err, setErr] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (step === 1) {
      if (c.name.trim().length < 3) e.name = 'Enter your registered business name.';
      if (!c.type) e.type = 'Select a business type.';
      if (c.address.trim().length < 8) e.address = 'Enter the full business address.';
      if (!c.district) e.district = 'Select a district.';
    }
    if (step === 2) {
      if (c.contactName.trim().length < 3) e.contactName = 'Enter the contact person’s name.';
      if (!/^\S+@\S+\.\S+$/.test(c.email)) e.email = 'Enter a valid email address.';
    }
    if (step === 3) {
      if (c.gstin && !/^[0-9A-Z]{15}$/.test(c.gstin)) e.gstin = 'A GSTIN has 15 letters and digits.';
      if (!c.docRegistration) e.docRegistration = 'Add a registration document.';
      if (!c.docId) e.docId = 'Add the owner or signatory’s ID.';
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
  const sub = (k: string) =>
    err[k] ? (
      <T v="caption" color={C.danger} style={{ marginTop: -10, marginBottom: 14 }}>
        {err[k]}
      </T>
    ) : null;

  return (
    <Screen header={<Header onBack={back} />} footer={<Btn title={step === TOTAL ? 'Submit for verification' : 'Continue'} loading={busy} onPress={next} iconRight={step === TOTAL ? undefined : 'arrow-forward'} />}>
      {step === 1 && (
        <>
          <StepHead step={1} total={TOTAL} title="Your business" text="Workers see your business name and rating on every job you post." />
          <Field label="Business name" icon="business" placeholder="Registered or trading name" value={c.name} onChangeText={(name) => update({ name })} error={err.name} autoCapitalize="words" />
          <Select label="Business type" icon="pricetag" value={c.type} options={[...BUSINESS_TYPES]} onChange={(type) => update({ type })} placeholder="Select type" />
          {sub('type')}
          <Field label="Business address" icon="location" placeholder="Building, street, city, PIN" value={c.address} onChangeText={(address) => update({ address })} error={err.address} multiline />
          <Select label="District" icon="map" value={c.district} options={[...DISTRICTS]} onChange={(district) => update({ district })} placeholder="Select district" />
          {sub('district')}
        </>
      )}

      {step === 2 && (
        <>
          <StepHead step={2} total={TOTAL} title="Main contact" text="The person Rozkaam's team and confirmed workers can reach." />
          <Field label="Contact person" icon="person" placeholder="Full name" value={c.contactName} onChangeText={(contactName) => update({ contactName })} error={err.contactName} autoCapitalize="words" />
          <Field label="Role (optional)" icon="briefcase" placeholder="e.g. Operations manager" value={c.contactRole} onChangeText={(contactRole) => update({ contactRole })} />
          <Field label="Work email" icon="mail" placeholder="name@company.com" value={c.email} onChangeText={(email) => update({ email: email.trim() })} error={err.email} keyboardType="email-address" autoCapitalize="none" hint="Invoices and confirmations are sent here." />
        </>
      )}

      {step === 3 && (
        <>
          <StepHead step={3} total={TOTAL} title="Verify your business" text="Every business on Rozkaam is verified before it can post work." />
          <Field label="GSTIN (optional)" icon="document-text" placeholder="15-character GSTIN" value={c.gstin} onChangeText={(t) => update({ gstin: t.toUpperCase().replace(/[^A-Z0-9]/g, '') })} error={err.gstin} autoCapitalize="characters" maxLength={15} />
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <PhotoBox label="Registration proof" hint="GST certificate, licence or Udyam" icon="document-attach" uri={c.docRegistration} onPress={async () => update({ docRegistration: (await takePhoto()) ?? c.docRegistration })} />
              {err.docRegistration ? (
                <T v="caption" color={C.danger} style={{ marginTop: 5 }}>
                  {err.docRegistration}
                </T>
              ) : null}
            </View>
            <View style={{ flex: 1 }}>
              <PhotoBox label="Signatory ID" hint="Owner or authorised person" icon="card" uri={c.docId} onPress={async () => update({ docId: (await takePhoto()) ?? c.docId })} />
              {err.docId ? (
                <T v="caption" color={C.danger} style={{ marginTop: 5 }}>
                  {err.docId}
                </T>
              ) : null}
            </View>
          </View>
          <Banner tone="info" icon="lock-closed" text="Documents are only seen by the Rozkaam verification team." style={{ marginTop: 18 }} />
        </>
      )}
    </Screen>
  );
}
