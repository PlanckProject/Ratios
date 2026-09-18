import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { ASPECT_RATIOS } from '../constants/ratios';
import { colors, radius } from '../constants/theme';
import type {
  CollageDocument,
  CollageLayer,
  LayerTransform,
} from '../types/collage';
import { CollageCanvas } from './CollageCanvas';
import { IconButton } from './IconButton';

interface PageStripProps {
  document: CollageDocument;
  pageOrder: number[];
  focusedPageIndex: number;
  selectedLayerId: string | null;
  previewing: boolean;
  onFocusPage: (pageIndex: number) => void;
  onSelectLayer: (layerId: string | null) => void;
  onUpdateTransform: (layerId: string, transform: LayerTransform) => LayerTransform | void;
  onTransformStart: () => void;
  onTransformEnd: () => void;
  onRequestFill: (layerId: string) => void;
  onDuplicateLayer: (layerId: string) => void;
  onDeleteLayer: (layerId: string) => void;
  onToggleLock: (layerId: string) => void;
  snapEnabled: boolean;
  onToggleSnap: () => void;
  onAddPage: () => void;
  onDeletePage: (pageIndex: number) => void;
  onReorderPages: (fromPageIndex: number, toDisplayIndex: number) => void;
}

function distanceBetweenTouches(
  touches: readonly { pageX: number; pageY: number }[],
): number {
  const first = touches[0];
  const second = touches[1];
  if (!first || !second) {
    return 0;
  }
  return Math.hypot(second.pageX - first.pageX, second.pageY - first.pageY);
}

export function PageStrip({
  document,
  pageOrder,
  focusedPageIndex,
  selectedLayerId,
  previewing,
  onFocusPage,
  onSelectLayer,
  onUpdateTransform,
  onTransformStart,
  onTransformEnd,
  onRequestFill,
  onDuplicateLayer,
  onDeleteLayer,
  onToggleLock,
  snapEnabled,
  onToggleSnap,
  onAddPage,
  onDeletePage,
  onReorderPages,
}: PageStripProps): React.JSX.Element {
  const { width: windowWidth } = useWindowDimensions();
  const ratio = ASPECT_RATIOS[document.canvas.aspectRatio];
  const basePageWidth = Math.min(Math.max(windowWidth * 0.68, 220), 340);
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(1);
  const pinchStartZoom = useRef(1);
  const pinchStartDistance = useRef(0);
  const pageWidth = basePageWidth * zoom;
  const pageHeight = (pageWidth * ratio.height) / ratio.width;
  const pageCount = Math.max(1, document.canvas.pageCount ?? 1);
  const pageGap = 2;
  const sidePadding = Math.max(16, windowWidth / 2 - pageWidth / 2);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const scrollRef = useRef<ScrollView | null>(null);
  const viewportWidth = useRef(windowWidth);
  const lastTransform = useRef<LayerTransform | null>(null);

  const handleUpdateTransform = useCallback(
    (layerId: string, transform: LayerTransform) => {
      const applied = onUpdateTransform(layerId, transform);
      lastTransform.current = applied ?? transform;
      return applied;
    },
    [onUpdateTransform],
  );

  const handleTransformStart = useCallback(() => {
    lastTransform.current = null;
    setScrollEnabled(false);
    onTransformStart();
  }, [onTransformStart]);

  const handleTransformEnd = useCallback(() => {
    setScrollEnabled(true);
    const transform = lastTransform.current;
    lastTransform.current = null;
    if (transform) {
      const center = transform.x + transform.width / 2;
      const page = Math.min(Math.max(Math.floor(center), 0), Math.ceil(pageCount) - 1);
      const displayIndex = pageOrder.indexOf(page);
      if (page !== focusedPageIndex && displayIndex >= 0) {
        onFocusPage(page);
        scrollRef.current?.scrollTo({
          animated: false,
          x: Math.max(
            0,
            sidePadding + displayIndex * (pageWidth + pageGap) +
              Math.min(Math.max(center - page, 0), 1) * pageWidth -
              viewportWidth.current / 2,
          ),
        });
      }
    }
    onTransformEnd();
  }, [focusedPageIndex, onFocusPage, onTransformEnd, pageCount, pageOrder, pageWidth, sidePadding]);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const centerX =
      event.nativeEvent.contentOffset.x + event.nativeEvent.layoutMeasurement.width / 2;
    const displayIndex = Math.min(
      Math.max(
        Math.round((centerX - sidePadding - pageWidth / 2) / (pageWidth + pageGap)),
        0,
      ),
      pageOrder.length - 1,
    );
    const logicalPageIndex = pageOrder[displayIndex];
    if (logicalPageIndex !== undefined && logicalPageIndex !== focusedPageIndex) {
      onFocusPage(logicalPageIndex);
    }
  };

  const pinchResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_, gesture) =>
          gesture.numberActiveTouches >= 2,
        onPanResponderGrant: (event) => {
          pinchStartDistance.current = distanceBetweenTouches(
            event.nativeEvent.touches,
          );
          pinchStartZoom.current = zoomRef.current;
        },
        onPanResponderMove: (event) => {
          const currentDistance = distanceBetweenTouches(event.nativeEvent.touches);
          if (!pinchStartDistance.current || !currentDistance) {
            return;
          }
          const nextZoom = Math.min(
            Math.max(
              pinchStartZoom.current * (currentDistance / pinchStartDistance.current),
              0.35,
            ),
            5,
          );
          zoomRef.current = nextZoom;
          setZoom(nextZoom);
        },
        onPanResponderRelease: () => {
          pinchStartDistance.current = 0;
        },
        onPanResponderTerminate: () => {
          pinchStartDistance.current = 0;
        },
      }),
    [],
  );

  return (
    <View
      {...pinchResponder.panHandlers}
      onLayout={(event) => {
        viewportWidth.current = event.nativeEvent.layout.width;
      }}
      style={styles.root}
    >
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[
          styles.content,
          { paddingHorizontal: sidePadding },
        ]}
        canCancelContentTouches={!selectedLayerId}
        horizontal
        onScroll={handleScroll}
        scrollEventThrottle={16}
        scrollEnabled={scrollEnabled && !selectedLayerId}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
      >
        {pageOrder.map((logicalPageIndex, displayIndex) => (
          <PageSlot
            document={document}
            displayIndex={displayIndex}
            focused={focusedPageIndex === logicalPageIndex}
            key={logicalPageIndex}
            logicalPageIndex={logicalPageIndex}
            pageCount={pageCount}
            pageHeight={pageHeight}
            pageWidth={pageWidth}
            previewing={previewing}
            selectedLayerId={
              focusedPageIndex === logicalPageIndex ? selectedLayerId : null
            }
            snapEnabled={snapEnabled}
            onDeleteLayer={onDeleteLayer}
            onDeletePage={onDeletePage}
            onDuplicateLayer={onDuplicateLayer}
            onFocusPage={onFocusPage}
            onReorderPages={onReorderPages}
            onRequestFill={onRequestFill}
            onSelectLayer={onSelectLayer}
            onToggleLock={onToggleLock}
            onToggleSnap={onToggleSnap}
            onTransformEnd={handleTransformEnd}
            onTransformStart={handleTransformStart}
            onUpdateTransform={handleUpdateTransform}
          />
        ))}
        <Pressable
          accessibilityLabel="Add a new page"
          onPress={onAddPage}
          style={[styles.addPage, { height: pageHeight, width: pageWidth }]}
        >
          <Ionicons color={colors.textMuted} name="add" size={52} />
          <Text style={styles.addPageLabel}>Add page</Text>
        </Pressable>
      </ScrollView>
      <View pointerEvents="none" style={styles.zoomBadge}>
        <Ionicons color={colors.textMuted} name="search-outline" size={14} />
        <Text style={styles.zoomText}>{Math.round(zoom * 100)}%</Text>
      </View>
    </View>
  );
}

interface PageSlotProps {
  document: CollageDocument;
  displayIndex: number;
  logicalPageIndex: number;
  pageCount: number;
  pageWidth: number;
  pageHeight: number;
  focused: boolean;
  previewing: boolean;
  selectedLayerId: string | null;
  snapEnabled: boolean;
  onFocusPage: (pageIndex: number) => void;
  onSelectLayer: (layerId: string | null) => void;
  onUpdateTransform: (layerId: string, transform: LayerTransform) => LayerTransform | void;
  onTransformStart: () => void;
  onTransformEnd: () => void;
  onRequestFill: (layerId: string) => void;
  onDuplicateLayer: (layerId: string) => void;
  onDeleteLayer: (layerId: string) => void;
  onToggleLock: (layerId: string) => void;
  onToggleSnap: () => void;
  onDeletePage: (pageIndex: number) => void;
  onReorderPages: (fromPageIndex: number, toDisplayIndex: number) => void;
}

function PageSlot({
  document,
  displayIndex,
  logicalPageIndex,
  pageCount,
  pageWidth,
  pageHeight,
  focused,
  previewing,
  selectedLayerId,
  snapEnabled,
  onFocusPage,
  onSelectLayer,
  onUpdateTransform,
  onTransformStart,
  onTransformEnd,
  onRequestFill,
  onDuplicateLayer,
  onDeleteLayer,
  onToggleLock,
  onToggleSnap,
  onDeletePage,
  onReorderPages,
}: PageSlotProps): React.JSX.Element {
  const dragTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragging = useRef(false);
  const lastDropIndex = useRef(displayIndex);
  const [isDragging, setIsDragging] = useState(false);
  const pageGap = 2;
  const handleCanvasPress = useCallback(
    () => onFocusPage(logicalPageIndex),
    [logicalPageIndex, onFocusPage],
  );
  const handleSelectLayer = useCallback(
    (layerId: string | null) => {
      onFocusPage(logicalPageIndex);
      onSelectLayer(layerId);
    },
    [logicalPageIndex, onFocusPage, onSelectLayer],
  );

  const reorderResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          lastDropIndex.current = displayIndex;
          dragTimer.current = setTimeout(() => {
            dragging.current = true;
            setIsDragging(true);
            onFocusPage(logicalPageIndex);
          }, 360);
        },
        onPanResponderMove: (_, gesture) => {
          if (!dragging.current) {
            if (Math.abs(gesture.dx) > 8 || Math.abs(gesture.dy) > 8) {
              if (dragTimer.current) {
                clearTimeout(dragTimer.current);
                dragTimer.current = null;
              }
            }
            return;
          }
          const targetIndex = Math.min(
            Math.max(
              displayIndex + Math.round(gesture.dx / (pageWidth + pageGap)),
              0,
            ),
            pageCount - 1,
          );
          if (targetIndex !== lastDropIndex.current) {
            lastDropIndex.current = targetIndex;
            onReorderPages(logicalPageIndex, targetIndex);
          }
        },
        onPanResponderRelease: () => {
          const wasDragging = dragging.current;
          if (dragTimer.current) {
            clearTimeout(dragTimer.current);
            dragTimer.current = null;
          }
          dragging.current = false;
          setIsDragging(false);
          if (!wasDragging) {
            onFocusPage(logicalPageIndex);
            onSelectLayer(null);
          }
        },
        onPanResponderTerminate: () => {
          if (dragTimer.current) {
            clearTimeout(dragTimer.current);
            dragTimer.current = null;
          }
          dragging.current = false;
          setIsDragging(false);
        },
      }),
    [
      displayIndex,
      logicalPageIndex,
      onFocusPage,
      onReorderPages,
      onSelectLayer,
      pageCount,
      pageWidth,
    ],
  );

  return (
    <View
      style={[
        styles.pageSlot,
        { width: pageWidth },
        isDragging && styles.pageSlotDragging,
      ]}
    >
      <View style={styles.pageHeader}>
        <View {...reorderResponder.panHandlers} style={styles.pageHandle}>
          <Ionicons color={focused ? colors.accent : colors.textMuted} name="reorder-three" size={16} />
          <Text numberOfLines={1} style={[styles.pageLabel, focused && styles.pageLabelFocused]}>
            Page {displayIndex + 1}
          </Text>
        </View>
        <IconButton
          accessibilityLabel={`Delete page ${displayIndex + 1}`}
          icon="trash-outline"
          onPress={() => onDeletePage(logicalPageIndex)}
          size={17}
          style={styles.pageDelete}
          tone="danger"
        />
      </View>
      <CollageCanvas
        animate={previewing}
        document={document}
        editable
        maxHeight={pageHeight}
        onCanvasPress={handleCanvasPress}
        onDeleteLayer={onDeleteLayer}
        onDuplicateLayer={onDuplicateLayer}
        onRequestFill={onRequestFill}
        onSelectLayer={handleSelectLayer}
        onToggleLock={onToggleLock}
        onToggleSnap={onToggleSnap}
        onTransformEnd={onTransformEnd}
        onTransformStart={onTransformStart}
        onUpdateTransform={onUpdateTransform}
        pageCount={pageCount}
        pageIndex={logicalPageIndex}
        selectedLayerId={selectedLayerId}
        snapEnabled={snapEnabled}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: '100%',
  },
  content: {
    alignItems: 'flex-start',
    gap: 2,
    paddingBottom: 28,
    paddingTop: 12,
  },
  pageSlot: {
    overflow: 'visible',
    position: 'relative',
  },
  pageSlotDragging: {
    opacity: 0.72,
    transform: [{ scale: 0.97 }],
  },
  pageHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 38,
  },
  pageHandle: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 5,
    height: '100%',
    justifyContent: 'center',
  },
  pageLabel: {
    color: colors.textMuted,
    flexShrink: 1,
    fontSize: 11,
    fontWeight: '700',
  },
  pageLabelFocused: {
    color: colors.accent,
  },
  pageDelete: {
    height: 38,
    minHeight: 38,
    minWidth: 38,
    width: 38,
  },
  addPage: {
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderStyle: 'dashed',
    borderWidth: 2,
    justifyContent: 'center',
    marginTop: 38,
  },
  addPageLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 8,
  },
  zoomBadge: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    bottom: 10,
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    position: 'absolute',
    right: 14,
  },
  zoomText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
});
