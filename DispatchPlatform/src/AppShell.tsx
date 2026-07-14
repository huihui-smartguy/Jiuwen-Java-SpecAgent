import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { normalizeCreatedTask } from './api/client';
import { ConsoleHeader } from './components/ConsoleHeader';
import { activeTask as initialActiveTask } from './data/mockData';
import { Dashboard } from './pages/Dashboard';
import { Knowledge } from './pages/Knowledge';
import { Observation } from './pages/Observation';
import { Results } from './pages/Results';
import { Scripts } from './pages/Scripts';
import { SettingsPage } from './pages/SettingsPage';
import { Tasks } from './pages/Tasks';
import type {
  Language,
  NormalizedTaskStatus,
  RuntimeConfig,
  SutTarget,
  TaskCreateResponse
} from './types';

export function AppShell({ runtimeConfig }: { runtimeConfig: RuntimeConfig }) {
  const [language, setLanguage] = useState<Language>(runtimeConfig.defaultLanguage);
  const [selectedSutId, setSelectedSutId] = useState(runtimeConfig.sutTargets[0].id);
  const [activeTask, setActiveTask] = useState<NormalizedTaskStatus | null>(() => (
    runtimeConfig.enableMockFallback ? initialActiveTask : null
  ));
  const [sessionTasks, setSessionTasks] = useState<NormalizedTaskStatus[]>(() => (
    runtimeConfig.enableMockFallback ? [initialActiveTask] : []
  ));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [objectFocusRequest, setObjectFocusRequest] = useState(0);
  const selectedSut = useMemo<SutTarget>(
    () => runtimeConfig.sutTargets.find((sut) => sut.id === selectedSutId) ?? runtimeConfig.sutTargets[0],
    [runtimeConfig.sutTargets, selectedSutId]
  );

  useEffect(() => {
    document.documentElement.classList.remove('lang-zh', 'lang-en');
    document.documentElement.classList.add(`lang-${language}`);
    document.documentElement.lang = language;
    return () => {
      document.documentElement.classList.remove(`lang-${language}`);
      if (document.documentElement.lang === language) {
        document.documentElement.removeAttribute('lang');
      }
    };
  }, [language]);

  const sharedProps = { language, selectedSut, activeTask, runtimeConfig };
  const handleTaskCreated = useCallback((response: TaskCreateResponse) => {
    const task = normalizeCreatedTask(response);
    setActiveTask(task);
    setSessionTasks((current) => [task, ...current.filter((item) => item.task_id !== task.task_id)]);
  }, []);
  const handleTaskStatusChange = useCallback((task: NormalizedTaskStatus) => {
    setActiveTask((current) => (current?.task_id === task.task_id ? task : current));
    setSessionTasks((current) => {
      const hasTask = current.some((item) => item.task_id === task.task_id);
      const nextTasks = current.map((item) => (item.task_id === task.task_id ? task : item));
      return hasTask ? nextTasks : [task, ...nextTasks];
    });
  }, []);
  const handleRequestObjectChange = useCallback(() => {
    setObjectFocusRequest((current) => current + 1);
  }, []);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <ConsoleHeader
        language={language}
        selectedObject={selectedSut}
        objects={runtimeConfig.sutTargets}
        auth={runtimeConfig.auth}
        drawerOpen={drawerOpen}
        objectFocusRequest={objectFocusRequest}
        onObjectChange={setSelectedSutId}
        onLanguageToggle={() => setLanguage((current) => (current === 'zh' ? 'en' : 'zh'))}
        onDrawerOpenChange={setDrawerOpen}
      />

      <main
        id="main-content"
        className="main-content"
        aria-hidden={drawerOpen || undefined}
        inert={drawerOpen}
      >
        <Routes>
          <Route path="/" element={<Dashboard {...sharedProps} />} />
          <Route
            path="/tasks"
            element={(
              <Tasks
                language={language}
                selectedSut={selectedSut}
                runtimeConfig={runtimeConfig}
                onTaskCreated={handleTaskCreated}
                onRequestObjectChange={handleRequestObjectChange}
              />
            )}
          />
          <Route
            path="/observation"
            element={activeTask ? (
              <Observation
                language={language}
                selectedSut={selectedSut}
                activeTask={activeTask}
                runtimeConfig={runtimeConfig}
                onTaskStatusChange={handleTaskStatusChange}
              />
            ) : (
              <Navigate to="/tasks" replace />
            )}
          />
          <Route path="/results" element={<Results {...sharedProps} />} />
          <Route path="/scripts" element={<Scripts {...sharedProps} />} />
          <Route path="/knowledge" element={<Knowledge {...sharedProps} />} />
          <Route path="/settings" element={<SettingsPage {...sharedProps} />} />
        </Routes>
      </main>
    </div>
  );
}
