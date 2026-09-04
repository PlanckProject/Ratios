import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CollageCanvas } from '../components/CollageCanvas';
import { IconButton } from '../components/IconButton';
import { colors, radius } from '../constants/theme';
import type { CollageTemplate } from '../types/collage';

interface TemplateDetailScreenProps {
  template: CollageTemplate;
  onBack: () => void;
  onUseTemplate: () => void;
}

export function TemplateDetailScreen({
  template,
  onBack,
  onUseTemplate,
}: TemplateDetailScreenProps): React.JSX.Element {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <IconButton icon="arrow-back" onPress={onBack} />
        <Text style={styles.headerTitle}>Template</Text>
        <IconButton icon="bookmark-outline" tone="surface" />
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.canvasWrap}>
          <CollageCanvas animate document={template} maxHeight={520} />
        </View>
        <View style={styles.metaRow}>
          <View style={styles.templateIcon}>
            <Ionicons color={colors.text} name="copy-outline" size={22} />
          </View>
          <View style={styles.metaCopy}>
            <Text style={styles.name}>{template.name}</Text>
            <Text style={styles.meta}>
              {template.canvas.aspectRatio} · {template.requirements.flexibleMediaCount +
                template.requirements.imageCount +
                template.requirements.videoCount}{' '}
              media · {template.layers.length} layers
            </Text>
          </View>
        </View>
        <Pressable
          onPress={onUseTemplate}
          style={({ pressed }) => [styles.useButton, pressed && styles.pressed]}
        >
          <Text style={styles.useButtonText}>Use template</Text>
          <Ionicons color={colors.accentInk} name="arrow-forward" size={19} />
        </Pressable>
        <View style={styles.details}>
          <Text style={styles.detailsTitle}>Included in this design</Text>
          <View style={styles.chips}>
            <InfoChip
              icon="images-outline"
              label={`${template.requirements.flexibleMediaCount +
                template.requirements.imageCount +
                template.requirements.videoCount} media slots`}
            />
            <InfoChip icon="layers-outline" label={`${template.layers.length} layers`} />
            <InfoChip icon="text-outline" label={`${template.requirements.textCount} text`} />
            <InfoChip icon="resize-outline" label={template.canvas.aspectRatio} />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoChip({
  icon,
  label,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
}): React.JSX.Element {
  return (
    <View style={styles.chip}>
      <Ionicons color={colors.textMuted} name={icon} size={16} />
      <Text style={styles.chipText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    backgroundColor: colors.background,
    flex: 1,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  content: {
    paddingBottom: 32,
    paddingHorizontal: 16,
  },
  canvasWrap: {
    alignItems: 'center',
    backgroundColor: '#111111',
    borderRadius: radius.lg,
    justifyContent: 'center',
    minHeight: 420,
    overflow: 'hidden',
    padding: 12,
  },
  metaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    paddingVertical: 18,
  },
  templateIcon: {
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.pill,
    height: 48,
    justifyContent: 'center',
    marginRight: 12,
    width: 48,
  },
  metaCopy: {
    flex: 1,
  },
  name: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
  },
  meta: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 4,
  },
  useButton: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    flexDirection: 'row',
    gap: 9,
    justifyContent: 'center',
    paddingVertical: 17,
  },
  useButtonText: {
    color: colors.accentInk,
    fontSize: 17,
    fontWeight: '800',
  },
  details: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    marginTop: 26,
    paddingTop: 22,
  },
  detailsTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 13,
  },
  chip: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  chipText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.75,
    transform: [{ scale: 0.99 }],
  },
});
