import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { colors, radius } from '../constants/theme';

interface IconButtonProps extends Omit<PressableProps, 'style'> {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label?: string;
  size?: number;
  tone?: 'plain' | 'surface' | 'light' | 'accent' | 'danger';
  style?: StyleProp<ViewStyle>;
}

export function IconButton({
  icon,
  label,
  size = 22,
  tone = 'plain',
  style,
  disabled,
  ...props
}: IconButtonProps): React.JSX.Element {
  const foreground =
    tone === 'light' || tone === 'accent'
      ? colors.accentInk
      : tone === 'danger'
        ? colors.danger
        : colors.text;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        tone === 'surface' && styles.surface,
        tone === 'light' && styles.light,
        tone === 'accent' && styles.accent,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
      {...props}
    >
      <Ionicons color={foreground} name={icon} size={size} />
      {label ? <Text style={[styles.label, { color: foreground }]}>{label}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    borderRadius: radius.pill,
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 44,
  },
  surface: {
    backgroundColor: colors.surfaceElevated,
  },
  light: {
    backgroundColor: colors.white,
  },
  accent: {
    backgroundColor: colors.accent,
  },
  disabled: {
    opacity: 0.35,
  },
  pressed: {
    opacity: 0.68,
    transform: [{ scale: 0.97 }],
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 3,
  },
});
