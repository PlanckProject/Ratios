import type { AspectRatioId } from '../types/collage';

export const ASPECT_RATIOS: Record<
  AspectRatioId,
  { id: AspectRatioId; label: string; width: number; height: number; use: string }
> = {
  '3:4': { id: '3:4', label: '3:4', width: 3, height: 4, use: 'Portrait' },
  '4:5': { id: '4:5', label: '4:5', width: 4, height: 5, use: 'Instagram portrait' },
  '9:16': { id: '9:16', label: '9:16', width: 9, height: 16, use: 'Stories & Reels' },
  '3:2': { id: '3:2', label: '3:2', width: 3, height: 2, use: 'Landscape' },
  '1:1': { id: '1:1', label: '1:1', width: 1, height: 1, use: 'Square post' },
};

export const ASPECT_RATIO_IDS = Object.keys(ASPECT_RATIOS) as AspectRatioId[];

export type ExportPreset = 'standard' | 'max';

export const EXPORT_WIDTHS: Record<ExportPreset, number> = {
  standard: 1080,
  max: 2160,
};

export function getExportDimensions(
  aspectRatio: AspectRatioId,
  preset: ExportPreset = 'max',
): {
  width: number;
  height: number;
} {
  const ratio = ASPECT_RATIOS[aspectRatio];
  const width = EXPORT_WIDTHS[preset];
  return {
    width,
    height: Math.round(width * (ratio.height / ratio.width)),
  };
}
