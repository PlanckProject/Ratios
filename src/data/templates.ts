import type {
  AspectRatioId,
  CollageTemplate,
  LayerTransform,
  MediaLayer,
} from '../types/collage';
import {
  calculateRequirements,
  createBlankProject,
  createMediaLayer,
} from '../utils/collage';

const imageUris = [
  'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1493246507139-91e8fad9978e?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1494783367193-149034c05e8f?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1511497584788-876760111969?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1518837695005-2083093ee35b?auto=format&fit=crop&w=1200&q=80',
];

type Pane = Pick<LayerTransform, 'x' | 'y' | 'width' | 'height'>;

function grid(columns: number, rows: number): Pane[] {
  return Array.from({ length: columns * rows }, (_, index) => ({
    x: (index % columns) / columns,
    y: Math.floor(index / columns) / rows,
    width: 1 / columns,
    height: 1 / rows,
  }));
}

const layouts = {
  full: [{ x: 0, y: 0, width: 1, height: 1 }],
  columns: grid(2, 1),
  rows: grid(1, 2),
  triptych: grid(3, 1),
  stack: grid(1, 3),
  grid: grid(2, 2),
  gallery: grid(3, 3),
  feature: [
    { x: 0, y: 0, width: 2 / 3, height: 1 },
    { x: 2 / 3, y: 0, width: 1 / 3, height: 0.5 },
    { x: 2 / 3, y: 0.5, width: 1 / 3, height: 0.5 },
  ],
  editorial: [
    { x: 0, y: 0, width: 1, height: 2 / 3 },
    { x: 0, y: 2 / 3, width: 0.5, height: 1 / 3 },
    { x: 0.5, y: 2 / 3, width: 0.5, height: 1 / 3 },
  ],
  mosaic: [
    { x: 0, y: 0, width: 0.5, height: 2 / 3 },
    { x: 0, y: 2 / 3, width: 0.5, height: 1 / 3 },
    { x: 0.5, y: 0, width: 0.5, height: 1 / 3 },
    { x: 0.5, y: 1 / 3, width: 0.5, height: 2 / 3 },
  ],
} satisfies Record<string, Pane[]>;

type TemplateSpec = [
  id: string,
  name: string,
  category: string,
  aspectRatio: AspectRatioId,
  pages: Array<keyof typeof layouts>,
  tags: string[],
];

const templateSpecs: TemplateSpec[] = [
  ['summer-windows', 'Summer windows', 'Travel', '4:5', ['mosaic'], ['summer', 'travel', 'editorial']],
  ['golden-hour', 'Golden hour', 'Featured', '9:16', ['full'], ['portrait', 'reel', 'minimal']],
  ['coastal-grid', 'Coastal grid', 'Summer', '1:1', ['feature'], ['summer', 'grid', 'square']],
  ['film-notes', 'Film notes', 'Stories', '3:4', ['stack'], ['film', 'story', 'dark']],
  ['weekend-contact', 'Weekend contact', 'Travel', '4:5', ['grid', 'full', 'columns'], ['travel', 'contact-sheet']],
  ['road-trip', 'Road trip', 'Travel', '3:4', ['full', 'rows', 'columns', 'editorial'], ['road', 'film']],
  ['city-lights', 'City lights', 'Stories', '9:16', ['full', 'rows', 'editorial', 'full', 'stack'], ['city', 'night']],
  ['coastlines', 'Coastlines', 'Summer', '1:1', ['columns', 'full', 'rows'], ['coast', 'summer']],
  ['mountain-air', 'Mountain air', 'Travel', '4:5', ['full', 'editorial', 'columns', 'full', 'rows', 'feature'], ['mountains', 'editorial']],
  ['quiet-mornings', 'Quiet mornings', 'Lifestyle', '3:4', ['rows', 'full', 'editorial', 'columns'], ['slow', 'lifestyle']],
  ['studio-notes', 'Studio notes', 'Design', '1:1', ['grid', 'feature', 'full'], ['design', 'grid']],
  ['after-hours', 'After hours', 'Stories', '9:16', ['full', 'stack', 'full', 'rows', 'editorial'], ['night', 'story']],
  ['field-journal', 'Field journal', 'Nature', '4:5', ['editorial', 'full', 'mosaic', 'columns'], ['nature', 'journal']],
  ['festival-frame', 'Festival frame', 'Events', '3:4', ['full', 'feature', 'rows'], ['festival', 'bold']],
  ['analog-week', 'Analog week', 'Stories', '4:5', ['rows', 'full', 'grid', 'columns', 'editorial', 'full'], ['analog', 'film']],
  ['blue-hour', 'Blue hour', 'Travel', '9:16', ['full', 'rows', 'stack', 'full'], ['blue', 'travel']],
  ['market-walk', 'Market walk', 'Lifestyle', '1:1', ['mosaic', 'full', 'grid'], ['food', 'lifestyle']],
  ['desert-drive', 'Desert drive', 'Travel', '3:2', ['full', 'triptych', 'feature', 'columns', 'full'], ['desert', 'road']],
  ['sunday-table', 'Sunday table', 'Lifestyle', '4:5', ['editorial', 'full', 'columns'], ['home', 'food']],
  ['neon-nights', 'Neon nights', 'Stories', '9:16', ['full', 'rows', 'editorial', 'full', 'stack', 'rows'], ['neon', 'night']],
  ['garden-study', 'Garden study', 'Nature', '3:4', ['feature', 'full', 'rows', 'mosaic'], ['garden', 'nature']],
  ['northbound', 'Northbound', 'Travel', '3:2', ['full', 'columns', 'triptych', 'full', 'feature'], ['road', 'journal']],
  ['soft-focus', 'Soft focus', 'Lifestyle', '1:1', ['full', 'columns', 'editorial'], ['soft', 'minimal']],
  ['summer-postcards', 'Summer postcards', 'Summer', '4:5', ['grid', 'full', 'rows', 'mosaic', 'columns', 'full'], ['summer', 'postcards']],
  ['night-train', 'Night train', 'Stories', '3:4', ['full', 'rows', 'feature', 'full'], ['train', 'night']],
  ['phone-gallery', 'Gallery', 'Editorial', '9:16', ['gallery'], ['gallery', 'phone', 'photos', 'contact-sheet']],
];

export const BUILTIN_TEMPLATES: CollageTemplate[] = templateSpecs.map(
  ([id, name, category, aspectRatio, pages, tags], templateIndex) => {
    const project = createBlankProject(name, aspectRatio);
    const templateId = `template-${id}`;
    const layers: MediaLayer[] = pages.flatMap((layout, pageIndex) =>
      layouts[layout].map((pane, paneIndex) => ({
        ...createMediaLayer('any', { ...pane, x: pageIndex + pane.x }),
        id: `${templateId}-page-${pageIndex + 1}-pane-${paneIndex + 1}`,
        name: `Page ${pageIndex + 1} photo ${paneIndex + 1}`,
        source: {
          uri: imageUris[(templateIndex * 3 + pageIndex * 3 + paneIndex) % imageUris.length]!,
          role: 'placeholder',
        },
      })),
    );

    return {
      ...project,
      id: templateId,
      documentType: 'collage-template',
      description: `${category} photography with edge-to-edge, full-bleed layouts.`,
      canvas: {
        ...project.canvas,
        pageCount: pages.length,
        pageOrder: pages.map((_, index) => index),
        background: { type: 'color', color: '#111111', blur: 0 },
      },
      layers: layers.map((layer, index) => ({ ...layer, zIndex: index })),
      requirements: calculateRequirements(layers),
      metadata: {
        ...project.metadata,
        author: 'Ratios',
        category,
        tags: [...tags, 'full-bleed'],
        coverLayerId: layers[0]?.id,
      },
    };
  },
);
