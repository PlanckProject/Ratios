import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from 'react';

import { BUILTIN_TEMPLATES } from '../data/templates';
import { parseCollageDocument } from '../services/jsonTransfer';
import { deleteManagedMedia } from '../services/mediaStorage';
import { loadTemplateRepository } from '../services/templateRepository';
import type {
  AspectRatioId,
  CollageProject,
  CollageTemplate,
} from '../types/collage';
import {
  createBlankProject,
  duplicateProject as cloneProject,
  instantiateTemplate,
} from '../utils/collage';

const PROJECTS_KEY = '@ratios/projects/v1';
const TEMPLATES_KEY = '@ratios/templates/v1';
const REPOSITORY_KEY = '@ratios/template-repository/v1';
const DEFAULT_REPOSITORY_URL = process.env.EXPO_PUBLIC_TEMPLATE_REPOSITORY_URL ?? '';

interface State {
  projects: CollageProject[];
  localTemplates: CollageTemplate[];
  remoteTemplates: CollageTemplate[];
  repositoryUrl: string;
  repositoryLoading: boolean;
  repositoryError: string | null;
  storageError: string | null;
  storageWriteBlocked: boolean;
  hydrated: boolean;
}

type Action =
  | {
      type: 'HYDRATE';
      projects: CollageProject[];
      localTemplates: CollageTemplate[];
      repositoryUrl: string;
      storageError?: string;
      storageWriteBlocked?: boolean;
    }
  | { type: 'ADD_PROJECT'; project: CollageProject }
  | { type: 'ADD_TEMPLATE'; template: CollageTemplate }
  | { type: 'UPDATE_PROJECT'; project: CollageProject }
  | { type: 'REMOVE_PROJECT'; projectId: string }
  | { type: 'SET_REPOSITORY_URL'; repositoryUrl: string }
  | { type: 'REPOSITORY_LOADING' }
  | {
      type: 'REPOSITORY_SUCCESS';
      templates: CollageTemplate[];
      repositoryUrl?: string;
    }
  | { type: 'REPOSITORY_ERROR'; error: string }
  | { type: 'STORAGE_ERROR'; error: string | null };

const initialState: State = {
  projects: [],
  localTemplates: [],
  remoteTemplates: [],
  repositoryUrl: DEFAULT_REPOSITORY_URL,
  repositoryLoading: false,
  repositoryError: null,
  storageError: null,
  storageWriteBlocked: false,
  hydrated: false,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'HYDRATE':
      return {
        ...state,
        hydrated: true,
        projects: action.projects,
        localTemplates: action.localTemplates,
        repositoryUrl: action.repositoryUrl,
        storageError: action.storageError ?? null,
        storageWriteBlocked: action.storageWriteBlocked ?? false,
      };
    case 'ADD_PROJECT':
      return {
        ...state,
        projects: [action.project, ...state.projects],
      };
    case 'ADD_TEMPLATE':
      return {
        ...state,
        localTemplates: [
          action.template,
          ...state.localTemplates.filter((template) => template.id !== action.template.id),
        ],
      };
    case 'UPDATE_PROJECT':
      return {
        ...state,
        projects: state.projects.map((project) =>
          project.id === action.project.id ? action.project : project,
        ),
      };
    case 'REMOVE_PROJECT':
      return {
        ...state,
        projects: state.projects.filter((project) => project.id !== action.projectId),
      };
    case 'SET_REPOSITORY_URL':
      return {
        ...state,
        repositoryUrl: action.repositoryUrl,
        repositoryError: null,
        remoteTemplates: action.repositoryUrl ? state.remoteTemplates : [],
      };
    case 'REPOSITORY_LOADING':
      return {
        ...state,
        repositoryLoading: true,
        repositoryError: null,
      };
    case 'REPOSITORY_SUCCESS':
      return {
        ...state,
        repositoryLoading: false,
        repositoryError: null,
        repositoryUrl: action.repositoryUrl ?? state.repositoryUrl,
        remoteTemplates: action.templates,
      };
    case 'REPOSITORY_ERROR':
      return {
        ...state,
        repositoryLoading: false,
        repositoryError: action.error,
      };
    case 'STORAGE_ERROR':
      return {
        ...state,
        storageError: action.error,
      };
  }
}

interface CollageContextValue extends State {
  templates: CollageTemplate[];
  createProject: (aspectRatio: AspectRatioId) => CollageProject;
  createFromTemplate: (template: CollageTemplate) => CollageProject;
  importDocument: (
    document: CollageProject | CollageTemplate,
  ) => CollageProject | CollageTemplate;
  updateProject: (project: CollageProject) => void;
  removeProject: (projectId: string) => void;
  duplicateProject: (projectId: string) => CollageProject | null;
  setRepositoryUrl: (url: string) => void;
  refreshRemoteTemplates: (repositoryUrlOverride?: string) => Promise<void>;
}

const CollageContext = createContext<CollageContextValue | null>(null);

function seedProjects(): CollageProject[] {
  const starter = instantiateTemplate(BUILTIN_TEMPLATES[0]!, 'Summer journal');
  return [starter];
}

interface StoredCollection<T> {
  items: T[];
  error?: string;
}

function parseStoredProjects(value: string | null): StoredCollection<CollageProject> {
  if (!value) {
    return { items: [] };
  }
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      throw new Error('Saved project data is not an array.');
    }
    const items: CollageProject[] = [];
    const errors: string[] = [];
    parsed.forEach((item, index) => {
      try {
        const document = parseCollageDocument(item);
        if (document.documentType !== 'collage-project') {
          throw new Error('The item is not a project.');
        }
        items.push(document);
      } catch (error: unknown) {
        errors.push(
          `project ${index + 1}: ${
            error instanceof Error ? error.message : 'invalid project'
          }`,
        );
      }
    });
    return {
      items,
      error: errors.length ? errors.join('; ') : undefined,
    };
  } catch (error: unknown) {
    return {
      items: [],
      error: error instanceof Error ? error.message : 'Unable to parse saved projects.',
    };
  }
}

function parseStoredTemplates(value: string | null): StoredCollection<CollageTemplate> {
  if (!value) {
    return { items: [] };
  }
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      throw new Error('Saved template data is not an array.');
    }
    const items: CollageTemplate[] = [];
    const errors: string[] = [];
    parsed.forEach((item, index) => {
      try {
        const document = parseCollageDocument(item);
        if (document.documentType !== 'collage-template') {
          throw new Error('The item is not a template.');
        }
        items.push(document);
      } catch (error: unknown) {
        errors.push(
          `template ${index + 1}: ${
            error instanceof Error ? error.message : 'invalid template'
          }`,
        );
      }
    });
    return {
      items,
      error: errors.length ? errors.join('; ') : undefined,
    };
  } catch (error: unknown) {
    return {
      items: [],
      error: error instanceof Error ? error.message : 'Unable to parse saved templates.',
    };
  }
}

export function CollageProvider({ children }: React.PropsWithChildren): React.JSX.Element {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    let active = true;
    AsyncStorage.multiGet([PROJECTS_KEY, TEMPLATES_KEY, REPOSITORY_KEY])
      .then(async (pairs) => {
        if (!active) {
          return;
        }
        const projectsValue = pairs.find(([key]) => key === PROJECTS_KEY)?.[1] ?? null;
        const templatesValue = pairs.find(([key]) => key === TEMPLATES_KEY)?.[1] ?? null;
        const repositoryValue = pairs.find(([key]) => key === REPOSITORY_KEY)?.[1] ?? null;
        const projectsResult = parseStoredProjects(projectsValue);
        const templatesResult = parseStoredTemplates(templatesValue);
        const storageErrors = [
          projectsResult.error ? `Projects: ${projectsResult.error}` : null,
          templatesResult.error ? `Templates: ${templatesResult.error}` : null,
        ].filter((message): message is string => Boolean(message));
        let storageWriteBlocked = false;

        if (storageErrors.length) {
          const recoveryEntries: Array<[string, string]> = [];
          const recoveryId = Date.now().toString(36);
          if (projectsResult.error && projectsValue) {
            recoveryEntries.push([
              `${PROJECTS_KEY}/recovery/${recoveryId}`,
              projectsValue,
            ]);
          }
          if (templatesResult.error && templatesValue) {
            recoveryEntries.push([
              `${TEMPLATES_KEY}/recovery/${recoveryId}`,
              templatesValue,
            ]);
          }
          if (recoveryEntries.length) {
            try {
              await AsyncStorage.multiSet(recoveryEntries);
            } catch {
              storageWriteBlocked = true;
              storageErrors.push('A recovery copy could not be created; saving is paused.');
            }
          }
        }

        if (!active) {
          return;
        }
        dispatch({
          type: 'HYDRATE',
          projects:
            projectsValue === null
              ? seedProjects()
              : projectsResult.items,
          localTemplates: templatesResult.items,
          repositoryUrl: repositoryValue ?? DEFAULT_REPOSITORY_URL,
          storageError: storageErrors.length ? storageErrors.join('\n') : undefined,
          storageWriteBlocked,
        });
      })
      .catch((error: unknown) => {
        if (!active) {
          return;
        }
        const message = error instanceof Error ? error.message : 'Unable to load saved projects.';
        dispatch({
          type: 'HYDRATE',
          projects: seedProjects(),
          localTemplates: [],
          repositoryUrl: DEFAULT_REPOSITORY_URL,
          storageError: message,
          storageWriteBlocked: true,
        });
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!state.hydrated || state.storageWriteBlocked) {
      return;
    }
    AsyncStorage.multiSet([
      [PROJECTS_KEY, JSON.stringify(state.projects)],
      [TEMPLATES_KEY, JSON.stringify(state.localTemplates)],
      [REPOSITORY_KEY, state.repositoryUrl],
    ])
      .then(() => dispatch({ type: 'STORAGE_ERROR', error: null }))
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Unable to save projects.';
        dispatch({ type: 'STORAGE_ERROR', error: message });
      });
  }, [
    state.hydrated,
    state.localTemplates,
    state.projects,
    state.repositoryUrl,
    state.storageWriteBlocked,
  ]);

  const createProject = useCallback((aspectRatio: AspectRatioId) => {
    const project = createBlankProject('Untitled collage', aspectRatio);
    dispatch({ type: 'ADD_PROJECT', project });
    return project;
  }, []);

  const createFromTemplate = useCallback((template: CollageTemplate) => {
    const project = instantiateTemplate(template);
    dispatch({ type: 'ADD_PROJECT', project });
    return project;
  }, []);

  const importDocument = useCallback((document: CollageProject | CollageTemplate) => {
    const now = new Date().toISOString();
    if (document.documentType === 'collage-template') {
      const template: CollageTemplate = {
        ...document,
        id: `${document.id}-import-${Date.now().toString(36)}`,
        createdAt: now,
        updatedAt: now,
        metadata: {
          ...document.metadata,
          repositoryUrl: undefined,
        },
      };
      dispatch({ type: 'ADD_TEMPLATE', template });
      return template;
    }

    const project: CollageProject = {
      ...document,
      id: `${document.id}-import-${Date.now().toString(36)}`,
      createdAt: now,
      updatedAt: now,
    };
    dispatch({ type: 'ADD_PROJECT', project });
    return project;
  }, []);

  const updateProject = useCallback((project: CollageProject) => {
    dispatch({ type: 'UPDATE_PROJECT', project });
  }, []);

  const removeProject = useCallback((projectId: string) => {
    const project = state.projects.find((item) => item.id === projectId);
    const remainingProjects = state.projects.filter((item) => item.id !== projectId);
    dispatch({ type: 'REMOVE_PROJECT', projectId });
    if (!project) {
      return;
    }

    const retainedUris = new Set(
      [...remainingProjects, ...state.localTemplates].flatMap((item) => [
        ...(item.canvas.background.source
          ? [item.canvas.background.source.uri]
          : []),
        ...item.layers.flatMap((layer) =>
          layer.type === 'media' && layer.source ? [layer.source.uri] : [],
        ),
      ]),
    );
    const removableUris = new Set(
      [
        ...(project.canvas.background.source &&
        !retainedUris.has(project.canvas.background.source.uri)
          ? [project.canvas.background.source.uri]
          : []),
        ...project.layers.flatMap((layer) =>
          layer.type === 'media' &&
          layer.source &&
          !retainedUris.has(layer.source.uri)
            ? [layer.source.uri]
            : [],
        ),
      ],
    );
    void Promise.all([...removableUris].map((uri) => deleteManagedMedia(uri))).catch(
      (error: unknown) => {
        const message =
          error instanceof Error ? error.message : 'Unable to remove unused project media.';
        dispatch({ type: 'STORAGE_ERROR', error: message });
      },
    );
  }, [state.localTemplates, state.projects]);

  const duplicateProject = useCallback(
    (projectId: string) => {
      const source = state.projects.find((project) => project.id === projectId);
      if (!source) {
        return null;
      }
      const duplicate = cloneProject(source);
      dispatch({ type: 'ADD_PROJECT', project: duplicate });
      return duplicate;
    },
    [state.projects],
  );

  const setRepositoryUrl = useCallback((repositoryUrl: string) => {
    dispatch({ type: 'SET_REPOSITORY_URL', repositoryUrl });
  }, []);

  const refreshRemoteTemplates = useCallback(async (repositoryUrlOverride?: string) => {
    const repositoryUrl = repositoryUrlOverride ?? state.repositoryUrl;
    dispatch({ type: 'REPOSITORY_LOADING' });
    try {
      const templates = await loadTemplateRepository(repositoryUrl);
      dispatch({
        type: 'REPOSITORY_SUCCESS',
        templates,
        repositoryUrl: repositoryUrlOverride ? repositoryUrl : undefined,
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Unable to load the template repository.';
      dispatch({ type: 'REPOSITORY_ERROR', error: message });
      throw error;
    }
  }, [state.repositoryUrl]);

  const value = useMemo<CollageContextValue>(
    () => ({
      ...state,
      templates: [...BUILTIN_TEMPLATES, ...state.localTemplates, ...state.remoteTemplates],
      createProject,
      createFromTemplate,
      importDocument,
      updateProject,
      removeProject,
      duplicateProject,
      setRepositoryUrl,
      refreshRemoteTemplates,
    }),
    [
      state,
      createProject,
      createFromTemplate,
      importDocument,
      updateProject,
      removeProject,
      duplicateProject,
      setRepositoryUrl,
      refreshRemoteTemplates,
    ],
  );

  return <CollageContext.Provider value={value}>{children}</CollageContext.Provider>;
}

export function useCollages(): CollageContextValue {
  const value = useContext(CollageContext);
  if (!value) {
    throw new Error('useCollages must be used inside CollageProvider.');
  }
  return value;
}
