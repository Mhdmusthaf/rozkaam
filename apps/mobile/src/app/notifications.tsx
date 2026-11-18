import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { ago } from '@/lib/format';
import { useStore } from '@/store';
import { C, Empty, Header, IconName, IconTile, Screen, T } from '@/ui';

export default function Notifications() {
  const role = useStore((s) => s.session.role) ?? 'worker';
  const all = useStore((s) => s.notices);
  const markRead = useStore((s) => s.markRead);
  const markAll = useStore((s) => s.markAllRead);
  const list = all.filter((n) => n.role === role);
  const unread = list.some((n) => !n.read);

  return (
    <Screen
      padded={false}
      header={
        <Header
          title="Notifications"
          right={
            unread ? (
              <T v="smallM" color={C.violet} onPress={() => markAll(role)} style={{ paddingRight: 8 }}>
                Mark all read
              </T>
            ) : undefined
          }
        />
      }>
      {list.length === 0 ? (
        <Empty icon="notifications-off" title="Nothing yet" text="Confirmations, reminders and payment updates will appear here." />
      ) : (
        list.map((n) => (
          <Pressable
            key={n.id}
            onPress={() => {
              markRead(n.id);
              if (n.href) router.push(n.href as never);
            }}
            style={({ pressed }) => ({ flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingVertical: 14, backgroundColor: n.read ? 'transparent' : C.violetTint, opacity: pressed ? 0.7 : 1, borderBottomWidth: 1, borderBottomColor: C.line })}>
            <IconTile icon={n.icon as IconName} tone={n.tone} size={42} />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <T v="bodyM" style={{ flex: 1 }} numberOfLines={1}>
                  {n.title}
                </T>
                {!n.read ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.violet }} /> : null}
              </View>
              <T v="small" color={C.muted}>
                {n.body}
              </T>
              <T v="caption" color={C.faint} style={{ marginTop: 4 }}>
                {ago(n.at)}
              </T>
            </View>
          </Pressable>
        ))
      )}
    </Screen>
  );
}
