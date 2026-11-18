import { router } from 'expo-router';
import { useState } from 'react';

import { BUSINESS_TYPES, DISTRICTS, useStore } from '@/store';
import { Banner, Btn, Field, Header, Screen, Select, T } from '@/ui';

export default function EditCompany() {
  const company = useStore((s) => s.company);
  const saveCompany = useStore((s) => s.saveCompany);
  const showToast = useStore((s) => s.showToast);

  const [f, setF] = useState({
    name: company.name,
    type: company.type,
    gstin: company.gstin,
    address: company.address,
    district: company.district,
    contactName: company.contactName,
    contactRole: company.contactRole,
    email: company.email,
  });
  const [errors, setErrors] = useState<Partial<Record<keyof typeof f, string>>>({});
  const up = (p: Partial<typeof f>) => {
    setF((x) => ({ ...x, ...p }));
    setErrors({});
  };

  const save = async () => {
    const e: typeof errors = {};
    if (f.name.trim().length < 2) e.name = 'Enter your company name.';
    if (!f.address.trim()) e.address = 'Enter your business address.';
    if (!f.contactName.trim()) e.contactName = 'Enter the contact person’s name.';
    if (f.email.trim() && !/^\S+@\S+\.\S+$/.test(f.email.trim())) e.email = 'Enter a valid email address.';
    if (f.gstin.trim() && f.gstin.trim().length !== 15) e.gstin = 'A GSTIN has 15 characters.';
    setErrors(e);
    if (Object.keys(e).length) return;
    if (!(await saveCompany({ ...f, name: f.name.trim(), gstin: f.gstin.trim().toUpperCase(), email: f.email.trim() }))) return;
    showToast('Company details saved');
    router.back();
  };

  return (
    <Screen header={<Header title="Edit company" />} footer={<Btn title="Save changes" onPress={save} />}>
      <T v="label" style={{ marginBottom: 10, marginTop: 6 }}>
        Company
      </T>
      <Field label="Company name" value={f.name} onChangeText={(name) => up({ name })} error={errors.name} icon="business-outline" />
      <Select label="Business type" value={f.type} options={[...BUSINESS_TYPES]} onChange={(type) => up({ type })} />
      <Field label="GSTIN (optional)" value={f.gstin} onChangeText={(gstin) => up({ gstin })} error={errors.gstin} autoCapitalize="characters" maxLength={15} />
      <Field label="Address" value={f.address} onChangeText={(address) => up({ address })} error={errors.address} multiline />
      <Select label="District" value={f.district} options={[...DISTRICTS]} onChange={(district) => up({ district })} icon="map-outline" />

      <T v="label" style={{ marginBottom: 10, marginTop: 6 }}>
        Contact person
      </T>
      <Field label="Name" value={f.contactName} onChangeText={(contactName) => up({ contactName })} error={errors.contactName} icon="person-outline" />
      <Field label="Role" placeholder="e.g. Operations manager" value={f.contactRole} onChangeText={(contactRole) => up({ contactRole })} />
      <Field label="Email" value={f.email} onChangeText={(email) => up({ email })} error={errors.email} keyboardType="email-address" autoCapitalize="none" icon="mail-outline" />

      <Banner tone="neutral" icon="information-circle" text="Changing your company name or GSTIN may need to be re-verified by Rozkaam before your next requirement goes live." />
    </Screen>
  );
}
