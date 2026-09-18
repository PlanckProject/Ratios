import { Ionicons } from '@expo/vector-icons';
import React, { memo } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius } from '../constants/theme';
import { exportCollageJson } from '../services/jsonTransfer';
import type { CollageProject } from '../types/collage';
import { CollageCanvas } from './CollageCanvas';

interface ProjectCardProps {
  project: CollageProject;
  width: number;
  onOpen: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

export const ProjectCard = memo(function ProjectCard({
  project,
  width,
  onOpen,
  onDuplicate,
  onDelete,
}: ProjectCardProps): React.JSX.Element {
  const confirmDelete = () => {
    Alert.alert(
      'Delete project?',
      'This removes the saved project and any unused local media from this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: onDelete },
      ],
    );
  };

  const exportProject = async () => {
    try {
      await exportCollageJson(project);
    } catch (error: unknown) {
      Alert.alert(
        'Export failed',
        error instanceof Error ? error.message : 'Unable to export the project.',
      );
    }
  };

  const showMenu = () => {
    Alert.alert(project.name, 'Project actions', [
      { text: 'Open', onPress: onOpen },
      { text: 'Duplicate', onPress: onDuplicate },
      { text: 'Export JSON', onPress: () => void exportProject() },
      { text: 'Delete', style: 'destructive', onPress: confirmDelete },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <View style={[styles.card, { width }]}>
      <Pressable
        accessibilityLabel={`Open ${project.name}`}
        accessibilityRole="button"
        onLongPress={showMenu}
        onPress={onOpen}
        style={({ pressed }) => pressed && styles.pressed}
      >
        <View style={styles.preview}>
          <CollageCanvas document={project} maxHeight={210} />
        </View>
        <View style={styles.details}>
          <Text numberOfLines={1} style={styles.title}>
            {project.name}
          </Text>
          <Text style={styles.meta}>
            {project.canvas.aspectRatio} · {project.layers.length} layer
            {project.layers.length === 1 ? '' : 's'}
          </Text>
        </View>
      </Pressable>
      <View style={styles.actions}>
        <Pressable
          accessibilityLabel={`Actions for ${project.name}`}
          accessibilityRole="button"
          onPress={showMenu}
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}
        >
          <Ionicons color={colors.textMuted} name="ellipsis-horizontal" size={18} />
          <Text style={styles.actionText}>More</Text>
        </Pressable>
        <Pressable
          accessibilityLabel={`Delete ${project.name}`}
          accessibilityRole="button"
          onPress={confirmDelete}
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}
        >
          <Ionicons color={colors.danger} name="trash-outline" size={16} />
          <Text style={[styles.actionText, styles.deleteText]}>Delete</Text>
        </Pressable>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    marginBottom: 14,
    overflow: 'hidden',
  },
  preview: {
    alignItems: 'center',
    backgroundColor: '#111111',
    height: 220,
    justifyContent: 'center',
    overflow: 'hidden',
    padding: 8,
  },
  actions: {
    alignItems: 'center',
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  action: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    minHeight: 44,
    paddingHorizontal: 8,
  },
  actionText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  deleteText: {
    color: colors.danger,
  },
  details: {
    padding: 12,
  },
  title: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  meta: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
  pressed: {
    opacity: 0.72,
  },
});
