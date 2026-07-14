import { useCallback, useEffect, useMemo, useState } from 'react';
import { Route, Routes } from 'react-router-dom';
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
  const [activeTask, setActiveTask] = useState(initialActiveTask);
  const [sessionTasks, setSessionTasks] = useState([initialActiveTask]);
  const [drawerOpen, setDrawerOpen] = useState(false);
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
    setActiveTask((current) => (current.task_id === task.task_id ? task : current));
    setSessionTasks((current) => {
      const hasTask = current.some((item) => item.task_id === task.task_id);
      const nextTasks = current.map((item) => (item.task_id === task.task_id ? task : item));
      return hasTask ? nextTasks : [task, ...nextTasks];
    });
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
        objectFocusRequest={0}
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
                {...sharedProps}
                sessionTasks={sessionTasks}
                onTaskCreated={handleTaskCreated}
                onTaskSelected={setActiveTask}
              />
            )}
          />
          <Route path="/observation" element={<Observation {...sharedProps} onTaskStatusChange={handleTaskStatusChange} />} />
          <Route path="/results" element={<Results {...sharedProps} />} />
          <Route path="/scripts" element={<Scripts {...sharedProps} />} />
          <Route path="/knowledge" element={<Knowledge {...sharedProps} />} />
          <Route path="/settings" element={<SettingsPage {...sharedProps} />} />
        </Routes>
      </main>
    </div>
  );
}
