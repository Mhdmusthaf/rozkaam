import { Image } from 'expo-image';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useStore } from '@/store';
import { C, F, IMG, Ionicons, Row, Sheet, shadowLg, T, Wordmark } from '@/ui';

const SLIDES = [
  { img: IMG.workerMan, alt: 'A smiling banquet service worker in a black uniform', light: 'Work, when', bold: 'you need it.', text: 'Verified part-time jobs near you. See the pay first, get paid on time.' },
  { img: IMG.team, alt: 'Three smiling service staff in black uniforms', light: 'The right team,', bold: 'right on time.', text: 'Post a requirement in minutes. Rozkaam confirms verified workers for you.' },
  { img: IMG.workerWoman, alt: 'A smiling hospitality worker in a white shirt and black waistcoat', light: 'Trust, built', bold: 'into every shift.', text: 'KYC on both sides, photo check-in at the venue, and two-way ratings.' },
];

export default function Welcome() {
  const insets = useSafeAreaInsets();
  const demoLogin = useStore((s) => s.demoLogin);
  const [i, setI] = useState(0);
  const [demo, setDemo] = useState(false);
  const s = SLIDES[i]!;

  const enterDemo = (role: 'worker' | 'business') => {
    setDemo(false);
    demoLogin(role);
    router.replace('/');
  };
  const next = () => (i < SLIDES.length - 1 ? setI(i + 1) : router.push('/role'));

  return (
    <View style={{ flex: 1, backgroundColor: C.white }}>
      <StatusBar style="dark" />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: insets.top + 16, paddingHorizontal: 24 }}>
        <Wordmark width={112} />
        <Pressable onPress={() => router.push('/role')} hitSlop={12} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }}>
          <T v="bodyM" color={C.muted}>
            Skip
          </T>
        </Pressable>
      </View>

      {/* Hero: the person stands in front of a violet disc */}
      <View style={{ flex: 1, minHeight: 300, alignItems: 'center', justifyContent: 'flex-end' }}>
        <View style={{ position: 'absolute', bottom: 12, width: 312, height: 312, borderRadius: 156, backgroundColor: C.violet }} />
        <View style={{ position: 'absolute', bottom: -12, width: 360, height: 360, borderRadius: 180, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#C9B0FF' }} />
        <Image source={s.img} style={{ width: 360, height: 360 }} contentFit="contain" contentPosition="bottom" accessibilityLabel={s.alt} />
        {i === 0 ? (
          <>
            <View style={[{ position: 'absolute', left: 16, top: 64, backgroundColor: C.white, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12 }, shadowLg]}>
              <T v="caption" color={C.muted}>
                Tonight · 5:00 PM
              </T>
              <Text style={{ fontFamily: F.bold, fontSize: 20, color: C.text }}>₹850</Text>
            </View>
            <View style={[{ position: 'absolute', right: 16, bottom: 96, backgroundColor: C.ink, borderRadius: 999, paddingLeft: 8, paddingRight: 16, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }, shadowLg]}>
              <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#2FC774', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="checkmark" size={15} color={C.ink} />
              </View>
              <Text style={{ fontFamily: F.bold, fontSize: 12, color: C.white }}>Verified worker</Text>
            </View>
          </>
        ) : null}
      </View>

      <View style={{ paddingHorizontal: 24, paddingTop: 28, minHeight: 172 }}>
        <Text style={{ fontFamily: F.medium, fontSize: 32, lineHeight: 40, letterSpacing: -0.8, color: C.text }}>{s.light}</Text>
        <Text style={{ fontFamily: F.bold, fontSize: 32, lineHeight: 40, letterSpacing: -0.8, color: C.text }}>{s.bold}</Text>
        <T v="body" color={C.muted} style={{ marginTop: 12, maxWidth: 310 }}>
          {s.text}
        </T>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingBottom: Math.max(insets.bottom, 16) + 8 }}>
        <View style={{ gap: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }} accessibilityLabel={`Step ${i + 1} of ${SLIDES.length}`}>
            {SLIDES.map((_, k) => (
              <View key={k} style={{ width: k === i ? 24 : 6, height: 6, borderRadius: 3, backgroundColor: k === i ? C.ink : '#CFCBDB' }} />
            ))}
          </View>
          <Pressable onPress={() => setDemo(true)} hitSlop={10} accessibilityRole="button">
            <T v="smallM" color={C.violet}>
              Explore the demo
            </T>
          </Pressable>
        </View>
        <Pressable
          onPress={next}
          accessibilityRole="button"
          accessibilityLabel={i < SLIDES.length - 1 ? 'Next' : 'Get started'}
          style={({ pressed }) => ({ width: 72, height: 72, borderRadius: 36, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.85 : 1, boxShadow: '0 0 0 8px #F1EAFF' })}>
          <Ionicons name="arrow-forward" size={26} color={C.white} />
        </Pressable>
      </View>

      <Sheet open={demo} onClose={() => setDemo(false)} title="Explore the demo">
        <T v="small" color={C.muted} style={{ marginBottom: 8 }}>
          Opens a ready-made account filled with sample data, so you can try every screen.
        </T>
        <Row icon="briefcase" title="As a worker" sub="Find jobs, check in, get paid" chevron onPress={() => enterDemo('worker')} />
        <Row icon="business" tone="dark" title="As a business" sub="Post requirements, track attendance, pay" chevron onPress={() => enterDemo('business')} />
      </Sheet>
    </View>
  );
}
