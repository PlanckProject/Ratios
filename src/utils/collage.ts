import { getExportDimensions } from '../constants/ratios';
import type {
  AspectRatioId,
  CollageDocument,
  CollageLayer,
  CollageProject,
  CollageTemplate,
  LayerTransform,
  MediaKind,
  MediaLayer,
  ShapeLayer,
  TextLayer,
} from '../types/collage';

const APP_VERSION = '1.0.0';

export function createId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

function timestamp(): string {
  return new Date().toISOString();
}

function baseLayer(
  type: CollageLayer['type'],
  name: string,
  transform: Partial<CollageLayer['transform']> = {},
): Omit<CollageLayer, 'type'> & { type: CollageLayer['type'] } {
  const now = timestamp();
  return {
    id: createId(type),
    type,
    name,
    zIndex: 0,
    visible: true,
    locked: false,
    opacity: 1,
    blendMode: 'normal',
    transform: {
      x: 0.1,
      y: 0.1,
      width: 0.8,
      height: 0.4,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      anchorX: 0.5,
      anchorY: 0.5,
      ...transform,
    },
    timing: {
      startMs: 0,
      endMs: 8000,
    },
    animations: {},
    metadata: {
      createdAt: now,
      updatedAt: now,
      tags: [],
    },
  } as Omit<CollageLayer, 'type'> & { type: CollageLayer['type'] };
}

export function createMediaLayer(
  mediaKind: MediaKind = 'any',
  transform: Partial<MediaLayer['transform']> = {},
): MediaLayer {
  return {
    ...baseLayer('media', mediaKind === 'video' ? 'Video' : 'Media', transform),
    type: 'media',
    mediaKind,
    fit: 'cover',
    crop: {
      x: 0.5,
      y: 0.5,
      zoom: 1,
      aspectRatio: 'free',
      flipX: false,
      flipY: false,
    },
    frame: {
      shape: 'rectangle',
      borderRadius: 0,
      borderWidth: 0,
      borderColor: '#FFFFFF',
    },
    playback: {
      muted: true,
      loop: true,
      speed: 1,
      trimStartMs: 0,
    },
  };
}

export function createTextLayer(text = 'Double tap to edit'): TextLayer {
  return {
    ...baseLayer('text', 'Text', {
      x: 0.15,
      y: 0.4,
      width: 0.7,
      height: 0.18,
    }),
    type: 'text',
    text,
    style: {
      fontFamily: 'System',
      fontSize: 30,
      fontWeight: '600',
      fontStyle: 'normal',
      color: '#FFFFFF',
      textAlign: 'center',
      letterSpacing: 0,
      lineHeight: 36,
      textTransform: 'none',
      strokeColor: '#000000',
      strokeWidth: 0,
      backgroundColor: 'transparent',
      padding: 4,
      borderRadius: 0,
      shadow: {
        color: '#000000',
        opacity: 0.25,
        radius: 4,
        offsetX: 0,
        offsetY: 2,
      },
    },
  };
}

export function createShapeLayer(): ShapeLayer {
  return {
    ...baseLayer('shape', 'Shape', {
      x: 0.2,
      y: 0.25,
      width: 0.6,
      height: 0.3,
    }),
    type: 'shape',
    shape: 'rounded',
    fill: '#DDFC72',
    stroke: '#FFFFFF',
    strokeWidth: 0,
  };
}

export function normalizeLayerOrder(layers: CollageLayer[]): CollageLayer[] {
  return layers.map((layer, index) => ({
    ...layer,
    zIndex: index,
    metadata: {
      ...layer.metadata,
      updatedAt: timestamp(),
    },
  }));
}

export function calculateRequirements(layers: CollageLayer[]): CollageDocument['requirements'] {
  return {
    imageCount: layers.filter((layer) => layer.type === 'media' && layer.mediaKind === 'image').length,
    videoCount: layers.filter((layer) => layer.type === 'media' && layer.mediaKind === 'video').length,
    flexibleMediaCount: layers.filter((layer) => layer.type === 'media' && layer.mediaKind === 'any').length,
    textCount: layers.filter((layer) => layer.type === 'text').length,
    layerCount: layers.length,
  };
}

export function totalMediaRequirements(
  requirements: CollageDocument['requirements'],
): number {
  return (
    requirements.imageCount +
    requirements.videoCount +
    requirements.flexibleMediaCount
  );
}

export function createBlankProject(
  name = 'Untitled collage',
  aspectRatio: AspectRatioId = '4:5',
): CollageProject {
  const dimensions = getExportDimensions(aspectRatio);
  const now = timestamp();
  return {
    schemaVersion: 1,
    documentType: 'collage-project',
    id: createId('project'),
    name,
    description: '',
    createdAt: now,
    updatedAt: now,
    appVersion: APP_VERSION,
    canvas: {
      aspectRatio,
      width: dimensions.width,
      height: dimensions.height,
      pageCount: 1,
      pageOrder: [0],
      durationMs: 8000,
      fps: 30,
      background: {
        type: 'color',
        color: '#E8E4DC',
        blur: 0,
      },
      safeArea: {
        top: 0.04,
        right: 0.04,
        bottom: 0.04,
        left: 0.04,
      },
    },
    layers: [],
    requirements: {
      imageCount: 0,
      videoCount: 0,
      flexibleMediaCount: 0,
      textCount: 0,
      layerCount: 0,
    },
    editor: {
      snapMediaSize: true,
      gridSize: 12,
      showGrid: false,
      showSafeArea: false,
      zoom: 1,
    },
    metadata: {
      author: 'You',
      category: 'Custom',
      tags: [],
      locale: 'en',
    },
  };
}

export function getPageOrder(document: CollageDocument): number[] {
  const pageCount = Math.max(1, document.canvas.pageCount ?? 1);
  const configured = document.canvas.pageOrder ?? [];
  const seen = new Set<number>();
  const order: number[] = [];

  for (const page of configured) {
    if (Number.isInteger(page) && page >= 0 && page < pageCount && !seen.has(page)) {
      seen.add(page);
      order.push(page);
    }
  }
  for (let page = 0; page < pageCount; page += 1) {
    if (!seen.has(page)) {
      order.push(page);
    }
  }
  return order;
}

export function updateDocumentLayers<TDocument extends CollageDocument>(
  document: TDocument,
  layers: CollageLayer[],
): TDocument {
  const orderedLayers = normalizeLayerOrder(layers);
  return {
    ...document,
    layers: orderedLayers,
    requirements: calculateRequirements(orderedLayers),
    updatedAt: timestamp(),
  };
}

const PAGE_SNAP_THRESHOLD = 0.045;
const LAYER_SNAP_THRESHOLD = 0.04;

function pageGuides(document: CollageDocument, axis: 'x' | 'y'): number[] {
  if (axis === 'y') {
    return [0, 0.5, 1];
  }
  const pageCount = Math.max(1, document.canvas.pageCount ?? 1);
  const guides: number[] = [];
  for (let page = 0; page < pageCount; page += 1) {
    guides.push(page, page + 0.5);
  }
  guides.push(Math.ceil(pageCount));
  return guides;
}

function layerGuides(
  layers: CollageLayer[],
  axis: 'x' | 'y',
): number[] {
  const guides: number[] = [];
  for (const layer of layers) {
    const start = axis === 'x' ? layer.transform.x : layer.transform.y;
    const size = axis === 'x' ? layer.transform.width : layer.transform.height;
    guides.push(start, start + size / 2, start + size);
  }
  return guides;
}

function nearestSnapDelta(
  points: number[],
  candidates: number[],
  threshold: number,
): number | null {
  let bestDelta = 0;
  let bestDistance = threshold;
  let found = false;
  for (const point of points) {
    for (const candidate of candidates) {
      const delta = candidate - point;
      const distance = Math.abs(delta);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestDelta = delta;
        found = true;
      }
    }
  }
  return found ? bestDelta : null;
}

function snapDelta(
  points: number[],
  pageCandidates: number[],
  layerCandidates: number[],
): number {
  return (
    nearestSnapDelta(points, pageCandidates, PAGE_SNAP_THRESHOLD) ??
    nearestSnapDelta(points, layerCandidates, LAYER_SNAP_THRESHOLD) ??
    0
  );
}

export function snapLayerTransform(
  document: CollageDocument,
  layerId: string,
  transform: LayerTransform,
): LayerTransform {
  if (!document.editor.snapMediaSize) {
    return transform;
  }

  const currentTransform = document.layers.find((layer) => layer.id === layerId)?.transform;
  const otherLayers = document.layers.filter(
    (layer) => layer.id !== layerId && layer.visible,
  );
  const xPage = pageGuides(document, 'x');
  const yPage = pageGuides(document, 'y');
  const xLayers = layerGuides(otherLayers, 'x');
  const yLayers = layerGuides(otherLayers, 'y');

  const left = transform.x;
  const width = Math.max(transform.width, 0.01);
  const centerX = left + width / 2;
  const right = left + width;
  const top = transform.y;
  const height = Math.max(transform.height, 0.01);
  const centerY = top + height / 2;
  const bottom = top + height;

  const widthChanged = currentTransform
    ? Math.abs(transform.width - currentTransform.width) > 1e-6
    : false;
  const heightChanged = currentTransform
    ? Math.abs(transform.height - currentTransform.height) > 1e-6
    : false;
  const leftChanged = currentTransform
    ? Math.abs(transform.x - currentTransform.x) > 1e-6
    : false;
  const topChanged = currentTransform
    ? Math.abs(transform.y - currentTransform.y) > 1e-6
    : false;

  let nextX = transform.x;
  let nextY = transform.y;
  let nextWidth = width;
  let nextHeight = height;

  if (!widthChanged) {
    nextX += snapDelta([left, centerX, right], xPage, xLayers);
  } else if (leftChanged) {
    const delta = snapDelta([left], xPage, xLayers);
    nextX += delta;
    nextWidth -= delta;
  } else {
    nextWidth += snapDelta([right], xPage, xLayers);
  }

  if (!heightChanged) {
    nextY += snapDelta([top, centerY, bottom], yPage, yLayers);
  } else if (topChanged) {
    const delta = snapDelta([top], yPage, yLayers);
    nextY += delta;
    nextHeight -= delta;
  } else {
    nextHeight += snapDelta([bottom], yPage, yLayers);
  }

  return {
    ...transform,
    x: nextX,
    y: nextY,
    width: Math.max(0.01, nextWidth),
    height: Math.max(0.01, nextHeight),
  };
}

export function instantiateTemplate(
  template: CollageTemplate,
  name = template.name,
): CollageProject {
  const now = timestamp();
  const layers = normalizeLayerOrder(
    template.layers.map((layer) => ({
      ...layer,
      id: createId(layer.type),
      metadata: {
        ...layer.metadata,
        createdAt: now,
        updatedAt: now,
      },
    })),
  );

  return {
    ...template,
    id: createId('project'),
    documentType: 'collage-project',
    name,
    createdAt: now,
    updatedAt: now,
    layers,
    requirements: calculateRequirements(layers),
    metadata: {
      ...template.metadata,
      sourceTemplateId: template.id,
      author: 'You',
    },
  };
}

export function duplicateProject(project: CollageProject): CollageProject {
  const now = timestamp();
  const layers = project.layers.map((layer) => ({
    ...layer,
    id: createId(layer.type),
    metadata: {
      ...layer.metadata,
      createdAt: now,
      updatedAt: now,
    },
  }));

  return {
    ...project,
    id: createId('project'),
    name: `${project.name} copy`,
    createdAt: now,
    updatedAt: now,
    layers: normalizeLayerOrder(layers),
  };
}

export function projectToTemplate(project: CollageProject): CollageTemplate {
  const now = timestamp();
  const layers = project.layers.map((layer) => {
    if (layer.type !== 'media' || layer.source?.role !== 'user') {
      return layer;
    }
    return {
      ...layer,
      source: undefined,
    };
  });

  return {
    ...project,
    id: createId('template'),
    documentType: 'collage-template',
    name: `${project.name} template`,
    createdAt: now,
    updatedAt: now,
    layers,
    requirements: calculateRequirements(layers),
    metadata: {
      ...project.metadata,
      author: 'You',
      category: project.metadata.category || 'Custom',
      sourceTemplateId: undefined,
      previewUri: undefined,
    },
  };
}

export function changeCanvasRatio<TDocument extends CollageDocument>(
  document: TDocument,
  aspectRatio: AspectRatioId,
): TDocument {
  const dimensions = getExportDimensions(aspectRatio);
  return {
    ...document,
    canvas: {
      ...document.canvas,
      aspectRatio,
      width: dimensions.width,
      height: dimensions.height,
    },
    updatedAt: timestamp(),
  };
}

export function gridLayers(
  preset: 'two-columns' | 'two-rows' | 'four-grid' | 'feature',
): MediaLayer[] {
  const gap = 0.012;
  const groupId = createId('grid');
  const transforms: Array<Pick<MediaLayer['transform'], 'x' | 'y' | 'width' | 'height'>> =
    preset === 'two-columns'
      ? [
          { x: 0, y: 0, width: 0.5 - gap / 2, height: 1 },
          { x: 0.5 + gap / 2, y: 0, width: 0.5 - gap / 2, height: 1 },
        ]
      : preset === 'two-rows'
        ? [
            { x: 0, y: 0, width: 1, height: 0.5 - gap / 2 },
            { x: 0, y: 0.5 + gap / 2, width: 1, height: 0.5 - gap / 2 },
          ]
        : preset === 'feature'
          ? [
              { x: 0, y: 0, width: 0.62, height: 1 },
              { x: 0.62 + gap, y: 0, width: 0.38 - gap, height: 0.5 - gap / 2 },
              {
                x: 0.62 + gap,
                y: 0.5 + gap / 2,
                width: 0.38 - gap,
                height: 0.5 - gap / 2,
              },
            ]
          : [
              { x: 0, y: 0, width: 0.5 - gap / 2, height: 0.5 - gap / 2 },
              {
                x: 0.5 + gap / 2,
                y: 0,
                width: 0.5 - gap / 2,
                height: 0.5 - gap / 2,
              },
              {
                x: 0,
                y: 0.5 + gap / 2,
                width: 0.5 - gap / 2,
                height: 0.5 - gap / 2,
              },
              {
                x: 0.5 + gap / 2,
                y: 0.5 + gap / 2,
                width: 0.5 - gap / 2,
                height: 0.5 - gap / 2,
              },
            ];

  return transforms.map((transform, index) => ({
    ...createMediaLayer('any', transform),
    name: `Grid slot ${index + 1}`,
    groupId,
  }));
}
