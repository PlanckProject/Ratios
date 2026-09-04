import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandMark } from '../components/BrandMark';
import { ProjectCard } from '../components/ProjectCard';
import { TemplateCard } from '../components/TemplateCard';
import { colors, radius } from '../constants/theme';
import { exportCollageJson } from '../services/jsonTransfer';
import { useCollages } from '../store/CollageProvider';
import type { CollageProject, CollageTemplate } from '../types/collage';
import { IconButton } from '../components/IconButton';

interface HomeScreenProps {
  onCreate: () => void;
  onImport: () => void;
  onOpenProject: (project: CollageProject) => void;
  onOpenTemplate: (template: CollageTemplate) => void;
}

export function HomeScreen({
  onCreate,
  onImport,
  onOpenProject,
  onOpenTemplate,
}: HomeScreenProps): React.JSX.Element {
  const { width } = useWindowDimensions();
  const {
    projects,
    templates,
    duplicateProject,
    removeProject,
  } = useCollages();
  const cardWidth = Math.max(148, (width - 48) / 2);
  const featuredTemplates = useMemo(() => templates.slice(0, 4), [templates]);

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <FlatList
        columnWrapperStyle={projects.length > 1 ? styles.columns : undefined}
        contentContainerStyle={styles.content}
        data={projects}
        keyExtractor={(project) => project.id}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons color={colors.textMuted} name="images-outline" size={32} />
            <Text style={styles.emptyTitle}>Your projects will live here</Text>
            <Text style={styles.emptyCopy}>Choose a format and start with a blank canvas.</Text>
          </View>
        }
        ListHeaderComponent={
          <>
            <View style={styles.header}>
              <BrandMark />
              <IconButton
                accessibilityLabel="Import collage JSON"
                icon="download-outline"
                onPress={onImport}
                tone="surface"
              />
            </View>
            <View style={styles.hero}>
              <View style={styles.heroCopy}>
                <Text style={styles.eyebrow}>CREATE WITHOUT LIMITS</Text>
                <Text style={styles.heroTitle}>Every frame,{'\n'}exactly your way.</Text>
                <Pressable
                  onPress={onCreate}
                  style={({ pressed }) => [styles.heroButton, pressed && styles.pressed]}
                >
                  <Text style={styles.heroButtonText}>New collage</Text>
                  <Ionicons color={colors.accentInk} name="arrow-forward" size={18} />
                </Pressable>
              </View>
              <View style={styles.heroArt}>
                <View style={[styles.heroTile, styles.heroTileBack]} />
                <View style={[styles.heroTile, styles.heroTileMiddle]} />
                <View style={[styles.heroTile, styles.heroTileFront]}>
                  <Text style={styles.heroTileText}>R</Text>
                </View>
              </View>
            </View>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Quick starts</Text>
              <Text style={styles.sectionMeta}>{templates.length} templates</Text>
            </View>
            <FlatList
              contentContainerStyle={styles.templateRow}
              data={featuredTemplates}
              horizontal
              keyExtractor={(template) => template.id}
              renderItem={({ item }) => (
                <TemplateCard
                  onPress={() => onOpenTemplate(item)}
                  template={item}
                  width={172}
                />
              )}
              showsHorizontalScrollIndicator={false}
            />
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Your projects</Text>
              <Text style={styles.sectionMeta}>{projects.length}</Text>
            </View>
          </>
        }
        numColumns={2}
        renderItem={({ item }) => (
          <ProjectCard
            onDelete={() => removeProject(item.id)}
            onDuplicate={() => duplicateProject(item.id)}
            onExport={() => {
              void exportCollageJson(item);
            }}
            onOpen={() => onOpenProject(item)}
            project={item}
            width={cardWidth}
          />
        )}
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
  content: {
    paddingBottom: 116,
    paddingHorizontal: 16,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 18,
    paddingTop: 8,
  },
  hero: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.lg,
    flexDirection: 'row',
    minHeight: 212,
    overflow: 'hidden',
    padding: 22,
  },
  heroCopy: {
    flex: 1,
    justifyContent: 'space-between',
    zIndex: 2,
  },
  eyebrow: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  heroTitle: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -1.1,
    lineHeight: 33,
    marginVertical: 14,
  },
  heroButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  heroButtonText: {
    color: colors.accentInk,
    fontSize: 14,
    fontWeight: '800',
  },
  heroArt: {
    height: 176,
    marginLeft: 10,
    width: 112,
  },
  heroTile: {
    borderColor: 'rgba(255,255,255,0.32)',
    borderRadius: 10,
    borderWidth: 1,
    height: 126,
    position: 'absolute',
    width: 84,
  },
  heroTileBack: {
    backgroundColor: '#51473F',
    right: -10,
    top: 6,
    transform: [{ rotate: '10deg' }],
  },
  heroTileMiddle: {
    backgroundColor: '#888278',
    right: 12,
    top: 22,
    transform: [{ rotate: '-7deg' }],
  },
  heroTileFront: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    bottom: 0,
    justifyContent: 'center',
    left: 4,
    transform: [{ rotate: '3deg' }],
  },
  heroTileText: {
    color: colors.accentInk,
    fontSize: 46,
    fontWeight: '900',
  },
  sectionHeader: {
    alignItems: 'baseline',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    marginTop: 28,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 21,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  sectionMeta: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  templateRow: {
    gap: 12,
    paddingRight: 16,
  },
  columns: {
    gap: 16,
  },
  empty: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    marginTop: 8,
    padding: 28,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
    marginTop: 12,
  },
  emptyCopy: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 5,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.75,
    transform: [{ scale: 0.98 }],
  },
});
