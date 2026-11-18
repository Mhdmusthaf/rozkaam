// Brand imagery (AI-generated for Rozkaam, stored in /brand/images).
// Demo people and venues are mapped to photos here so every screen that shows
// a name or a job automatically gets the matching image.
import type { Category } from '@/store/types';

export const IMG = {
  workerMan: require('@/assets/images/roz/worker-man.webp'),
  workerWoman: require('@/assets/images/roz/worker-woman.webp'),
  manager: require('@/assets/images/roz/manager.webp'),
  team: require('@/assets/images/roz/team.webp'),
  banquet: require('@/assets/images/roz/venue-banquet.webp'),
  catering: require('@/assets/images/roz/venue-catering.webp'),
  wallet: require('@/assets/images/roz/icon-wallet.webp'),
  pin: require('@/assets/images/roz/icon-pin.webp'),
  shield: require('@/assets/images/roz/icon-shield.webp'),
} as const;

const FACES: Record<string, number> = {
  'Arjun Menon': require('@/assets/images/roz/avatar-arjun.webp'),
  'Sneha Pillai': require('@/assets/images/roz/avatar-sneha.webp'),
  'Nisha Thomas': require('@/assets/images/roz/avatar-nisha.webp'),
  'Akhil Raj': require('@/assets/images/roz/avatar-akhil.webp'),
  'Meera Nair': require('@/assets/images/roz/avatar-meera.webp'),
  'Rahul Krishnan': require('@/assets/images/roz/avatar-rahul.webp'),
};

/** Profile photo for a demo person, if we have one. */
export const faceFor = (name: string): number | undefined => FACES[name];

/** Venue photo for a job. Only categories we have a fitting photo for get one. */
export const venuePhoto = (category: Category): number | undefined =>
  category === 'Events' ? IMG.banquet : category === 'Catering' ? IMG.catering : undefined;
