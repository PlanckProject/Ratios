import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../constants/theme';

export function BrandMark({ compact = false }: { compact?: boolean }): React.JSX.Element {
  return (
    <View style={styles.row}>
      <View style={[styles.mark, compact && styles.markCompact]}>
        <View style={styles.squareBack} />
        <View style={styles.squareFront} />
      </View>
      {!compact ? <Text style={styles.wordmark}>Ratios</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  mark: {
    height: 34,
    width: 34,
  },
  markCompact: {
    transform: [{ scale: 0.82 }],
  },
  squareBack: {
    borderColor: colors.text,
    borderWidth: 2,
    height: 24,
    left: 0,
    position: 'absolute',
    top: 0,
    width: 24,
  },
  squareFront: {
    borderColor: colors.text,
    borderWidth: 2,
    bottom: 0,
    height: 24,
    position: 'absolute',
    right: 0,
    width: 24,
  },
  wordmark: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.7,
  },
});
