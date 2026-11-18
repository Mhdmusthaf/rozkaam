import { View } from 'react-native';

import { C, T } from './index';

/** "Step 2 of 4" bar with a title, used by onboarding and long forms. */
export function StepHead({ step, total, title, text }: { step: number; total: number; title: string; text?: string }) {
  return (
    <View style={{ marginBottom: 20 }}>
      <View style={{ flexDirection: 'row', gap: 6, marginBottom: 14 }}>
        {Array.from({ length: total }, (_, i) => (
          <View key={i} style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: i < step ? C.violet : C.line }} />
        ))}
      </View>
      <T v="label" color={C.violet}>
        Step {step} of {total}
      </T>
      <T v="h1" style={{ marginTop: 4 }}>
        {title}
      </T>
      {text ? (
        <T v="body" color={C.muted} style={{ marginTop: 6 }}>
          {text}
        </T>
      ) : null}
    </View>
  );
}
