import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { normalizeCreatedTask } from './api/client';
import { ConsoleHeader } from './components/ConsoleHeader';
import { activeTask as initialActiveTask } from './data/mockData';
import { Dashboard } from './pages/Dashboard';
import { Knowledge } from './pages/Knowledge';
import { Observation } from './pages/Observation';
import { ReportDetailPage } from './pages/ReportDetailPage';
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
  const location = useLocation();
  const [language, setLanguage] = useState<Language>(runtimeConfig.defaultLanguage);
  const [selectedSutId, setSelectedSutId] = useState(runtimeConfig.sutTargets[0].id);
  const [activeTask, setActiveTask] = useState<NormalizedTaskStatus | null>(() => (
    runtimeConfig.enableMockFallback
      ? { ...initialActiveTask, sourceSut: { ...runtimeConfig.sutTargets[0] } }
      : null
  ));
  const [sessionTasks, setSessionTasks] = useState<NormalizedTaskStatus[]>(() => (
    runtimeConfig.enableMockFallback
      ? [{ ...initialActiveTask, sourceSut: { ...runtimeConfig.sutTargets[0] } }]
      : []
  ));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [objectFocusRequest, setObjectFocusRequest] = useState(0);
  const mainContentRef = useRef<HTMLElement>(null);
  const previousPathRef = useRef(location.pathname);
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

  useEffect(() => {
    if (previousPathRef.current === location.pathname) {
      return;
    }

    previousPathRef.current = location.pathname;
    mainContentRef.current?.focus({ preventScroll: true });
  }, [location.pathname]);

  const sharedProps = { language, selectedSut, activeTask, runtimeConfig };
  const handleTaskCreated = useCallback((response: TaskCreateResponse) => {
    const task = {
      ...normalizeCreatedTask(response),
      sourceSut: { ...selectedSut }
    };
    setActiveTask(task);
    setSessionTasks((current) => [task, ...current.filter((item) => item.task_id !== task.task_id)]);
  }, [selectedSut]);
  const handleTaskStatusChange = useCallback((task: NormalizedTaskStatus) => {
    setActiveTask((current) => (current?.task_id === task.task_id
      ? {
          ...task,
          version: task.version ?? current.version,
          sourceSut: task.sourceSut ?? current.sourceSut
        }
      : current));
    setSessionTasks((current) => {
      const hasTask = current.some((item) => item.task_id === task.task_id);
      const nextTasks = current.map((item) => (item.task_id === task.task_id
        ? {
            ...task,
            version: task.version ?? item.version,
            sourceSut: task.sourceSut ?? item.sourceSut
          }
        : item));
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
        ref={mainContentRef}
        id="main-content"
        className="main-content"
        tabIndex={-1}
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
          <Route
            path="/results"
            element={<Results {...sharedProps} sessionTasks={sessionTasks} />}
          />
          <Route
            path="/results/:reportId"
            element={(
              <ReportDetailPage
                language={language}
                selectedSut={selectedSut}
                runtimeConfig={runtimeConfig}
              />
            )}
          />
          <Route path="/scripts" element={<Scripts {...sharedProps} />} />
          <Route path="/knowledge" element={<Knowledge {...sharedProps} />} />
          <Route
            path="/settings"
            element={(
              <SettingsPage
                language={language}
                selectedSut={selectedSut}
                runtimeConfig={runtimeConfig}
                onObjectChange={setSelectedSutId}
                onLanguageChange={setLanguage}
              />
            )}
          />
        </Routes>
      </main>
    </div>
  );
}
