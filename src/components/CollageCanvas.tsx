import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  AppState,
  Image,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { ASPECT_RATIOS } from '../constants/ratios';
import { colors, radius } from '../constants/theme';
import type {
  CollageDocument,
  CollageLayer,
  LayerTransform,
  MediaLayer,
  ShapeLayer,
  TextLayer,
} from '../types/collage';

interface CollageCanvasProps {
  document: CollageDocument;
  maxHeight?: number;
  editable?: boolean;
  animate?: boolean;
  timelineMs?: number;
  videoFrameMs?: number;
  selectedLayerId?: string | null;
  onSelectLayer?: (layerId: string | null) => void;
  onUpdateTransform?: (layerId: string, transform: LayerTransform) => void;
  onTransformStart?: () => void;
  onTransformEnd?: () => void;
  onRequestFill?: (layerId: string) => void;
  onDuplicateLayer?: (layerId: string) => void;
  onDeleteLayer?: (layerId: string) => void;
  onToggleLock?: (layerId: string) => void;
  style?: StyleProp<ViewStyle>;
}

interface CanvasSize {
  width: number;
  height: number;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

export function CollageCanvas({
  document,
  maxHeight = 520,
  editable = false,
  animate = false,
  timelineMs,
  videoFrameMs,
  selectedLayerId,
  onSelectLayer,
  onUpdateTransform,
  onTransformStart,
  onTransformEnd,
  onRequestFill,
  onDuplicateLayer,
  onDeleteLayer,
  onToggleLock,
  style,
}: CollageCanvasProps): React.JSX.Element {
  const [availableWidth, setAvailableWidth] = useState(0);
  const ratio = ASPECT_RATIOS[document.canvas.aspectRatio];
  const canvasSize = useMemo<CanvasSize>(() => {
    if (!availableWidth) {
      return { width: 0, height: 0 };
    }
    const aspect = ratio.width / ratio.height;
    let width = availableWidth;
    let height = width / aspect;
    if (height > maxHeight) {
      height = maxHeight;
      width = height * aspect;
    }
    return { width, height };
  }, [availableWidth, maxHeight, ratio.height, ratio.width]);

  const handleLayout = (event: LayoutChangeEvent) => {
    setAvailableWidth(event.nativeEvent.layout.width);
  };

  return (
    <View onLayout={handleLayout} style={[styles.stage, style]}>
      {canvasSize.width > 0 ? (
        <Pressable
          onPress={() => editable && onSelectLayer?.(null)}
          style={[
            styles.canvas,
            {
              backgroundColor: document.canvas.background.color,
              height: canvasSize.height,
              width: canvasSize.width,
            },
          ]}
        >
          {document.canvas.background.type === 'image' &&
          document.canvas.background.source ? (
            <Image
              blurRadius={document.canvas.background.blur}
              resizeMode="cover"
              source={{ uri: document.canvas.background.source.uri }}
              style={styles.backgroundImage}
            />
          ) : null}
          {document.layers.map((layer) =>
            timelineMs === undefined ||
            (timelineMs >= layer.timing.startMs && timelineMs <= layer.timing.endMs) ? (
            <EditableLayer
              animate={animate}
              canvasSize={canvasSize}
              editable={editable}
              key={layer.id}
              layer={layer}
              timelineMs={timelineMs}
              videoFrameMs={videoFrameMs}
              onDelete={onDeleteLayer}
              onDuplicate={onDuplicateLayer}
              onRequestFill={onRequestFill}
              onSelect={onSelectLayer}
              onToggleLock={onToggleLock}
              onTransformEnd={onTransformEnd}
              onTransformStart={onTransformStart}
              onUpdateTransform={onUpdateTransform}
              selected={selectedLayerId === layer.id}
            />
            ) : null,
          )}
          {document.editor.showGrid ? <GridOverlay /> : null}
          {document.editor.showSafeArea ? (
            <View
              pointerEvents="none"
              style={[
                styles.safeArea,
                {
                  bottom: `${document.canvas.safeArea.bottom * 100}%`,
                  left: `${document.canvas.safeArea.left * 100}%`,
                  right: `${document.canvas.safeArea.right * 100}%`,
                  top: `${document.canvas.safeArea.top * 100}%`,
                },
              ]}
            />
          ) : null}
        </Pressable>
      ) : null}
    </View>
  );
}

function GridOverlay(): React.JSX.Element {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {[1, 2].map((index) => (
        <React.Fragment key={index}>
          <View style={[styles.gridVertical, { left: `${(index / 3) * 100}%` }]} />
          <View style={[styles.gridHorizontal, { top: `${(index / 3) * 100}%` }]} />
        </React.Fragment>
      ))}
    </View>
  );
}

interface EditableLayerProps {
  layer: CollageLayer;
  canvasSize: CanvasSize;
  editable: boolean;
  animate: boolean;
  timelineMs?: number;
  videoFrameMs?: number;
  selected: boolean;
  onSelect?: (layerId: string | null) => void;
  onUpdateTransform?: (layerId: string, transform: LayerTransform) => void;
  onTransformStart?: () => void;
  onTransformEnd?: () => void;
  onRequestFill?: (layerId: string) => void;
  onDuplicate?: (layerId: string) => void;
  onDelete?: (layerId: string) => void;
  onToggleLock?: (layerId: string) => void;
}

const EditableLayer = memo(function EditableLayer({
  layer,
  canvasSize,
  editable,
  animate,
  timelineMs,
  videoFrameMs,
  selected,
  onSelect,
  onUpdateTransform,
  onTransformStart,
  onTransformEnd,
  onRequestFill,
  onDuplicate,
  onDelete,
  onToggleLock,
}: EditableLayerProps): React.JSX.Element | null {
  const layerRef = useRef(layer);
  layerRef.current = layer;
  const dragStart = useRef(layer.transform);
  const resizeStart = useRef(layer.transform);

  const moveResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => editable,
        onMoveShouldSetPanResponder: (_, gesture) =>
          editable && Math.abs(gesture.dx) + Math.abs(gesture.dy) > 2,
        onPanResponderGrant: () => {
          const currentLayer = layerRef.current;
          dragStart.current = currentLayer.transform;
          onSelect?.(currentLayer.id);
          onTransformStart?.();
        },
        onPanResponderMove: (_, gesture) => {
          const currentLayer = layerRef.current;
          if (currentLayer.locked) {
            return;
          }
          onUpdateTransform?.(currentLayer.id, {
            ...dragStart.current,
            x: clamp(dragStart.current.x + gesture.dx / canvasSize.width, -0.2, 0.95),
            y: clamp(dragStart.current.y + gesture.dy / canvasSize.height, -0.2, 0.95),
          });
        },
        onPanResponderRelease: (_, gesture) => {
          const currentLayer = layerRef.current;
          if (
            currentLayer.type === 'media' &&
            !currentLayer.source &&
            Math.abs(gesture.dx) < 4 &&
            Math.abs(gesture.dy) < 4
          ) {
            onRequestFill?.(currentLayer.id);
          }
          onTransformEnd?.();
        },
        onPanResponderTerminate: onTransformEnd,
      }),
    [
      canvasSize.height,
      canvasSize.width,
      editable,
      onRequestFill,
      onSelect,
      onTransformEnd,
      onTransformStart,
      onUpdateTransform,
    ],
  );

  const resizeResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => editable && !layerRef.current.locked,
        onMoveShouldSetPanResponder: () => editable && !layerRef.current.locked,
        onPanResponderGrant: () => {
          resizeStart.current = layerRef.current.transform;
          onTransformStart?.();
        },
        onPanResponderMove: (_, gesture) => {
          onUpdateTransform?.(layerRef.current.id, {
            ...resizeStart.current,
            width: clamp(
              resizeStart.current.width + gesture.dx / canvasSize.width,
              0.08,
              1.2,
            ),
            height: clamp(
              resizeStart.current.height + gesture.dy / canvasSize.height,
              0.06,
              1.2,
            ),
          });
        },
        onPanResponderRelease: onTransformEnd,
        onPanResponderTerminate: onTransformEnd,
      }),
    [
      canvasSize.height,
      canvasSize.width,
      editable,
      onTransformEnd,
      onTransformStart,
      onUpdateTransform,
    ],
  );

  if (!layer.visible) {
    return null;
  }

  const frameStyle: ViewStyle = {
    height: layer.transform.height * canvasSize.height,
    left: layer.transform.x * canvasSize.width,
    opacity: layer.opacity,
    top: layer.transform.y * canvasSize.height,
    transform: [
      { rotate: `${layer.transform.rotation}deg` },
      { scaleX: layer.transform.scaleX },
      { scaleY: layer.transform.scaleY },
    ],
    width: layer.transform.width * canvasSize.width,
    zIndex: layer.zIndex,
  };

  return (
    <View
      {...(editable ? moveResponder.panHandlers : {})}
      pointerEvents={editable ? 'auto' : 'none'}
      style={[styles.layer, frameStyle]}
    >
      <LayerContent
        animate={animate}
        canvasWidth={canvasSize.width}
        layer={layer}
        timelineMs={timelineMs}
        videoFrameMs={videoFrameMs}
      />
      {selected && editable ? (
        <>
          <View pointerEvents="none" style={styles.selectionBorder} />
          <View style={styles.contextPill}>
            <Pressable hitSlop={8} onPress={() => onDelete?.(layer.id)}>
              <Ionicons color={colors.accentInk} name="trash-outline" size={18} />
            </Pressable>
            <Pressable hitSlop={8} onPress={() => onDuplicate?.(layer.id)}>
              <Ionicons color={colors.accentInk} name="copy-outline" size={18} />
            </Pressable>
            <Pressable hitSlop={8} onPress={() => onToggleLock?.(layer.id)}>
              <Ionicons
                color={colors.accentInk}
                name={layer.locked ? 'lock-closed' : 'lock-open-outline'}
                size={18}
              />
            </Pressable>
          </View>
          <View pointerEvents="none" style={[styles.handle, styles.handleTopLeft]} />
          <View pointerEvents="none" style={[styles.handle, styles.handleTopRight]} />
          <View pointerEvents="none" style={[styles.handle, styles.handleBottomLeft]} />
          <View
            {...resizeResponder.panHandlers}
            style={[styles.handle, styles.handleBottomRight]}
          />
        </>
      ) : null}
    </View>
  );
});

function LayerContent({
  layer,
  animate,
  canvasWidth,
  timelineMs,
  videoFrameMs,
}: {
  layer: CollageLayer;
  animate: boolean;
  canvasWidth: number;
  timelineMs?: number;
  videoFrameMs?: number;
}): React.JSX.Element {
  if (layer.type === 'media') {
    return (
      <MediaLayerContent
        animate={animate}
        layer={layer}
        timelineMs={timelineMs}
        videoFrameMs={videoFrameMs}
      />
    );
  }
  if (layer.type === 'text') {
    return (
      <TextLayerContent
        animate={animate}
        canvasWidth={canvasWidth}
        layer={layer}
        timelineMs={timelineMs}
      />
    );
  }
  return <ShapeLayerContent layer={layer} />;
}

function MediaLayerContent({
  layer,
  animate,
  timelineMs,
  videoFrameMs,
}: {
  layer: MediaLayer;
  animate: boolean;
  timelineMs?: number;
  videoFrameMs?: number;
}): React.JSX.Element {
  const borderRadius =
    layer.frame.shape === 'circle'
      ? 999
      : layer.frame.shape === 'rounded'
        ? layer.frame.borderRadius
        : 0;

  return (
    <View
      style={[
        styles.mediaFrame,
        {
          borderColor: layer.frame.borderColor,
          borderRadius,
          borderWidth: layer.frame.borderWidth,
        },
      ]}
    >
      {!layer.source ? (
        <View style={styles.placeholder}>
          <View style={styles.placeholderPlus}>
            <Ionicons color={colors.text} name="add" size={26} />
          </View>
          <Text style={styles.placeholderText}>
            {layer.mediaKind === 'video' ? 'Add video' : 'Add media'}
          </Text>
        </View>
      ) : layer.mediaKind === 'video' || layer.source.mimeType?.startsWith('video/') ? (
        animate || timelineMs !== undefined || videoFrameMs !== undefined ? (
          <VideoLayerContent
            layer={layer}
            timelineMs={timelineMs ?? videoFrameMs}
          />
        ) : (
          <View style={[styles.fill, styles.videoPoster]}>
            <View pointerEvents="none" style={styles.videoBadge}>
              <Ionicons color={colors.text} name="play" size={16} />
            </View>
          </View>
        )
      ) : (
        <Image
          resizeMode={layer.fit === 'fill' ? 'stretch' : layer.fit}
          source={{ uri: layer.source.uri }}
          style={[
            styles.croppedMedia,
            {
              height: `${layer.crop.zoom * 100}%`,
              left: `${-(layer.crop.zoom - 1) * layer.crop.x * 100}%`,
              top: `${-(layer.crop.zoom - 1) * layer.crop.y * 100}%`,
              transform: [
                { scaleX: layer.crop.flipX ? -1 : 1 },
                { scaleY: layer.crop.flipY ? -1 : 1 },
              ],
              width: `${layer.crop.zoom * 100}%`,
            },
          ]}
        />
      )}
    </View>
  );
}

function VideoLayerContent({
  layer,
  timelineMs,
}: {
  layer: MediaLayer;
  timelineMs?: number;
}): React.JSX.Element {
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  const player = useVideoPlayer(layer.source?.uri ?? '', (instance) => {
    instance.loop = layer.playback.loop;
    instance.muted = layer.playback.muted;
    instance.playbackRate = layer.playback.speed;
    instance.currentTime = layer.playback.trimStartMs / 1000;
  });

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      setAppActive(state === 'active');
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    player.loop = layer.playback.loop;
    player.muted = layer.playback.muted;
    player.playbackRate = layer.playback.speed;
    if (timelineMs !== undefined) {
      player.pause();
      const localTimeMs = Math.max(0, timelineMs - layer.timing.startMs);
      const trimStartMs = layer.playback.trimStartMs;
      const trimEndMs =
        layer.playback.trimEndMs ??
        layer.source?.durationMs ??
        trimStartMs + localTimeMs * layer.playback.speed;
      const playableDurationMs = Math.max(trimEndMs - trimStartMs, 1);
      const requestedTimeMs = trimStartMs + localTimeMs * layer.playback.speed;
      const resolvedTimeMs = layer.playback.loop
        ? trimStartMs + ((requestedTimeMs - trimStartMs) % playableDurationMs)
        : Math.min(requestedTimeMs, trimEndMs);
      player.currentTime = resolvedTimeMs / 1000;
    } else if (appActive) {
      player.play();
    } else {
      player.pause();
    }
  }, [
    appActive,
    layer.playback.loop,
    layer.playback.muted,
    layer.playback.speed,
    layer.playback.trimEndMs,
    layer.playback.trimStartMs,
    layer.source?.durationMs,
    layer.timing.startMs,
    player,
    timelineMs,
  ]);

  return (
    <View style={styles.fill}>
      <VideoView
        contentFit={layer.fit === 'fill' ? 'fill' : layer.fit}
        nativeControls={false}
        player={player}
        surfaceType={Platform.OS === 'android' ? 'textureView' : undefined}
        style={[
          styles.croppedMedia,
          {
            height: `${layer.crop.zoom * 100}%`,
            left: `${-(layer.crop.zoom - 1) * layer.crop.x * 100}%`,
            top: `${-(layer.crop.zoom - 1) * layer.crop.y * 100}%`,
            transform: [
              { scaleX: layer.crop.flipX ? -1 : 1 },
              { scaleY: layer.crop.flipY ? -1 : 1 },
            ],
            width: `${layer.crop.zoom * 100}%`,
          },
        ]}
      />
    </View>
  );
}

function TextLayerContent({
  layer,
  animate,
  canvasWidth,
  timelineMs,
}: {
  layer: TextLayer;
  animate: boolean;
  canvasWidth: number;
  timelineMs?: number;
}): React.JSX.Element {
  const progress = useRef(new Animated.Value(1)).current;
  const [visibleText, setVisibleText] = useState(layer.text);
  const animation = layer.animations.loop ?? layer.animations.entrance;
  const deterministicProgress = useMemo(() => {
    if (
      timelineMs === undefined ||
      !animate ||
      !animation?.enabled ||
      animation.type === 'none'
    ) {
      return null;
    }
    const elapsedMs = Math.max(
      0,
      timelineMs - layer.timing.startMs - animation.delayMs,
    );
    const durationMs = Math.max(animation.durationMs, 1);
    let value: number;
    if (animation.loop) {
      const cycleMs =
        animation.direction === 'alternate' ? durationMs * 2 : durationMs;
      const cyclePosition = elapsedMs % cycleMs;
      value =
        animation.direction === 'alternate' && cyclePosition > durationMs
          ? 2 - cyclePosition / durationMs
          : cyclePosition / durationMs;
    } else {
      value = Math.min(elapsedMs / durationMs, 1);
    }
    return animation.direction === 'reverse' ? 1 - value : value;
  }, [animate, animation, layer.timing.startMs, timelineMs]);

  useEffect(() => {
    progress.stopAnimation();
    progress.setValue(1);
    setVisibleText(layer.text);
    if (
      timelineMs !== undefined ||
      !animate ||
      !animation?.enabled ||
      animation.type === 'none'
    ) {
      return;
    }

    if (animation.type === 'typewriter') {
      let index = 0;
      setVisibleText('');
      const interval = setInterval(() => {
        index += 1;
        setVisibleText(layer.text.slice(0, index));
        if (index >= layer.text.length) {
          clearInterval(interval);
        }
      }, Math.max(30, animation.durationMs / Math.max(layer.text.length, 1)));
      return () => clearInterval(interval);
    }

    const sequence = Animated.sequence([
      Animated.delay(animation.delayMs),
      Animated.timing(progress, {
        duration: animation.durationMs,
        toValue: 1,
        useNativeDriver: true,
      }),
    ]);
    progress.setValue(0);
    const runner = animation.loop
      ? Animated.loop(
          Animated.sequence([
            sequence,
            Animated.timing(progress, {
              duration: animation.durationMs,
              toValue: 0,
              useNativeDriver: true,
            }),
          ]),
        )
      : sequence;
    runner.start();
    return () => runner.stop();
  }, [animate, animation, layer.text, progress, timelineMs]);

  const animatedStyle =
    deterministicProgress !== null
      ? animation?.type === 'rise'
        ? {
            opacity: deterministicProgress,
            transform: [{ translateY: 14 * (1 - deterministicProgress) }],
          }
        : animation?.type === 'pulse'
          ? {
              opacity: 0.72 + deterministicProgress * 0.28,
              transform: [{ scale: 0.96 + deterministicProgress * 0.08 }],
            }
          : animation?.type === 'fade'
            ? { opacity: deterministicProgress }
            : { opacity: 1 }
      : animation?.type === 'rise'
        ? {
            opacity: progress,
            transform: [
              {
                translateY: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [14, 0],
                }),
              },
            ],
          }
        : animation?.type === 'pulse'
          ? {
              opacity: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [0.72, 1],
              }),
              transform: [
                {
                  scale: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.96, 1.04],
                  }),
                },
              ],
            }
          : { opacity: progress };
  const renderedText =
    deterministicProgress !== null && animation?.type === 'typewriter'
      ? layer.text.slice(
          0,
          Math.min(
            layer.text.length,
            Math.ceil(layer.text.length * deterministicProgress),
          ),
        )
      : visibleText;
  const scale = canvasWidth / 390;

  return (
    <Animated.View style={[styles.textFrame, animatedStyle]}>
      <Text
        adjustsFontSizeToFit
        minimumFontScale={0.35}
        numberOfLines={6}
        style={{
          backgroundColor: layer.style.backgroundColor,
          borderRadius: layer.style.borderRadius * scale,
          color: layer.style.color,
          fontFamily: layer.style.fontFamily === 'System' ? undefined : layer.style.fontFamily,
          fontSize: layer.style.fontSize * scale,
          fontStyle: layer.style.fontStyle,
          fontWeight: layer.style.fontWeight,
          letterSpacing: layer.style.letterSpacing * scale,
          lineHeight: layer.style.lineHeight * scale,
          padding: layer.style.padding * scale,
          textAlign: layer.style.textAlign,
          textShadowColor: layer.style.shadow.color,
          textShadowOffset: {
            height: layer.style.shadow.offsetY,
            width: layer.style.shadow.offsetX,
          },
          textShadowRadius: layer.style.shadow.radius,
          textTransform: layer.style.textTransform,
        }}
      >
        {renderedText}
      </Text>
    </Animated.View>
  );
}

function ShapeLayerContent({ layer }: { layer: ShapeLayer }): React.JSX.Element {
  if (layer.shape === 'line') {
    return (
      <View style={[styles.fill, styles.lineFrame]}>
        <View
          style={[
            styles.line,
            {
              backgroundColor: layer.fill,
              height: Math.max(layer.strokeWidth, 4),
            },
          ]}
        />
      </View>
    );
  }
  return (
    <View
      style={[
        styles.fill,
        {
          backgroundColor: layer.fill,
          borderColor: layer.stroke,
          borderRadius:
            layer.shape === 'circle'
              ? 999
              : layer.shape === 'rounded'
                ? 18
                : 0,
          borderWidth: layer.strokeWidth,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  stage: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  canvas: {
    elevation: 8,
    overflow: 'hidden',
    shadowColor: colors.black,
    shadowOffset: { height: 10, width: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
  },
  layer: {
    position: 'absolute',
  },
  fill: {
    height: '100%',
    width: '100%',
  },
  backgroundImage: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  croppedMedia: {
    position: 'absolute',
  },
  mediaFrame: {
    height: '100%',
    overflow: 'hidden',
    width: '100%',
  },
  placeholder: {
    alignItems: 'center',
    backgroundColor: '#CFCFCF',
    flex: 1,
    justifyContent: 'center',
  },
  placeholderPlus: {
    alignItems: 'center',
    backgroundColor: 'rgba(20,20,20,0.66)',
    borderRadius: radius.pill,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  placeholderText: {
    color: '#4A4A4A',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 6,
  },
  videoBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: radius.pill,
    height: 34,
    justifyContent: 'center',
    left: '50%',
    marginLeft: -17,
    marginTop: -17,
    position: 'absolute',
    top: '50%',
    width: 34,
  },
  videoPoster: {
    backgroundColor: '#272727',
  },
  textFrame: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  selectionBorder: {
    borderColor: colors.white,
    borderWidth: 1.5,
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  contextPill: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    position: 'absolute',
    right: 0,
    top: -48,
  },
  handle: {
    backgroundColor: colors.white,
    borderColor: '#BDBDBD',
    borderRadius: 9,
    borderWidth: 1,
    height: 18,
    position: 'absolute',
    width: 18,
  },
  handleTopLeft: {
    left: -9,
    top: -9,
  },
  handleTopRight: {
    right: -9,
    top: -9,
  },
  handleBottomLeft: {
    bottom: -9,
    left: -9,
  },
  handleBottomRight: {
    bottom: -9,
    right: -9,
  },
  gridVertical: {
    backgroundColor: 'rgba(255,255,255,0.35)',
    bottom: 0,
    position: 'absolute',
    top: 0,
    width: StyleSheet.hairlineWidth,
  },
  gridHorizontal: {
    backgroundColor: 'rgba(255,255,255,0.35)',
    height: StyleSheet.hairlineWidth,
    left: 0,
    position: 'absolute',
    right: 0,
  },
  safeArea: {
    borderColor: 'rgba(255,255,255,0.55)',
    borderStyle: 'dashed',
    borderWidth: 1,
    position: 'absolute',
  },
  lineFrame: {
    justifyContent: 'center',
  },
  line: {
    borderRadius: radius.pill,
    width: '100%',
  },
});
