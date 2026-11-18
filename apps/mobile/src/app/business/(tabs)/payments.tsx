import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { ago, inr } from '@/lib/format';
import { BizTxn, jobCost, useStore } from '@/store';
import { Banner, Btn, C, Card, Divider, Empty, KV, Pill, R, Row, Screen, Section, Sheet, T } from '@/ui';

export default function Payments() {
  const txns = useStore((s) => s.bizTxns);
  const jobs = useStore((s) => s.jobs);
  const showToast = useStore((s) => s.showToast);
  const [open, setOpen] = useState<BizTxn | null>(null);

  const funded = txns.filter((t) => t.kind === 'funding').reduce((s, t) => s + t.amount, 0);
  const refunded = txns.filter((t) => t.kind === 'refund').reduce((s, t) => s + t.amount, 0);

  const job = open?.jobId ? jobs.find((j) => j.id === open.jobId) : undefined;
  const cost = job ? jobCost(job) : null;

  return (
    <Screen>
      <T v="h1" style={{ marginTop: 10, marginBottom: 16 }}>
        Payments
      </T>

      <View style={{ backgroundColor: C.ink, borderRadius: R.xl, padding: 20 }}>
        <T v="label" color="rgba(255,255,255,0.6)">
          Net spend
        </T>
        <T v="display" color={C.white} style={{ marginTop: 4 }}>
          {inr(funded - refunded)}
        </T>
        <T v="small" color="rgba(255,255,255,0.6)">
          Funded minus refunds, across all requirements
        </T>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
          <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: R.md, padding: 12 }}>
            <T v="caption" color="rgba(255,255,255,0.6)">
              Funded
            </T>
            <T v="h3" color={C.white}>
              {inr(funded)}
            </T>
          </View>
          <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: R.md, padding: 12 }}>
            <T v="caption" color="rgba(255,255,255,0.6)">
              Refunded
            </T>
            <T v="h3" color={C.white}>
              {inr(refunded)}
            </T>
          </View>
        </View>
      </View>

      <Banner
        tone="violet"
        icon="information-circle"
        text="You fund a requirement before it goes live. Workers are paid only after you approve attendance, and unused slots are refunded."
        style={{ marginTop: 16 }}
      />

      <Section title="Transactions">
        {txns.length ? (
          <Card pad={6} style={{ paddingHorizontal: 14 }}>
            {txns.map((t, i) => (
              <View key={t.id} style={i ? { borderTopWidth: 1, borderTopColor: C.line } : null}>
                <Row
                  icon={t.kind === 'funding' ? 'arrow-up' : 'arrow-down'}
                  tone={t.kind === 'funding' ? 'violet' : 'success'}
                  title={t.title}
                  sub={`${t.invoice ? t.invoice + ' · ' : ''}${ago(t.at)}`}
                  onPress={() => setOpen(t)}
                  right={
                    <T v="bodyM" color={t.kind === 'funding' ? C.text : C.success}>
                      {t.kind === 'funding' ? '−' : '+'}
                      {inr(t.amount)}
                    </T>
                  }
                />
              </View>
            ))}
          </Card>
        ) : (
          <Empty icon="card-outline" title="No payments yet" text="Funding and refunds for your requirements will appear here." />
        )}
      </Section>

      <Sheet open={!!open} onClose={() => setOpen(null)} title={open?.kind === 'refund' ? 'Refund' : 'Invoice'}>
        {open ? (
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <T v="bodyM" style={{ flex: 1 }} numberOfLines={2}>
                {open.title}
              </T>
              <Pill label={open.kind === 'refund' ? 'Refunded' : 'Paid'} tone="success" />
            </View>
            <T v="small" color={C.muted}>
              {open.invoice ? `${open.invoice} · ` : ''}
              {new Date(open.at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </T>
            <Divider />
            {open.kind === 'funding' && job && cost ? (
              <>
                <KV k={`${job.needed} workers × ${inr(job.pay)}`} v={inr(cost.subtotal)} />
                <KV
                  k={`Rozkaam service fee (${Math.round(job.commissionRate * 100)}%)`}
                  v={job.commissionMode === 'on_top' ? inr(cost.fee) : 'Included'}
                />
                <Divider />
                <KV k="Total funded" v={inr(open.amount)} bold />
              </>
            ) : (
              <>
                <KV k="Reason" v={open.sub} />
                <Divider />
                <KV k="Amount refunded" v={inr(open.amount)} bold color={C.success} />
              </>
            )}
            <T v="caption" color={C.muted} style={{ marginTop: 8 }}>
              Sandbox payment. No real money moved.
            </T>
            <View style={{ gap: 10, marginTop: 16 }}>
              {open.kind === 'funding' ? (
                <Btn title="Download invoice" icon="download-outline" onPress={() => showToast('Invoice downloads arrive with the backend', 'info')} />
              ) : null}
              {open.jobId ? (
                <Btn
                  title="View requirement"
                  variant="outline"
                  onPress={() => {
                    const id = open.jobId;
                    setOpen(null);
                    router.push(`/business/requirement/${id}`);
                  }}
                />
              ) : null}
            </View>
          </View>
        ) : null}
      </Sheet>
    </Screen>
  );
}
