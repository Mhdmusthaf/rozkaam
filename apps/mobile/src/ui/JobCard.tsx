import { Image } from 'expo-image';
import { Text, View } from 'react-native';

import { dayLabel, hoursBetween, inr, time12 } from '@/lib/format';
import { Application, appMeta, Category, Job, workerPay } from '@/store';
import { C, Card, F, IconName, IconTile, Pill, T, venuePhoto } from './index';

export const categoryIcon: Record<Category, IconName> = {
  Events: 'sparkles',
  Catering: 'restaurant',
  Hospitality: 'bed',
  'Film & Production': 'videocam',
  Retail: 'cart',
  Promotions: 'megaphone',
  Logistics: 'cube',
  'Call centre': 'headset',
};

const slotsLabel = (job: Job) => {
  const left = Math.max(0, job.needed - job.confirmed);
  return left === 0 ? 'Full · waitlist' : `${left} ${left === 1 ? 'slot' : 'slots'} left`;
};

/** Square venue photo, or a soft violet tile with the category icon. */
export function JobThumb({ job, size = 72 }: { job: Job; size?: number }) {
  const photo = venuePhoto(job.category);
  return photo ? (
    <Image source={photo} style={{ width: size, height: size, borderRadius: size * 0.25 }} contentFit="cover" accessibilityLabel={`${job.category} venue`} />
  ) : (
    <IconTile icon={categoryIcon[job.category]} size={size} />
  );
}

/** A job as the worker sees it: in the feed, and in My Gigs (with `app`). */
export function JobCard({ job, app, onPress }: { job: Job; app?: Application; onPress: () => void }) {
  const meta = app ? appMeta[app.status] : null;
  return (
    <Card onPress={onPress} style={{ marginBottom: 12 }} pad={8}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <JobThumb job={job} />
        <View style={{ flex: 1, gap: 2 }}>
          <T v="bodyM" numberOfLines={1}>
            {job.title}
          </T>
          <T v="caption" color={C.muted} numberOfLines={1}>
            {dayLabel(job.dateISO)} · {time12(job.start)} · {job.area}
          </T>
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
            {meta ? <Pill label={meta.label} tone={meta.tone} /> : <Pill label={slotsLabel(job)} tone={job.needed - job.confirmed <= 0 ? 'neutral' : 'success'} />}
            {!meta && job.urgent ? <Pill label="Urgent" tone="danger" icon="flash" /> : null}
          </View>
        </View>
        <View style={{ alignItems: 'flex-end', paddingRight: 8 }}>
          <Text style={{ fontFamily: F.bold, fontSize: 19, color: C.violet }}>{inr(workerPay(job))}</Text>
          <T v="caption" color={C.muted}>
            {hoursBetween(job.start, job.end)} h
          </T>
        </View>
      </View>
    </Card>
  );
}

/** Large feed card with the venue photo on top, for the first job in the list. */
export function FeaturedJob({ job, onPress }: { job: Job; onPress: () => void }) {
  const photo = venuePhoto(job.category);
  if (!photo) return <JobCard job={job} onPress={onPress} />;
  return (
    <Card onPress={onPress} style={{ marginBottom: 12 }} pad={8}>
      <View style={{ height: 136, borderRadius: 18, overflow: 'hidden' }}>
        <Image source={photo} style={{ width: '100%', height: 136 }} contentFit="cover" accessibilityLabel={`${job.venue}`} />
        <View style={{ position: 'absolute', left: 8, top: 8, backgroundColor: C.white, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }}>
          <Text style={{ fontFamily: F.bold, fontSize: 12, color: C.text }}>
            {dayLabel(job.dateISO)} · {time12(job.start)}
          </Text>
        </View>
        <View style={{ position: 'absolute', right: 8, top: 8, backgroundColor: C.ink, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }}>
          <Text style={{ fontFamily: F.bold, fontSize: 12, color: C.white }}>{slotsLabel(job)}</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 8, paddingTop: 12, paddingBottom: 8 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <T v="bodyM" numberOfLines={1}>
            {job.title}
          </T>
          <T v="caption" color={C.muted} numberOfLines={1}>
            {job.business} · {job.distanceKm} km
          </T>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ fontFamily: F.bold, fontSize: 20, color: C.violet }}>{inr(workerPay(job))}</Text>
          <T v="caption" color={C.muted}>
            {hoursBetween(job.start, job.end)} h shift
          </T>
        </View>
      </View>
    </Card>
  );
}
