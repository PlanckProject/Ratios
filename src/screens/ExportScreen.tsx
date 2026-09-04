import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { RecordingView, useViewRecorder } from 'react-native-view-recorder';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CollageCanvas } from '../components/CollageCanvas';
import { IconButton } from '../components/IconButton';
import {
  getExportDimensions,
  type ExportPreset,
} from '../constants/ratios';
import { colors, radius } from '../constants/theme';
import { useCollages } from '../store/CollageProvider';

type OutputType = 'image' | 'video';

interface ExportJob {
  outputType: OutputType;
  preset: ExportPreset;
  dimensions: {
    width: number;
    height: number;
  };
  fps: number;
  bitrate: number;
}

interface CompletedExport extends ExportJob {
  uri: string;
  savedToLibrary: boolean;
}

interface ExportScreenProps {
  projectId: string;
  onBack: () => void;
}

function waitForRender(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

function safeFileName(name: string): string {
  return (
    name
      .trim()
      .replace(/[^a-z0-9-_]+/gi, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase() || 'ratios-export'
  );
}

function toNativePath(uri: string): string {
  return uri.startsWith('file://')
    ? decodeURIComponent(uri.slice('file://'.length))
    : uri;
}

function toFileUri(path: string): string {
  return path.startsWith('file://') ? path : `file://${path}`;
}

export function ExportScreen({
  projectId,
  onBack,
}: ExportScreenProps): React.JSX.Element {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const { projects } = useCollages();
  const project = projects.find((item) => item.id === projectId);
  const recorder = useViewRecorder();
  const hasMotion = useMemo(
    () =>
      Boolean(
        project?.layers.some(
          (layer) =>
            (layer.type === 'media' &&
              (layer.mediaKind === 'video' ||
                layer.source?.mimeType?.startsWith('video/'))) ||
            Object.values(layer.animations).some(
              (animation) => animation?.enabled && animation.type !== 'none',
            ),
        ),
      ),
    [project],
  );
  const [preset, setPreset] = useState<ExportPreset>('max');
  const [outputType, setOutputType] = useState<OutputType>(
    hasMotion ? 'video' : 'image',
  );
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [timelineMs, setTimelineMs] = useState(0);
  const [activeJob, setActiveJob] = useState<ExportJob | null>(null);
  const [completedExport, setCompletedExport] = useState<CompletedExport | null>(null);
  const [renderRun, setRenderRun] = useState(0);
  const abortController = useRef<AbortController | null>(null);
  const canceled = useRef(false);
  const mounted = useRef(true);

  useEffect(
    () => () => {
      mounted.current = false;
      canceled.current = true;
      abortController.current?.abort();
    },
    [],
  );

  const selectedDimensions = project
    ? getExportDimensions(project.canvas.aspectRatio, preset)
    : { width: 2160, height: 2700 };
  const renderJob =
    activeJob ??
    (project
      ? {
          outputType,
          preset,
          dimensions: selectedDimensions,
          fps: Math.min(Math.max(project.canvas.fps, 24), 60),
          bitrate: preset === 'max' ? 45_000_000 : 16_000_000,
        }
      : null);
  const previewSize = useMemo(() => {
    const aspect = selectedDimensions.width / selectedDimensions.height;
    const maxWidth = windowWidth - 32;
    const maxHeight = Math.min(windowHeight * 0.42, 480);
    let width = maxWidth;
    let height = width / aspect;
    if (height > maxHeight) {
      height = maxHeight;
      width = height * aspect;
    }
    return { width, height };
  }, [
    selectedDimensions.height,
    selectedDimensions.width,
    windowHeight,
    windowWidth,
  ]);

  if (!project) {
    return (
      <SafeAreaView style={styles.missing}>
        <Text style={styles.missingTitle}>Project not found</Text>
        <Pressable onPress={onBack} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const outputDestination = (
    job: ExportJob,
    extension: 'png' | 'mp4',
  ): { nativePath: string; uri: string } => {
    const directory = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
    if (!directory) {
      throw new Error('No writable export directory is available.');
    }
    const uri = `${directory}${safeFileName(project.name)}-${job.preset}-${Date.now()}.${extension}`;
    return {
      nativePath: toNativePath(uri),
      uri,
    };
  };

  const deleteOutput = async (uri: string): Promise<void> => {
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists) {
      await FileSystem.deleteAsync(uri, { idempotent: true });
    }
  };

  const removePreviousOutput = async (): Promise<void> => {
    if (!completedExport) {
      return;
    }
    await deleteOutput(completedExport.uri);
  };

  const exportImage = async (job: ExportJob): Promise<string> => {
    const destination = outputDestination(job, 'png');
    await new Promise((resolve) => setTimeout(resolve, 250));
    const result = await recorder.snapshot({
      output: destination.nativePath,
      format: 'png',
      quality: 1,
      width: job.dimensions.width,
      height: job.dimensions.height,
      result: 'tmpfile',
    });
    return toFileUri(result || destination.nativePath);
  };

  const exportVideo = async (job: ExportJob): Promise<string> => {
    const durationMs = project.canvas.durationMs;
    const totalFrames = Math.max(
      1,
      Math.round((durationMs * job.fps) / 1000),
    );
    const destination = outputDestination(job, 'mp4');
    const controller = new AbortController();
    abortController.current = controller;

    try {
      const result = await recorder.record({
        output: destination.nativePath,
        fps: job.fps,
        totalFrames,
        width: job.dimensions.width,
        height: job.dimensions.height,
        codec: 'h264',
        bitrate: job.bitrate,
        quality: 1,
        keyFrameInterval: 2,
        optimizeForNetwork: true,
        signal: controller.signal,
        onFrame: async ({ frameIndex }) => {
          const frameTimeMs = Math.min(
            (frameIndex * 1000) / job.fps,
            durationMs,
          );
          setTimelineMs(frameTimeMs);
          setProgress((frameIndex + 1) / totalFrames);
          await waitForRender();
          await new Promise((resolve) => setTimeout(resolve, 8));
        },
      });
      return toFileUri(result || destination.nativePath);
    } finally {
      abortController.current = null;
    }
  };

  const saveToLibrary = async (uri: string): Promise<boolean> => {
    const permission = await MediaLibrary.requestPermissionsAsync(true);
    if (!permission.granted) {
      return false;
    }
    await MediaLibrary.saveToLibraryAsync(uri);
    return true;
  };

  const generate = async () => {
    const job: ExportJob = {
      outputType,
      preset,
      dimensions: getExportDimensions(project.canvas.aspectRatio, preset),
      fps: Math.min(Math.max(project.canvas.fps, 24), 60),
      bitrate: preset === 'max' ? 45_000_000 : 16_000_000,
    };
    canceled.current = false;
    setExporting(true);
    setActiveJob(job);
    setTimelineMs(0);
    setProgress(0);
    setRenderRun((value) => value + 1);
    try {
      await removePreviousOutput();
      setCompletedExport(null);
      await waitForRender();
      const uri =
        job.outputType === 'image'
          ? await exportImage(job)
          : await exportVideo(job);
      if (canceled.current) {
        await deleteOutput(uri);
        return;
      }
      const savedToLibrary = await saveToLibrary(uri);
      if (canceled.current) {
        await deleteOutput(uri);
        return;
      }
      if (mounted.current) {
        setProgress(1);
        setCompletedExport({
          ...job,
          uri,
          savedToLibrary,
        });
      }
    } catch (error: unknown) {
      if (
        !canceled.current &&
        (error as { name?: string }).name !== 'AbortError'
      ) {
        Alert.alert(
          'Export failed',
          error instanceof Error ? error.message : 'The media could not be generated.',
        );
      }
    } finally {
      if (mounted.current) {
        setExporting(false);
        setActiveJob(null);
        setTimelineMs(0);
      }
    }
  };

  const shareOutput = async () => {
    if (!completedExport) {
      return;
    }
    if (!(await Sharing.isAvailableAsync())) {
      Alert.alert('Sharing unavailable', 'This device cannot open a share sheet.');
      return;
    }
    await Sharing.shareAsync(completedExport.uri, {
      dialogTitle: `Share ${project.name}`,
      mimeType:
        completedExport.outputType === 'image' ? 'image/png' : 'video/mp4',
      UTI:
        completedExport.outputType === 'image'
          ? 'public.png'
          : 'public.mpeg-4',
    });
  };

  const cancelExport = () => {
    canceled.current = true;
    abortController.current?.abort();
  };

  const displayedDimensions = activeJob?.dimensions ?? selectedDimensions;
  const displayedOutputType = activeJob?.outputType ?? outputType;
  const displayedPreset = activeJob?.preset ?? preset;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <IconButton
          icon="arrow-back"
          onPress={() => {
            if (exporting) {
              cancelExport();
            }
            onBack();
          }}
        />
        <Text style={styles.headerTitle}>Export</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.previewStage}>
        <RecordingView
          collapsable={false}
          sessionId={recorder.sessionId}
          style={[
            styles.recordingView,
            {
              height: previewSize.height,
              width: previewSize.width,
            },
          ]}
        >
          <CollageCanvas
            animate={exporting && activeJob?.outputType === 'video'}
            document={project}
            key={renderRun}
            maxHeight={previewSize.height}
            timelineMs={
              exporting && activeJob?.outputType === 'video'
                ? timelineMs
                : undefined
            }
            videoFrameMs={
              exporting && activeJob?.outputType === 'image' ? 0 : undefined
            }
          />
        </RecordingView>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        scrollEnabled={!exporting}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionLabel}>Format</Text>
        <View style={styles.segmented}>
          <SelectorButton
            active={outputType === 'image'}
            disabled={exporting}
            icon="image-outline"
            label="Image"
            onPress={() => setOutputType('image')}
          />
          <SelectorButton
            active={outputType === 'video'}
            disabled={exporting}
            icon="videocam-outline"
            label="Video"
            onPress={() => setOutputType('video')}
          />
        </View>

        <Text style={styles.sectionLabel}>Quality preset</Text>
        <View style={styles.presetRow}>
          <PresetCard
            active={preset === 'standard'}
            disabled={exporting}
            dimensions={getExportDimensions(project.canvas.aspectRatio, 'standard')}
            label="Standard"
            onPress={() => setPreset('standard')}
          />
          <PresetCard
            active={preset === 'max'}
            badge="Default"
            disabled={exporting}
            dimensions={getExportDimensions(project.canvas.aspectRatio, 'max')}
            label="Max"
            onPress={() => setPreset('max')}
          />
        </View>

        <View style={styles.outputDetails}>
          <View>
            <Text style={styles.outputTitle}>
              {displayedDimensions.width} × {displayedDimensions.height}
            </Text>
            <Text style={styles.outputMeta}>
              {displayedOutputType === 'image'
                ? 'Lossless PNG'
                : `H.264 · ${renderJob?.fps ?? project.canvas.fps} fps · ${
                    displayedPreset === 'max' ? '45' : '16'
                  } Mbps`}
            </Text>
          </View>
          <View style={styles.ratioBadge}>
            <Text style={styles.ratioText}>{project.canvas.aspectRatio}</Text>
          </View>
        </View>

        {exporting ? (
          <View style={styles.progressCard}>
            <View style={styles.progressHeader}>
              <ActivityIndicator color={colors.accent} size="small" />
              <Text style={styles.progressTitle}>
                Rendering {displayedOutputType === 'image' ? 'image' : 'video'}…
              </Text>
              <Text style={styles.progressValue}>{Math.round(progress * 100)}%</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
            </View>
            <Pressable onPress={cancelExport} style={styles.cancelButton}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={() => void generate()}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
          >
            <Ionicons color={colors.accentInk} name="sparkles" size={20} />
            <Text style={styles.primaryButtonText}>
              Generate {outputType === 'image' ? 'image' : 'video'}
            </Text>
          </Pressable>
        )}

        {completedExport && !exporting ? (
          <View style={styles.successCard}>
            <View style={styles.successIcon}>
              <Ionicons color={colors.accentInk} name="checkmark" size={22} />
            </View>
            <View style={styles.successCopy}>
              <Text style={styles.successTitle}>Export ready</Text>
              <Text style={styles.successMeta}>
                {completedExport.savedToLibrary
                  ? 'Saved to your media library.'
                  : 'Use Share to choose a destination.'}
              </Text>
            </View>
            <IconButton icon="share-outline" onPress={() => void shareOutput()} tone="surface" />
          </View>
        ) : null}

        <Text style={styles.qualityNote}>
          Max renders at twice Instagram’s standard 1080-pixel width. Height is calculated
          directly from the selected collage ratio; the editor preview is never used as the
          export resolution.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function SelectorButton({
  active,
  disabled,
  icon,
  label,
  onPress,
}: {
  active: boolean;
  disabled: boolean;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
}): React.JSX.Element {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.selectorButton,
        active && styles.selectorButtonActive,
        disabled && styles.disabled,
      ]}
    >
      <Ionicons
        color={active ? colors.accentInk : colors.textMuted}
        name={icon}
        size={19}
      />
      <Text style={[styles.selectorText, active && styles.selectorTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

function PresetCard({
  active,
  badge,
  disabled,
  dimensions,
  label,
  onPress,
}: {
  active: boolean;
  badge?: string;
  disabled: boolean;
  dimensions: { width: number; height: number };
  label: string;
  onPress: () => void;
}): React.JSX.Element {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.presetCard,
        active && styles.presetCardActive,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.presetTitleRow}>
        <Text style={styles.presetTitle}>{label}</Text>
        {badge ? <Text style={styles.presetBadge}>{badge}</Text> : null}
      </View>
      <Text style={styles.presetDimensions}>
        {dimensions.width} × {dimensions.height}
      </Text>
      <Text style={styles.presetCopy}>
        {label === 'Max' ? 'Highest detail' : 'Fast, social-ready'}
      </Text>
      <View style={[styles.radio, active && styles.radioActive]}>
        {active ? <View style={styles.radioDot} /> : null}
      </View>
    </Pressable>
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
  headerSpacer: {
    width: 44,
  },
  content: {
    paddingBottom: 36,
    paddingHorizontal: 16,
  },
  previewStage: {
    alignItems: 'center',
    backgroundColor: '#111111',
    borderRadius: radius.lg,
    justifyContent: 'center',
    minHeight: 240,
    marginHorizontal: 16,
    overflow: 'hidden',
    padding: 12,
  },
  recordingView: {
    backgroundColor: colors.canvas,
    overflow: 'hidden',
  },
  sectionLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.9,
    marginBottom: 10,
    marginTop: 22,
    textTransform: 'uppercase',
  },
  segmented: {
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    flexDirection: 'row',
    padding: 4,
  },
  selectorButton: {
    alignItems: 'center',
    borderRadius: radius.pill,
    flex: 1,
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'center',
    paddingVertical: 11,
  },
  selectorButtonActive: {
    backgroundColor: colors.accent,
  },
  selectorText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  selectorTextActive: {
    color: colors.accentInk,
  },
  presetRow: {
    flexDirection: 'row',
    gap: 10,
  },
  presetCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    minHeight: 126,
    padding: 14,
  },
  presetCardActive: {
    borderColor: colors.accent,
    borderWidth: 2,
  },
  presetTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  presetTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  presetBadge: {
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    color: colors.accentInk,
    fontSize: 9,
    fontWeight: '800',
    overflow: 'hidden',
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  presetDimensions: {
    color: colors.text,
    fontSize: 13,
    fontVariant: ['tabular-nums'],
    fontWeight: '700',
    marginTop: 16,
  },
  presetCopy: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 3,
  },
  radio: {
    alignItems: 'center',
    borderColor: colors.textMuted,
    borderRadius: radius.pill,
    borderWidth: 1,
    bottom: 12,
    height: 18,
    justifyContent: 'center',
    position: 'absolute',
    right: 12,
    width: 18,
  },
  radioActive: {
    borderColor: colors.accent,
  },
  radioDot: {
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    height: 10,
    width: 10,
  },
  outputDetails: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
    padding: 14,
  },
  outputTitle: {
    color: colors.text,
    fontSize: 17,
    fontVariant: ['tabular-nums'],
    fontWeight: '800',
  },
  outputMeta: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
  ratioBadge: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  ratioText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    flexDirection: 'row',
    gap: 9,
    justifyContent: 'center',
    marginTop: 16,
    paddingVertical: 17,
  },
  primaryButtonText: {
    color: colors.accentInk,
    fontSize: 16,
    fontWeight: '800',
  },
  progressCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    marginTop: 16,
    padding: 16,
  },
  progressHeader: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  progressTitle: {
    color: colors.text,
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 9,
  },
  progressValue: {
    color: colors.textMuted,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  progressTrack: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    height: 5,
    marginTop: 14,
    overflow: 'hidden',
  },
  progressFill: {
    backgroundColor: colors.accent,
    height: '100%',
  },
  cancelButton: {
    alignSelf: 'center',
    marginTop: 14,
    padding: 6,
  },
  cancelText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '700',
  },
  successCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: 'rgba(221,252,114,0.3)',
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    marginTop: 12,
    padding: 12,
  },
  successIcon: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  successCopy: {
    flex: 1,
    marginHorizontal: 11,
  },
  successTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  successMeta: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 3,
  },
  qualityNote: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 18,
    textAlign: 'center',
  },
  missing: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  missingTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.99 }],
  },
  disabled: {
    opacity: 0.5,
  },
});
