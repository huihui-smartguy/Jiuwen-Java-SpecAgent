import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
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
import {
  applyReducedMotionPreference,
  loadConsolePreferences,
  subscribeToConsolePreferences,
  type ConsolePreferencesV1
} from './preferences';
import type {
  Language,
  NormalizedTaskStatus,
  RuntimeConfig,
  SutTarget,
  TaskCreateResponse
} from './types';

function taskSourceIdentity(task: NormalizedTaskStatus, fallbackApiBaseUrl: string) {
  const source = (task.sourceSut?.apiBaseUrl || fallbackApiBaseUrl || '/api').trim();
  return source === '/' ? source : source.replace(/\/+$/, '');
}

function isSameTask(
  left: NormalizedTaskStatus,
  right: NormalizedTaskStatus,
  fallbackApiBaseUrl: string
) {
  return left.task_id === right.task_id
    && taskSourceIdentity(left, fallbackApiBaseUrl) === taskSourceIdentity(right, fallbackApiBaseUrl);
}

function observationLaunchFromState(state: unknown) {
  if (!state || typeof state !== 'object' || !('testwiseLaunch' in state)) {
    return undefined;
  }
  const launch = (state as { testwiseLaunch?: unknown }).testwiseLaunch;
  if (!launch || typeof launch !== 'object') {
    return undefined;
  }
  const taskId = 'taskId' in launch ? (launch as { taskId?: unknown }).taskId : undefined;
  const apiBaseUrl = 'apiBaseUrl' in launch
    ? (launch as { apiBaseUrl?: unknown }).apiBaseUrl
    : undefined;
  return typeof taskId === 'string' && taskId.trim()
    && typeof apiBaseUrl === 'string' && apiBaseUrl.trim()
    ? { taskId, apiBaseUrl }
    : undefined;
}

export function AppShell({ runtimeConfig }: { runtimeConfig: RuntimeConfig }) {
  const location = useLocation();
  const [preferences, setPreferences] = useState<ConsolePreferencesV1>(() => (
    loadConsolePreferences(runtimeConfig)
  ));
  const [language, setLanguage] = useState<Language>(() => preferences.language);
  const [selectedSutId, setSelectedSutId] = useState(() => preferences.defaultSutId);
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

  useEffect(() => (
    applyReducedMotionPreference(preferences.reducedMotion)
  ), [preferences.reducedMotion]);

  useEffect(() => subscribeToConsolePreferences(runtimeConfig, (nextPreferences) => {
    setPreferences(nextPreferences);
    setSelectedSutId(nextPreferences.defaultSutId);
    setLanguage(nextPreferences.language);
  }), [runtimeConfig]);

  useEffect(() => {
    if (previousPathRef.current === location.pathname) {
      return;
    }

    previousPathRef.current = location.pathname;
    mainContentRef.current?.focus({ preventScroll: true });
  }, [location.pathname]);

  const sharedProps = { language, selectedSut, activeTask, runtimeConfig };
  const observationLaunch = observationLaunchFromState(location.state);
  const handleTaskCreated = useCallback((response: TaskCreateResponse) => {
    const task = {
      ...normalizeCreatedTask(response),
      sourceSut: { ...selectedSut }
    };
    setActiveTask(task);
    setSessionTasks((current) => [
      task,
      ...current.filter((item) => !isSameTask(item, task, runtimeConfig.apiBaseUrl))
    ]);
  }, [runtimeConfig.apiBaseUrl, selectedSut]);
  const handleTaskStatusChange = useCallback((task: NormalizedTaskStatus) => {
    setActiveTask((current) => (current && isSameTask(current, task, runtimeConfig.apiBaseUrl)
      ? {
          ...task,
          version: task.version ?? current.version,
          sourceSut: task.sourceSut ?? current.sourceSut
        }
      : current));
    setSessionTasks((current) => {
      const hasTask = current.some((item) => isSameTask(item, task, runtimeConfig.apiBaseUrl));
      const nextTasks = current.map((item) => (isSameTask(item, task, runtimeConfig.apiBaseUrl)
        ? {
            ...task,
            version: task.version ?? item.version,
            sourceSut: task.sourceSut ?? item.sourceSut
          }
        : item));
      return hasTask ? nextTasks : [task, ...nextTasks];
    });
  }, [runtimeConfig.apiBaseUrl]);
  const handleRequestObjectChange = useCallback(() => {
    setObjectFocusRequest((current) => current + 1);
  }, []);
  const handlePreferencesChange = useCallback((nextPreferences: ConsolePreferencesV1) => {
    setPreferences(nextPreferences);
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
            element={(
              <Observation
                language={language}
                selectedSut={selectedSut}
                activeTask={activeTask}
                runtimeConfig={runtimeConfig}
                launchedTask={observationLaunch}
                onTaskStatusChange={handleTaskStatusChange}
              />
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
                reportDownloadFormat={preferences.reportDownloadFormat}
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
                preferences={preferences}
                onObjectChange={setSelectedSutId}
                onLanguageChange={setLanguage}
                onPreferencesChange={handlePreferencesChange}
              />
            )}
          />
        </Routes>
      </main>
    </div>
  );
}
