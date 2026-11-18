// Rozkaam component library. Every screen is built from these pieces.
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ReactNode, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { initials } from '@/lib/format';
import { faceFor } from './images';
import { C, F, R, S, shadow, Tone, toneColors } from './theme';

export * from './theme';
export { Logo, Logomark, Wordmark } from './Logo';
export { IMG, faceFor, venuePhoto } from './images';
export type IconName = keyof typeof Ionicons.glyphMap;
export { Ionicons };

// ---------------------------------------------------------------- Text
type TV = 'display' | 'h1' | 'h2' | 'h3' | 'title' | 'body' | 'bodyM' | 'small' | 'smallM' | 'caption' | 'label';
const textStyles: Record<TV, TextStyle> = {
  display: { fontFamily: F.extra, fontSize: 40, lineHeight: 46, letterSpacing: -1.2 },
  h1: { fontFamily: F.extra, fontSize: 32, lineHeight: 40, letterSpacing: -0.8 },
  h2: { fontFamily: F.bold, fontSize: 20, lineHeight: 26, letterSpacing: -0.2 },
  h3: { fontFamily: F.bold, fontSize: 18, lineHeight: 24 },
  title: { fontFamily: F.semi, fontSize: 16, lineHeight: 22 },
  body: { fontFamily: F.regular, fontSize: 15, lineHeight: 22 },
  bodyM: { fontFamily: F.semi, fontSize: 15, lineHeight: 22 },
  small: { fontFamily: F.regular, fontSize: 12.5, lineHeight: 18 },
  smallM: { fontFamily: F.semi, fontSize: 12.5, lineHeight: 18 },
  caption: { fontFamily: F.medium, fontSize: 12, lineHeight: 16 },
  label: { fontFamily: F.bold, fontSize: 11.5, lineHeight: 15, letterSpacing: 0.7, textTransform: 'uppercase' },
};

export function T({
  v = 'body',
  color = C.text,
  center,
  style,
  children,
  numberOfLines,
  onPress,
}: {
  v?: TV;
  color?: string;
  center?: boolean;
  style?: StyleProp<TextStyle>;
  children: ReactNode;
  numberOfLines?: number;
  onPress?: () => void;
}) {
  return (
    <Text numberOfLines={numberOfLines} onPress={onPress} style={[textStyles[v], { color }, center && { textAlign: 'center' }, style]}>
      {children}
    </Text>
  );
}

// ---------------------------------------------------------------- Layout
export function Screen({
  children,
  scroll = true,
  padded = true,
  bg = C.bg,
  footer,
  header,
  topInset = true,
  contentStyle,
}: {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  bg?: string;
  footer?: ReactNode;
  header?: ReactNode;
  topInset?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const insets = useSafeAreaInsets();
  const pad = padded ? S.xl : 0;
  const body = scroll ? (
    <ScrollView
      style={{ flex: 1 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[{ paddingHorizontal: pad, paddingBottom: footer ? 24 : 24 + insets.bottom, paddingTop: 4 }, contentStyle]}>
      {children}
    </ScrollView>
  ) : (
    <View style={[{ flex: 1, paddingHorizontal: pad }, contentStyle]}>{children}</View>
  );
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ flex: 1, paddingTop: topInset && !header ? insets.top : 0 }}>
        {header}
        {body}
        {footer ? (
          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>{footer}</View>
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}

/** Plain top bar for inner screens: back arrow, centred title, optional right slot. */
export function Header({
  title,
  right,
  onBack,
  dark,
  back = true,
}: {
  title?: string;
  right?: ReactNode;
  onBack?: () => void;
  dark?: boolean;
  back?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const fg = dark ? C.white : C.text;
  return (
    <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: dark ? C.ink : 'transparent' }]}>
      <View style={{ width: 44 }}>
        {back ? (
          <IconBtn
            icon="chevron-back"
            onPress={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')))}
            tone={dark ? 'ghostDark' : 'plain'}
            label="Back"
          />
        ) : null}
      </View>
      <T v="title" color={fg} center style={{ flex: 1 }} numberOfLines={1}>
        {title ?? ''}
      </T>
      <View style={{ minWidth: 44, alignItems: 'flex-end' }}>{right}</View>
    </View>
  );
}

/** Dark rounded block at the top of home screens (from the reference designs). */
export function DarkTop({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const insets = useSafeAreaInsets();
  return <View style={[styles.darkTop, { paddingTop: insets.top + 14 }, style]}>{children}</View>;
}

export function Section({
  title,
  action,
  onAction,
  children,
  style,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{ marginTop: S.xxl }, style]}>
      <View style={styles.sectionHead}>
        <T v="h3">{title}</T>
        {action ? (
          <Pressable onPress={onAction} hitSlop={10}>
            <T v="smallM" color={C.violet}>
              {action}
            </T>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

export function Card({
  children,
  style,
  onPress,
  pad = S.lg,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  pad?: number;
}) {
  const base = [styles.card, { padding: pad }, style];
  if (onPress)
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [base, pressed && { opacity: 0.85, transform: [{ scale: 0.995 }] }]}>
        {children}
      </Pressable>
    );
  return <View style={base}>{children}</View>;
}

export const Divider = ({ style }: { style?: StyleProp<ViewStyle> }) => (
  <View style={[{ height: 1, backgroundColor: C.line, marginVertical: S.md }, style]} />
);

export const Gap = ({ h = S.md }: { h?: number }) => <View style={{ height: h }} />;

// ---------------------------------------------------------------- Buttons
type BtnVariant = 'primary' | 'dark' | 'outline' | 'ghost' | 'danger' | 'soft' | 'white';
export function Btn({
  title,
  onPress,
  variant = 'primary',
  icon,
  iconRight,
  loading,
  disabled,
  size = 'lg',
  style,
}: {
  title: string;
  onPress?: () => void;
  variant?: BtnVariant;
  icon?: IconName;
  iconRight?: IconName;
  loading?: boolean;
  disabled?: boolean;
  size?: 'lg' | 'md' | 'sm';
  style?: StyleProp<ViewStyle>;
}) {
  const palette: Record<BtnVariant, { bg: string; fg: string; border?: string }> = {
    primary: { bg: C.violet, fg: C.white },
    dark: { bg: C.ink, fg: C.white },
    outline: { bg: 'transparent', fg: C.text, border: C.line },
    ghost: { bg: 'transparent', fg: C.violet },
    danger: { bg: C.dangerSoft, fg: C.danger },
    soft: { bg: C.violetSoft, fg: C.violet },
    white: { bg: C.white, fg: C.ink },
  };
  const p = palette[variant];
  const off = disabled || loading;
  // Large primary and dark buttons are the page-2 action bar: dark, label on the
  // left, a white chip with an arrow (or the given icon) on the right.
  if (size === 'lg' && (variant === 'primary' || variant === 'dark')) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        disabled={off}
        onPress={onPress}
        style={({ pressed }) => [
          { height: 62, borderRadius: 22, backgroundColor: C.ink, paddingLeft: 22, paddingRight: 8, flexDirection: 'row', alignItems: 'center', gap: 10, opacity: off ? 0.4 : pressed ? 0.88 : 1 },
          style,
        ]}>
        <Text numberOfLines={1} style={{ flex: 1, fontFamily: F.bold, fontSize: 15.5, color: C.white }}>
          {title}
        </Text>
        <View style={{ width: 46, height: 46, borderRadius: 16, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center' }}>
          {loading ? <ActivityIndicator color={C.ink} /> : <Ionicons name={icon ?? iconRight ?? 'arrow-forward'} size={20} color={C.ink} />}
        </View>
      </Pressable>
    );
  }
  const h = size === 'lg' ? 56 : size === 'md' ? 46 : 36;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={off}
      onPress={onPress}
      style={({ pressed }) => [
        {
          height: h,
          borderRadius: size === 'sm' ? R.pill : 20,
          backgroundColor: p.bg,
          borderWidth: p.border ? 1.5 : 0,
          borderColor: p.border,
          paddingHorizontal: size === 'sm' ? 14 : 20,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          opacity: off ? 0.45 : pressed ? 0.85 : 1,
        },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={p.fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={size === 'sm' ? 15 : 19} color={p.fg} /> : null}
          <Text style={{ fontFamily: F.bold, fontSize: size === 'lg' ? 15.5 : size === 'md' ? 14.5 : 13, color: p.fg }}>{title}</Text>
          {iconRight ? <Ionicons name={iconRight} size={size === 'sm' ? 15 : 19} color={p.fg} /> : null}
        </>
      )}
    </Pressable>
  );
}

export function IconBtn({
  icon,
  onPress,
  tone = 'plain',
  size = 44,
  badge,
  label,
}: {
  icon: IconName;
  onPress?: () => void;
  tone?: 'plain' | 'card' | 'ghostDark' | 'violet' | 'soft';
  size?: number;
  badge?: boolean;
  label?: string;
}) {
  const map = {
    plain: { bg: 'transparent', fg: C.text },
    card: { bg: C.card, fg: C.text },
    ghostDark: { bg: 'rgba(255,255,255,0.12)', fg: C.white },
    violet: { bg: C.violet, fg: C.white },
    soft: { bg: C.violetSoft, fg: C.violet },
  }[tone];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label ?? icon}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [
        { width: size, height: size, borderRadius: size / 2, backgroundColor: map.bg, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 },
        tone === 'card' && shadow,
      ]}>
      <Ionicons name={icon} size={size * 0.48} color={map.fg} />
      {badge ? <View style={styles.badgeDot} /> : null}
    </Pressable>
  );
}

// ---------------------------------------------------------------- Small pieces
export function Pill({ label, tone = 'violet', icon, style }: { label: string; tone?: Tone; icon?: IconName; style?: StyleProp<ViewStyle> }) {
  const t = toneColors[tone];
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: t.bg, borderRadius: R.pill, paddingHorizontal: 10, paddingVertical: 5 }, style]}>
      {icon ? <Ionicons name={icon} size={12} color={t.fg} /> : null}
      <Text style={{ fontFamily: F.bold, fontSize: 11.5, color: t.fg }}>{label}</Text>
    </View>
  );
}

export function Chip({ label, selected, onPress, icon }: { label: string; selected?: boolean; onPress?: () => void; icon?: IconName }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 14,
        height: 38,
        borderRadius: R.pill,
        backgroundColor: selected ? C.ink : C.card,
        borderWidth: 1,
        borderColor: selected ? C.ink : C.line,
      }}>
      {icon ? <Ionicons name={icon} size={15} color={selected ? C.white : C.muted} /> : null}
      <Text style={{ fontFamily: F.semi, fontSize: 13, color: selected ? C.white : C.text }}>{label}</Text>
    </Pressable>
  );
}

export function Avatar({ name, size = 44, uri, tone = 'violet' }: { name: string; size?: number; uri?: string | null; tone?: 'violet' | 'dark' | 'grey' }) {
  const bg = tone === 'dark' ? C.ink3 : tone === 'grey' ? '#E3E9EE' : C.violetSoft;
  const fg = tone === 'dark' ? C.white : tone === 'grey' ? '#51606B' : C.violet;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      {uri || faceFor(name) ? (
        <Image source={uri ? { uri } : faceFor(name)} style={{ width: size, height: size }} contentFit="cover" />
      ) : (
        <Text style={{ fontFamily: F.bold, fontSize: size * 0.36, color: fg }}>{initials(name || '?')}</Text>
      )}
    </View>
  );
}

/** Square rounded icon tile used in list rows and quick actions. */
export function IconTile({ icon, tone = 'violet', size = 44 }: { icon: IconName; tone?: Tone; size?: number }) {
  const t = toneColors[tone];
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.32, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={icon} size={size * 0.46} color={t.fg} />
    </View>
  );
}

export function Row({
  icon,
  tone = 'violet',
  title,
  sub,
  right,
  onPress,
  chevron,
  left,
}: {
  icon?: IconName;
  tone?: Tone;
  title: string;
  sub?: string;
  right?: ReactNode;
  onPress?: () => void;
  chevron?: boolean;
  left?: ReactNode;
}) {
  const inner = (
    <>
      {left ?? (icon ? <IconTile icon={icon} tone={tone} size={42} /> : null)}
      <View style={{ flex: 1 }}>
        <T v="bodyM" numberOfLines={1}>
          {title}
        </T>
        {sub ? (
          <T v="small" color={C.muted} numberOfLines={2}>
            {sub}
          </T>
        ) : null}
      </View>
      {right}
      {chevron ? <Ionicons name="chevron-forward" size={18} color={C.faint} /> : null}
    </>
  );
  const st = { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12, paddingVertical: 10 };
  return onPress ? (
    <Pressable onPress={onPress} style={({ pressed }) => [st, pressed && { opacity: 0.6 }]}>
      {inner}
    </Pressable>
  ) : (
    <View style={st}>{inner}</View>
  );
}

export function InfoLine({ icon, text, color = C.muted }: { icon: IconName; text: string; color?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Ionicons name={icon} size={14} color={color} />
      <T v="small" color={color} numberOfLines={1} style={{ flexShrink: 1 }}>
        {text}
      </T>
    </View>
  );
}

export function Banner({ tone = 'info', icon, title, text, style }: { tone?: Tone; icon?: IconName; title?: string; text: string; style?: StyleProp<ViewStyle> }) {
  const t = toneColors[tone];
  return (
    <View style={[{ flexDirection: 'row', gap: 10, backgroundColor: t.bg, borderRadius: R.md, padding: 14 }, style]}>
      {icon ? <Ionicons name={icon} size={18} color={t.fg} style={{ marginTop: 1 }} /> : null}
      <View style={{ flex: 1 }}>
        {title ? (
          <T v="smallM" color={t.fg}>
            {title}
          </T>
        ) : null}
        <T v="small" color={tone === 'dark' ? C.white : C.text}>
          {text}
        </T>
      </View>
    </View>
  );
}

export function Stat({ value, label, dark }: { value: string; label: string; dark?: boolean }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ fontFamily: F.extra, fontSize: 20, color: dark ? C.white : C.text }}>{value}</Text>
      <T v="caption" color={dark ? 'rgba(255,255,255,0.6)' : C.muted}>
        {label}
      </T>
    </View>
  );
}

export function Empty({ icon, title, text, action, onAction }: { icon: IconName; title: string; text?: string; action?: string; onAction?: () => void }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 44, paddingHorizontal: 24, gap: 8 }}>
      <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: C.violetSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
        <Ionicons name={icon} size={30} color={C.violet} />
      </View>
      <T v="h3" center>
        {title}
      </T>
      {text ? (
        <T v="small" color={C.muted} center>
          {text}
        </T>
      ) : null}
      {action ? <Btn title={action} onPress={onAction} size="md" style={{ marginTop: 10 }} /> : null}
    </View>
  );
}

// ---------------------------------------------------------------- Inputs
export function Field({
  label,
  hint,
  error,
  prefix,
  icon,
  style,
  ...rest
}: TextInputProps & { label?: string; hint?: string; error?: string; prefix?: string; icon?: IconName }) {
  const [focus, setFocus] = useState(false);
  return (
    <View style={{ marginBottom: S.lg }}>
      {label ? (
        <T v="smallM" style={{ marginBottom: 6 }}>
          {label}
        </T>
      ) : null}
      <View
        style={{
          flexDirection: 'row',
          alignItems: rest.multiline ? 'flex-start' : 'center',
          gap: 8,
          backgroundColor: C.card,
          borderRadius: R.md,
          borderWidth: 1.5,
          borderColor: error ? C.danger : focus ? C.violet : C.line,
          paddingHorizontal: 14,
          minHeight: 52,
        }}>
        {icon ? <Ionicons name={icon} size={18} color={C.faint} style={rest.multiline ? { marginTop: 16 } : undefined} /> : null}
        {prefix ? <Text style={{ fontFamily: F.semi, fontSize: 15, color: C.text }}>{prefix}</Text> : null}
        <TextInput
          placeholderTextColor={C.faint}
          accessibilityLabel={label}
          {...rest}
          onFocus={(e) => {
            setFocus(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocus(false);
            rest.onBlur?.(e);
          }}
          style={[
            { flex: 1, fontFamily: F.medium, fontSize: 15, color: C.text, paddingVertical: rest.multiline ? 14 : 0, minHeight: rest.multiline ? 96 : 48, textAlignVertical: rest.multiline ? 'top' : 'center' },
            Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null,
            style,
          ]}
        />
      </View>
      {error ? (
        <T v="caption" color={C.danger} style={{ marginTop: 5 }}>
          {error}
        </T>
      ) : hint ? (
        <T v="caption" color={C.muted} style={{ marginTop: 5 }}>
          {hint}
        </T>
      ) : null}
    </View>
  );
}

/** Tappable field that opens a list of options in a bottom sheet. */
export function Select({
  label,
  value,
  options,
  onChange,
  placeholder = 'Select',
  icon,
}: {
  label?: string;
  value?: string;
  options: string[];
  onChange: (v: string) => void;
  placeholder?: string;
  icon?: IconName;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ marginBottom: S.lg }}>
      {label ? (
        <T v="smallM" style={{ marginBottom: 6 }}>
          {label}
        </T>
      ) : null}
      <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={() => setOpen(true)} style={styles.select}>
        {icon ? <Ionicons name={icon} size={18} color={C.faint} /> : null}
        <Text style={{ flex: 1, fontFamily: F.medium, fontSize: 15, color: value ? C.text : C.faint }}>{value || placeholder}</Text>
        <Ionicons name="chevron-down" size={18} color={C.faint} />
      </Pressable>
      <Sheet open={open} onClose={() => setOpen(false)} title={label ?? placeholder}>
        <ScrollView style={{ maxHeight: 380 }}>
          {options.map((o) => (
            <Pressable
              key={o}
              onPress={() => {
                onChange(o);
                setOpen(false);
              }}
              style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.line }}>
              <T v={o === value ? 'bodyM' : 'body'} color={o === value ? C.violet : C.text} style={{ flex: 1 }}>
                {o}
              </T>
              {o === value ? <Ionicons name="checkmark-circle" size={20} color={C.violet} /> : null}
            </Pressable>
          ))}
        </ScrollView>
      </Sheet>
    </View>
  );
}

export function Segment<V extends string>({ value, options, onChange, style }: { value: V; options: { value: V; label: string; count?: number }[]; onChange: (v: V) => void; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.segment, style]}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.value)}
            style={[{ flex: 1, height: 38, borderRadius: R.pill, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }, on && { backgroundColor: C.ink }]}>
            <Text style={{ fontFamily: F.semi, fontSize: 13, color: on ? C.white : C.muted }}>{o.label}</Text>
            {o.count ? (
              <View style={{ minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, backgroundColor: on ? C.violet : C.line, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: F.bold, fontSize: 10.5, color: on ? C.white : C.muted }}>{o.count}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export function Stepper({ value, onChange, min = 1, max = 200 }: { value: number; onChange: (n: number) => void; min?: number; max?: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
      <IconBtn icon="remove" tone="soft" size={40} onPress={() => onChange(Math.max(min, value - 1))} label="Decrease" />
      <Text style={{ fontFamily: F.extra, fontSize: 22, color: C.text, minWidth: 36, textAlign: 'center' }}>{value}</Text>
      <IconBtn icon="add" tone="soft" size={40} onPress={() => onChange(Math.min(max, value + 1))} label="Increase" />
    </View>
  );
}

export function Stars({ value, onChange, size = 30 }: { value: number; onChange?: (n: number) => void; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: size * 0.18 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable key={n} disabled={!onChange} onPress={() => onChange?.(n)} hitSlop={4} accessibilityLabel={`${n} star`}>
          <Ionicons name={n <= Math.round(value) ? 'star' : 'star-outline'} size={size} color={n <= Math.round(value) ? '#F5A623' : C.faint} />
        </Pressable>
      ))}
    </View>
  );
}

export function Rating({ value, count, dark }: { value: number; count?: number; dark?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Ionicons name="star" size={13} color="#F5A623" />
      <T v="smallM" color={dark ? C.white : C.text}>
        {value.toFixed(1)}
      </T>
      {count !== undefined ? (
        <T v="small" color={dark ? 'rgba(255,255,255,0.6)' : C.muted}>
          ({count})
        </T>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------- Progress line
/** Horizontal step tracker: Applied → Confirmed → Checked in → Paid. */
export function Steps({ steps, current, dark }: { steps: string[]; current: number; dark?: boolean }) {
  const off = dark ? 'rgba(255,255,255,0.22)' : C.line;
  const on = dark ? C.white : C.violet;
  return (
    <View style={{ flexDirection: 'row' }}>
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <View key={s} style={{ flex: 1, alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%' }}>
              <View style={{ flex: 1, height: 2, backgroundColor: i === 0 ? 'transparent' : done || active ? on : off }} />
              <View
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 10,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: done ? on : active ? (dark ? C.violet : C.white) : 'transparent',
                  borderWidth: done ? 0 : 2,
                  borderColor: active ? on : off,
                }}>
                {done ? <Ionicons name="checkmark" size={12} color={dark ? C.ink : C.white} /> : active ? <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: dark ? C.white : C.violet }} /> : null}
              </View>
              <View style={{ flex: 1, height: 2, backgroundColor: i === steps.length - 1 ? 'transparent' : done ? on : off }} />
            </View>
            <T v="caption" color={done || active ? (dark ? C.white : C.text) : dark ? 'rgba(255,255,255,0.5)' : C.faint} style={{ marginTop: 6 }} center>
              {s}
            </T>
          </View>
        );
      })}
    </View>
  );
}

/** Thin filled bar, e.g. slots filled 6/10. */
export function Bar({ value, max, color = C.violet, track = C.line, height = 6 }: { value: number; max: number; color?: string; track?: string; height?: number }) {
  const pct = max <= 0 ? 0 : Math.min(100, Math.round((value / max) * 100));
  return (
    <View style={{ height, borderRadius: height / 2, backgroundColor: track, overflow: 'hidden' }}>
      <View style={{ width: `${pct}%`, height, borderRadius: height / 2, backgroundColor: color }} />
    </View>
  );
}

// ---------------------------------------------------------------- Bottom sheet
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: string; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, justifyContent: 'flex-end', alignItems: 'center' }}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(15,11,26,0.5)' }]} onPress={onClose} accessibilityLabel="Close" />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          <View style={{ width: 44, height: 5, borderRadius: 3, backgroundColor: C.line, alignSelf: 'center', marginBottom: 14 }} />
          {title ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
              <T v="h3" style={{ flex: 1 }}>
                {title}
              </T>
              <IconBtn icon="close" onPress={onClose} size={36} tone="soft" label="Close" />
            </View>
          ) : null}
          {children}
        </View>
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------- Map placeholder
/** Stylised venue map. A real map SDK (needs an API key) replaces this later. */
export function MapCard({ label, sub, height = 150, onPress }: { label: string; sub?: string; height?: number; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={{ height, borderRadius: R.lg, overflow: 'hidden', backgroundColor: '#ECEAF4' }}>
      <Svg width="100%" height="100%" viewBox="0 0 340 150" preserveAspectRatio="xMidYMid slice">
        <Rect width="340" height="150" fill="#ECEAF4" />
        <Path d="M-10 40 L120 28 L210 60 L350 44" stroke="#FFFFFF" strokeWidth="12" fill="none" />
        <Path d="M60 -10 L88 70 L70 160" stroke="#FFFFFF" strokeWidth="10" fill="none" />
        <Path d="M240 -10 L222 62 L262 160" stroke="#FFFFFF" strokeWidth="10" fill="none" />
        <Path d="M-10 112 L96 98 L226 118 L350 100" stroke="#FFFFFF" strokeWidth="9" fill="none" />
        <Rect x="104" y="72" width="54" height="22" rx="4" fill="#DDD9EC" />
        <Rect x="270" y="62" width="48" height="28" rx="4" fill="#DDD9EC" />
        <Rect x="14" y="56" width="36" height="30" rx="4" fill="#DDD9EC" />
        <Path d="M0 150 C60 128 96 142 150 150 Z" fill="#D5E6F2" />
        <Path d="M40 132 C90 96 132 84 170 70" stroke={C.violet} strokeWidth="2.5" strokeDasharray="5 6" fill="none" />
        <Circle cx="40" cy="132" r="6" fill={C.ink} />
        <Circle cx="40" cy="132" r="2.5" fill="#FFFFFF" />
        <Circle cx="170" cy="64" r="20" fill={C.violet} opacity="0.16" />
        <Path d="M170 44 c-9 0 -15 6.5 -15 14.5 c0 10.5 15 22 15 22 s15 -11.5 15 -22 c0 -8 -6 -14.5 -15 -14.5z" fill={C.violet} />
        <Circle cx="170" cy="58.5" r="5.5" fill="#FFFFFF" />
      </Svg>
      <View style={styles.mapLabel}>
        <Ionicons name="location" size={16} color={C.violet} />
        <View style={{ flex: 1 }}>
          <T v="smallM" numberOfLines={1}>
            {label}
          </T>
          {sub ? (
            <T v="caption" color={C.muted} numberOfLines={1}>
              {sub}
            </T>
          ) : null}
        </View>
        {onPress ? <Ionicons name="navigate" size={16} color={C.violet} /> : null}
      </View>
    </Pressable>
  );
}

/** Label/value line used in summaries. */
export function KV({ k, v, bold, color }: { k: string; v: string; bold?: boolean; color?: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 16, paddingVertical: 6 }}>
      <T v={bold ? 'bodyM' : 'body'} color={bold ? C.text : C.muted}>
        {k}
      </T>
      <T v={bold ? 'h3' : 'bodyM'} color={color ?? C.text} style={{ flexShrink: 1, textAlign: 'right' }}>
        {v}
      </T>
    </View>
  );
}

/** Tappable box for photo capture (KYC, check-in). */
export function PhotoBox({ uri, label, hint, icon = 'camera', onPress, height = 150 }: { uri?: string | null; label: string; hint?: string; icon?: IconName; onPress: () => void; height?: number }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={[styles.photoBox, { height }, uri ? { borderStyle: 'solid', borderColor: C.success } : null]}>
      {uri ? (
        <>
          <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
          <View style={styles.photoDone}>
            <Ionicons name="checkmark-circle" size={16} color={C.white} />
            <Text style={{ fontFamily: F.semi, fontSize: 12, color: C.white }}>Added · tap to retake</Text>
          </View>
        </>
      ) : (
        <>
          <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: C.violetSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={icon} size={22} color={C.violet} />
          </View>
          <T v="bodyM">{label}</T>
          {hint ? (
            <T v="caption" color={C.muted} center>
              {hint}
            </T>
          ) : null}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 8 },
  footer: { paddingHorizontal: S.xl, paddingTop: 12, backgroundColor: 'transparent', gap: 8 },
  darkTop: { backgroundColor: C.ink, paddingHorizontal: S.xl, paddingBottom: 24, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: S.md },
  card: { backgroundColor: C.card, borderRadius: R.lg, ...shadow },
  badgeDot: { position: 'absolute', top: 9, right: 10, width: 9, height: 9, borderRadius: 5, backgroundColor: '#FF5A4E', borderWidth: 1.5, borderColor: C.ink },
  select: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.card, borderRadius: R.md, borderWidth: 1.5, borderColor: C.line, paddingHorizontal: 14, height: 52 },
  segment: { flexDirection: 'row', backgroundColor: C.card, borderRadius: R.pill, padding: 4, ...shadow },
  sheet: { width: '100%', maxWidth: 480, backgroundColor: C.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: S.xl, paddingTop: 10 },
  mapLabel: { position: 'absolute', left: 10, right: 10, bottom: 10, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.card, borderRadius: R.md, paddingHorizontal: 12, paddingVertical: 9, ...shadow },
  photoBox: { borderRadius: R.lg, borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.faint, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center', gap: 6, overflow: 'hidden', padding: 12 },
  photoDone: { position: 'absolute', left: 10, bottom: 10, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(14,159,82,0.92)', borderRadius: R.pill, paddingHorizontal: 10, paddingVertical: 5 },
});
