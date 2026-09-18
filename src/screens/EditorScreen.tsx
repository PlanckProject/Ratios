import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomSheet } from '../components/BottomSheet';
import { IconButton } from '../components/IconButton';
import { PageStrip } from '../components/PageStrip';
import { ASPECT_RATIOS, ASPECT_RATIO_IDS } from '../constants/ratios';
import { colors, radius } from '../constants/theme';
import { exportCollageJson } from '../services/jsonTransfer';
import { persistPickedAsset } from '../services/mediaStorage';
import { useCollages } from '../store/CollageProvider';
import type {
  AnimationType,
  AspectRatioId,
  CollageLayer,
  CollageProject,
  LayerTransform,
  MediaKind,
  MediaLayer,
  ShapeLayer,
  TextLayer,
} from '../types/collage';
import {
  changeCanvasRatio,
  createBlankProject,
  createId,
  createMediaLayer,
  createShapeLayer,
  createTextLayer,
  gridLayers,
  getPageOrder,
  projectToTemplate,
  snapLayerTransform,
  updateDocumentLayers,
} from '../utils/collage';

const SHEET_TITLES = {
  add: 'New layer',
  background: 'Background',
  layers: 'Layers',
  ratio: 'Canvas ratio',
  grid: 'Add a grid',
  text: 'Edit text',
  media: 'Crop',
  transform: 'Transform',
  shape: 'Shape',
  arrange: 'Arrange',
  json: 'Project JSON',
} as const;

type SheetId = keyof typeof SHEET_TITLES | null;

const BACKGROUND_COLORS = [
  '#F4F1EA',
  '#FFFFFF',
  '#D8D2C5',
  '#B9C5B2',
  '#7E8C93',
  '#6E5B4E',
  '#272727',
  '#000000',
];

const TEXT_COLORS = ['#FFFFFF', '#111111', '#DDFC72', '#FF9A7A', '#9DC5FF', '#D9B7FF'];
const SHAPE_COLORS = ['#DDFC72', '#FFFFFF', '#111111', '#FF9A7A', '#9DC5FF', '#D9B7FF'];
const TEXT_ANIMATIONS: AnimationType[] = ['none', 'fade', 'rise', 'pulse', 'typewriter'];

interface EditorScreenProps {
  projectId: string;
  onBack: () => void;
  onExport: () => void;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

export function EditorScreen({
  projectId,
  onBack,
  onExport,
}: EditorScreenProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { projects, updateProject } = useCollages();
  const sourceProject = projects.find((project) => project.id === projectId);
  const [document, setDocument] = useState<CollageProject>(
    () => sourceProject ?? createBlankProject('Missing project'),
  );
  const documentRef = useRef(document);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<SheetId>(null);
  const [past, setPast] = useState<CollageProject[]>([]);
  const [future, setFuture] = useState<CollageProject[]>([]);
  const transformSnapshot = useRef<CollageProject | null>(null);
  const transformChanged = useRef(false);
  const [textDraft, setTextDraft] = useState('');
  const [nameDraft, setNameDraft] = useState(document.name);
  const [previewing, setPreviewing] = useState(false);
  const [focusedPageIndex, setFocusedPageIndex] = useState(0);

  useEffect(() => {
    if (sourceProject && sourceProject.id !== documentRef.current.id) {
      documentRef.current = sourceProject;
      setDocument(sourceProject);
      setSelectedLayerId(null);
      setPast([]);
      setFuture([]);
      setFocusedPageIndex(0);
    }
  }, [sourceProject]);

  useEffect(() => {
    documentRef.current = document;
    if (!sourceProject || sourceProject === document) {
      return;
    }
    const timer = setTimeout(() => updateProject(document), 220);
    return () => clearTimeout(timer);
  }, [document, sourceProject, updateProject]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        updateProject(documentRef.current);
      }
    });
    return () => subscription.remove();
  }, [updateProject]);

  const selectedLayer = useMemo(
    () => document.layers.find((layer) => layer.id === selectedLayerId) ?? null,
    [document.layers, selectedLayerId],
  );

  const commit = useCallback((updater: (current: CollageProject) => CollageProject) => {
    const current = documentRef.current;
    const next = {
      ...updater(current),
      updatedAt: new Date().toISOString(),
    };
    setPast((items) => [...items.slice(-39), current]);
    setFuture([]);
    documentRef.current = next;
    setDocument(next);
  }, []);

  const updateLayer = useCallback(
    (layerId: string, updater: (layer: CollageLayer) => CollageLayer) => {
      commit((current) => {
        const nextLayers = current.layers.map((layer) => {
          if (layer.id !== layerId) {
            return layer;
          }
          const nextLayer = updater(layer);
          return {
            ...nextLayer,
            transform: snapLayerTransform(current, layerId, nextLayer.transform),
          };
        });
        return updateDocumentLayers(current, nextLayers);
      });
    },
    [commit],
  );

  const updateTransform = useCallback((layerId: string, transform: LayerTransform): LayerTransform => {
    transformChanged.current = true;
    const current = documentRef.current;
    const layer = current.layers.find((item) => item.id === layerId);
    const normalizedTransform = layer
      ? snapLayerTransform(current, layerId, {
          ...transform,
          width: Math.max(transform.width, 0.01),
          height: Math.max(transform.height, 0.01),
        })
      : transform;
    const next = {
      ...current,
      updatedAt: new Date().toISOString(),
      layers: current.layers.map((currentLayer) =>
        currentLayer.id === layerId
          ? {
              ...currentLayer,
              transform: normalizedTransform,
              metadata: {
                ...currentLayer.metadata,
                updatedAt: new Date().toISOString(),
              },
            }
          : currentLayer,
      ),
    };
    documentRef.current = next;
    setDocument(next);
    return normalizedTransform;
  }, []);

  const beginTransform = useCallback(() => {
    transformSnapshot.current = documentRef.current;
    transformChanged.current = false;
  }, []);

  const finishTransform = useCallback(() => {
    const snapshot = transformSnapshot.current;
    if (transformChanged.current && snapshot) {
      setPast((items) => [...items.slice(-39), snapshot]);
      setFuture([]);
    }
    transformSnapshot.current = null;
    transformChanged.current = false;
    updateProject(documentRef.current);
  }, [updateProject]);

  const undo = () => {
    const previous = past.at(-1);
    if (!previous) {
      return;
    }
    setPast((items) => items.slice(0, -1));
    setFuture((items) => [documentRef.current, ...items].slice(0, 40));
    documentRef.current = previous;
    setDocument(previous);
    setSelectedLayerId(null);
  };

  const redo = () => {
    const next = future[0];
    if (!next) {
      return;
    }
    setFuture((items) => items.slice(1));
    setPast((items) => [...items.slice(-39), documentRef.current]);
    documentRef.current = next;
    setDocument(next);
    setSelectedLayerId(null);
  };

  const closeEditor = () => {
    updateProject(documentRef.current);
    onBack();
  };

  const openExport = () => {
    updateProject(documentRef.current);
    onExport();
  };

  const pageCount = Math.max(1, document.canvas.pageCount ?? 1);
  const pageOrder = useMemo(() => getPageOrder(document), [document.canvas]);

  const addPage = () => {
    if (pageCount >= 20) {
      Alert.alert('Page limit reached', 'A project can contain up to 20 final pages.');
      return;
    }
    commit((current) => ({
      ...current,
      canvas: {
        ...current.canvas,
        pageCount: (current.canvas.pageCount ?? 1) + 1,
        pageOrder: [...getPageOrder(current), current.canvas.pageCount ?? 1],
      },
    }));
    setFocusedPageIndex(pageCount);
    setSelectedLayerId(null);
  };

  const deletePage = (pageIndexToDelete: number) => {
    if (pageCount <= 1) {
      return;
    }

    const hasContent = documentRef.current.layers.some((layer) => {
      const layerStart = layer.transform.x;
      const layerEnd = layerStart + layer.transform.width;
      return layerStart < pageIndexToDelete + 1 && layerEnd > pageIndexToDelete;
    });
    const nextPageCount = Math.max(pageCount - 1, 1);

    const performDelete = () => {
      commit((current) => {
        const nextLayers = current.layers
          .filter((layer) => {
            const layerStart = layer.transform.x;
            const layerEnd = layerStart + layer.transform.width;
            const fullyWithinPage =
              layerStart >= pageIndexToDelete && layerEnd <= pageIndexToDelete + 1;
            return !fullyWithinPage;
          })
          .map((layer) =>
            layer.transform.x >= pageIndexToDelete + 1
              ? {
                  ...layer,
                  transform: {
                    ...layer.transform,
                    x: layer.transform.x - 1,
                  },
                }
              : layer,
          );
        const nextPageOrder = getPageOrder(current)
          .filter((page) => page !== pageIndexToDelete)
          .map((page) => (page > pageIndexToDelete ? page - 1 : page));
        return updateDocumentLayers(
          {
            ...current,
            canvas: {
              ...current.canvas,
              pageCount: nextPageCount,
              pageOrder: nextPageOrder,
            },
          },
          nextLayers,
        );
      });
      setFocusedPageIndex((current) => {
        if (current === pageIndexToDelete) {
          return Math.min(current, nextPageCount - 1);
        }
        return current > pageIndexToDelete ? current - 1 : current;
      });
      setSelectedLayerId(null);
    };

    if (hasContent) {
      Alert.alert(
        'Delete page?',
        'This page contains media or design elements. Items fully contained on this page will be deleted; overlapping items will be kept.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete page', onPress: performDelete, style: 'destructive' },
        ],
      );
      return;
    }
    performDelete();
  };

  const reorderPages = (fromPageIndex: number, toDisplayIndex: number) => {
    commit((current) => {
      const nextPageOrder = [...getPageOrder(current)];
      const fromDisplayIndex = nextPageOrder.indexOf(fromPageIndex);
      if (fromDisplayIndex < 0 || fromDisplayIndex === toDisplayIndex) {
        return current;
      }
      const [page] = nextPageOrder.splice(fromDisplayIndex, 1);
      if (page === undefined) {
        return current;
      }
      nextPageOrder.splice(toDisplayIndex, 0, page);
      return {
        ...current,
        canvas: {
          ...current.canvas,
          pageOrder: nextPageOrder,
        },
      };
    });
  };

  const addLayer = (layer: CollageLayer) => {
    if (documentRef.current.layers.length >= 200) {
      Alert.alert('Layer limit reached', 'A collage can contain up to 200 layers.');
      return;
    }
    commit((current) => updateDocumentLayers(current, [...current.layers, layer]));
    setSelectedLayerId(layer.id);
  };

  const placeLayerOnPage = <T extends CollageLayer>(
    layer: T,
    targetPage = focusedPageIndex,
  ): T => ({
    ...layer,
    transform: {
      ...layer.transform,
      x: layer.transform.x + targetPage,
    },
  });

  const deleteLayer = useCallback(
    (layerId: string) => {
      commit((current) =>
        updateDocumentLayers(
          current,
          current.layers.filter((layer) => layer.id !== layerId),
        ),
      );
      setSelectedLayerId((selected) => (selected === layerId ? null : selected));
    },
    [commit],
  );

  const duplicateLayer = useCallback(
    (layerId: string) => {
      const source = documentRef.current.layers.find((layer) => layer.id === layerId);
      if (!source) {
        return;
      }
      const duplicate: CollageLayer = {
        ...source,
        id: createId(source.type),
        name: `${source.name} copy`,
        transform: {
          ...source.transform,
          x: clamp(source.transform.x + 0.035, -0.2, pageCount - 0.05),
          y: clamp(source.transform.y + 0.035, -0.2, 0.95),
        },
        metadata: {
          ...source.metadata,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      };
      addLayer(duplicate);
    },
    [commit, pageCount],
  );

  const toggleLayerLock = useCallback(
    (layerId: string) => {
      updateLayer(layerId, (layer) => ({ ...layer, locked: !layer.locked }));
    },
    [updateLayer],
  );

  const toggleLayerVisibility = (layerId: string) => {
    updateLayer(layerId, (layer) => ({ ...layer, visible: !layer.visible }));
  };

  const clearMedia = useCallback(
    (layerId: string) => {
      updateLayer(layerId, (layer) =>
        layer.type === 'media'
          ? {
              ...layer,
              name: layer.mediaKind === 'video' ? 'Video' : 'Media',
              source: undefined,
            }
          : layer,
      );
    },
    [updateLayer],
  );

  const toggleSnap = useCallback(() => {
    commit((current) => ({
      ...current,
      editor: {
        ...current.editor,
        snapMediaSize: !current.editor.snapMediaSize,
      },
    }));
  }, [commit]);

  const moveLayer = (layerId: string, destination: 'front' | 'back' | 'forward' | 'backward') => {
    commit((current) => {
      const layers = [...current.layers];
      const index = layers.findIndex((layer) => layer.id === layerId);
      if (index < 0) {
        return current;
      }
      const [layer] = layers.splice(index, 1);
      if (!layer) {
        return current;
      }
      const target =
        destination === 'front'
          ? layers.length
          : destination === 'back'
            ? 0
            : destination === 'forward'
              ? Math.min(index + 1, layers.length)
              : Math.max(index - 1, 0);
      layers.splice(target, 0, layer);
      return updateDocumentLayers(current, layers);
    });
  };

  const pickMedia = useCallback(
    async (kind: MediaKind, targetLayerId?: string) => {
      try {
        const currentPermission = await ImagePicker.getMediaLibraryPermissionsAsync();
        const permission = currentPermission.granted
          ? currentPermission
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          Alert.alert(
            'Photo access needed',
            'Allow photo library access to add images and videos to a collage.',
          );
          return;
        }

        const mediaTypes =
          kind === 'image'
            ? ImagePicker.MediaTypeOptions.Images
            : kind === 'video'
              ? ImagePicker.MediaTypeOptions.Videos
              : ImagePicker.MediaTypeOptions.All;
        const result = await ImagePicker.launchImageLibraryAsync({
          allowsEditing: false,
          allowsMultipleSelection: !targetLayerId,
          mediaTypes,
          quality: 1,
          videoMaxDuration: 120,
        });
        if (result.canceled) {
          return;
        }
        const [firstAsset] = result.assets;
        if (!firstAsset) {
          throw new Error('The selected media could not be read.');
        }

        const target = targetLayerId
          ? documentRef.current.layers.find((layer) => layer.id === targetLayerId)
          : null;
        if (target?.type === 'media') {
          const detectedKind: MediaKind =
            firstAsset.type === 'video' ? 'video' : 'image';
          const source = await persistPickedAsset(firstAsset);
          updateLayer(target.id, (layer) =>
            layer.type === 'media'
              ? {
                  ...layer,
                  mediaKind: detectedKind,
                  name:
                    firstAsset.fileName ??
                    (detectedKind === 'video' ? 'Video' : 'Image'),
                  source,
                }
              : layer,
          );
          setSelectedLayerId(target.id);
        } else {
          if (documentRef.current.layers.length + result.assets.length > 200) {
            Alert.alert('Layer limit reached', 'A collage can contain up to 200 layers.');
            return;
          }
          const newLayers: CollageLayer[] = [];
          for (const [index, asset] of result.assets.entries()) {
            const detectedKind: MediaKind = asset.type === 'video' ? 'video' : 'image';
            const source = await persistPickedAsset(asset);
            const layer = createMediaLayer(detectedKind, {
              x: focusedPageIndex + clamp(0.08 + (index % 3) * 0.12, -0.2, 0.95),
              y: clamp(0.12 + Math.floor(index / 3) * 0.1, -0.2, 0.95),
              width: result.assets.length === 1 ? 0.76 : 0.62,
              height: result.assets.length === 1 ? 0.56 : 0.46,
            });
            newLayers.push({
              ...layer,
              name:
                asset.fileName ?? (detectedKind === 'video' ? 'Video' : 'Image'),
              source,
            });
          }
          commit((current) =>
            updateDocumentLayers(current, [...current.layers, ...newLayers]),
          );
          setSelectedLayerId(newLayers.at(-1)?.id ?? null);
        }
        setSheet(null);
      } catch (error: unknown) {
        Alert.alert(
          'Unable to add media',
          error instanceof Error ? error.message : 'The media picker failed.',
        );
      }
    },
    [commit, focusedPageIndex, updateLayer],
  );

  const requestFill = useCallback(
    (layerId: string) => {
      const layer = documentRef.current.layers.find((item) => item.id === layerId);
      if (layer?.type === 'media') {
        void pickMedia(layer.mediaKind, layer.id);
      }
    },
    [pickMedia],
  );

  const addText = () => {
    const layer = placeLayerOnPage(createTextLayer('Your story'));
    addLayer(layer);
    setTextDraft(layer.text);
    setSheet('text');
  };

  const addShape = () => {
    const layer = placeLayerOnPage(createShapeLayer());
    addLayer(layer);
    setSheet('shape');
  };

  const applyGrid = (preset: Parameters<typeof gridLayers>[0]) => {
    const layers = gridLayers(preset).map((layer) => placeLayerOnPage(layer));
    if (documentRef.current.layers.length + layers.length > 200) {
      Alert.alert('Layer limit reached', 'This grid would exceed the 200-layer limit.');
      return;
    }
    commit((current) => updateDocumentLayers(current, [...current.layers, ...layers]));
    setSelectedLayerId(layers.at(-1)?.id ?? null);
    setSheet(null);
  };

  const openSelectedEditor = () => {
    if (!selectedLayer) {
      return;
    }
    if (selectedLayer.type === 'text') {
      setTextDraft(selectedLayer.text);
      setSheet('text');
    } else if (selectedLayer.type === 'media') {
      setSheet('media');
    } else {
      setSheet('shape');
    }
  };

  const openTransformEditor = () => {
    if (selectedLayer) {
      setSheet('transform');
    }
  };

  const setMediaAspect = (aspect: MediaLayer['crop']['aspectRatio']) => {
    if (selectedLayer?.type !== 'media') {
      return;
    }
    const currentDocument = documentRef.current;
    updateLayer(selectedLayer.id, (layer) => {
      if (layer.type !== 'media') {
        return layer;
      }
      let numericRatio: number | null = null;
      if (aspect === 'original' && layer.source?.width && layer.source.height) {
        numericRatio = layer.source.width / layer.source.height;
      } else if (aspect !== 'free') {
        const [width, heightValue] = aspect.split(':').map(Number);
        numericRatio = (width ?? 1) / (heightValue ?? 1);
      }
      const nextHeight = numericRatio
        ? Math.max(
            (layer.transform.width * currentDocument.canvas.width) /
              numericRatio /
              currentDocument.canvas.height,
            0.01,
          )
        : layer.transform.height;
      return {
        ...layer,
        crop: {
          ...layer.crop,
          aspectRatio: aspect,
        },
        transform: {
          ...layer.transform,
          height: nextHeight,
        },
      };
    });
  };

  const exportProject = async () => {
    try {
      await exportCollageJson(documentRef.current);
    } catch (error: unknown) {
      Alert.alert(
        'Export failed',
        error instanceof Error ? error.message : 'Unable to export the project.',
      );
    }
  };

  const exportTemplate = async () => {
    try {
      await exportCollageJson(projectToTemplate(documentRef.current));
    } catch (error: unknown) {
      Alert.alert(
        'Export failed',
        error instanceof Error ? error.message : 'Unable to export the template.',
      );
    }
  };

  if (!sourceProject) {
    return (
      <SafeAreaView style={styles.missing}>
        <Text style={styles.missingTitle}>Project not found</Text>
        <Pressable onPress={onBack} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Back to projects</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <View style={styles.topBar}>
        <IconButton icon="arrow-back" onPress={closeEditor} />
        <View style={styles.titleWrap}>
          <Text numberOfLines={1} style={styles.projectTitle}>
            {document.name}
          </Text>
          <Text style={styles.projectMeta}>
            {document.canvas.aspectRatio} · {pageCount} page{pageCount === 1 ? '' : 's'} ·{' '}
            {document.layers.length} layers
          </Text>
        </View>
        <View style={styles.topActions}>
          <IconButton
            icon={previewing ? 'pause' : 'play'}
            onPress={() => setPreviewing((value) => !value)}
          />
          <IconButton disabled={!past.length} icon="arrow-undo" onPress={undo} />
          <IconButton disabled={!future.length} icon="arrow-redo" onPress={redo} />
          <IconButton icon="share-outline" onPress={openExport} />
        </View>
      </View>

      <View style={styles.workspace}>
        <PageStrip
          document={document}
          focusedPageIndex={focusedPageIndex}
          onAddPage={addPage}
          onDeleteLayer={deleteLayer}
          onDeletePage={deletePage}
          onDuplicateLayer={duplicateLayer}
          onFocusPage={setFocusedPageIndex}
          onReorderPages={reorderPages}
          onRequestFill={requestFill}
          onSelectLayer={setSelectedLayerId}
          onToggleLock={toggleLayerLock}
          onToggleSnap={toggleSnap}
          onTransformEnd={finishTransform}
          onTransformStart={beginTransform}
          onUpdateTransform={updateTransform}
          pageOrder={pageOrder}
          previewing={previewing}
          selectedLayerId={selectedLayerId}
          snapEnabled={document.editor.snapMediaSize}
        />
      </View>

      <View style={[styles.dock, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        {selectedLayer ? (
          <>
            <DockAction
              icon={selectedLayer.type === 'text' ? 'text-outline' : 'options-outline'}
              label={selectedLayer.type === 'media' ? 'Crop' : 'Edit'}
              onPress={openSelectedEditor}
            />
            <DockAction
              icon="resize-outline"
              label="Transform"
              onPress={openTransformEditor}
            />
            <DockAction
              icon="layers-outline"
              label="Arrange"
              onPress={() => setSheet('arrange')}
            />
            <DockAction
              danger
              icon="trash-outline"
              label="Delete"
              onPress={() => deleteLayer(selectedLayer.id)}
            />
            {selectedLayer.type === 'media' ? (
              <DockAction
                icon="close-circle-outline"
                label="Clear"
                onPress={() => clearMedia(selectedLayer.id)}
              />
            ) : null}
            <IconButton
              icon="close"
              onPress={() => setSelectedLayerId(null)}
              style={styles.closeSelection}
              tone="surface"
            />
          </>
        ) : (
          <>
            <DockAction
              icon="color-palette-outline"
              label="Background"
              onPress={() => setSheet('background')}
            />
            <DockAction
              icon="layers-outline"
              label="Layers"
              onPress={() => setSheet('layers')}
            />
            <Pressable
              accessibilityLabel="Add a new layer"
              onPress={() => setSheet('add')}
              style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
            >
              <Ionicons color={colors.accentInk} name="add" size={38} />
            </Pressable>
            <DockAction
              icon="crop-outline"
              label="Ratio"
              onPress={() => setSheet('ratio')}
            />
            <DockAction icon="code-slash" label="JSON" onPress={() => setSheet('json')} />
          </>
        )}
      </View>

      {sheet ? (
        <BottomSheet onClose={() => setSheet(null)} title={SHEET_TITLES[sheet]}>
          {sheet === 'add' ? (
            <View style={styles.actionGrid}>
              <ActionTile
                icon="image-outline"
                label="Images"
                onPress={() => {
                  void pickMedia('image');
                }}
              />
              <ActionTile
                icon="play-outline"
                label="Video"
                onPress={() => {
                  void pickMedia('video');
                }}
              />
              <ActionTile icon="text-outline" label="Text" onPress={addText} />
              <ActionTile icon="grid-outline" label="Grid" onPress={() => setSheet('grid')} />
              <ActionTile icon="shapes-outline" label="Shape" onPress={addShape} />
            </View>
          ) : null}
          {sheet === 'background' ? (
            <>
              <Text style={styles.sheetLabel}>Canvas color</Text>
              <View style={styles.swatches}>
                {BACKGROUND_COLORS.map((color) => (
                  <Pressable
                    accessibilityLabel={`Set background to ${color}`}
                    key={color}
                    onPress={() =>
                      commit((current) => ({
                        ...current,
                        canvas: {
                          ...current.canvas,
                          background: {
                            ...current.canvas.background,
                            type: 'color',
                            color,
                          },
                        },
                      }))
                    }
                    style={[
                      styles.swatch,
                      { backgroundColor: color },
                      document.canvas.background.color === color && styles.swatchSelected,
                    ]}
                  />
                ))}
              </View>
              <Text style={styles.sheetLabel}>Guides</Text>
              <SettingRow
                active={document.editor.showGrid}
                icon="grid-outline"
                label="Rule of thirds"
                onPress={() =>
                  commit((current) => ({
                    ...current,
                    editor: {
                      ...current.editor,
                      showGrid: !current.editor.showGrid,
                    },
                  }))
                }
              />
              <SettingRow
                active={document.editor.showSafeArea}
                icon="scan-outline"
                label="Safe area"
                onPress={() =>
                  commit((current) => ({
                    ...current,
                    editor: {
                      ...current.editor,
                      showSafeArea: !current.editor.showSafeArea,
                    },
                  }))
                }
              />
              <Text style={styles.sheetHint}>
                Guides are visual only, so layers can move and overlap freely. Media size snapping is
                available when editing a media layer.
              </Text>
            </>
          ) : null}
          {sheet === 'layers' ? (
            <>
              <Text style={styles.sheetHint}>Top layers appear first. Use arrows for precise ordering.</Text>
              {[...document.layers].reverse().map((layer) => (
                <Pressable
                  key={layer.id}
                  onPress={() => setSelectedLayerId(layer.id)}
                  style={[
                    styles.layerRow,
                    selectedLayerId === layer.id && styles.layerRowSelected,
                    !layer.visible && styles.layerRowHidden,
                  ]}
                >
                  <View style={styles.layerIcon}>
                    <Ionicons color={colors.text} name={layerIcon(layer)} size={20} />
                  </View>
                  <View style={styles.layerCopy}>
                    <Text numberOfLines={1} style={styles.layerName}>
                      {layer.name}
                    </Text>
                    <Text style={styles.layerType}>{layer.type}</Text>
                  </View>
                  <IconButton
                    icon={layer.visible ? 'eye-outline' : 'eye-off-outline'}
                    onPress={() => toggleLayerVisibility(layer.id)}
                    size={18}
                  />
                  <IconButton
                    icon={layer.locked ? 'lock-closed' : 'lock-open-outline'}
                    onPress={() => toggleLayerLock(layer.id)}
                    size={18}
                  />
                  <IconButton
                    icon="arrow-up"
                    onPress={() => moveLayer(layer.id, 'forward')}
                    size={18}
                  />
                  <IconButton
                    icon="arrow-down"
                    onPress={() => moveLayer(layer.id, 'backward')}
                    size={18}
                  />
                </Pressable>
              ))}
              {!document.layers.length ? (
                <Text style={styles.emptySheet}>Add media, text, a shape, or a grid to begin.</Text>
              ) : null}
            </>
          ) : null}
          {sheet === 'ratio' ? (
            <View style={styles.ratioList}>
              {ASPECT_RATIO_IDS.map((id) => {
                const ratio = ASPECT_RATIOS[id];
                return (
                  <Pressable
                    key={id}
                    onPress={() => {
                      commit((current) => changeCanvasRatio(current, id));
                      setSheet(null);
                    }}
                    style={[
                      styles.ratioOption,
                      document.canvas.aspectRatio === id && styles.ratioOptionSelected,
                    ]}
                  >
                    <RatioGlyph id={id} />
                    <View style={styles.ratioOptionCopy}>
                      <Text style={styles.ratioOptionLabel}>{ratio.label}</Text>
                      <Text style={styles.ratioOptionUse}>{ratio.use}</Text>
                    </View>
                    {document.canvas.aspectRatio === id ? (
                      <Ionicons color={colors.accent} name="checkmark-circle" size={22} />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          ) : null}
          {sheet === 'grid' ? (
            <View style={styles.gridChoices}>
              <GridChoice label="Two columns" onPress={() => applyGrid('two-columns')} preset="columns" />
              <GridChoice label="Two rows" onPress={() => applyGrid('two-rows')} preset="rows" />
              <GridChoice label="Four grid" onPress={() => applyGrid('four-grid')} preset="four" />
              <GridChoice label="Feature" onPress={() => applyGrid('feature')} preset="feature" />
            </View>
          ) : null}
          {sheet === 'text' && selectedLayer?.type === 'text' ? (
            <>
              <TextInput
                multiline
                onChangeText={setTextDraft}
                placeholder="Enter text"
                placeholderTextColor={colors.textMuted}
                style={styles.textEditor}
                value={textDraft}
              />
              <Text style={styles.sheetLabel}>Size</Text>
              <View style={styles.chipRow}>
                {[22, 30, 42, 56].map((fontSize) => (
                  <ChoiceChip
                    active={selectedLayer.style.fontSize === fontSize}
                    key={fontSize}
                    label={`${fontSize}`}
                    onPress={() =>
                      updateLayer(selectedLayer.id, (layer) =>
                        layer.type === 'text'
                          ? {
                            ...layer,
                            style: {
                              ...layer.style,
                              fontSize,
                              lineHeight: Math.round(fontSize * 1.14),
                            },
                          }
                          : layer,
                      )
                    }
                  />
                ))}
              </View>
              <Text style={styles.sheetLabel}>Color</Text>
              <View style={styles.swatches}>
                {TEXT_COLORS.map((color) => (
                  <Pressable
                    key={color}
                    onPress={() =>
                      updateLayer(selectedLayer.id, (layer) =>
                        layer.type === 'text'
                          ? { ...layer, style: { ...layer.style, color } }
                          : layer,
                      )
                    }
                    style={[
                      styles.swatch,
                      { backgroundColor: color },
                      selectedLayer.style.color === color && styles.swatchSelected,
                    ]}
                  />
                ))}
              </View>
              <Text style={styles.sheetLabel}>Alignment</Text>
              <View style={styles.chipRow}>
                {(['left', 'center', 'right'] as const).map((alignment) => (
                  <ChoiceChip
                    active={selectedLayer.style.textAlign === alignment}
                    key={alignment}
                    label={alignment}
                    onPress={() =>
                      updateLayer(selectedLayer.id, (layer) =>
                        layer.type === 'text'
                          ? {
                            ...layer,
                            style: {
                              ...layer.style,
                              textAlign: alignment,
                            },
                          }
                          : layer,
                      )
                    }
                  />
                ))}
              </View>
              <Text style={styles.sheetLabel}>Animation</Text>
              <View style={styles.chipRow}>
                {TEXT_ANIMATIONS.map((animationType) => {
                  const active =
                    (selectedLayer.animations.loop ?? selectedLayer.animations.entrance)?.type ===
                    animationType;
                  return (
                    <ChoiceChip
                      active={active}
                      key={animationType}
                      label={animationType}
                      onPress={() =>
                        updateLayer(selectedLayer.id, (layer) => {
                          if (layer.type !== 'text') {
                            return layer;
                          }
                          return {
                            ...layer,
                            animations:
                              animationType === 'none'
                                ? {}
                                : {
                                  loop: {
                                    id: createId('animation'),
                                    type: animationType,
                                    enabled: true,
                                    durationMs: animationType === 'typewriter' ? 1200 : 650,
                                    delayMs: 0,
                                    easing: 'ease-in-out',
                                    loop: animationType === 'pulse' || animationType === 'fade',
                                    direction: 'alternate',
                                  },
                                },
                          };
                        })
                      }
                    />
                  );
                })}
              </View>
              <Pressable
                onPress={() => {
                  updateLayer(selectedLayer.id, (layer) =>
                    layer.type === 'text' ? { ...layer, text: textDraft } : layer,
                  );
                  setSheet(null);
                }}
                style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
              >
                <Text style={styles.primaryButtonText}>Apply text</Text>
              </Pressable>
            </>
          ) : null}
          {sheet === 'media' && selectedLayer?.type === 'media' ? (
            <>
              <Pressable
                onPress={() => {
                  void pickMedia(selectedLayer.mediaKind, selectedLayer.id);
                }}
                style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
              >
                <Ionicons color={colors.text} name="images-outline" size={19} />
                <Text style={styles.secondaryButtonText}>Replace media</Text>
              </Pressable>
              <Text style={styles.sheetLabel}>Fill mode</Text>
              <View style={styles.chipRow}>
                {(['cover', 'contain', 'fill'] as const).map((fit) => (
                  <ChoiceChip
                    active={selectedLayer.fit === fit}
                    key={fit}
                    label={fit}
                    onPress={() =>
                      updateLayer(selectedLayer.id, (layer) =>
                        layer.type === 'media' ? { ...layer, fit } : layer,
                      )
                    }
                  />
                ))}
              </View>
              <Text style={styles.sheetLabel}>Frame ratio</Text>
              <ScrollView
                contentContainerStyle={styles.chipRow}
                horizontal
                showsHorizontalScrollIndicator={false}
              >
                {(['free', 'original', '1:1', '4:5', '3:4', '16:9'] as const).map((aspect) => (
                  <ChoiceChip
                    active={selectedLayer.crop.aspectRatio === aspect}
                    key={aspect}
                    label={aspect}
                    onPress={() => setMediaAspect(aspect)}
                  />
                ))}
              </ScrollView>
              <Text style={styles.sheetLabel}>Crop controls</Text>
              <PropertyStepper
                label="Zoom"
                onDecrease={() =>
                  updateLayer(selectedLayer.id, (layer) =>
                    layer.type === 'media'
                      ? {
                        ...layer,
                        crop: {
                          ...layer.crop,
                          zoom: clamp(layer.crop.zoom - 0.1, 1, 4),
                        },
                      }
                      : layer,
                  )
                }
                onIncrease={() =>
                  updateLayer(selectedLayer.id, (layer) =>
                    layer.type === 'media'
                      ? {
                        ...layer,
                        crop: {
                          ...layer.crop,
                          zoom: clamp(layer.crop.zoom + 0.1, 1, 4),
                        },
                      }
                      : layer,
                  )
                }
                value={`${selectedLayer.crop.zoom.toFixed(1)}×`}
              />
              <PropertyStepper
                label="Horizontal crop"
                onDecrease={() =>
                  updateLayer(selectedLayer.id, (layer) =>
                    layer.type === 'media'
                      ? {
                        ...layer,
                        crop: {
                          ...layer.crop,
                          x: clamp(layer.crop.x - 0.1, 0, 1),
                        },
                      }
                      : layer,
                  )
                }
                onIncrease={() =>
                  updateLayer(selectedLayer.id, (layer) =>
                    layer.type === 'media'
                      ? {
                        ...layer,
                        crop: {
                          ...layer.crop,
                          x: clamp(layer.crop.x + 0.1, 0, 1),
                        },
                      }
                      : layer,
                  )
                }
                value={`${Math.round(selectedLayer.crop.x * 100)}%`}
              />
              <PropertyStepper
                label="Vertical crop"
                onDecrease={() =>
                  updateLayer(selectedLayer.id, (layer) =>
                    layer.type === 'media'
                      ? {
                        ...layer,
                        crop: {
                          ...layer.crop,
                          y: clamp(layer.crop.y - 0.1, 0, 1),
                        },
                      }
                      : layer,
                  )
                }
                onIncrease={() =>
                  updateLayer(selectedLayer.id, (layer) =>
                    layer.type === 'media'
                      ? {
                        ...layer,
                        crop: {
                          ...layer.crop,
                          y: clamp(layer.crop.y + 0.1, 0, 1),
                        },
                      }
                      : layer,
                  )
                }
                value={`${Math.round(selectedLayer.crop.y * 100)}%`}
              />
              <View style={styles.inlineActions}>
                <Pressable
                  onPress={() =>
                    updateLayer(selectedLayer.id, (layer) =>
                      layer.type === 'media'
                        ? {
                          ...layer,
                          crop: { ...layer.crop, flipX: !layer.crop.flipX },
                        }
                        : layer,
                    )
                  }
                  style={styles.inlineAction}
                >
                  <Ionicons color={colors.text} name="swap-horizontal" size={20} />
                  <Text style={styles.inlineActionText}>Flip X</Text>
                </Pressable>
                <Pressable
                  onPress={() =>
                    updateLayer(selectedLayer.id, (layer) =>
                      layer.type === 'media'
                        ? {
                          ...layer,
                          crop: { ...layer.crop, flipY: !layer.crop.flipY },
                        }
                        : layer,
                    )
                  }
                  style={styles.inlineAction}
                >
                  <Ionicons color={colors.text} name="swap-vertical" size={20} />
                  <Text style={styles.inlineActionText}>Flip Y</Text>
                </Pressable>
              </View>
            </>
          ) : null}
          {sheet === 'transform' && selectedLayer ? (
            <>
              <Text style={styles.sheetHint}>
                Drag the bottom-right handle on the selected layer to resize it freely. Use the
                handle above the layer to rotate it.
              </Text>
              <Text style={styles.sheetLabel}>Rotation</Text>
              <PropertyStepper
                label="Rotation"
                onDecrease={() =>
                  updateLayer(selectedLayer.id, (layer) => ({
                    ...layer,
                    transform: {
                      ...layer.transform,
                      rotation: layer.transform.rotation - 15,
                    },
                  }))
                }
                onIncrease={() =>
                  updateLayer(selectedLayer.id, (layer) => ({
                    ...layer,
                    transform: {
                      ...layer.transform,
                      rotation: layer.transform.rotation + 15,
                    },
                  }))
                }
                value={`${Math.round(selectedLayer.transform.rotation)}°`}
              />
              <Text style={styles.sheetLabel}>Scale</Text>
              <PropertyStepper
                label="Scale X"
                onDecrease={() =>
                  updateLayer(selectedLayer.id, (layer) => ({
                    ...layer,
                    transform: {
                      ...layer.transform,
                      scaleX: clamp(layer.transform.scaleX - 0.1, -1000, 1000),
                    },
                  }))
                }
                onIncrease={() =>
                  updateLayer(selectedLayer.id, (layer) => ({
                    ...layer,
                    transform: {
                      ...layer.transform,
                      scaleX: clamp(layer.transform.scaleX + 0.1, -1000, 1000),
                    },
                  }))
                }
                value={selectedLayer.transform.scaleX.toFixed(1)}
              />
              <PropertyStepper
                label="Scale Y"
                onDecrease={() =>
                  updateLayer(selectedLayer.id, (layer) => ({
                    ...layer,
                    transform: {
                      ...layer.transform,
                      scaleY: clamp(layer.transform.scaleY - 0.1, -1000, 1000),
                    },
                  }))
                }
                onIncrease={() =>
                  updateLayer(selectedLayer.id, (layer) => ({
                    ...layer,
                    transform: {
                      ...layer.transform,
                      scaleY: clamp(layer.transform.scaleY + 0.1, -1000, 1000),
                    },
                  }))
                }
                value={selectedLayer.transform.scaleY.toFixed(1)}
              />
            </>
          ) : null}
          {sheet === 'shape' && selectedLayer?.type === 'shape' ? (
            <>
              <Text style={styles.sheetLabel}>Shape</Text>
              <View style={styles.chipRow}>
                {(['rectangle', 'rounded', 'circle', 'line'] as const).map((shape) => (
                  <ChoiceChip
                    active={selectedLayer.shape === shape}
                    key={shape}
                    label={shape}
                    onPress={() =>
                      updateLayer(selectedLayer.id, (layer) =>
                        layer.type === 'shape' ? { ...layer, shape } : layer,
                      )
                    }
                  />
                ))}
              </View>
              <Text style={styles.sheetLabel}>Fill</Text>
              <View style={styles.swatches}>
                {SHAPE_COLORS.map((color) => (
                  <Pressable
                    key={color}
                    onPress={() =>
                      updateLayer(selectedLayer.id, (layer) =>
                        layer.type === 'shape' ? { ...layer, fill: color } : layer,
                      )
                    }
                    style={[
                      styles.swatch,
                      { backgroundColor: color },
                      selectedLayer.fill === color && styles.swatchSelected,
                    ]}
                  />
                ))}
              </View>
            </>
          ) : null}
          {sheet === 'arrange' && selectedLayer ? (
            <>
              <View style={styles.actionGrid}>
                <ActionTile
                  icon="play-forward-outline"
                  label="To front"
                  onPress={() => moveLayer(selectedLayer.id, 'front')}
                />
                <ActionTile
                  icon="play-back-outline"
                  label="To back"
                  onPress={() => moveLayer(selectedLayer.id, 'back')}
                />
                <ActionTile
                  icon="arrow-up-outline"
                  label="Forward"
                  onPress={() => moveLayer(selectedLayer.id, 'forward')}
                />
                <ActionTile
                  icon="arrow-down-outline"
                  label="Backward"
                  onPress={() => moveLayer(selectedLayer.id, 'backward')}
                />
              </View>
              <Text style={styles.sheetLabel}>Opacity</Text>
              <PropertyStepper
                label="Layer opacity"
                onDecrease={() =>
                  updateLayer(selectedLayer.id, (layer) => ({
                    ...layer,
                    opacity: clamp(layer.opacity - 0.1, 0.1, 1),
                  }))
                }
                onIncrease={() =>
                  updateLayer(selectedLayer.id, (layer) => ({
                    ...layer,
                    opacity: clamp(layer.opacity + 0.1, 0.1, 1),
                  }))
                }
                value={`${Math.round(selectedLayer.opacity * 100)}%`}
              />
            </>
          ) : null}
          {sheet === 'json' ? (
            <>
              <Text style={styles.sheetLabel}>Project name</Text>
              <TextInput
                onChangeText={setNameDraft}
                placeholder="Project name"
                placeholderTextColor={colors.textMuted}
                style={styles.nameInput}
                value={nameDraft}
              />
              <Pressable
                onPress={() =>
                  commit((current) => ({
                    ...current,
                    name: nameDraft.trim() || 'Untitled collage',
                  }))
                }
                style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
              >
                <Ionicons color={colors.text} name="checkmark" size={19} />
                <Text style={styles.secondaryButtonText}>Save name</Text>
              </Pressable>
              <View style={styles.exportCard}>
                <View style={styles.exportIcon}>
                  <Ionicons color={colors.accentInk} name="document-text-outline" size={24} />
                </View>
                <View style={styles.exportCopy}>
                  <Text style={styles.exportTitle}>Project JSON</Text>
                  <Text style={styles.exportMeta}>
                    Preserves the design and same-device media references, transforms, timing, and
                    editor state.
                  </Text>
                </View>
                <IconButton icon="share-outline" onPress={() => void exportProject()} tone="surface" />
              </View>
              <View style={styles.exportCard}>
                <View style={styles.exportIcon}>
                  <Ionicons color={colors.accentInk} name="albums-outline" size={24} />
                </View>
                <View style={styles.exportCopy}>
                  <Text style={styles.exportTitle}>Reusable template</Text>
                  <Text style={styles.exportMeta}>
                    Keeps the design and metadata while clearing device-local media.
                  </Text>
                </View>
                <IconButton icon="share-outline" onPress={() => void exportTemplate()} tone="surface" />
              </View>
              <Text style={styles.schemaNote}>
                Schema v1 uses one readable JSON document for both projects and templates. The
                documentType field is the only top-level distinction.
              </Text>
            </>
          ) : null}
        </BottomSheet>
      ) : null}
    </SafeAreaView>
  );
}

function DockAction({
  icon,
  label,
  onPress,
  danger = false,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
  danger?: boolean;
}): React.JSX.Element {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.dockAction, pressed && styles.pressed]}
    >
      <Ionicons color={danger ? colors.danger : colors.text} name={icon} size={23} />
      <Text style={[styles.dockLabel, danger && styles.danger]}>{label}</Text>
    </Pressable>
  );
}

function ActionTile({
  icon,
  label,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
}): React.JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.actionTile, pressed && styles.pressed]}
    >
      <View style={styles.actionIcon}>
        <Ionicons color={colors.text} name={icon} size={29} />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

function ChoiceChip({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}): React.JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.choiceChip,
        active && styles.choiceChipActive,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.choiceChipText, active && styles.choiceChipTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

function PropertyStepper({
  label,
  value,
  onDecrease,
  onIncrease,
}: {
  label: string;
  value: string;
  onDecrease: () => void;
  onIncrease: () => void;
}): React.JSX.Element {
  return (
    <View style={styles.stepper}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <View style={styles.stepperControls}>
        <IconButton icon="remove" onPress={onDecrease} size={18} tone="surface" />
        <Text style={styles.stepperValue}>{value}</Text>
        <IconButton icon="add" onPress={onIncrease} size={18} tone="surface" />
      </View>
    </View>
  );
}

function SettingRow({
  active,
  icon,
  label,
  onPress,
}: {
  active: boolean;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
}): React.JSX.Element {
  return (
    <Pressable onPress={onPress} style={styles.settingRow}>
      <Ionicons color={colors.text} name={icon} size={21} />
      <Text style={styles.settingLabel}>{label}</Text>
      <View style={[styles.toggle, active && styles.toggleActive]}>
        <View style={[styles.toggleThumb, active && styles.toggleThumbActive]} />
      </View>
    </Pressable>
  );
}

function GridChoice({
  label,
  preset,
  onPress,
}: {
  label: string;
  preset: 'columns' | 'rows' | 'four' | 'feature';
  onPress: () => void;
}): React.JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.gridChoice, pressed && styles.pressed]}
    >
      <View style={styles.gridPreview}>
        {preset === 'columns' ? (
          <>
            <View style={[styles.gridCell, { bottom: 0, left: 0, top: 0, width: '48%' }]} />
            <View style={[styles.gridCell, { bottom: 0, right: 0, top: 0, width: '48%' }]} />
          </>
        ) : null}
        {preset === 'rows' ? (
          <>
            <View style={[styles.gridCell, { height: '48%', left: 0, right: 0, top: 0 }]} />
            <View style={[styles.gridCell, { bottom: 0, height: '48%', left: 0, right: 0 }]} />
          </>
        ) : null}
        {preset === 'four' ? (
          <>
            <View style={[styles.gridCell, { height: '48%', left: 0, top: 0, width: '48%' }]} />
            <View style={[styles.gridCell, { height: '48%', right: 0, top: 0, width: '48%' }]} />
            <View style={[styles.gridCell, { bottom: 0, height: '48%', left: 0, width: '48%' }]} />
            <View style={[styles.gridCell, { bottom: 0, height: '48%', right: 0, width: '48%' }]} />
          </>
        ) : null}
        {preset === 'feature' ? (
          <>
            <View style={[styles.gridCell, { bottom: 0, left: 0, top: 0, width: '60%' }]} />
            <View style={[styles.gridCell, { height: '48%', right: 0, top: 0, width: '36%' }]} />
            <View style={[styles.gridCell, { bottom: 0, height: '48%', right: 0, width: '36%' }]} />
          </>
        ) : null}
      </View>
      <Text style={styles.gridChoiceLabel}>{label}</Text>
    </Pressable>
  );
}

function RatioGlyph({ id }: { id: AspectRatioId }): React.JSX.Element {
  const ratio = ASPECT_RATIOS[id];
  const aspect = ratio.width / ratio.height;
  let width = 36;
  let height = width / aspect;
  if (height > 46) {
    height = 46;
    width = height * aspect;
  }
  return <View style={[styles.ratioGlyph, { height, width }]} />;
}

function layerIcon(
  layer: CollageLayer,
): React.ComponentProps<typeof Ionicons>['name'] {
  if (layer.type === 'text') {
    return 'text-outline';
  }
  if (layer.type === 'shape') {
    return 'shapes-outline';
  }
  return layer.mediaKind === 'video' ? 'videocam-outline' : 'image-outline';
}

const styles = StyleSheet.create({
  safe: {
    backgroundColor: colors.background,
    flex: 1,
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 58,
    paddingHorizontal: 8,
  },
  titleWrap: {
    flex: 1,
    marginHorizontal: 4,
  },
  projectTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  projectMeta: {
    color: colors.textMuted,
    fontSize: 10,
    marginTop: 2,
    textAlign: 'center',
  },
  topActions: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  workspace: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    overflow: 'hidden',
    paddingHorizontal: 12,
    paddingVertical: 16,
  },
  dock: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    flexDirection: 'row',
    justifyContent: 'space-around',
    minHeight: 92,
    paddingHorizontal: 8,
    paddingTop: 10,
  },
  dockAction: {
    alignItems: 'center',
    flex: 1,
    gap: 5,
    justifyContent: 'center',
    minHeight: 58,
  },
  dockLabel: {
    color: colors.text,
    fontSize: 10,
    fontWeight: '600',
  },
  danger: {
    color: colors.danger,
  },
  addButton: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: 34,
    height: 66,
    justifyContent: 'center',
    marginHorizontal: 3,
    marginTop: -30,
    width: 66,
  },
  closeSelection: {
    height: 46,
    marginLeft: 2,
    width: 46,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingTop: 8,
  },
  actionTile: {
    alignItems: 'center',
    width: 78,
  },
  actionIcon: {
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.pill,
    height: 68,
    justifyContent: 'center',
    width: 68,
  },
  actionLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 7,
  },
  sheetLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 10,
    marginTop: 22,
    textTransform: 'uppercase',
  },
  sheetHint: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 12,
  },
  swatches: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  swatch: {
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 42,
    width: 42,
  },
  swatchSelected: {
    borderColor: colors.accent,
    borderWidth: 3,
  },
  settingRow: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minHeight: 54,
  },
  settingLabel: {
    color: colors.text,
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 11,
  },
  toggle: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    height: 28,
    padding: 3,
    width: 48,
  },
  toggleActive: {
    backgroundColor: colors.accent,
  },
  toggleThumb: {
    backgroundColor: colors.white,
    borderRadius: radius.pill,
    height: 22,
    width: 22,
  },
  toggleThumbActive: {
    alignSelf: 'flex-end',
    backgroundColor: colors.accentInk,
  },
  layerRow: {
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: 9,
    minHeight: 62,
    paddingHorizontal: 8,
  },
  layerRowSelected: {
    borderColor: colors.accent,
  },
  layerRowHidden: {
    opacity: 0.5,
  },
  layerIcon: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  layerCopy: {
    flex: 1,
    marginLeft: 10,
  },
  layerName: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  layerType: {
    color: colors.textMuted,
    fontSize: 10,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  emptySheet: {
    color: colors.textMuted,
    fontSize: 13,
    paddingVertical: 28,
    textAlign: 'center',
  },
  ratioList: {
    gap: 9,
  },
  ratioOption: {
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 66,
    paddingHorizontal: 14,
  },
  ratioOptionSelected: {
    borderColor: colors.accent,
  },
  ratioGlyph: {
    backgroundColor: colors.canvas,
    borderRadius: 2,
    marginRight: 16,
  },
  ratioOptionCopy: {
    flex: 1,
  },
  ratioOptionLabel: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  ratioOptionUse: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  gridChoices: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingTop: 6,
  },
  gridChoice: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    padding: 12,
    width: '47%',
  },
  gridPreview: {
    height: 112,
    position: 'relative',
  },
  gridCell: {
    backgroundColor: '#D7D7D7',
    borderRadius: 3,
    position: 'absolute',
  },
  gridChoiceLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 9,
  },
  textEditor: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    color: colors.text,
    fontSize: 18,
    minHeight: 96,
    padding: 13,
    textAlignVertical: 'top',
  },
  nameInput: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    color: colors.text,
    fontSize: 16,
    height: 52,
    paddingHorizontal: 13,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  choiceChip: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  choiceChipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  choiceChipText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  choiceChipTextActive: {
    color: colors.accentInk,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    marginTop: 22,
    paddingHorizontal: 18,
    paddingVertical: 15,
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
    marginTop: 12,
    paddingVertical: 13,
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  stepper: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minHeight: 58,
  },
  stepperLabel: {
    color: colors.text,
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  stepperControls: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  stepperValue: {
    color: colors.text,
    fontSize: 13,
    fontVariant: ['tabular-nums'],
    minWidth: 48,
    textAlign: 'center',
  },
  inlineActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 18,
  },
  inlineAction: {
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.sm,
    flex: 1,
    gap: 5,
    paddingVertical: 12,
  },
  inlineActionText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '700',
  },
  exportCard: {
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    flexDirection: 'row',
    marginTop: 14,
    padding: 13,
  },
  exportIcon: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  exportCopy: {
    flex: 1,
    marginHorizontal: 12,
  },
  exportTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  exportMeta: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 3,
  },
  schemaNote: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 18,
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
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },
});
