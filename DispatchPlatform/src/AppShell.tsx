import {
  Activity,
  BarChart3,
  Bell,
  BookOpen,
  ChevronDown,
  Languages,
  LayoutDashboard,
  Menu,
  PlayCircle,
  ScrollText,
  Settings,
  X
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent
} from 'react';
import { NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { normalizeCreatedTask } from './api/client';
import { AccountMenu } from './components/AccountMenu';
import { StatusBadge } from './components/StatusBadge';
import { TestWiseLogo } from './components/TestWiseLogo';
import { activeTask as initialActiveTask } from './data/mockData';
import { getCopy } from './i18n';
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

const navGroups = [
  { key: 'navOverview', items: [{ to: '/', key: 'dashboard', icon: LayoutDashboard }] },
  {
    key: 'navExecution',
    items: [
      { to: '/tasks', key: 'tasks', icon: PlayCircle },
      { to: '/observation', key: 'observation', icon: Activity }
    ]
  },
  { key: 'navAnalysis', items: [{ to: '/results', key: 'results', icon: BarChart3 }] },
  {
    key: 'navAssets',
    items: [
      { to: '/scripts', key: 'scripts', icon: ScrollText },
      { to: '/knowledge', key: 'knowledge', icon: BookOpen }
    ]
  },
  { key: 'navSystem', items: [{ to: '/settings', key: 'settings', icon: Settings }] }
] as const;

type NavGroupKey = (typeof navGroups)[number]['key'];

export function AppShell({ runtimeConfig }: { runtimeConfig: RuntimeConfig }) {
  const [language, setLanguage] = useState<Language>(runtimeConfig.defaultLanguage);
  const [selectedSutId, setSelectedSutId] = useState(runtimeConfig.sutTargets[0].id);
  const [activeTask, setActiveTask] = useState(initialActiveTask);
  const [sessionTasks, setSessionTasks] = useState([initialActiveTask]);
  const [openGroup, setOpenGroup] = useState<NavGroupKey | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();
  const navigationRef = useRef<HTMLElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const drawerTriggerRef = useRef<HTMLButtonElement>(null);
  const drawerCloseRef = useRef<HTMLButtonElement>(null);
  const triggerRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const clickedGroupRef = useRef<NavGroupKey | null>(null);
  const t = getCopy(language);
  const selectedSut = useMemo<SutTarget>(
    () => runtimeConfig.sutTargets.find((sut) => sut.id === selectedSutId) ?? runtimeConfig.sutTargets[0],
    [runtimeConfig.sutTargets, selectedSutId]
  );

  const cancelScheduledClose = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = undefined;
    }
  }, []);
  const closeNavigation = useCallback(() => {
    cancelScheduledClose();
    clickedGroupRef.current = null;
    setOpenGroup(null);
  }, [cancelScheduledClose]);
  const scheduleClose = useCallback(() => {
    cancelScheduledClose();
    closeTimerRef.current = setTimeout(closeNavigation, 180);
  }, [cancelScheduledClose, closeNavigation]);

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
    const onOutsidePress = (event: PointerEvent) => {
      if (navigationRef.current && !navigationRef.current.contains(event.target as Node)) {
        closeNavigation();
      }
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeNavigation();
        setDrawerOpen(false);
      }
    };
    document.addEventListener('pointerdown', onOutsidePress);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('pointerdown', onOutsidePress);
      document.removeEventListener('keydown', onEscape);
      cancelScheduledClose();
    };
  }, [cancelScheduledClose, closeNavigation]);

  useEffect(() => {
    if (!drawerOpen) {
      return;
    }

    const drawer = drawerRef.current;
    const trigger = drawerTriggerRef.current;
    const focusableElements = () => Array.from(
      drawer?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      ) ?? []
    );
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') {
        return;
      }
      const focusable = focusableElements();
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) {
        return;
      }
      if (!drawer?.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    drawerCloseRef.current?.focus();
    document.addEventListener('keydown', trapFocus);
    return () => {
      document.removeEventListener('keydown', trapFocus);
      trigger?.focus();
    };
  }, [drawerOpen]);

  useEffect(() => {
    closeNavigation();
    setDrawerOpen(false);
  }, [closeNavigation, location.pathname]);

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

  const openSibling = (index: number, direction: -1 | 1) => {
    const nextIndex = (index + direction + navGroups.length) % navGroups.length;
    const nextGroup = navGroups[nextIndex];
    clickedGroupRef.current = null;
    setOpenGroup(nextGroup.key);
    triggerRefs.current[nextIndex]?.focus();
  };

  const handleTriggerKeyDown = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    index: number,
    groupKey: NavGroupKey
  ) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      openSibling(index, event.key === 'ArrowRight' ? 1 : -1);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpenGroup(groupKey);
      window.setTimeout(() => {
        navigationRef.current?.querySelector<HTMLAnchorElement>(`[data-menu="${groupKey}"] a`)?.focus();
      }, 0);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      closeNavigation();
      event.currentTarget.focus();
    }
  };

  const handleMenuItemKeyDown = (event: ReactKeyboardEvent<HTMLAnchorElement>, groupIndex: number) => {
    const menu = event.currentTarget.closest('[role="menu"]');
    const items = Array.from(menu?.querySelectorAll<HTMLAnchorElement>('a') ?? []);
    const currentIndex = items.indexOf(event.currentTarget);
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      items[(currentIndex + direction + items.length) % items.length]?.focus();
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      items[event.key === 'Home' ? 0 : items.length - 1]?.focus();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      closeNavigation();
      triggerRefs.current[groupIndex]?.focus();
    }
  };

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <header
        className="app-header"
        data-testid="testwise-command-rail"
        aria-hidden={drawerOpen || undefined}
        inert={drawerOpen}
      >
        <div className="app-header__inner">
          <NavLink className="brand-link" to="/" aria-label="TestWise home">
            <TestWiseLogo size={30} />
            <span>TestWise</span>
          </NavLink>

          <nav
            className="desktop-navigation"
            aria-label="Primary navigation"
            ref={navigationRef}
            onPointerEnter={cancelScheduledClose}
            onPointerLeave={scheduleClose}
          >
            {navGroups.map((group, groupIndex) => {
              const expanded = openGroup === group.key;
              const active = group.items.some((item) => item.to === location.pathname);
              return (
                <div
                  className="desktop-nav-group"
                  key={group.key}
                  onPointerEnter={() => {
                    cancelScheduledClose();
                    clickedGroupRef.current = null;
                    setOpenGroup(group.key);
                  }}
                >
                  <button
                    ref={(node) => { triggerRefs.current[groupIndex] = node; }}
                    className={`desktop-nav-trigger ${active ? 'is-active' : ''}`}
                    type="button"
                    aria-expanded={expanded}
                    aria-haspopup="menu"
                    aria-controls={`menu-${group.key}`}
                    onClick={() => {
                      if (openGroup === group.key && clickedGroupRef.current === group.key) {
                        closeNavigation();
                      } else {
                        clickedGroupRef.current = group.key;
                        setOpenGroup(group.key);
                      }
                    }}
                    onFocus={() => setOpenGroup(group.key)}
                    onKeyDown={(event) => handleTriggerKeyDown(event, groupIndex, group.key)}
                  >
                    {t[group.key]}
                    <ChevronDown aria-hidden="true" />
                  </button>
                  {expanded && (
                    <div
                      className="desktop-nav-menu"
                      id={`menu-${group.key}`}
                      data-menu={group.key}
                      role="menu"
                      aria-label={t[group.key]}
                    >
                      {group.items.map((item) => {
                        const ItemIcon = item.icon;
                        return (
                          <NavLink
                            key={item.to}
                            to={item.to}
                            end={item.to === '/'}
                            role="menuitem"
                            className={({ isActive }) => `desktop-menu-item ${isActive ? 'is-active' : ''}`}
                            onKeyDown={(event) => handleMenuItemKeyDown(event, groupIndex)}
                          >
                            <ItemIcon aria-hidden="true" />
                            <span>{t[item.key]}</span>
                          </NavLink>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          <div className="app-header__actions">
            <label className="environment-control" data-testid="sut-command">
              <span>environment</span>
              <select
                aria-label="environment"
                value={selectedSutId}
                onChange={(event) => setSelectedSutId(event.target.value)}
              >
                {runtimeConfig.sutTargets.map((sut) => (
                  <option key={sut.id} value={sut.id}>{sut.name} · {sut.version}</option>
                ))}
              </select>
            </label>
            <div className="desktop-health"><StatusBadge status={selectedSut.status} language={language} /></div>
            <button className="icon-button header-notification" type="button" aria-label={t.notifications} title={t.notifications}>
              <Bell aria-hidden="true" />
            </button>
            <button
              className="language-button header-language"
              type="button"
              onClick={() => setLanguage(language === 'zh' ? 'en' : 'zh')}
            >
              <Languages aria-hidden="true" />
              <span>{language === 'zh' ? t.english : t.chinese}</span>
            </button>
            <AccountMenu auth={runtimeConfig.auth} language={language} />
            <button
              ref={drawerTriggerRef}
              className="mobile-menu-trigger"
              type="button"
              aria-label={drawerOpen ? t.closeNavigation : t.openNavigation}
              aria-expanded={drawerOpen}
              aria-controls="mobile-navigation-drawer"
              onClick={() => setDrawerOpen((current) => !current)}
            >
              {drawerOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
            </button>
          </div>
        </div>
      </header>

      {drawerOpen && (
        <div className="mobile-drawer-backdrop" onPointerDown={() => setDrawerOpen(false)}>
          <aside
            id="mobile-navigation-drawer"
            ref={drawerRef}
            className="mobile-drawer"
            role="dialog"
            aria-modal="true"
            aria-label={t.navigation}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <div className="mobile-drawer__heading">
              <span>{t.navigation}</span>
              <button ref={drawerCloseRef} type="button" className="icon-button" aria-label={t.closeNavigation} onClick={() => setDrawerOpen(false)}>
                <X aria-hidden="true" />
              </button>
            </div>
            <label className="mobile-environment-control">
              <span>environment</span>
              <select
                aria-label="Mobile environment"
                value={selectedSutId}
                onChange={(event) => setSelectedSutId(event.target.value)}
              >
                {runtimeConfig.sutTargets.map((sut) => (
                  <option key={sut.id} value={sut.id}>{sut.name} · {sut.version}</option>
                ))}
              </select>
              <StatusBadge status={selectedSut.status} language={language} />
            </label>
            <nav className="mobile-navigation" aria-label={t.navigation}>
              {navGroups.map((group) => (
                <section key={group.key} className="mobile-nav-group">
                  <h2>{t[group.key]}</h2>
                  {group.items.map((item) => {
                    const ItemIcon = item.icon;
                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.to === '/'}
                        className={({ isActive }) => `mobile-nav-link ${isActive ? 'is-active' : ''}`}
                        onClick={() => setDrawerOpen(false)}
                      >
                        <ItemIcon aria-hidden="true" />
                        {t[item.key]}
                      </NavLink>
                    );
                  })}
                </section>
              ))}
            </nav>
          </aside>
        </div>
      )}

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
