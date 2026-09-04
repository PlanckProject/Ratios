import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Share } from 'react-native';

import { ASPECT_RATIOS, getExportDimensions } from '../constants/ratios';
import type {
  AnimationSpec,
  AspectRatioId,
  BaseLayer,
  CollageDocument,
  CollageLayer,
  CollageProject,
  CollageTemplate,
  JsonValue,
  LayerTransform,
  MediaLayer,
  MediaSource,
  ShapeLayer,
  TextLayer,
} from '../types/collage';
import {
  calculateRequirements,
  createId,
  createMediaLayer,
  createShapeLayer,
  createTextLayer,
} from '../utils/collage';

const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
const MAX_LAYERS = 200;
const MAX_STRING_LENGTH = 10_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function recordValue(
  record: Record<string, unknown>,
  key: string,
  label: string,
): Record<string, unknown> | undefined {
  const value = record[key];
  if (value === undefined || value === null) {
    return undefined;
  }
  if (!isRecord(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value;
}

function stringValue(
  record: Record<string, unknown>,
  key: string,
  fallback: string,
  label: string,
  maxLength = MAX_STRING_LENGTH,
): string {
  const value = record[key];
  if (value === undefined || value === null) {
    return fallback;
  }
  if (typeof value !== 'string') {
    throw new Error(`${label} must be a string.`);
  }
  if (value.length > maxLength) {
    throw new Error(`${label} is too long.`);
  }
  return value;
}

function optionalStringValue(
  record: Record<string, unknown>,
  key: string,
  label: string,
  maxLength = MAX_STRING_LENGTH,
): string | undefined {
  const value = record[key];
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (typeof value !== 'string') {
    throw new Error(`${label} must be a string.`);
  }
  if (value.length > maxLength) {
    throw new Error(`${label} is too long.`);
  }
  return value;
}

function numberValue(
  record: Record<string, unknown>,
  key: string,
  fallback: number,
  minimum: number,
  maximum: number,
  label: string,
): number {
  const value = record[key];
  if (value === undefined || value === null) {
    return fallback;
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number.`);
  }
  if (value < minimum || value > maximum) {
    throw new Error(`${label} must be between ${minimum} and ${maximum}.`);
  }
  return value;
}

function optionalNumberValue(
  record: Record<string, unknown>,
  key: string,
  minimum: number,
  maximum: number,
  label: string,
): number | undefined {
  if (record[key] === undefined || record[key] === null) {
    return undefined;
  }
  return numberValue(record, key, minimum, minimum, maximum, label);
}

function booleanValue(
  record: Record<string, unknown>,
  key: string,
  fallback: boolean,
  label: string,
): boolean {
  const value = record[key];
  if (value === undefined || value === null) {
    return fallback;
  }
  if (typeof value !== 'boolean') {
    throw new Error(`${label} must be true or false.`);
  }
  return value;
}

function enumValue<T extends string>(
  record: Record<string, unknown>,
  key: string,
  allowed: readonly T[],
  fallback: T,
  label: string,
): T {
  const value = record[key];
  if (value === undefined || value === null) {
    return fallback;
  }
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new Error(`${label} must be one of: ${allowed.join(', ')}.`);
  }
  return value as T;
}

function stringArrayValue(
  record: Record<string, unknown>,
  key: string,
  fallback: string[],
  label: string,
): string[] {
  const value = record[key];
  if (value === undefined || value === null) {
    return fallback;
  }
  if (!Array.isArray(value) || value.length > 100) {
    throw new Error(`${label} must be an array with no more than 100 entries.`);
  }
  return value.map((item, index) => {
    if (typeof item !== 'string' || item.length > 200) {
      throw new Error(`${label}[${index}] must be a short string.`);
    }
    return item;
  });
}

function jsonValue(value: unknown, label: string, depth = 0): JsonValue {
  if (depth > 8) {
    throw new Error(`${label} is nested too deeply.`);
  }
  if (
    value === null ||
    typeof value === 'boolean' ||
    typeof value === 'string'
  ) {
    return value;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error(`${label} contains a non-finite number.`);
    }
    return value;
  }
  if (Array.isArray(value)) {
    if (value.length > 500) {
      throw new Error(`${label} contains too many values.`);
    }
    return value.map((item, index) => jsonValue(item, `${label}[${index}]`, depth + 1));
  }
  if (isRecord(value)) {
    const entries = Object.entries(value);
    if (entries.length > 200) {
      throw new Error(`${label} contains too many keys.`);
    }
    return Object.fromEntries(
      entries.map(([key, item]) => [
        key,
        jsonValue(item, `${label}.${key}`, depth + 1),
      ]),
    );
  }
  throw new Error(`${label} must contain JSON-compatible values.`);
}

function extensionsValue(
  record: Record<string, unknown>,
  key: string,
  label: string,
): Record<string, JsonValue> | undefined {
  const value = record[key];
  if (value === undefined || value === null) {
    return undefined;
  }
  const normalized = jsonValue(value, label);
  if (!isRecord(normalized)) {
    throw new Error(`${label} must be an object.`);
  }
  return normalized as Record<string, JsonValue>;
}

function transformValue(
  value: unknown,
  fallback: LayerTransform,
  label: string,
): LayerTransform {
  if (value === undefined || value === null) {
    return fallback;
  }
  if (!isRecord(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return {
    x: numberValue(value, 'x', fallback.x, -2, 2, `${label}.x`),
    y: numberValue(value, 'y', fallback.y, -2, 2, `${label}.y`),
    width: numberValue(value, 'width', fallback.width, 0.01, 4, `${label}.width`),
    height: numberValue(value, 'height', fallback.height, 0.01, 4, `${label}.height`),
    rotation: numberValue(
      value,
      'rotation',
      fallback.rotation,
      -3600,
      3600,
      `${label}.rotation`,
    ),
    scaleX: numberValue(value, 'scaleX', fallback.scaleX, -10, 10, `${label}.scaleX`),
    scaleY: numberValue(value, 'scaleY', fallback.scaleY, -10, 10, `${label}.scaleY`),
    anchorX: numberValue(value, 'anchorX', fallback.anchorX, 0, 1, `${label}.anchorX`),
    anchorY: numberValue(value, 'anchorY', fallback.anchorY, 0, 1, `${label}.anchorY`),
  };
}

function animationValue(value: unknown, label: string): AnimationSpec | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (!isRecord(value)) {
    throw new Error(`${label} must be an object.`);
  }
  const type = enumValue(
    value,
    'type',
    ['none', 'fade', 'rise', 'pulse', 'typewriter'] as const,
    'none',
    `${label}.type`,
  );
  return {
    id: stringValue(value, 'id', createId('animation'), `${label}.id`, 200),
    type,
    enabled: booleanValue(value, 'enabled', type !== 'none', `${label}.enabled`),
    durationMs: numberValue(
      value,
      'durationMs',
      600,
      0,
      60_000,
      `${label}.durationMs`,
    ),
    delayMs: numberValue(value, 'delayMs', 0, 0, 60_000, `${label}.delayMs`),
    easing: enumValue(
      value,
      'easing',
      ['linear', 'ease-in', 'ease-out', 'ease-in-out'] as const,
      'ease-in-out',
      `${label}.easing`,
    ),
    loop: booleanValue(value, 'loop', false, `${label}.loop`),
    direction: enumValue(
      value,
      'direction',
      ['normal', 'reverse', 'alternate'] as const,
      'normal',
      `${label}.direction`,
    ),
  };
}

function mediaSourceValue(value: unknown, label: string): MediaSource | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (!isRecord(value)) {
    throw new Error(`${label} must be an object.`);
  }
  const uri = stringValue(value, 'uri', '', `${label}.uri`, 4096);
  if (!uri) {
    throw new Error(`${label}.uri is required when a source is provided.`);
  }
  const scheme = uri.match(/^([a-z][a-z0-9+.-]*):/i)?.[1]?.toLowerCase();
  if (!scheme || ['javascript', 'data'].includes(scheme)) {
    throw new Error(`${label}.uri uses an unsupported URI scheme.`);
  }
  return {
    uri,
    mediaLibraryId: optionalStringValue(value, 'mediaLibraryId', `${label}.mediaLibraryId`, 500),
    fileName: optionalStringValue(value, 'fileName', `${label}.fileName`, 500),
    mimeType: optionalStringValue(value, 'mimeType', `${label}.mimeType`, 200),
    width: optionalNumberValue(value, 'width', 1, 100_000, `${label}.width`),
    height: optionalNumberValue(value, 'height', 1, 100_000, `${label}.height`),
    durationMs: optionalNumberValue(
      value,
      'durationMs',
      0,
      86_400_000,
      `${label}.durationMs`,
    ),
    role: enumValue(
      value,
      'role',
      ['user', 'placeholder', 'remote'] as const,
      'placeholder',
      `${label}.role`,
    ),
  };
}

function baseLayerValue(
  value: Record<string, unknown>,
  fallback: CollageLayer,
  index: number,
  durationMs: number,
): BaseLayer {
  const label = `layers[${index}]`;
  const timing = recordValue(value, 'timing', `${label}.timing`) ?? {};
  const animations = recordValue(value, 'animations', `${label}.animations`) ?? {};
  const metadata = recordValue(value, 'metadata', `${label}.metadata`) ?? {};
  const now = new Date().toISOString();

  return {
    id: stringValue(value, 'id', createId(fallback.type), `${label}.id`, 200),
    type: fallback.type,
    name: stringValue(value, 'name', fallback.name, `${label}.name`, 500),
    zIndex: index,
    visible: booleanValue(value, 'visible', true, `${label}.visible`),
    locked: booleanValue(value, 'locked', false, `${label}.locked`),
    opacity: numberValue(value, 'opacity', 1, 0, 1, `${label}.opacity`),
    blendMode: enumValue(
      value,
      'blendMode',
      ['normal', 'multiply', 'screen', 'overlay'] as const,
      'normal',
      `${label}.blendMode`,
    ),
    groupId: optionalStringValue(value, 'groupId', `${label}.groupId`, 200),
    transform: transformValue(
      value.transform ?? value.frame,
      fallback.transform,
      `${label}.transform`,
    ),
    timing: {
      startMs: numberValue(timing, 'startMs', 0, 0, durationMs, `${label}.timing.startMs`),
      endMs: numberValue(
        timing,
        'endMs',
        durationMs,
        0,
        durationMs,
        `${label}.timing.endMs`,
      ),
    },
    animations: {
      entrance: animationValue(animations.entrance, `${label}.animations.entrance`),
      loop: animationValue(animations.loop, `${label}.animations.loop`),
      exit: animationValue(animations.exit, `${label}.animations.exit`),
    },
    metadata: {
      createdAt: stringValue(metadata, 'createdAt', now, `${label}.metadata.createdAt`, 100),
      updatedAt: stringValue(metadata, 'updatedAt', now, `${label}.metadata.updatedAt`, 100),
      tags: stringArrayValue(metadata, 'tags', [], `${label}.metadata.tags`),
      extensions: extensionsValue(
        metadata,
        'extensions',
        `${label}.metadata.extensions`,
      ),
    },
  };
}

function mediaLayerValue(
  value: Record<string, unknown>,
  index: number,
  durationMs: number,
): MediaLayer {
  const fallback = createMediaLayer();
  const base = baseLayerValue(value, fallback, index, durationMs);
  const label = `layers[${index}]`;
  const crop = recordValue(value, 'crop', `${label}.crop`) ?? {};
  const frame = recordValue(value, 'mediaFrame', `${label}.mediaFrame`) ??
    recordValue(value, 'frameStyle', `${label}.frameStyle`) ??
    recordValue(value, 'frame', `${label}.frame`) ??
    {};
  const playback = recordValue(value, 'playback', `${label}.playback`) ?? {};

  return {
    ...base,
    type: 'media',
    mediaKind: enumValue(
      value,
      'mediaKind',
      ['image', 'video', 'any'] as const,
      'any',
      `${label}.mediaKind`,
    ),
    source: mediaSourceValue(value.source, `${label}.source`),
    fit: enumValue(
      value,
      'fit',
      ['cover', 'contain', 'fill'] as const,
      'cover',
      `${label}.fit`,
    ),
    crop: {
      x: numberValue(crop, 'x', 0.5, 0, 1, `${label}.crop.x`),
      y: numberValue(crop, 'y', 0.5, 0, 1, `${label}.crop.y`),
      zoom: numberValue(crop, 'zoom', 1, 1, 10, `${label}.crop.zoom`),
      aspectRatio: enumValue(
        crop,
        'aspectRatio',
        ['free', 'original', '3:4', '4:5', '9:16', '3:2', '1:1', '16:9'] as const,
        'free',
        `${label}.crop.aspectRatio`,
      ),
      flipX: booleanValue(crop, 'flipX', false, `${label}.crop.flipX`),
      flipY: booleanValue(crop, 'flipY', false, `${label}.crop.flipY`),
    },
    frame: {
      shape: enumValue(
        frame,
        'shape',
        ['rectangle', 'rounded', 'circle'] as const,
        'rectangle',
        `${label}.frame.shape`,
      ),
      borderRadius: numberValue(
        frame,
        'borderRadius',
        0,
        0,
        1000,
        `${label}.frame.borderRadius`,
      ),
      borderWidth: numberValue(
        frame,
        'borderWidth',
        0,
        0,
        100,
        `${label}.frame.borderWidth`,
      ),
      borderColor: stringValue(
        frame,
        'borderColor',
        '#FFFFFF',
        `${label}.frame.borderColor`,
        100,
      ),
    },
    playback: {
      muted: booleanValue(playback, 'muted', true, `${label}.playback.muted`),
      loop: booleanValue(playback, 'loop', true, `${label}.playback.loop`),
      speed: numberValue(playback, 'speed', 1, 0.1, 4, `${label}.playback.speed`),
      trimStartMs: numberValue(
        playback,
        'trimStartMs',
        0,
        0,
        86_400_000,
        `${label}.playback.trimStartMs`,
      ),
      trimEndMs: optionalNumberValue(
        playback,
        'trimEndMs',
        0,
        86_400_000,
        `${label}.playback.trimEndMs`,
      ),
    },
  };
}

function textLayerValue(
  value: Record<string, unknown>,
  index: number,
  durationMs: number,
): TextLayer {
  const fallback = createTextLayer();
  const base = baseLayerValue(value, fallback, index, durationMs);
  const label = `layers[${index}]`;
  const style = recordValue(value, 'style', `${label}.style`) ?? {};
  const shadow = recordValue(style, 'shadow', `${label}.style.shadow`) ?? {};

  return {
    ...base,
    type: 'text',
    text: stringValue(value, 'text', fallback.text, `${label}.text`),
    style: {
      fontFamily: stringValue(
        style,
        'fontFamily',
        fallback.style.fontFamily,
        `${label}.style.fontFamily`,
        200,
      ),
      fontSize: numberValue(
        style,
        'fontSize',
        fallback.style.fontSize,
        1,
        1000,
        `${label}.style.fontSize`,
      ),
      fontWeight: enumValue(
        style,
        'fontWeight',
        ['300', '400', '500', '600', '700', '800'] as const,
        fallback.style.fontWeight,
        `${label}.style.fontWeight`,
      ),
      fontStyle: enumValue(
        style,
        'fontStyle',
        ['normal', 'italic'] as const,
        fallback.style.fontStyle,
        `${label}.style.fontStyle`,
      ),
      color: stringValue(style, 'color', fallback.style.color, `${label}.style.color`, 100),
      textAlign: enumValue(
        style,
        'textAlign',
        ['left', 'center', 'right'] as const,
        fallback.style.textAlign,
        `${label}.style.textAlign`,
      ),
      letterSpacing: numberValue(
        style,
        'letterSpacing',
        fallback.style.letterSpacing,
        -100,
        500,
        `${label}.style.letterSpacing`,
      ),
      lineHeight: numberValue(
        style,
        'lineHeight',
        fallback.style.lineHeight,
        1,
        2000,
        `${label}.style.lineHeight`,
      ),
      textTransform: enumValue(
        style,
        'textTransform',
        ['none', 'uppercase', 'lowercase'] as const,
        fallback.style.textTransform,
        `${label}.style.textTransform`,
      ),
      strokeColor: stringValue(
        style,
        'strokeColor',
        fallback.style.strokeColor,
        `${label}.style.strokeColor`,
        100,
      ),
      strokeWidth: numberValue(
        style,
        'strokeWidth',
        fallback.style.strokeWidth,
        0,
        100,
        `${label}.style.strokeWidth`,
      ),
      backgroundColor: stringValue(
        style,
        'backgroundColor',
        fallback.style.backgroundColor,
        `${label}.style.backgroundColor`,
        100,
      ),
      padding: numberValue(
        style,
        'padding',
        fallback.style.padding,
        0,
        500,
        `${label}.style.padding`,
      ),
      borderRadius: numberValue(
        style,
        'borderRadius',
        fallback.style.borderRadius,
        0,
        1000,
        `${label}.style.borderRadius`,
      ),
      shadow: {
        color: stringValue(
          shadow,
          'color',
          fallback.style.shadow.color,
          `${label}.style.shadow.color`,
          100,
        ),
        opacity: numberValue(
          shadow,
          'opacity',
          fallback.style.shadow.opacity,
          0,
          1,
          `${label}.style.shadow.opacity`,
        ),
        radius: numberValue(
          shadow,
          'radius',
          fallback.style.shadow.radius,
          0,
          100,
          `${label}.style.shadow.radius`,
        ),
        offsetX: numberValue(
          shadow,
          'offsetX',
          fallback.style.shadow.offsetX,
          -500,
          500,
          `${label}.style.shadow.offsetX`,
        ),
        offsetY: numberValue(
          shadow,
          'offsetY',
          fallback.style.shadow.offsetY,
          -500,
          500,
          `${label}.style.shadow.offsetY`,
        ),
      },
    },
  };
}

function shapeLayerValue(
  value: Record<string, unknown>,
  index: number,
  durationMs: number,
): ShapeLayer {
  const fallback = createShapeLayer();
  const base = baseLayerValue(value, fallback, index, durationMs);
  const label = `layers[${index}]`;

  return {
    ...base,
    type: 'shape',
    shape: enumValue(
      value,
      'shape',
      ['rectangle', 'rounded', 'circle', 'line'] as const,
      fallback.shape,
      `${label}.shape`,
    ),
    fill: stringValue(value, 'fill', fallback.fill, `${label}.fill`, 100),
    stroke: stringValue(value, 'stroke', fallback.stroke, `${label}.stroke`, 100),
    strokeWidth: numberValue(
      value,
      'strokeWidth',
      fallback.strokeWidth,
      0,
      100,
      `${label}.strokeWidth`,
    ),
  };
}

function layersValue(value: unknown, durationMs: number): CollageLayer[] {
  if (value === undefined || value === null) {
    return [];
  }
  if (!Array.isArray(value) || value.length > MAX_LAYERS) {
    throw new Error(`layers must be an array with no more than ${MAX_LAYERS} entries.`);
  }
  const ids = new Set<string>();
  return value.map((item, index) => {
    if (!isRecord(item)) {
      throw new Error(`layers[${index}] must be an object.`);
    }
    const type = enumValue(
      item,
      'type',
      ['media', 'text', 'shape'] as const,
      'media',
      `layers[${index}].type`,
    );
    const layer =
      type === 'text'
        ? textLayerValue(item, index, durationMs)
        : type === 'shape'
          ? shapeLayerValue(item, index, durationMs)
          : mediaLayerValue(item, index, durationMs);
    if (ids.has(layer.id)) {
      throw new Error(`Layer id "${layer.id}" is duplicated.`);
    }
    ids.add(layer.id);
    return layer;
  });
}

export function parseCollageDocument(
  value: unknown,
): CollageProject | CollageTemplate {
  const candidate =
    isRecord(value) && isRecord(value.document) ? value.document : value;

  if (!isRecord(candidate)) {
    throw new Error('The JSON root must be a collage document object.');
  }
  if (candidate.schemaVersion !== 1) {
    throw new Error('Unsupported collage schema version.');
  }

  const documentType = enumValue(
    candidate,
    'documentType',
    ['collage-project', 'collage-template'] as const,
    'collage-template',
    'documentType',
  );
  const canvas = recordValue(candidate, 'canvas', 'canvas');
  if (!canvas) {
    throw new Error('canvas is required.');
  }
  const aspectRatio = enumValue(
    canvas,
    'aspectRatio',
    Object.keys(ASPECT_RATIOS) as AspectRatioId[],
    '4:5',
    'canvas.aspectRatio',
  );
  const ratio = ASPECT_RATIOS[aspectRatio];
  const dimensions = getExportDimensions(aspectRatio);
  const durationMs = numberValue(
    canvas,
    'durationMs',
    8000,
    100,
    86_400_000,
    'canvas.durationMs',
  );
  const background = recordValue(canvas, 'background', 'canvas.background') ?? {};
  const safeArea = recordValue(canvas, 'safeArea', 'canvas.safeArea') ?? {};
  const editor = recordValue(candidate, 'editor', 'editor') ?? {};
  const metadata = recordValue(candidate, 'metadata', 'metadata') ?? {};
  const layers = layersValue(candidate.layers, durationMs);
  const now = new Date().toISOString();

  const normalized: CollageDocument = {
    schemaVersion: 1,
    documentType,
    id: stringValue(candidate, 'id', createId(documentType), 'id', 200),
    name: stringValue(candidate, 'name', 'Untitled collage', 'name', 500),
    description: stringValue(candidate, 'description', '', 'description'),
    createdAt: stringValue(candidate, 'createdAt', now, 'createdAt', 100),
    updatedAt: stringValue(candidate, 'updatedAt', now, 'updatedAt', 100),
    appVersion: stringValue(candidate, 'appVersion', '1.0.0', 'appVersion', 100),
    canvas: {
      aspectRatio,
      width: dimensions.width,
      height: dimensions.height,
      durationMs,
      fps: numberValue(canvas, 'fps', 30, 1, 240, 'canvas.fps'),
      background: {
        type: enumValue(
          background,
          'type',
          ['color', 'image'] as const,
          'color',
          'canvas.background.type',
        ),
        color: stringValue(
          background,
          'color',
          '#E8E4DC',
          'canvas.background.color',
          100,
        ),
        source: mediaSourceValue(background.source, 'canvas.background.source'),
        blur: numberValue(background, 'blur', 0, 0, 100, 'canvas.background.blur'),
      },
      safeArea: {
        top: numberValue(safeArea, 'top', 0.04, 0, 0.5, 'canvas.safeArea.top'),
        right: numberValue(safeArea, 'right', 0.04, 0, 0.5, 'canvas.safeArea.right'),
        bottom: numberValue(safeArea, 'bottom', 0.04, 0, 0.5, 'canvas.safeArea.bottom'),
        left: numberValue(safeArea, 'left', 0.04, 0, 0.5, 'canvas.safeArea.left'),
      },
    },
    layers,
    requirements: calculateRequirements(layers),
    editor: {
      snapToGrid: booleanValue(editor, 'snapToGrid', true, 'editor.snapToGrid'),
      gridSize: numberValue(editor, 'gridSize', 12, 1, 1000, 'editor.gridSize'),
      showGrid: booleanValue(editor, 'showGrid', false, 'editor.showGrid'),
      showSafeArea: booleanValue(
        editor,
        'showSafeArea',
        false,
        'editor.showSafeArea',
      ),
      zoom: numberValue(editor, 'zoom', 1, 0.1, 10, 'editor.zoom'),
    },
    metadata: {
      author: stringValue(metadata, 'author', 'Unknown', 'metadata.author', 500),
      category: stringValue(metadata, 'category', 'Custom', 'metadata.category', 500),
      tags: stringArrayValue(metadata, 'tags', [], 'metadata.tags'),
      locale: stringValue(metadata, 'locale', 'en', 'metadata.locale', 100),
      coverLayerId: optionalStringValue(
        metadata,
        'coverLayerId',
        'metadata.coverLayerId',
        200,
      ),
      sourceTemplateId: optionalStringValue(
        metadata,
        'sourceTemplateId',
        'metadata.sourceTemplateId',
        200,
      ),
      repositoryUrl: optionalStringValue(
        metadata,
        'repositoryUrl',
        'metadata.repositoryUrl',
        4096,
      ),
      previewUri: optionalStringValue(
        metadata,
        'previewUri',
        'metadata.previewUri',
        4096,
      ),
      extensions: extensionsValue(metadata, 'extensions', 'metadata.extensions'),
    },
    extensions: extensionsValue(candidate, 'extensions', 'extensions'),
  };

  return documentType === 'collage-template'
    ? ({ ...normalized, documentType } as CollageTemplate)
    : ({ ...normalized, documentType } as CollageProject);
}

export async function importCollageJson(): Promise<
  CollageProject | CollageTemplate | null
> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/json', 'text/plain'],
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (result.canceled) {
    return null;
  }

  const asset = result.assets[0];
  if (!asset) {
    throw new Error('No file was selected.');
  }
  if (asset.size && asset.size > MAX_IMPORT_BYTES) {
    throw new Error('The selected JSON file is larger than 5 MB.');
  }

  const contents = await FileSystem.readAsStringAsync(asset.uri, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  if (contents.length > MAX_IMPORT_BYTES) {
    throw new Error('The selected JSON file is larger than 5 MB.');
  }

  return parseCollageDocument(JSON.parse(contents) as unknown);
}

export async function exportCollageJson(document: CollageDocument): Promise<void> {
  const directory = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
  if (!directory) {
    throw new Error('No writable export directory is available.');
  }

  const safeName = document.name
    .trim()
    .replace(/[^a-z0-9-_]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  const uri = `${directory}${safeName || 'collage'}.ratios.json`;
  const json = JSON.stringify(document, null, 2);

  await FileSystem.writeAsStringAsync(uri, json, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      dialogTitle: `Export ${document.name}`,
      mimeType: 'application/json',
      UTI: 'public.json',
    });
    return;
  }

  await Share.share({
    title: document.name,
    message: json,
  });
}
