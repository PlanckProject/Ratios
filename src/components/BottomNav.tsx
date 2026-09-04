import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '../constants/theme';

export type TabId = 'home' | 'templates' | 'projects' | 'settings';

interface BottomNavProps {
  active: TabId;
  onSelect: (tab: TabId) => void;
  onCreate: () => void;
}

const items: Array<{
  id: TabId;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  activeIcon: React.ComponentProps<typeof Ionicons>['name'];
}> = [
  { id: 'home', label: 'Home', icon: 'home-outline', activeIcon: 'home' },
  { id: 'templates', label: 'Templates', icon: 'grid-outline', activeIcon: 'grid' },
  { id: 'projects', label: 'Projects', icon: 'folder-open-outline', activeIcon: 'folder-open' },
  { id: 'settings', label: 'More', icon: 'options-outline', activeIcon: 'options' },
];

export function BottomNav({
  active,
  onSelect,
  onCreate,
}: BottomNavProps): React.JSX.Element {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.shell, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {items.slice(0, 2).map((item) => (
        <NavItem key={item.id} active={active === item.id} item={item} onSelect={onSelect} />
      ))}
      <Pressable
        accessibilityLabel="Create a new collage"
        accessibilityRole="button"
        onPress={onCreate}
        style={({ pressed }) => [styles.create, pressed && styles.pressed]}
      >
        <Ionicons color={colors.accentInk} name="add" size={38} />
      </Pressable>
      {items.slice(2).map((item) => (
        <NavItem key={item.id} active={active === item.id} item={item} onSelect={onSelect} />
      ))}
    </View>
  );
}

function NavItem({
  active,
  item,
  onSelect,
}: {
  active: boolean;
  item: (typeof items)[number];
  onSelect: (tab: TabId) => void;
}): React.JSX.Element {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={() => onSelect(item.id)}
      style={({ pressed }) => [styles.item, pressed && styles.pressed]}
    >
      <Ionicons
        color={active ? colors.text : colors.textMuted}
        name={active ? item.activeIcon : item.icon}
        size={25}
      />
      <Text style={[styles.label, active && styles.activeLabel]}>{item.label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shell: {
    alignItems: 'center',
    backgroundColor: 'rgba(9,9,9,0.97)',
    borderTopColor: '#242424',
    borderTopWidth: StyleSheet.hairlineWidth,
    bottom: 0,
    flexDirection: 'row',
    left: 0,
    paddingHorizontal: 10,
    paddingTop: 10,
    position: 'absolute',
    right: 0,
  },
  item: {
    alignItems: 'center',
    flex: 1,
    gap: 3,
    justifyContent: 'center',
    minHeight: 58,
  },
  label: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  activeLabel: {
    color: colors.text,
  },
  create: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: 34,
    height: 66,
    justifyContent: 'center',
    marginHorizontal: 4,
    marginTop: -24,
    width: 66,
  },
  pressed: {
    opacity: 0.7,
    transform: [{ scale: 0.97 }],
  },
});
