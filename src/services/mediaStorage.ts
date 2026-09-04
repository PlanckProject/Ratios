import type { ImagePickerAsset } from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';

import type { MediaSource } from '../types/collage';
import { createId } from '../utils/collage';

const MEDIA_DIRECTORY = `${FileSystem.documentDirectory ?? ''}ratios-media/`;

function extensionFor(asset: ImagePickerAsset): string {
  const fileExtension = asset.fileName?.match(/\.([a-z0-9]+)$/i)?.[1];
  if (fileExtension) {
    return fileExtension.toLowerCase();
  }
  const mimeExtension = asset.mimeType?.split('/')[1]?.split(';')[0];
  if (mimeExtension) {
    return mimeExtension.replace('quicktime', 'mov').replace('jpeg', 'jpg');
  }
  return asset.type === 'video' ? 'mp4' : 'jpg';
}

async function ensureMediaDirectory(): Promise<void> {
  if (!FileSystem.documentDirectory) {
    throw new Error('No persistent media directory is available.');
  }
  const info = await FileSystem.getInfoAsync(MEDIA_DIRECTORY);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(MEDIA_DIRECTORY, { intermediates: true });
  }
}

export async function persistPickedAsset(asset: ImagePickerAsset): Promise<MediaSource> {
  await ensureMediaDirectory();
  const targetUri = `${MEDIA_DIRECTORY}${createId('asset')}.${extensionFor(asset)}`;
  await FileSystem.copyAsync({
    from: asset.uri,
    to: targetUri,
  });

  return {
    uri: targetUri,
    mediaLibraryId: asset.assetId ?? undefined,
    fileName: asset.fileName ?? undefined,
    mimeType: asset.mimeType ?? undefined,
    width: asset.width,
    height: asset.height,
    durationMs: asset.duration ?? undefined,
    role: 'user',
  };
}

export function isManagedMediaUri(uri: string | undefined): uri is string {
  return Boolean(uri && uri.startsWith(MEDIA_DIRECTORY));
}

export async function deleteManagedMedia(uri: string | undefined): Promise<void> {
  if (!isManagedMediaUri(uri)) {
    return;
  }
  const info = await FileSystem.getInfoAsync(uri);
  if (info.exists) {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  }
}
