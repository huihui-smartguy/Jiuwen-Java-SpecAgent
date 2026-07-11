import {
  Bell,
  Languages,
  Search,
} from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { NavLink, Route, Routes } from 'react-router-dom';
import { getCopy } from './i18n';
import { activeTask as initialActiveTask } from './data/mockData';
import { normalizeCreatedTask } from './api/client';
import type { Language, NormalizedTaskStatus, RuntimeConfig, SutTarget, TaskCreateResponse } from './types';
import { Dashboard } from './pages/Dashboard';
import { Tasks } from './pages/Tasks';
import { Observation } from './pages/Observation';
import { Results } from './pages/Results';
import { Scripts } from './pages/Scripts';
import { Knowledge } from './pages/Knowledge';
import { SettingsPage } from './pages/SettingsPage';
import { StatusBadge } from './components/StatusBadge';
import { AccountMenu } from './components/AccountMenu';

const navGroups = [
  { key: 'navOverview', items: [{ to: '/', key: 'dashboard' }] },
  {
    key: 'navExecution',
    items: [
      { to: '/tasks', key: 'tasks' },
      { to: '/observation', key: 'observation' }
    ]
  },
  { key: 'navAnalysis', items: [{ to: '/results', key: 'results' }] },
  {
    key: 'navAssets',
    items: [
      { to: '/scripts', key: 'scripts' },
      { to: '/knowledge', key: 'knowledge' }
    ]
  },
  { key: 'navSystem', items: [{ to: '/settings', key: 'settings' }] }
] as const;

export function AppShell({ runtimeConfig }: { runtimeConfig: RuntimeConfig }) {
  const [language, setLanguage] = useState<Language>(runtimeConfig.defaultLanguage);
  const [selectedSutId, setSelectedSutId] = useState(runtimeConfig.sutTargets[0].id);
  const [activeTask, setActiveTask] = useState(initialActiveTask);
  const [sessionTasks, setSessionTasks] = useState([initialActiveTask]);
  const t = getCopy(language);
  const selectedSut = useMemo<SutTarget>(
    () =>
      runtimeConfig.sutTargets.find((sut) => sut.id === selectedSutId) ??
      runtimeConfig.sutTargets[0],
    [runtimeConfig.sutTargets, selectedSutId]
  );

  const sharedProps = {
    language,
    selectedSut,
    activeTask,
    runtimeConfig
  };
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
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <aside className="sidebar" aria-label="Primary">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <div>
            <strong>{t.appName}</strong>
            <span>{t.appSubtitle}</span>
          </div>
        </div>
        <nav className="nav-list" aria-label="TestWise navigation">
          {navGroups.map((group) => (
            <div className="nav-group" key={group.key}>
              <p className="nav-group-title">{t[group.key]}</p>
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                >
                  <span className="nav-dot" aria-hidden="true" />
                  <span>{t[item.key]}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      <div className="workspace">
        <header className="topbar" data-testid="testwise-command-rail">
          <label className="sut-command" data-testid="sut-command">
            <span>{t.sutShort}</span>
            <select
              aria-label={t.sutSelector}
              value={selectedSutId}
              onChange={(event) => setSelectedSutId(event.target.value)}
            >
              {runtimeConfig.sutTargets.map((sut) => (
                <option key={sut.id} value={sut.id}>
                  {sut.name} · {sut.version}
                </option>
              ))}
            </select>
          </label>
          <div className="search-box" role="search" data-testid="global-search-command">
            <Search aria-hidden="true" />
            <input aria-label={t.globalSearch} placeholder={t.globalSearch} />
          </div>
          <button className="topbar-search-trigger" type="button" aria-label={t.globalSearch} title={t.globalSearch}>
            <Search aria-hidden="true" />
          </button>
          <div className="topbar__utilities">
            <StatusBadge status={selectedSut.status} language={language} />
            <button
              className="icon-button"
              type="button"
              aria-label={t.notifications}
              title={t.notifications}
            >
              <Bell aria-hidden="true" />
            </button>
            <button
              className="language-button"
              type="button"
              onClick={() => setLanguage(language === 'zh' ? 'en' : 'zh')}
            >
              <Languages aria-hidden="true" />
              {language === 'zh' ? t.english : t.chinese}
            </button>
            <AccountMenu auth={runtimeConfig.auth} language={language} />
          </div>
        </header>

        <main id="main-content" className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard {...sharedProps} />} />
            <Route
              path="/tasks"
              element={<Tasks {...sharedProps} sessionTasks={sessionTasks} onTaskCreated={handleTaskCreated} />}
            />
            <Route
              path="/observation"
              element={<Observation {...sharedProps} onTaskStatusChange={handleTaskStatusChange} />}
            />
            <Route path="/results" element={<Results {...sharedProps} />} />
            <Route path="/scripts" element={<Scripts {...sharedProps} />} />
            <Route path="/knowledge" element={<Knowledge {...sharedProps} />} />
            <Route path="/settings" element={<SettingsPage {...sharedProps} />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
