// Rozkaam design tokens. Brand: violet #6601F9 + cool grey #B1C2CC.
export const C = {
  violet: '#6601F9',
  violetDark: '#4A00C2',
  violetLight: '#8F45FF',
  violetSoft: '#EFE6FF',
  violetTint: '#F7F2FF',
  grey: '#B1C2CC',
  ink: '#0F0B1A',
  ink2: '#1E1832',
  ink3: '#2C2447',
  bg: '#F6F5FA',
  card: '#FFFFFF',
  text: '#14111F',
  muted: '#5A566B',
  faint: '#8E8AA3',
  line: '#E8E6F0',
  success: '#0E9F52',
  successSoft: '#E2F6EA',
  warn: '#B86200',
  warnSoft: '#FFF1D9',
  danger: '#D92D3F',
  dangerSoft: '#FDE7E9',
  info: '#2463EB',
  infoSoft: '#E6EEFF',
  white: '#FFFFFF',
} as const;

export const F = {
  regular: 'PlusJakartaSans_500Medium',
  medium: 'PlusJakartaSans_500Medium',
  semi: 'PlusJakartaSans_700Bold',
  bold: 'PlusJakartaSans_700Bold',
  extra: 'PlusJakartaSans_700Bold',
} as const;

export const R = { sm: 12, md: 16, lg: 24, xl: 32, pill: 999 } as const;

export const S = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 } as const;

export const shadow = { boxShadow: '0 16px 40px rgba(60, 20, 160, 0.08)' } as const;
export const shadowLg = { boxShadow: '0 24px 48px rgba(60, 20, 160, 0.20)' } as const;

export type Tone = 'violet' | 'success' | 'warn' | 'danger' | 'info' | 'neutral' | 'dark';

export const toneColors: Record<Tone, { bg: string; fg: string }> = {
  violet: { bg: C.violetSoft, fg: C.violet },
  success: { bg: C.successSoft, fg: C.success },
  warn: { bg: C.warnSoft, fg: C.warn },
  danger: { bg: C.dangerSoft, fg: C.danger },
  info: { bg: C.infoSoft, fg: C.info },
  neutral: { bg: '#EEEDF3', fg: C.muted },
  dark: { bg: C.ink, fg: C.white },
};
