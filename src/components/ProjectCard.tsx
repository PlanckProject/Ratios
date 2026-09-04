import { Ionicons } from '@expo/vector-icons';
import React, { memo } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius } from '../constants/theme';
import type { CollageProject } from '../types/collage';
import { CollageCanvas } from './CollageCanvas';

interface ProjectCardProps {
  project: CollageProject;
  width: number;
  onOpen: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onExport: () => void;
}

export const ProjectCard = memo(function ProjectCard({
  project,
  width,
  onOpen,
  onDuplicate,
  onDelete,
  onExport,
}: ProjectCardProps): React.JSX.Element {
  const showMenu = () => {
    Alert.alert(project.name, 'Project actions', [
      { text: 'Open', onPress: onOpen },
      { text: 'Duplicate', onPress: onDuplicate },
      { text: 'Export JSON', onPress: onExport },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          Alert.alert('Delete project?', 'This removes the saved project from this device.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: onDelete },
          ]),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onOpen}
      style={({ pressed }) => [styles.card, { width }, pressed && styles.pressed]}
    >
      <View style={styles.preview}>
        <CollageCanvas document={project} maxHeight={210} />
      </View>
      <Pressable hitSlop={10} onPress={showMenu} style={styles.menu}>
        <Ionicons color={colors.text} name="ellipsis-horizontal" size={19} />
      </Pressable>
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
  menu: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: radius.pill,
    height: 34,
    justifyContent: 'center',
    position: 'absolute',
    right: 9,
    top: 9,
    width: 34,
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
