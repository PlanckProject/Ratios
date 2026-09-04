import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius } from '../constants/theme';
import type { CollageTemplate } from '../types/collage';
import { CollageCanvas } from './CollageCanvas';

interface TemplateCardProps {
  template: CollageTemplate;
  width: number;
  onPress: () => void;
}

export const TemplateCard = memo(function TemplateCard({
  template,
  width,
  onPress,
}: TemplateCardProps): React.JSX.Element {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, { width }, pressed && styles.pressed]}
    >
      <View style={styles.preview}>
        <CollageCanvas document={template} maxHeight={218} />
      </View>
      <Text numberOfLines={1} style={styles.title}>
        {template.name}
      </Text>
      <Text style={styles.meta}>
        {template.metadata.category} · {template.canvas.aspectRatio}
      </Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    marginBottom: 18,
  },
  preview: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    height: 226,
    justifyContent: 'center',
    overflow: 'hidden',
    padding: 8,
  },
  title: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginTop: 9,
  },
  meta: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 3,
  },
  pressed: {
    opacity: 0.7,
    transform: [{ scale: 0.99 }],
  },
});
