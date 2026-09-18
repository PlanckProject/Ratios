export type AspectRatioId = '3:4' | '4:5' | '9:16' | '3:2' | '1:1';
export type LayerType = 'media' | 'text' | 'shape';
export type AnimationType = 'none' | 'fade' | 'rise' | 'pulse' | 'typewriter';
export type MediaKind = 'image' | 'video' | 'any';
export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

export interface LayerTransform {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  anchorX: number;
  anchorY: number;
}

export interface LayerTiming {
  startMs: number;
  endMs: number;
}

export interface AnimationSpec {
  id: string;
  type: AnimationType;
  enabled: boolean;
  durationMs: number;
  delayMs: number;
  easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
  loop: boolean;
  direction: 'normal' | 'reverse' | 'alternate';
}

export interface BaseLayer {
  id: string;
  type: LayerType;
  name: string;
  zIndex: number;
  visible: boolean;
  locked: boolean;
  opacity: number;
  blendMode: 'normal' | 'multiply' | 'screen' | 'overlay';
  groupId?: string;
  transform: LayerTransform;
  timing: LayerTiming;
  animations: {
    entrance?: AnimationSpec;
    loop?: AnimationSpec;
    exit?: AnimationSpec;
  };
  metadata: {
    createdAt: string;
    updatedAt: string;
    tags: string[];
    extensions?: Record<string, JsonValue>;
  };
}

export interface MediaSource {
  uri: string;
  mediaLibraryId?: string;
  fileName?: string;
  mimeType?: string;
  width?: number;
  height?: number;
  durationMs?: number;
  role: 'user' | 'placeholder' | 'remote';
}

export interface MediaLayer extends BaseLayer {
  type: 'media';
  mediaKind: MediaKind;
  source?: MediaSource;
  fit: 'cover' | 'contain' | 'fill';
  crop: {
    x: number;
    y: number;
    zoom: number;
    aspectRatio: 'free' | 'original' | AspectRatioId | '16:9';
    flipX: boolean;
    flipY: boolean;
  };
  frame: {
    shape: 'rectangle' | 'rounded' | 'circle';
    borderRadius: number;
    borderWidth: number;
    borderColor: string;
  };
  playback: {
    muted: boolean;
    loop: boolean;
    speed: number;
    trimStartMs: number;
    trimEndMs?: number;
  };
}

export interface TextLayer extends BaseLayer {
  type: 'text';
  text: string;
  style: {
    fontFamily: string;
    fontSize: number;
    fontWeight: '300' | '400' | '500' | '600' | '700' | '800';
    fontStyle: 'normal' | 'italic';
    color: string;
    textAlign: 'left' | 'center' | 'right';
    letterSpacing: number;
    lineHeight: number;
    textTransform: 'none' | 'uppercase' | 'lowercase';
    strokeColor: string;
    strokeWidth: number;
    backgroundColor: string;
    padding: number;
    borderRadius: number;
    shadow: {
      color: string;
      opacity: number;
      radius: number;
      offsetX: number;
      offsetY: number;
    };
  };
}

export interface ShapeLayer extends BaseLayer {
  type: 'shape';
  shape: 'rectangle' | 'rounded' | 'circle' | 'line';
  fill: string;
  stroke: string;
  strokeWidth: number;
}

export type CollageLayer = MediaLayer | TextLayer | ShapeLayer;

export interface CollageDocument {
  schemaVersion: 1;
  documentType: 'collage-project' | 'collage-template';
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  appVersion: string;
  canvas: {
    aspectRatio: AspectRatioId;
    width: number;
    height: number;
    pageCount: number;
    pageOrder?: number[];
    durationMs: number;
    fps: number;
    background: {
      type: 'color' | 'image';
      color: string;
      source?: MediaSource;
      blur: number;
    };
    safeArea: {
      top: number;
      right: number;
      bottom: number;
      left: number;
    };
  };
  layers: CollageLayer[];
  requirements: {
    imageCount: number;
    videoCount: number;
    flexibleMediaCount: number;
    textCount: number;
    layerCount: number;
  };
  editor: {
    snapMediaSize: boolean;
    gridSize: number;
    showGrid: boolean;
    showSafeArea: boolean;
    zoom: number;
  };
  metadata: {
    author: string;
    category: string;
    tags: string[];
    locale: string;
    coverLayerId?: string;
    sourceTemplateId?: string;
    repositoryUrl?: string;
    previewUri?: string;
    extensions?: Record<string, JsonValue>;
  };
  extensions?: Record<string, JsonValue>;
}

export type CollageTemplate = CollageDocument & {
  documentType: 'collage-template';
};

export type CollageProject = CollageDocument & {
  documentType: 'collage-project';
};

export interface TemplateRepositoryManifest {
  schemaVersion: 1;
  name?: string;
  templates: Array<string | CollageTemplate>;
}
