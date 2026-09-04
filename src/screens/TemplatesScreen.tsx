import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TemplateCard } from '../components/TemplateCard';
import { colors, radius } from '../constants/theme';
import { useCollages } from '../store/CollageProvider';
import type { CollageTemplate } from '../types/collage';

interface TemplatesScreenProps {
  onOpenTemplate: (template: CollageTemplate) => void;
  onOpenSettings: () => void;
}

export function TemplatesScreen({
  onOpenTemplate,
  onOpenSettings,
}: TemplatesScreenProps): React.JSX.Element {
  const { width } = useWindowDimensions();
  const {
    templates,
    repositoryUrl,
    repositoryLoading,
    repositoryError,
    refreshRemoteTemplates,
  } = useCollages();
  const [query, setQuery] = useState('');
  const cardWidth = Math.max(148, (width - 48) / 2);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return templates;
    }
    return templates.filter(
      (template) =>
        template.name.toLowerCase().includes(normalized) ||
        template.metadata.category.toLowerCase().includes(normalized) ||
        template.metadata.tags.some((tag) => tag.toLowerCase().includes(normalized)),
    );
  }, [query, templates]);

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <FlatList
        columnWrapperStyle={filtered.length > 1 ? styles.columns : undefined}
        contentContainerStyle={styles.content}
        data={filtered}
        keyExtractor={(template) => template.id}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No matching templates</Text>
            <Text style={styles.emptyCopy}>Try another name, category, or tag.</Text>
          </View>
        }
        ListHeaderComponent={
          <>
            <View style={styles.headingRow}>
              <View>
                <Text style={styles.kicker}>DISCOVER</Text>
                <Text style={styles.heading}>Templates</Text>
              </View>
              <Pressable
                accessibilityLabel="Configure template repository"
                onPress={onOpenSettings}
                style={styles.repositoryButton}
              >
                <Ionicons color={colors.text} name="cloud-outline" size={21} />
              </Pressable>
            </View>
            <View style={styles.search}>
              <Ionicons color={colors.textMuted} name="search" size={21} />
              <TextInput
                autoCorrect={false}
                onChangeText={setQuery}
                placeholder="Search templates"
                placeholderTextColor={colors.textMuted}
                style={styles.searchInput}
                value={query}
              />
            </View>
            <View style={styles.repositoryStatus}>
              <View style={styles.statusCopy}>
                <Text style={styles.statusTitle}>
                  {repositoryUrl ? 'Remote library connected' : 'Built-in library'}
                </Text>
                <Text numberOfLines={1} style={styles.statusMeta}>
                  {repositoryError ??
                    (repositoryUrl
                      ? `${templates.length} templates available`
                      : 'Add a repository URL to sync your own JSON designs')}
                </Text>
              </View>
              {repositoryUrl ? (
                <Pressable
                  disabled={repositoryLoading}
                  onPress={() => {
                    void refreshRemoteTemplates().catch(() => undefined);
                  }}
                  style={styles.refresh}
                >
                  <Ionicons
                    color={colors.accentInk}
                    name={repositoryLoading ? 'hourglass-outline' : 'refresh'}
                    size={18}
                  />
                </Pressable>
              ) : null}
            </View>
            <Text style={styles.sectionTitle}>
              {query ? `${filtered.length} results` : 'All templates'}
            </Text>
          </>
        }
        numColumns={2}
        refreshControl={
          repositoryUrl ? (
            <RefreshControl
              onRefresh={() => {
                void refreshRemoteTemplates().catch(() => undefined);
              }}
              refreshing={repositoryLoading}
              tintColor={colors.accent}
            />
          ) : undefined
        }
        renderItem={({ item }) => (
          <TemplateCard
            onPress={() => onOpenTemplate(item)}
            template={item}
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
  headingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 18,
    paddingTop: 8,
  },
  kicker: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.3,
  },
  heading: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -1,
    marginTop: 2,
  },
  repositoryButton: {
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.pill,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  search: {
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
  },
  searchInput: {
    color: colors.text,
    flex: 1,
    fontSize: 16,
    height: 52,
  },
  repositoryStatus: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    flexDirection: 'row',
    marginTop: 14,
    padding: 14,
  },
  statusCopy: {
    flex: 1,
  },
  statusTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  statusMeta: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 3,
  },
  refresh: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    height: 38,
    justifyContent: 'center',
    marginLeft: 10,
    width: 38,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 21,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginBottom: 14,
    marginTop: 26,
  },
  columns: {
    gap: 16,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 42,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
  },
  emptyCopy: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 5,
  },
});
