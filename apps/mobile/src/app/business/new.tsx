import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Switch, View } from 'react-native';

import { dayISO, dayLong, hoursBetween, inr, parseDay, time12 } from '@/lib/format';
import { CATEGORIES, Category, EXPERIENCE, ReqDraft, reqCost, SKILLS, useStore } from '@/store';
import { Banner, Btn, C, Card, Chip, Divider, Field, Header, KV, R, Screen, Segment, Select, Stepper, T } from '@/ui';

const STEPS = ['Role', 'When & where', 'Team & pay', 'Requirements', 'Review'];

const SLOTS = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`);
const SLOT_LABELS = SLOTS.map(time12);
const toHM = (label: string) => SLOTS[SLOT_LABELS.indexOf(label)] ?? '09:00';

const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DATES = Array.from({ length: 10 }, (_, i) => dayISO(i));

type Errors = Partial<Record<string, string>>;

export default function NewRequirement() {
  const company = useStore((s) => s.company);
  const session = useStore((s) => s.session);
  const settings = useStore((s) => s.settings);
  const createRequirement = useStore((s) => s.createRequirement);
  const fund = useStore((s) => s.fund);
  const showToast = useStore((s) => s.showToast);

  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Errors>({});
  const [payText, setPayText] = useState('800');
  const [d, setD] = useState<ReqDraft>({
    title: '',
    category: 'Events',
    description: '',
    dateISO: dayISO(1),
    report: '09:30',
    start: '10:00',
    end: '18:00',
    pay: 800,
    needed: 10,
    venue: '',
    address: '',
    area: '',
    dress: '',
    gender: 'Any',
    skills: [],
    experience: 'New to this',
    instructions: '',
    pocName: company.contactName,
    pocPhone: session.phone ? `+91 ${session.phone}` : '',
    urgent: false,
  });
  const up = (p: Partial<ReqDraft>) => {
    setD((x) => ({ ...x, ...p }));
    setErrors({});
  };

  const pay = Number(payText) || 0;
  const cost = reqCost(pay, d.needed, settings.commissionRate, settings.commissionMode);
  const pct = Math.round(settings.commissionRate * 100);

  const validate = (s: number): Errors => {
    const e: Errors = {};
    if (s === 0) {
      if (d.title.trim().length < 4) e.title = 'Give the role a short title, like "Banquet service staff".';
      if (d.description.trim().length < 15) e.description = 'Describe the work in a sentence or two so workers know what to expect.';
    }
    if (s === 1) {
      if (!d.venue.trim()) e.venue = 'Enter the venue name.';
      if (!d.address.trim()) e.address = 'Enter the full address so workers can find it.';
      if (!d.area.trim()) e.area = 'Enter the area, like "Kakkanad".';
      if (d.report > d.start) e.report = 'Reporting time must be at or before the start time.';
    }
    if (s === 2) {
      if (pay < 300) e.pay = 'Pay per worker must be at least ₹300.';
      else if (pay > 5000) e.pay = 'Pay per worker cannot be more than ₹5,000.';
    }
    if (s === 3) {
      if (!d.dress.trim()) e.dress = 'Tell workers what to wear, or write "No dress code".';
      if (!d.pocName.trim()) e.pocName = 'Who should workers report to?';
      if (d.pocPhone.replace(/\D/g, '').length < 10) e.pocPhone = 'Enter a 10-digit phone number.';
    }
    return e;
  };

  const next = () => {
    const e = validate(step);
    setErrors(e);
    if (Object.keys(e).length === 0) setStep((s) => s + 1);
  };
  const back = () => (step === 0 ? router.back() : setStep((s) => s - 1));

  const draft = (): ReqDraft => ({ ...d, pay, title: d.title.trim(), description: d.description.trim(), venue: d.venue.trim(), address: d.address.trim(), area: d.area.trim() });

  const saveDraft = () => {
    createRequirement(draft());
    showToast('Saved as a draft');
    router.replace('/business/requirements');
  };
  const fundNow = () => {
    const id = createRequirement(draft());
    fund(id);
    router.replace(`/business/funded?id=${id}`);
  };

  const footer =
    step < 4 ? (
      <Btn title="Continue" iconRight="arrow-forward" onPress={next} />
    ) : (
      <>
        <Btn title={`Fund ${inr(cost.total)}`} icon="lock-closed" onPress={fundNow} />
        <Btn title="Save as draft" variant="outline" size="md" onPress={saveDraft} />
      </>
    );

  return (
    <Screen header={<Header title="New requirement" onBack={back} />} footer={footer}>
      {/* step indicator */}
      <View style={{ flexDirection: 'row', gap: 5, marginTop: 4 }}>
        {STEPS.map((s, i) => (
          <View key={s} style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: i <= step ? C.violet : C.line }} />
        ))}
      </View>
      <T v="label" color={C.violet} style={{ marginTop: 14 }}>
        Step {step + 1} of {STEPS.length}
      </T>
      <T v="h2" style={{ marginBottom: 18 }}>
        {['What role do you need?', 'When and where?', 'Team size and pay', 'What should workers know?', 'Review and fund'][step]}
      </T>

      {step === 0 ? (
        <>
          <Field label="Role title" placeholder="e.g. Banquet service staff" value={d.title} onChangeText={(title) => up({ title })} error={errors.title} maxLength={60} />
          <Select label="Category" value={d.category} options={[...CATEGORIES]} onChange={(c) => up({ category: c as Category })} icon="grid-outline" />
          <Field
            label="Description"
            placeholder="What will the workers do? Mention the event and the main tasks."
            value={d.description}
            onChangeText={(description) => up({ description })}
            error={errors.description}
            multiline
            maxLength={400}
          />
        </>
      ) : null}

      {step === 1 ? (
        <>
          <T v="smallM" style={{ marginBottom: 8 }}>
            Date
          </T>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20, marginBottom: 6 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
            {DATES.map((iso, i) => {
              const dt = parseDay(iso);
              const on = iso === d.dateISO;
              return (
                <Pressable
                  key={iso}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={dayLong(iso)}
                  onPress={() => up({ dateISO: iso })}
                  style={{ width: 62, paddingVertical: 10, borderRadius: R.md, alignItems: 'center', backgroundColor: on ? C.ink : C.card, borderWidth: 1, borderColor: on ? C.ink : C.line }}>
                  <T v="caption" color={on ? 'rgba(255,255,255,0.7)' : C.muted}>
                    {i === 0 ? 'Today' : DAY[dt.getDay()]}
                  </T>
                  <T v="h3" color={on ? C.white : C.text}>
                    {dt.getDate()}
                  </T>
                  <T v="caption" color={on ? 'rgba(255,255,255,0.7)' : C.muted}>
                    {MON[dt.getMonth()]}
                  </T>
                </Pressable>
              );
            })}
          </ScrollView>
          <T v="caption" color={C.muted} style={{ marginBottom: 16 }}>
            {dayLong(d.dateISO)}
          </T>

          <Select label="Reporting time" value={time12(d.report)} options={SLOT_LABELS} onChange={(v) => up({ report: toHM(v) })} icon="walk-outline" />
          {errors.report ? (
            <T v="caption" color={C.danger} style={{ marginTop: -10, marginBottom: 12 }}>
              {errors.report}
            </T>
          ) : null}
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Select label="Start" value={time12(d.start)} options={SLOT_LABELS} onChange={(v) => up({ start: toHM(v) })} />
            </View>
            <View style={{ flex: 1 }}>
              <Select label="End" value={time12(d.end)} options={SLOT_LABELS} onChange={(v) => up({ end: toHM(v) })} />
            </View>
          </View>
          <T v="caption" color={C.muted} style={{ marginTop: -8, marginBottom: 16 }}>
            Shift length: {hoursBetween(d.start, d.end)} hours
          </T>

          <Field label="Venue name" placeholder="e.g. Lotus Convention Centre" value={d.venue} onChangeText={(venue) => up({ venue })} error={errors.venue} icon="business-outline" />
          <Field label="Full address" placeholder="Building, street, landmark" value={d.address} onChangeText={(address) => up({ address })} error={errors.address} icon="location-outline" />
          <Field label="Area" placeholder="e.g. Kakkanad" value={d.area} onChangeText={(area) => up({ area })} error={errors.area} hint="Workers within about 15 km will see this requirement." />
        </>
      ) : null}

      {step === 2 ? (
        <>
          <Card style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <T v="bodyM">Workers needed</T>
                <T v="small" color={C.muted}>
                  How many people for this shift
                </T>
              </View>
              <Stepper value={d.needed} onChange={(needed) => up({ needed })} min={1} max={200} />
            </View>
          </Card>
          <Field
            label="Pay per worker"
            prefix="₹"
            keyboardType="number-pad"
            value={payText}
            onChangeText={(t) => {
              setPayText(t.replace(/\D/g, '').slice(0, 5));
              setErrors({});
            }}
            error={errors.pay}
            hint={settings.commissionMode === 'on_top' ? 'Each worker receives this full amount for the shift.' : `Each worker receives ${inr(cost.workerGets)} after the ${pct}% Rozkaam fee.`}
          />
          <Card style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <T v="bodyM">Mark as urgent</T>
                <T v="small" color={C.muted}>
                  Shows an "Urgent" tag so workers notice it first
                </T>
              </View>
              <Switch value={d.urgent} onValueChange={(urgent) => up({ urgent })} trackColor={{ true: C.violet, false: C.line }} thumbColor={C.white} accessibilityLabel="Mark as urgent" />
            </View>
          </Card>
          <Card style={{ backgroundColor: C.violetTint }}>
            <KV k={`${d.needed} workers × ${inr(pay)}`} v={inr(cost.subtotal)} />
            <KV k={`Rozkaam service fee (${pct}%)`} v={settings.commissionMode === 'on_top' ? inr(cost.fee) : 'Included'} />
            <Divider />
            <KV k="Estimated total" v={inr(cost.total)} bold />
          </Card>
        </>
      ) : null}

      {step === 3 ? (
        <>
          <Field label="Dress code" placeholder="e.g. Black formal shirt and trousers, black shoes" value={d.dress} onChangeText={(dress) => up({ dress })} error={errors.dress} icon="shirt-outline" />
          <T v="smallM" style={{ marginBottom: 6 }}>
            Gender requirement
          </T>
          <Segment
            value={d.gender}
            onChange={(gender) => up({ gender })}
            options={[
              { value: 'Any', label: 'Any' },
              { value: 'Male', label: 'Male' },
              { value: 'Female', label: 'Female' },
            ]}
          />
          <T v="caption" color={C.muted} style={{ marginTop: 6, marginBottom: 16 }}>
            Choose Male or Female only where genuinely necessary and lawful for the role.
          </T>

          <T v="smallM" style={{ marginBottom: 8 }}>
            Skills needed {d.skills.length ? `(${d.skills.length})` : '(optional)'}
          </T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
            {SKILLS.map((s) => {
              const on = d.skills.includes(s);
              return <Chip key={s} label={s} selected={on} onPress={() => up({ skills: on ? d.skills.filter((x) => x !== s) : [...d.skills, s] })} />;
            })}
          </View>

          <Select label="Minimum experience" value={d.experience} options={[...EXPERIENCE]} onChange={(experience) => up({ experience })} />
          <Field
            label="Instructions for workers (optional)"
            placeholder="Entry gate, what to carry, meals provided, parking…"
            value={d.instructions}
            onChangeText={(instructions) => up({ instructions })}
            multiline
            maxLength={400}
          />
          <Field label="Point of contact at the venue" placeholder="Name and role" value={d.pocName} onChangeText={(pocName) => up({ pocName })} error={errors.pocName} icon="person-outline" />
          <Field
            label="Contact phone"
            placeholder="+91 98XXX XXXXX"
            keyboardType="phone-pad"
            value={d.pocPhone}
            onChangeText={(pocPhone) => up({ pocPhone })}
            error={errors.pocPhone}
            icon="call-outline"
            hint="Shared only with workers Rozkaam has confirmed."
          />
        </>
      ) : null}

      {step === 4 ? (
        <>
          <Card>
            <T v="caption" color={C.violet}>
              {d.category.toUpperCase()}
              {d.urgent ? ' · URGENT' : ''}
            </T>
            <T v="h3">{d.title}</T>
            <T v="small" color={C.muted} style={{ marginTop: 4 }}>
              {d.description}
            </T>
            <Divider />
            <KV k="Date" v={dayLong(d.dateISO)} />
            <KV k="Reporting" v={time12(d.report)} />
            <KV k="Shift" v={`${time12(d.start)} – ${time12(d.end)}`} />
            <KV k="Venue" v={`${d.venue}, ${d.area}`} />
            <KV k="Dress code" v={d.dress} />
            <KV k="Gender" v={d.gender} />
            <KV k="Skills" v={d.skills.length ? d.skills.join(', ') : 'None specified'} />
            <KV k="Experience" v={d.experience} />
            <KV k="Contact" v={d.pocName} />
            <Pressable onPress={() => setStep(0)} hitSlop={8} style={{ alignSelf: 'flex-start', marginTop: 8 }}>
              <T v="smallM" color={C.violet}>
                Edit details
              </T>
            </Pressable>
          </Card>

          <Card style={{ marginTop: 14, backgroundColor: C.ink }}>
            <T v="label" color="rgba(255,255,255,0.6)">
              Cost
            </T>
            <View style={{ marginTop: 8 }}>
              <CostLine k={`Worker pay · ${d.needed} × ${inr(pay)}`} v={inr(cost.subtotal)} />
              <CostLine k={`Rozkaam service fee (${pct}%)`} v={settings.commissionMode === 'on_top' ? inr(cost.fee) : 'Included'} />
              <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.15)', marginVertical: 10 }} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <T v="bodyM" color={C.white}>
                  Total to fund
                </T>
                <T v="h1" color={C.white}>
                  {inr(cost.total)}
                </T>
              </View>
            </View>
          </Card>

          <Banner
            tone="violet"
            icon="shield-checkmark"
            title="How funding works"
            text="Your money is held until the work is done. Workers are paid after you approve attendance, and you get a refund for any slot that was not filled or worked."
            style={{ marginTop: 14 }}
          />
          <T v="caption" color={C.muted} center style={{ marginTop: 12 }}>
            Sandbox mode: funding is simulated and no real money moves.
          </T>
        </>
      ) : null}
    </Screen>
  );
}

function CostLine({ k, v }: { k: string; v: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, gap: 12 }}>
      <T v="body" color="rgba(255,255,255,0.75)" style={{ flexShrink: 1 }}>
        {k}
      </T>
      <T v="bodyM" color={C.white}>
        {v}
      </T>
    </View>
  );
}
