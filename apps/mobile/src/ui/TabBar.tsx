import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { C, IconName, Ionicons } from './index';

export interface TabItem {
  icon: IconName;
  iconOn: IconName;
  label: string;
}

/**
 * Floating dark pill bar (page 2 design): the current tab sits in a white
 * tile, and a violet round button in the middle holds the main action.
 * `items` maps each tab route name to its icon and label.
 */
export function RozTabBar({
  state,
  navigateToTab,
  items,
  center,
}: BottomTabBarProps & { items: Record<string, TabItem>; center: { icon: IconName; label: string; onPress: () => void } }) {
  const insets = useSafeAreaInsets();
  const routes = state.routes.filter((r) => items[r.name]);
  const half = Math.ceil(routes.length / 2);

  const tab = (route: (typeof routes)[number]) => {
    const item = items[route.name]!;
    const focused = state.routes[state.index]?.key === route.key;
    return (
      <Pressable
        key={route.key}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={item.label}
        onPress={() => navigateToTab(route.key)}
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: 48, height: 48, borderRadius: 18, backgroundColor: focused ? C.white : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={focused ? item.iconOn : item.icon} size={22} color={focused ? C.ink : '#BDB8D0'} />
        </View>
      </Pressable>
    );
  };

  return (
    <View style={{ backgroundColor: C.bg, paddingHorizontal: 16, paddingTop: 8, paddingBottom: Math.max(insets.bottom, 16) }}>
      <View style={{ height: 72, borderRadius: 28, backgroundColor: C.ink, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, boxShadow: '0 16px 40px rgba(15, 11, 26, 0.28)' }}>
        {routes.slice(0, half).map(tab)}
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={center.label}
            onPress={center.onPress}
            style={({ pressed }) => ({ width: 56, height: 56, borderRadius: 28, backgroundColor: C.violet, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.85 : 1, boxShadow: '0 0 0 6px rgba(102, 1, 249, 0.28)' })}>
            <Ionicons name={center.icon} size={25} color={C.white} />
          </Pressable>
        </View>
        {routes.slice(half).map(tab)}
      </View>
    </View>
  );
}
