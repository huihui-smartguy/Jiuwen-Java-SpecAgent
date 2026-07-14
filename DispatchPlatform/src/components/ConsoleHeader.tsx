import { ChevronDown, Menu, X } from 'lucide-react';
import { useEffect, useRef, type Ref } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { getCopy } from '../i18n';
import type { AuthConfig, Language, SutTarget } from '../types';
import { AccountMenu } from './AccountMenu';
import { FairySparkLogo } from './FairySparkLogo';

export const navigationItems = [
  { label: 'Overview', to: '/', end: true },
  { label: 'Tasks', to: '/tasks' },
  { label: 'Observe', to: '/observation' },
  { label: 'Results', to: '/results' },
  { label: 'Scripts', to: '/scripts' },
  { label: 'Knowledge', to: '/knowledge' },
  { label: 'Settings', to: '/settings' }
] as const;

export interface ConsoleHeaderProps {
  language: Language;
  selectedObject: SutTarget;
  objects: readonly SutTarget[];
  auth?: AuthConfig;
  drawerOpen: boolean;
  objectFocusRequest: number;
  onObjectChange: (id: string) => void;
  onLanguageToggle: () => void;
  onDrawerOpenChange: (open: boolean) => void;
}

interface ObjectControlProps {
  language: Language;
  selectedObject: SutTarget;
  objects: readonly SutTarget[];
  testId: string;
  selectRef?: Ref<HTMLSelectElement>;
  onObjectChange: (id: string) => void;
}

function ObjectControl({
  language,
  selectedObject,
  objects,
  testId,
  selectRef,
  onObjectChange
}: ObjectControlProps) {
  const t = getCopy(language);

  return (
    <label className="object-control" data-testid={testId}>
      <span className="object-control__label">Object</span>
      <span className="object-control__summary" aria-hidden="true">
        <span className="object-control__identity">
          <strong>{selectedObject.name}</strong>
          <span>{selectedObject.version}</span>
        </span>
        <span className={`object-control__status object-control__status--${selectedObject.status}`}>
          <span aria-hidden="true" />
          {t[selectedObject.status]}
        </span>
        <ChevronDown aria-hidden="true" />
      </span>
      <select
        ref={selectRef}
        className="object-control__select"
        aria-label="Object"
        value={selectedObject.id}
        onChange={(event) => onObjectChange(event.target.value)}
      >
        {objects.map((object) => (
          <option key={object.id} value={object.id}>
            {object.name} · {object.version}
          </option>
        ))}
      </select>
    </label>
  );
}

export function ConsoleHeader({
  language,
  selectedObject,
  objects,
  auth,
  drawerOpen,
  objectFocusRequest,
  onObjectChange,
  onLanguageToggle,
  onDrawerOpenChange
}: ConsoleHeaderProps) {
  const location = useLocation();
  const t = getCopy(language);
  const drawerRef = useRef<HTMLElement>(null);
  const drawerTriggerRef = useRef<HTMLButtonElement>(null);
  const drawerCloseRef = useRef<HTMLButtonElement>(null);
  const desktopObjectRef = useRef<HTMLSelectElement>(null);
  const drawerObjectRef = useRef<HTMLSelectElement>(null);
  const lastObjectFocusRequestRef = useRef(0);
  const languageLabel = language === 'zh' ? t.switchToEnglish : t.switchToChinese;
  const languageText = language === 'zh' ? 'EN' : '中';

  useEffect(() => {
    onDrawerOpenChange(false);
  }, [location.pathname, onDrawerOpenChange]);

  useEffect(() => {
    if (!drawerOpen) {
      return undefined;
    }

    const drawer = drawerRef.current;
    const trigger = drawerTriggerRef.current;
    const focusableElements = () => Array.from(
      drawer?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      ) ?? []
    );
    const handleDrawerKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onDrawerOpenChange(false);
        return;
      }
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
    document.addEventListener('keydown', handleDrawerKeyDown);
    return () => {
      document.removeEventListener('keydown', handleDrawerKeyDown);
      trigger?.focus();
    };
  }, [drawerOpen, onDrawerOpenChange]);

  useEffect(() => {
    if (
      objectFocusRequest <= 0 ||
      objectFocusRequest === lastObjectFocusRequestRef.current
    ) {
      return;
    }
    lastObjectFocusRequestRef.current = objectFocusRequest;

    const isDrawerLayout = window.matchMedia?.('(max-width: 1179px)').matches ?? false;
    if (!isDrawerLayout) {
      desktopObjectRef.current?.focus();
      return;
    }

    onDrawerOpenChange(true);
    window.requestAnimationFrame(() => drawerObjectRef.current?.focus());
  }, [objectFocusRequest, onDrawerOpenChange]);

  const navigation = (closeDrawer = false) => (
    <nav className={closeDrawer ? 'mobile-navigation' : 'desktop-navigation'} aria-label="Primary navigation">
      {navigationItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={'end' in item ? item.end : undefined}
          className={({ isActive }) => `${closeDrawer ? 'mobile-nav-link' : 'desktop-nav-link'} ${isActive ? 'is-active' : ''}`}
          onClick={closeDrawer ? () => onDrawerOpenChange(false) : undefined}
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <>
      <header
        className="app-header"
        data-testid="testwise-command-rail"
        aria-hidden={drawerOpen || undefined}
        inert={drawerOpen}
      >
        <div className="app-header__inner">
          <NavLink className="brand-link" to="/" aria-label="Console home">
            <FairySparkLogo />
            <span>Console</span>
          </NavLink>

          {navigation()}

          <div className="app-header__actions">
            <div className="desktop-object-control">
              <ObjectControl
                language={language}
                selectedObject={selectedObject}
                objects={objects}
                testId="object-control"
                selectRef={desktopObjectRef}
                onObjectChange={onObjectChange}
              />
            </div>
            <button
              className="language-button header-language"
              type="button"
              aria-label={languageLabel}
              title={languageLabel}
              onClick={onLanguageToggle}
            >
              {languageText}
            </button>
            <AccountMenu auth={auth} language={language} />
            <button
              ref={drawerTriggerRef}
              className="mobile-menu-trigger"
              type="button"
              aria-label={drawerOpen ? t.closeNavigation : t.openNavigation}
              aria-expanded={drawerOpen}
              aria-controls="mobile-navigation-drawer"
              onClick={() => onDrawerOpenChange(!drawerOpen)}
            >
              {drawerOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
            </button>
          </div>
        </div>
      </header>

      {drawerOpen && (
        <div className="mobile-drawer-backdrop" onPointerDown={() => onDrawerOpenChange(false)}>
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
              <strong>{t.navigation}</strong>
              <button
                ref={drawerCloseRef}
                type="button"
                className="icon-button"
                aria-label={t.closeNavigation}
                onClick={() => onDrawerOpenChange(false)}
              >
                <X aria-hidden="true" />
              </button>
            </div>

            <ObjectControl
              language={language}
              selectedObject={selectedObject}
              objects={objects}
              testId="drawer-object-control"
              selectRef={drawerObjectRef}
              onObjectChange={onObjectChange}
            />
            {navigation(true)}
            <div className="mobile-drawer__controls">
              <button
                className="language-button"
                type="button"
                aria-label={languageLabel}
                title={languageLabel}
                onClick={onLanguageToggle}
              >
                {languageText}
              </button>
              <AccountMenu auth={auth} language={language} />
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
