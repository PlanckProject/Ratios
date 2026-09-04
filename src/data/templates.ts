import type { CollageTemplate, MediaLayer, TextLayer } from '../types/collage';
import { getExportDimensions } from '../constants/ratios';
import { calculateRequirements, createMediaLayer, createTextLayer } from '../utils/collage';

const imageUris = [
  'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1493246507139-91e8fad9978e?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1494783367193-149034c05e8f?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1200&q=80',
];

function imageLayer(
  name: string,
  uri: string,
  transform: Partial<MediaLayer['transform']>,
  borderRadius = 0,
): MediaLayer {
  return {
    ...createMediaLayer('any', transform),
    name,
    source: {
      uri,
      role: 'placeholder',
    },
    frame: {
      shape: borderRadius > 0 ? 'rounded' : 'rectangle',
      borderRadius,
      borderWidth: 0,
      borderColor: '#FFFFFF',
    },
  };
}

function titleLayer(
  text: string,
  transform: Partial<TextLayer['transform']>,
  color = '#FFFFFF',
): TextLayer {
  const layer = createTextLayer(text);
  return {
    ...layer,
    transform: {
      ...layer.transform,
      ...transform,
    },
    style: {
      ...layer.style,
      color,
      fontSize: 34,
      lineHeight: 38,
      fontWeight: '600',
      letterSpacing: -0.5,
      shadow: {
        color: '#000000',
        opacity: 0.28,
        radius: 5,
        offsetX: 0,
        offsetY: 2,
      },
    },
    animations: {
      entrance: {
        id: 'title-rise',
        type: 'rise',
        enabled: true,
        durationMs: 500,
        delayMs: 120,
        easing: 'ease-out',
        loop: false,
        direction: 'normal',
      },
    },
  };
}

function template(
  id: string,
  name: string,
  category: string,
  aspectRatio: CollageTemplate['canvas']['aspectRatio'],
  background: string,
  layers: CollageTemplate['layers'],
  tags: string[],
): CollageTemplate {
  const now = '2026-01-01T00:00:00.000Z';
  const dimensions = getExportDimensions(aspectRatio);
  const orderedLayers = layers.map((layer, index) => ({ ...layer, zIndex: index }));

  return {
    schemaVersion: 1,
    documentType: 'collage-template',
    id,
    name,
    description: `${category} collage template`,
    createdAt: now,
    updatedAt: now,
    appVersion: '1.0.0',
    canvas: {
      aspectRatio,
      width: dimensions.width,
      height: dimensions.height,
      durationMs: 8000,
      fps: 30,
      background: {
        type: 'color',
        color: background,
        blur: 0,
      },
      safeArea: {
        top: 0.04,
        right: 0.04,
        bottom: 0.04,
        left: 0.04,
      },
    },
    layers: orderedLayers,
    requirements: calculateRequirements(orderedLayers),
    editor: {
      snapToGrid: true,
      gridSize: 12,
      showGrid: false,
      showSafeArea: false,
      zoom: 1,
    },
    metadata: {
      author: 'Ratios',
      category,
      tags,
      locale: 'en',
      coverLayerId: orderedLayers.at(-1)?.id,
    },
  };
}

export const BUILTIN_TEMPLATES: CollageTemplate[] = [
  template(
    'template-summer-windows',
    'Summer windows',
    'Travel',
    '4:5',
    '#D9D5CC',
    [
      imageLayer('Backdrop', imageUris[0]!, { x: 0, y: 0, width: 1, height: 1 }),
      imageLayer('Top memory', imageUris[1]!, { x: 0.12, y: 0.08, width: 0.46, height: 0.28 }, 8),
      imageLayer('Middle memory', imageUris[2]!, { x: 0.42, y: 0.38, width: 0.45, height: 0.28 }, 8),
      imageLayer('Bottom memory', imageUris[3]!, { x: 0.15, y: 0.7, width: 0.46, height: 0.24 }, 8),
      titleLayer('SUMMER\nNOTES', { x: 0.05, y: 0.36, width: 0.32, height: 0.14 }),
    ],
    ['summer', 'travel', 'editorial'],
  ),
  template(
    'template-golden-hour',
    'Golden hour',
    'Featured',
    '9:16',
    '#6E5B4E',
    [
      imageLayer('Hero', imageUris[2]!, { x: 0, y: 0, width: 1, height: 1 }),
      titleLayer('GOLDEN\nHOUR', { x: 0.1, y: 0.68, width: 0.8, height: 0.17 }),
    ],
    ['portrait', 'reel', 'minimal'],
  ),
  template(
    'template-coastal-grid',
    'Coastal grid',
    'Summer',
    '1:1',
    '#F0EEE7',
    [
      imageLayer('Left', imageUris[3]!, { x: 0.04, y: 0.04, width: 0.45, height: 0.58 }, 16),
      imageLayer('Top right', imageUris[4]!, { x: 0.51, y: 0.04, width: 0.45, height: 0.28 }, 16),
      imageLayer('Bottom right', imageUris[5]!, { x: 0.51, y: 0.34, width: 0.45, height: 0.62 }, 16),
      titleLayer('COAST\nTO COAST', { x: 0.05, y: 0.66, width: 0.42, height: 0.22 }, '#151515'),
    ],
    ['summer', 'grid', 'square'],
  ),
  template(
    'template-film-notes',
    'Film notes',
    'Stories',
    '3:4',
    '#171717',
    [
      imageLayer('Top frame', imageUris[5]!, { x: 0.08, y: 0.08, width: 0.84, height: 0.29 }, 4),
      imageLayer('Middle frame', imageUris[1]!, { x: 0.08, y: 0.39, width: 0.84, height: 0.29 }, 4),
      imageLayer('Bottom frame', imageUris[0]!, { x: 0.08, y: 0.7, width: 0.84, height: 0.22 }, 4),
      titleLayer('FILM / 06', { x: 0.14, y: 0.44, width: 0.72, height: 0.1 }),
    ],
    ['film', 'story', 'dark'],
  ),
];
