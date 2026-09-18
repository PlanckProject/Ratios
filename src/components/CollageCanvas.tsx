import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  type PanResponderGestureState,
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
  pageIndex?: number;
  pageCount?: number;
  editable?: boolean;
  animate?: boolean;
  timelineMs?: number;
  videoFrameMs?: number;
  selectedLayerId?: string | null;
  onSelectLayer?: (layerId: string | null) => void;
  onUpdateTransform?: (layerId: string, transform: LayerTransform) => LayerTransform | void;
  onTransformStart?: () => void;
  onTransformEnd?: () => void;
  onRequestFill?: (layerId: string) => void;
  onDuplicateLayer?: (layerId: string) => void;
  onDeleteLayer?: (layerId: string) => void;
  onToggleLock?: (layerId: string) => void;
  snapEnabled?: boolean;
  onToggleSnap?: () => void;
  onCanvasPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

interface CanvasSize {
  width: number;
  height: number;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

export const CollageCanvas = memo(function CollageCanvas({
  document,
  maxHeight = 520,
  pageIndex = 0,
  pageCount: pageCountProp,
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
  snapEnabled = false,
  onToggleSnap,
  onCanvasPress,
  style,
}: CollageCanvasProps): React.JSX.Element {
  const [availableWidth, setAvailableWidth] = useState(0);
  const ratio = ASPECT_RATIOS[document.canvas.aspectRatio];
  const resolvedPageCount = Math.max(1, pageCountProp ?? document.canvas.pageCount ?? 1);
  const resolvedPageIndex = clamp(pageIndex, 0, resolvedPageCount - 1);
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
  const pageLayers = useMemo(
    () =>
      document.layers.filter(
        (layer) =>
          layer.visible &&
          (layerIsOnPage(layer, resolvedPageIndex) ||
            (editable && layer.id === selectedLayerId)) &&
          (timelineMs === undefined ||
            (timelineMs >= layer.timing.startMs && timelineMs <= layer.timing.endMs)),
      ),
    [document.layers, editable, resolvedPageIndex, selectedLayerId, timelineMs],
  );

  return (
    <View onLayout={handleLayout} style={[styles.stage, style]}>
      {canvasSize.width > 0 ? (
        <View
          style={[
            styles.canvas,
            {
              height: canvasSize.height,
              width: canvasSize.width,
            },
          ]}
        >
          <View
            pointerEvents="none"
            style={[
              styles.canvasSurface,
              { backgroundColor: document.canvas.background.color },
            ]}
          >
            {document.canvas.background.type === 'image' &&
            document.canvas.background.source ? (
              <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                <Image
                  blurRadius={document.canvas.background.blur}
                  resizeMode="cover"
                  source={{ uri: document.canvas.background.source.uri }}
                  style={styles.backgroundImage}
                />
              </View>
            ) : null}
            {pageLayers.map((layer) => (
              <EditableLayer
                animate={animate}
                canvasSize={canvasSize}
                key={layer.id}
                layer={layer}
                timelineMs={timelineMs}
                videoFrameMs={videoFrameMs}
                pageIndex={resolvedPageIndex}
                selected={selectedLayerId === layer.id}
              />
            ))}
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
          </View>
          {editable ? (
            <View pointerEvents="box-none" style={styles.editorOverlay}>
              <Pressable
                onPress={() => {
                  onCanvasPress?.();
                  onSelectLayer?.(null);
                }}
                style={StyleSheet.absoluteFill}
              />
              {pageLayers.map((layer) => (
                <LayerChrome
                  canvasSize={canvasSize}
                  key={`chrome-${layer.id}`}
                  layer={layer}
                  pageCount={resolvedPageCount}
                  pageIndex={resolvedPageIndex}
                  selected={selectedLayerId === layer.id}
                  onRequestFill={onRequestFill}
                  onSelect={onSelectLayer}
                  onTransformEnd={onTransformEnd}
                  onTransformStart={onTransformStart}
                  onUpdateTransform={onUpdateTransform}
                />
              ))}
            </View>
          ) : null}
          {editable && selectedLayerId ? (
            <SelectionActions
              layer={document.layers.find((layer) => layer.id === selectedLayerId) ?? null}
              onDelete={onDeleteLayer}
              onDuplicate={onDuplicateLayer}
              onToggleLock={onToggleLock}
              onToggleSnap={onToggleSnap}
              snapEnabled={snapEnabled}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
});

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

function layerIsOnPage(layer: CollageLayer, pageIndex: number): boolean {
  const layerEnd = layer.transform.x + layer.transform.width;
  return layer.visible && layerEnd > pageIndex && layer.transform.x < pageIndex + 1;
}

function layerFrameStyle(
  transform: LayerTransform,
  canvasSize: CanvasSize,
  pageIndex: number,
) {
  return {
    height: transform.height * canvasSize.height,
    left: (transform.x - pageIndex) * canvasSize.width,
    top: transform.y * canvasSize.height,
    width: transform.width * canvasSize.width,
  };
}

type ResizeCorner = 'nw' | 'ne' | 'sw' | 'se';

function resizeByCorner(
  origin: LayerTransform,
  corner: ResizeCorner,
  dx: number,
  dy: number,
): LayerTransform {
  let x = origin.x;
  let y = origin.y;
  let width = origin.width;
  let height = origin.height;

  if (corner === 'ne' || corner === 'se') {
    width = origin.width + dx;
  } else {
    width = origin.width - dx;
    x = origin.x + dx;
  }

  if (corner === 'sw' || corner === 'se') {
    height = origin.height + dy;
  } else {
    height = origin.height - dy;
    y = origin.y + dy;
  }

  if (width < 0.01) {
    if (corner === 'nw' || corner === 'sw') {
      x = origin.x + origin.width - 0.01;
    }
    width = 0.01;
  }
  if (height < 0.01) {
    if (corner === 'nw' || corner === 'ne') {
      y = origin.y + origin.height - 0.01;
    }
    height = 0.01;
  }

  return { ...origin, x, y, width, height };
}

interface EditableLayerProps {
  layer: CollageLayer;
  canvasSize: CanvasSize;
  pageIndex: number;
  animate: boolean;
  timelineMs?: number;
  videoFrameMs?: number;
  selected: boolean;
}

const EditableLayer = memo(function EditableLayer({
  layer,
  canvasSize,
  pageIndex,
  animate,
  timelineMs,
  videoFrameMs,
  selected,
}: EditableLayerProps): React.JSX.Element | null {
  if (!layerIsOnPage(layer, pageIndex)) {
    return null;
  }

  return (
    <View
      pointerEvents="none"
      style={[
        styles.layer,
        layerFrameStyle(layer.transform, canvasSize, pageIndex),
        {
          opacity: layer.opacity,
          transform: [
            { rotate: `${layer.transform.rotation}deg` },
            { scaleX: layer.transform.scaleX },
            { scaleY: layer.transform.scaleY },
          ],
          zIndex: selected ? 10000 + layer.zIndex : layer.zIndex,
        },
      ]}
    >
      <LayerContent
        animate={animate}
        canvasWidth={canvasSize.width}
        layer={layer}
        timelineMs={timelineMs}
        videoFrameMs={videoFrameMs}
      />
    </View>
  );
});

interface LayerChromeProps {
  layer: CollageLayer;
  canvasSize: CanvasSize;
  pageIndex: number;
  pageCount: number;
  selected: boolean;
  onSelect?: (layerId: string | null) => void;
  onUpdateTransform?: (layerId: string, transform: LayerTransform) => LayerTransform | void;
  onTransformStart?: () => void;
  onTransformEnd?: () => void;
  onRequestFill?: (layerId: string) => void;
}

const LayerChrome = memo(function LayerChrome({
  layer,
  canvasSize,
  pageIndex,
  pageCount,
  selected,
  onSelect,
  onUpdateTransform,
  onTransformStart,
  onTransformEnd,
  onRequestFill,
}: LayerChromeProps): React.JSX.Element | null {
  const layerRef = useRef(layer);
  layerRef.current = layer;
  const callbacks = {
    onSelect,
    onUpdateTransform,
    onTransformStart,
    onTransformEnd,
    onRequestFill,
  };
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;
  const origin = useRef(layer.transform);
  const [transforming, setTransforming] = useState(false);
  const canDrag = selected && !layer.locked;

  const finishGesture = useCallback(() => {
    setTransforming(false);
    callbacksRef.current.onTransformEnd?.();
  }, []);

  const responders = useMemo(() => {
    if (!canDrag) {
      return null;
    }

    const begin = () => {
      origin.current = { ...layerRef.current.transform };
      setTransforming(true);
      callbacksRef.current.onSelect?.(layerRef.current.id);
      callbacksRef.current.onTransformStart?.();
    };

    const delta = (gesture: PanResponderGestureState) => ({
      dx: gesture.dx / canvasSize.width,
      dy: gesture.dy / canvasSize.height,
    });

    const moveTo = (gesture: PanResponderGestureState) => {
      const { dx, dy } = delta(gesture);
      callbacksRef.current.onUpdateTransform?.(layerRef.current.id, {
        ...origin.current,
        x: clamp(origin.current.x + dx, -0.2, pageCount - 0.05),
        y: clamp(origin.current.y + dy, -0.2, 0.95),
      });
    };

    const createMove = () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () =>
          selected && !layerRef.current.locked,
        onMoveShouldSetPanResponder: () =>
          selected && !layerRef.current.locked,
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
        onPanResponderGrant: begin,
        onPanResponderMove: (_, gesture) => moveTo(gesture),
        onPanResponderRelease: (_, gesture) => {
          const { dx, dy } = delta(gesture);
          const moved = Math.abs(dx) + Math.abs(dy) > 0.004;
          if (moved) {
            moveTo(gesture);
          } else if (
            layerRef.current.type === 'media' &&
            !layerRef.current.source
          ) {
            callbacksRef.current.onRequestFill?.(layerRef.current.id);
          }
          finishGesture();
        },
        onPanResponderTerminate: finishGesture,
      });

    const createCorner = (corner: ResizeCorner) =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !layerRef.current.locked,
        onStartShouldSetPanResponderCapture: () => !layerRef.current.locked,
        onMoveShouldSetPanResponder: () => !layerRef.current.locked,
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
        onPanResponderGrant: begin,
        onPanResponderMove: (_, gesture) => {
          const { dx, dy } = delta(gesture);
          callbacksRef.current.onUpdateTransform?.(
            layerRef.current.id,
            resizeByCorner(origin.current, corner, dx, dy),
          );
        },
        onPanResponderRelease: (_, gesture) => {
          const { dx, dy } = delta(gesture);
          callbacksRef.current.onUpdateTransform?.(
            layerRef.current.id,
            resizeByCorner(origin.current, corner, dx, dy),
          );
          finishGesture();
        },
        onPanResponderTerminate: finishGesture,
      });

    const rotate = PanResponder.create({
      onStartShouldSetPanResponder: () => !layerRef.current.locked,
      onStartShouldSetPanResponderCapture: () => !layerRef.current.locked,
      onMoveShouldSetPanResponder: () => !layerRef.current.locked,
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onPanResponderGrant: begin,
      onPanResponderMove: (_, gesture) => {
        const { dx } = delta(gesture);
        callbacksRef.current.onUpdateTransform?.(layerRef.current.id, {
          ...origin.current,
          rotation: origin.current.rotation + dx * 180,
        });
      },
      onPanResponderRelease: (_, gesture) => {
        const { dx } = delta(gesture);
        callbacksRef.current.onUpdateTransform?.(layerRef.current.id, {
          ...origin.current,
          rotation: origin.current.rotation + dx * 180,
        });
        finishGesture();
      },
      onPanResponderTerminate: finishGesture,
    });

    return {
      move: createMove(),
      nw: createCorner('nw'),
      ne: createCorner('ne'),
      sw: createCorner('sw'),
      se: createCorner('se'),
      rotate,
    };
  }, [
    canDrag,
    canvasSize.height,
    canvasSize.width,
    finishGesture,
    pageCount,
    selected,
  ]);

  if (!layer.visible || (!transforming && !layerIsOnPage(layer, pageIndex))) {
    return null;
  }

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.layerChrome,
        layerFrameStyle(layer.transform, canvasSize, pageIndex),
        {
          transform: [
            { rotate: `${layer.transform.rotation}deg` },
            { scaleX: layer.transform.scaleX },
            { scaleY: layer.transform.scaleY },
          ],
          zIndex: selected ? 10000 + layer.zIndex : layer.zIndex,
        },
      ]}
    >
      {responders ? (
        <View
          collapsable={false}
          {...responders.move.panHandlers}
          style={StyleSheet.absoluteFill}
        />
      ) : (
        <Pressable
          onPress={() => onSelect?.(layer.id)}
          style={StyleSheet.absoluteFill}
        />
      )}
      {selected ? (
        <>
          <View pointerEvents="none" style={styles.selectionBorder} />
          {responders ? (
            <>
              <View
                {...responders.nw.panHandlers}
                hitSlop={12}
                style={[styles.handleHit, styles.handleHitTopLeft]}
              >
                <View pointerEvents="none" style={styles.handleKnob} />
              </View>
              <View
                {...responders.ne.panHandlers}
                hitSlop={12}
                style={[styles.handleHit, styles.handleHitTopRight]}
              >
                <View pointerEvents="none" style={styles.handleKnob} />
              </View>
              <View
                {...responders.sw.panHandlers}
                hitSlop={12}
                style={[styles.handleHit, styles.handleHitBottomLeft]}
              >
                <View pointerEvents="none" style={styles.handleKnob} />
              </View>
              <View
                {...responders.se.panHandlers}
                hitSlop={12}
                style={[styles.handleHit, styles.handleHitBottomRight]}
              >
                <View pointerEvents="none" style={styles.handleKnob} />
              </View>
              <View pointerEvents="none" style={styles.rotationStem} />
              <View
                {...responders.rotate.panHandlers}
                hitSlop={12}
                style={[styles.handleHit, styles.handleHitRotation]}
              >
                <View pointerEvents="none" style={styles.handleKnob} />
              </View>
            </>
          ) : null}
        </>
      ) : null}
    </View>
  );
});

function SelectionActions({
  layer,
  onDelete,
  onDuplicate,
  onToggleLock,
  onToggleSnap,
  snapEnabled,
}: {
  layer: CollageLayer | null;
  onDelete?: (layerId: string) => void;
  onDuplicate?: (layerId: string) => void;
  onToggleLock?: (layerId: string) => void;
  onToggleSnap?: () => void;
  snapEnabled: boolean;
}): React.JSX.Element | null {
  if (!layer) {
    return null;
  }

  return (
    <Animated.View style={styles.contextPill}>
      {layer.type !== 'media' ? (
        <Pressable
          accessibilityLabel="Delete layer"
          hitSlop={8}
          onPress={() => onDelete?.(layer.id)}
          style={styles.contextAction}
        >
          <Ionicons color={colors.accentInk} name="trash-outline" size={18} />
        </Pressable>
      ) : null}
      <Pressable
        accessibilityLabel={snapEnabled ? 'Disable snapping' : 'Enable snapping'}
        hitSlop={8}
        onPress={onToggleSnap}
        style={[styles.contextAction, snapEnabled && styles.contextActionActive]}
      >
        <Ionicons color={colors.accentInk} name="magnet-outline" size={18} />
      </Pressable>
      <Pressable
        accessibilityLabel="Duplicate layer"
        hitSlop={8}
        onPress={() => onDuplicate?.(layer.id)}
        style={styles.contextAction}
      >
        <Ionicons color={colors.accentInk} name="copy-outline" size={18} />
      </Pressable>
      <Pressable
        accessibilityLabel={layer.locked ? 'Unlock layer' : 'Lock layer'}
        hitSlop={8}
        onPress={() => onToggleLock?.(layer.id)}
        style={styles.contextAction}
      >
        <Ionicons
          color={colors.accentInk}
          name={layer.locked ? 'lock-closed' : 'lock-open-outline'}
          size={18}
        />
      </Pressable>
    </Animated.View>
  );
}

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
        <VideoLayerContent
          animate={animate}
          layer={layer}
          timelineMs={timelineMs ?? videoFrameMs}
        />
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
  animate,
  timelineMs,
}: {
  layer: MediaLayer;
  animate: boolean;
  timelineMs?: number;
}): React.JSX.Element {
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  const [manualPlayback, setManualPlayback] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const player = useVideoPlayer(layer.source?.uri ?? '', (instance) => {
    instance.loop = layer.playback.loop;
    instance.muted = layer.playback.muted;
    instance.playbackRate = layer.playback.speed;
    instance.currentTime = layer.playback.trimStartMs / 1000;
  });

  useEffect(() => {
    const subscription = player.addListener('playingChange', ({ isPlaying: nextPlaying }) => {
      setIsPlaying(nextPlaying);
    });
    return () => subscription.remove();
  }, [player]);

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
    } else if (appActive && (animate || manualPlayback)) {
      player.play();
    } else {
      player.pause();
    }
  }, [
    appActive,
    animate,
    layer.playback.loop,
    layer.playback.muted,
    layer.playback.speed,
    layer.playback.trimEndMs,
    layer.playback.trimStartMs,
    layer.source?.durationMs,
    layer.timing.startMs,
    player,
    manualPlayback,
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
      {!isPlaying && !animate && timelineMs === undefined ? (
        <Pressable
          accessibilityLabel="Play video"
          onPress={() => {
            setManualPlayback(true);
            player.play();
          }}
          style={styles.videoPlayButton}
        >
          <Ionicons color={colors.white} name="play" size={22} />
        </Pressable>
      ) : null}
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
    overflow: 'visible',
    position: 'relative',
    shadowColor: colors.black,
    shadowOffset: { height: 10, width: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
  },
  editorOverlay: {
    bottom: 0,
    left: 0,
    overflow: 'visible',
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 20,
  },
  canvasSurface: {
    bottom: 0,
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    right: 0,
    top: 0,
  },
  layer: {
    position: 'absolute',
  },
  layerChrome: {
    overflow: 'visible',
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
  videoPlayButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.62)',
    borderRadius: radius.pill,
    height: 52,
    justifyContent: 'center',
    left: '50%',
    marginLeft: -26,
    marginTop: -26,
    position: 'absolute',
    top: '50%',
    width: 52,
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
    elevation: 10,
    flexDirection: 'row',
    gap: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    position: 'absolute',
    right: 0,
    top: -48,
    zIndex: 40,
  },
  contextAction: {
    alignItems: 'center',
    borderRadius: radius.pill,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  contextActionActive: {
    backgroundColor: colors.accent,
  },
  handleHit: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    position: 'absolute',
    width: 44,
    zIndex: 30,
  },
  handleHitTopLeft: {
    left: -22,
    top: -22,
  },
  handleHitTopRight: {
    right: -22,
    top: -22,
  },
  handleHitBottomLeft: {
    bottom: -22,
    left: -22,
  },
  handleHitBottomRight: {
    bottom: -22,
    right: -22,
  },
  handleHitRotation: {
    left: '50%',
    marginLeft: -22,
    top: -58,
  },
  handleKnob: {
    backgroundColor: colors.white,
    borderColor: '#BDBDBD',
    borderRadius: 10,
    borderWidth: 1,
    elevation: 4,
    height: 18,
    width: 18,
  },
  rotationStem: {
    backgroundColor: colors.white,
    height: 18,
    left: '50%',
    marginLeft: StyleSheet.hairlineWidth / -2,
    position: 'absolute',
    top: -18,
    width: StyleSheet.hairlineWidth,
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
