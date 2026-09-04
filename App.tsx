import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { BottomNav, type TabId } from './src/components/BottomNav';
import { colors } from './src/constants/theme';
import { importCollageJson } from './src/services/jsonTransfer';
import { EditorScreen } from './src/screens/EditorScreen';
import { ExportScreen } from './src/screens/ExportScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { NewProjectScreen } from './src/screens/NewProjectScreen';
import { ProjectsScreen } from './src/screens/ProjectsScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { TemplateDetailScreen } from './src/screens/TemplateDetailScreen';
import { TemplatesScreen } from './src/screens/TemplatesScreen';
import { CollageProvider, useCollages } from './src/store/CollageProvider';
import type { CollageProject, CollageTemplate } from './src/types/collage';

type Route =
  | { name: 'tabs' }
  | { name: 'new-project' }
  | { name: 'editor'; projectId: string }
  | { name: 'export'; projectId: string }
  | { name: 'template'; template: CollageTemplate };

export default function App(): React.JSX.Element {
  return (
    <SafeAreaProvider>
      <CollageProvider>
        <StatusBar style="light" />
        <RatiosApp />
      </CollageProvider>
    </SafeAreaProvider>
  );
}

function RatiosApp(): React.JSX.Element {
  const {
    hydrated,
    createProject,
    createFromTemplate,
    importDocument,
  } = useCollages();
  const [activeTab, setActiveTab] = useState<TabId>('home');
  const [route, setRoute] = useState<Route>({ name: 'tabs' });

  if (!hydrated) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  const openProject = (project: CollageProject) => {
    setRoute({ name: 'editor', projectId: project.id });
  };

  const openTemplate = (template: CollageTemplate) => {
    setRoute({ name: 'template', template });
  };

  const importJson = async () => {
    try {
      const document = await importCollageJson();
      if (!document) {
        return;
      }
      const imported = importDocument(document);
      if (imported.documentType === 'collage-project') {
        setRoute({ name: 'editor', projectId: imported.id });
        return;
      }
      setRoute({ name: 'template', template: imported });
    } catch (error: unknown) {
      Alert.alert(
        'Unable to import JSON',
        error instanceof Error ? error.message : 'The selected file is not a valid Ratios document.',
      );
    }
  };

  if (route.name === 'new-project') {
    return (
      <NewProjectScreen
        onBack={() => setRoute({ name: 'tabs' })}
        onSelect={(aspectRatio) => {
          const project = createProject(aspectRatio);
          setRoute({ name: 'editor', projectId: project.id });
        }}
      />
    );
  }

  if (route.name === 'editor') {
    return (
      <EditorScreen
        onBack={() => {
          setActiveTab('projects');
          setRoute({ name: 'tabs' });
        }}
        onExport={() => setRoute({ name: 'export', projectId: route.projectId })}
        projectId={route.projectId}
      />
    );
  }

  if (route.name === 'export') {
    return (
      <ExportScreen
        onBack={() => setRoute({ name: 'editor', projectId: route.projectId })}
        projectId={route.projectId}
      />
    );
  }

  if (route.name === 'template') {
    return (
      <TemplateDetailScreen
        onBack={() => setRoute({ name: 'tabs' })}
        onUseTemplate={() => {
          const project = createFromTemplate(route.template);
          setRoute({ name: 'editor', projectId: project.id });
        }}
        template={route.template}
      />
    );
  }

  return (
    <View style={styles.app}>
      {activeTab === 'home' ? (
        <HomeScreen
          onCreate={() => setRoute({ name: 'new-project' })}
          onImport={() => void importJson()}
          onOpenProject={openProject}
          onOpenTemplate={openTemplate}
        />
      ) : null}
      {activeTab === 'templates' ? (
        <TemplatesScreen
          onOpenSettings={() => setActiveTab('settings')}
          onOpenTemplate={openTemplate}
        />
      ) : null}
      {activeTab === 'projects' ? <ProjectsScreen onOpenProject={openProject} /> : null}
      {activeTab === 'settings' ? (
        <SettingsScreen onImport={() => void importJson()} />
      ) : null}
      <BottomNav
        active={activeTab}
        onCreate={() => setRoute({ name: 'new-project' })}
        onSelect={setActiveTab}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  app: {
    backgroundColor: colors.background,
    flex: 1,
  },
  loading: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: 'center',
  },
});
