import Svg, { Ellipse, G, Path } from 'react-native-svg';
import { View } from 'react-native';

import { MARK_ACCENT, MARK_DOTS, MARK_MAIN, MARK_VIEWBOX, WORD, WORD_VIEWBOX } from './brand-paths';
import { C } from './theme';

type Variant = 'colour' | 'white' | 'dark';

const palette = (v: Variant) =>
  v === 'white'
    ? { main: C.white, accent: 'rgba(255,255,255,0.55)' }
    : v === 'dark'
      ? { main: C.ink, accent: C.grey }
      : { main: C.violet, accent: C.grey };

/** The Rozkaam symbol. `size` is the rendered width. */
export function Logomark({ size = 48, variant = 'colour' }: { size?: number; variant?: Variant }) {
  const p = palette(variant);
  return (
    <Svg width={size} height={(size * 1140) / 1260} viewBox={MARK_VIEWBOX}>
      <G>
        {MARK_ACCENT.map((d, i) => (
          <Path key={`a${i}`} d={d} fill={p.accent} />
        ))}
        {MARK_DOTS.map((e, i) => (
          <Ellipse key={`e${i}`} cx={e.cx} cy={e.cy} rx={e.rx} ry={e.ry} fill={p.main} />
        ))}
        {MARK_MAIN.map((d, i) => (
          <Path key={`m${i}`} d={d} fill={p.main} />
        ))}
      </G>
    </Svg>
  );
}

/** The "rozkaam" wordmark. `width` is the rendered width. */
export function Wordmark({ width = 140, variant = 'colour' }: { width?: number; variant?: Variant }) {
  const p = palette(variant);
  return (
    <Svg width={width} height={(width * 220) / 1376} viewBox={WORD_VIEWBOX}>
      {WORD.map((d, i) => (
        <Path key={i} d={d} fill={p.main} />
      ))}
    </Svg>
  );
}

/** Symbol + wordmark side by side. */
export function Logo({ height = 34, variant = 'colour' }: { height?: number; variant?: Variant }) {
  const markW = (height * 1260) / 1140;
  const wordW = height * 0.62 * (1376 / 220);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: height * 0.22 }}>
      <Logomark size={markW} variant={variant} />
      <Wordmark width={wordW} variant={variant} />
    </View>
  );
}
