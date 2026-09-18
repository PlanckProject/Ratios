import { Ionicons } from '@expo/vector-icons';
import React, { useRef } from 'react';
import {
  Animated,
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
  onPressIn,
  onPressOut,
  ...props
}: IconButtonProps): React.JSX.Element {
  const pressScale = useRef(new Animated.Value(1)).current;
  const foreground =
    tone === 'light' || tone === 'accent'
      ? colors.accentInk
      : tone === 'danger'
        ? colors.danger
        : colors.text;

  return (
    <Animated.View
      style={{
        transform: [{ scale: pressScale }],
      }}
    >
      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        onPressIn={(event) => {
          if (!disabled) {
            Animated.spring(pressScale, {
              friction: 8,
              tension: 280,
              toValue: 0.94,
              useNativeDriver: true,
            }).start();
          }
          onPressIn?.(event);
        }}
        onPressOut={(event) => {
          Animated.spring(pressScale, {
            friction: 8,
            tension: 280,
            toValue: 1,
            useNativeDriver: true,
          }).start();
          onPressOut?.(event);
        }}
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
    </Animated.View>
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
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 3,
  },
});
