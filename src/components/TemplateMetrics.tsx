import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radius } from '../constants/theme';
import type { CollageTemplate } from '../types/collage';

interface TemplateMetricsProps {
  aspectRatio: CollageTemplate['canvas']['aspectRatio'];
  pageCount: number;
  requirements: CollageTemplate['requirements'];
  compact?: boolean;
}

interface MetricProps {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string;
}

export function TemplateMetrics({
  aspectRatio,
  pageCount,
  requirements,
  compact = false,
}: TemplateMetricsProps): React.JSX.Element {
  const mediaMetrics: MetricProps[] = [];
  if (requirements.imageCount > 0) {
    mediaMetrics.push({
      icon: 'image-outline',
      label: 'Images required',
      value: String(requirements.imageCount),
    });
  }
  if (requirements.videoCount > 0) {
    mediaMetrics.push({
      icon: 'videocam-outline',
      label: 'Videos required',
      value: String(requirements.videoCount),
    });
  }
  if (requirements.flexibleMediaCount > 0) {
    mediaMetrics.push({
      icon: 'images-outline',
      label: 'Images or videos required',
      value: String(requirements.flexibleMediaCount),
    });
  }
  if (mediaMetrics.length === 0) {
    mediaMetrics.push({
      icon: 'images-outline',
      label: 'Media required',
      value: '0',
    });
  }

  return (
    <View
      accessibilityLabel={`Aspect ratio ${aspectRatio}, ${mediaMetrics
        .map((metric) => `${metric.value} ${metric.label.toLowerCase()}`)
        .join(', ')}, ${pageCount} final outputs`}
      style={[styles.row, compact && styles.rowCompact]}
    >
      <Metric compact={compact} icon="resize-outline" label="Aspect ratio" value={aspectRatio} />
      {mediaMetrics.map((metric) => (
        <Metric
          compact={compact}
          icon={metric.icon}
          key={`${metric.icon}-${metric.label}`}
          label={metric.label}
          value={metric.value}
        />
      ))}
      <Metric
        compact={compact}
        icon="albums-outline"
        label="Final images or videos"
        value={String(pageCount)}
      />
    </View>
  );
}

function Metric({ icon, label, value, compact }: MetricProps & { compact: boolean }): React.JSX.Element {
  return (
    <View
      accessibilityLabel={`${label}: ${value}`}
      style={[styles.metric, compact && styles.metricCompact]}
    >
      <Ionicons color={colors.textMuted} name={icon} size={compact ? 14 : 16} />
      <Text style={[styles.value, compact && styles.valueCompact]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  rowCompact: {
    gap: 6,
  },
  metric: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  metricCompact: {
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 5,
  },
  value: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  valueCompact: {
    fontSize: 11,
  },
});
