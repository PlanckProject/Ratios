import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProjectCard } from '../components/ProjectCard';
import { colors, radius } from '../constants/theme';
import { useCollages } from '../store/CollageProvider';
import type { CollageProject } from '../types/collage';

interface ProjectsScreenProps {
  onOpenProject: (project: CollageProject) => void;
}

export function ProjectsScreen({
  onOpenProject,
}: ProjectsScreenProps): React.JSX.Element {
  const { width } = useWindowDimensions();
  const { projects, duplicateProject, removeProject } = useCollages();
  const [query, setQuery] = useState('');
  const cardWidth = Math.max(148, (width - 48) / 2);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return normalized
      ? projects.filter((project) => project.name.toLowerCase().includes(normalized))
      : projects;
  }, [projects, query]);

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <FlatList
        columnWrapperStyle={filtered.length > 1 ? styles.columns : undefined}
        contentContainerStyle={styles.content}
        data={filtered}
        keyExtractor={(project) => project.id}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons color={colors.textMuted} name="folder-open-outline" size={34} />
            <Text style={styles.emptyTitle}>No projects found</Text>
          </View>
        }
        ListHeaderComponent={
          <>
            <View style={styles.headingRow}>
              <View>
                <Text style={styles.kicker}>YOUR WORK</Text>
                <Text style={styles.heading}>Projects</Text>
              </View>
              <View style={styles.count}>
                <Text style={styles.countText}>{projects.length}</Text>
              </View>
            </View>
            <View style={styles.search}>
              <Ionicons color={colors.textMuted} name="search" size={21} />
              <TextInput
                onChangeText={setQuery}
                placeholder="Search projects"
                placeholderTextColor={colors.textMuted}
                style={styles.searchInput}
                value={query}
              />
            </View>
            <Text style={styles.sectionTitle}>
              {query ? `${filtered.length} matches` : 'Recently edited'}
            </Text>
          </>
        }
        numColumns={2}
        renderItem={({ item }) => (
          <ProjectCard
            onDelete={() => removeProject(item.id)}
            onDuplicate={() => duplicateProject(item.id)}
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
  count: {
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.pill,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  countText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
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
  sectionTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 14,
    marginTop: 26,
  },
  columns: {
    gap: 16,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 52,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
    marginTop: 10,
  },
});
