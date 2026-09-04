import type {
  CollageTemplate,
  TemplateRepositoryManifest,
} from '../types/collage';
import { parseCollageDocument } from './jsonTransfer';

function manifestUrl(repositoryUrl: string): string {
  const trimmed = repositoryUrl.trim();
  if (!trimmed) {
    throw new Error('Enter a template repository URL first.');
  }
  return trimmed.toLowerCase().endsWith('.json')
    ? trimmed
    : `${trimmed.replace(/\/+$/, '')}/index.json`;
}

function resolveTemplateUrl(indexUrl: string, path: string): string {
  return new URL(path, indexUrl).toString();
}

async function fetchJson(url: string, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
    },
    signal,
  });
  if (!response.ok) {
    throw new Error(`Template repository returned ${response.status}.`);
  }
  return response.json() as Promise<unknown>;
}

function asTemplate(value: unknown, repositoryUrl: string): CollageTemplate {
  const document = parseCollageDocument(value);
  if (document.documentType !== 'collage-template') {
    throw new Error(`Document ${document.id} is not a collage template.`);
  }
  return {
    ...document,
    metadata: {
      ...document.metadata,
      repositoryUrl,
    },
  };
}

export async function loadTemplateRepository(
  repositoryUrl: string,
  signal?: AbortSignal,
): Promise<CollageTemplate[]> {
  const indexUrl = manifestUrl(repositoryUrl);
  const payload = await fetchJson(indexUrl, signal);
  const entries = Array.isArray(payload)
    ? payload
    : (payload as TemplateRepositoryManifest | undefined)?.templates;

  if (!Array.isArray(entries)) {
    return [asTemplate(payload, repositoryUrl)];
  }
  if (entries.length > 50) {
    throw new Error('A template repository can expose at most 50 templates.');
  }

  const templates = await Promise.all(
    entries.map(async (entry) => {
      if (typeof entry === 'string') {
        const templatePayload = await fetchJson(resolveTemplateUrl(indexUrl, entry), signal);
        return asTemplate(templatePayload, repositoryUrl);
      }
      return asTemplate(entry, repositoryUrl);
    }),
  );

  return templates;
}
