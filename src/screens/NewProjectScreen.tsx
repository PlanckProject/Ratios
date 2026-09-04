import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ASPECT_RATIOS, ASPECT_RATIO_IDS } from '../constants/ratios';
import { colors, radius } from '../constants/theme';
import type { AspectRatioId } from '../types/collage';
import { IconButton } from '../components/IconButton';

interface NewProjectScreenProps {
  onBack: () => void;
  onSelect: (aspectRatio: AspectRatioId) => void;
}

export function NewProjectScreen({
  onBack,
  onSelect,
}: NewProjectScreenProps): React.JSX.Element {
  const { width } = useWindowDimensions();
  const cardWidth = Math.max(154, (width - 48) / 2);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <IconButton icon="arrow-back" onPress={onBack} />
        <Text style={styles.headerTitle}>New project</Text>
        <View style={styles.headerSpacer} />
      </View>
      <FlatList
        columnWrapperStyle={styles.columns}
        contentContainerStyle={styles.content}
        data={ASPECT_RATIO_IDS}
        keyExtractor={(item) => item}
        ListHeaderComponent={
          <View style={styles.intro}>
            <Text style={styles.kicker}>CHOOSE A CANVAS</Text>
            <Text style={styles.title}>Pick your format</Text>
            <Text style={styles.copy}>
              You can switch between supported social formats later without losing layers.
            </Text>
          </View>
        }
        numColumns={2}
        renderItem={({ item }) => {
          const ratio = ASPECT_RATIOS[item];
          const visualAspect = ratio.width / ratio.height;
          const maxPreviewWidth = 78;
          const maxPreviewHeight = 96;
          let previewWidth = maxPreviewWidth;
          let previewHeight = previewWidth / visualAspect;
          if (previewHeight > maxPreviewHeight) {
            previewHeight = maxPreviewHeight;
            previewWidth = previewHeight * visualAspect;
          }

          return (
            <Pressable
              accessibilityLabel={`Create ${ratio.label} ${ratio.use} collage`}
              onPress={() => onSelect(item)}
              style={({ pressed }) => [
                styles.ratioCard,
                { width: cardWidth },
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.previewArea}>
                <View
                  style={[
                    styles.ratioPreview,
                    {
                      height: previewHeight,
                      width: previewWidth,
                    },
                  ]}
                >
                  <View style={styles.previewLineVertical} />
                  <View style={styles.previewLineHorizontal} />
                </View>
              </View>
              <View style={styles.ratioCopy}>
                <Text style={styles.ratioLabel}>{ratio.label}</Text>
                <Text style={styles.ratioUse}>{ratio.use}</Text>
              </View>
              <Ionicons color={colors.textMuted} name="arrow-forward" size={18} />
            </Pressable>
          );
        }}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
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
    fontSize: 17,
    fontWeight: '700',
  },
  headerSpacer: {
    width: 44,
  },
  content: {
    paddingBottom: 36,
    paddingHorizontal: 16,
  },
  intro: {
    paddingBottom: 28,
    paddingTop: 28,
  },
  kicker: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  title: {
    color: colors.text,
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: -1.2,
    marginTop: 6,
  },
  copy: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 9,
    maxWidth: 360,
  },
  columns: {
    gap: 16,
  },
  ratioCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: 16,
    minHeight: 142,
    padding: 14,
  },
  previewArea: {
    alignItems: 'center',
    height: 100,
    justifyContent: 'center',
    width: 82,
  },
  ratioPreview: {
    backgroundColor: colors.canvas,
    borderRadius: 4,
    overflow: 'hidden',
  },
  previewLineVertical: {
    backgroundColor: 'rgba(0,0,0,0.13)',
    bottom: 0,
    left: '50%',
    position: 'absolute',
    top: 0,
    width: 1,
  },
  previewLineHorizontal: {
    backgroundColor: 'rgba(0,0,0,0.13)',
    height: 1,
    left: 0,
    position: 'absolute',
    right: 0,
    top: '50%',
  },
  ratioCopy: {
    flex: 1,
    marginLeft: 10,
  },
  ratioLabel: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  ratioUse: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 4,
  },
  pressed: {
    borderColor: colors.accent,
    opacity: 0.78,
    transform: [{ scale: 0.99 }],
  },
});
