import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandMark } from '../components/BrandMark';
import { colors, radius } from '../constants/theme';
import { useCollages } from '../store/CollageProvider';

interface SettingsScreenProps {
  onImport: () => void;
}

export function SettingsScreen({ onImport }: SettingsScreenProps): React.JSX.Element {
  const {
    repositoryUrl,
    repositoryLoading,
    repositoryError,
    remoteTemplates,
    storageError,
    setRepositoryUrl,
    refreshRemoteTemplates,
  } = useCollages();
  const [draftUrl, setDraftUrl] = useState(repositoryUrl);

  useEffect(() => {
    setDraftUrl(repositoryUrl);
  }, [repositoryUrl]);

  const connectRepository = async () => {
    const nextUrl = draftUrl.trim();
    if (!nextUrl) {
      setRepositoryUrl('');
      return;
    }
    try {
      await refreshRemoteTemplates(nextUrl);
    } catch (error: unknown) {
      Alert.alert(
        'Repository unavailable',
        error instanceof Error ? error.message : 'Unable to load templates.',
      );
    }
  };

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <BrandMark />
          <Text style={styles.version}>v1.0</Text>
        </View>
        <Text style={styles.heading}>Settings</Text>

        <View style={styles.card}>
          <View style={styles.cardHeading}>
            <View style={styles.cardIcon}>
              <Ionicons color={colors.accentInk} name="cloud-outline" size={21} />
            </View>
            <View style={styles.cardHeadingCopy}>
              <Text style={styles.cardTitle}>Template repository</Text>
              <Text style={styles.cardCopy}>
                Point Ratios at a JSON file or a directory containing index.json.
              </Text>
            </View>
          </View>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            onChangeText={setDraftUrl}
            placeholder="https://example.com/templates"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            value={draftUrl}
          />
          <Pressable
            disabled={repositoryLoading}
            onPress={() => {
              void connectRepository();
            }}
            style={({ pressed }) => [
              styles.primaryButton,
              repositoryLoading && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.primaryButtonText}>
              {repositoryLoading ? 'Connecting…' : 'Save and sync'}
            </Text>
          </Pressable>
          {repositoryError ? <Text style={styles.error}>{repositoryError}</Text> : null}
          {remoteTemplates.length ? (
            <Text style={styles.success}>{remoteTemplates.length} remote templates synced.</Text>
          ) : null}
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeading}>
            <View style={styles.cardIcon}>
              <Ionicons color={colors.accentInk} name="code-slash" size={21} />
            </View>
            <View style={styles.cardHeadingCopy}>
              <Text style={styles.cardTitle}>Import JSON</Text>
              <Text style={styles.cardCopy}>
                Open a Ratios project or template file from your device.
              </Text>
            </View>
          </View>
          <Pressable
            onPress={onImport}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
          >
            <Ionicons color={colors.text} name="download-outline" size={19} />
            <Text style={styles.secondaryButtonText}>Choose JSON file</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>JSON-first by design</Text>
          <Text style={styles.cardCopyLong}>
            Every project stores canvas dimensions, aspect ratio, duration, media requirements,
            layer order, transforms, crops, text styling, animation timing, playback settings,
            guides, and repository provenance in a portable document.
          </Text>
        </View>

        {storageError ? (
          <View style={[styles.card, styles.errorCard]}>
            <Text style={styles.cardTitle}>Local storage warning</Text>
            <Text style={styles.error}>{storageError}</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    backgroundColor: colors.background,
    flex: 1,
  },
  content: {
    paddingBottom: 126,
    paddingHorizontal: 16,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 18,
    paddingTop: 8,
  },
  version: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  heading: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -1,
    marginBottom: 20,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    marginBottom: 14,
    padding: 18,
  },
  cardHeading: {
    flexDirection: 'row',
  },
  cardIcon: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    height: 42,
    justifyContent: 'center',
    marginRight: 12,
    width: 42,
  },
  cardHeadingCopy: {
    flex: 1,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
  },
  cardCopy: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  cardCopyLong: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
  },
  input: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    color: colors.text,
    fontSize: 14,
    height: 50,
    marginTop: 16,
    paddingHorizontal: 13,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    marginTop: 12,
    paddingVertical: 14,
  },
  primaryButtonText: {
    color: colors.accentInk,
    fontSize: 15,
    fontWeight: '800',
  },
  secondaryButton: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginTop: 16,
    paddingVertical: 13,
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  error: {
    color: colors.danger,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 10,
  },
  success: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 10,
  },
  errorCard: {
    borderColor: 'rgba(255,91,91,0.35)',
    borderWidth: 1,
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.99 }],
  },
});
