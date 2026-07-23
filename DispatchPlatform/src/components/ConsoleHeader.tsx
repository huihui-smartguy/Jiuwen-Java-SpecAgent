import { Check, ChevronDown, Menu, Search, X } from 'lucide-react';
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type Ref
} from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { getCopy } from '../i18n';
import {
  groupObjectsByProduct,
  objectIdentityLabel,
  objectMatchesSearch,
  objectOptionLabel,
  productDisplayLabel,
  sceneDisplayLabel
} from '../objectLabels';
import type { AuthConfig, Language, SutTarget } from '../types';
import { AccountMenu } from './AccountMenu';
import { GradientGhostLogo } from './GradientGhostLogo';

export const navigationItems = [
  { labels: { en: 'Overview', zh: '总览' }, to: '/', end: true },
  { labels: { en: 'Tasks', zh: '任务' }, to: '/tasks' },
  { labels: { en: 'Observe', zh: '观测' }, to: '/observation' },
  { labels: { en: 'Results', zh: '结果' }, to: '/results' },
  { labels: { en: 'Scripts', zh: '脚本' }, to: '/scripts' },
  { labels: { en: 'Knowledge', zh: '知识' }, to: '/knowledge' },
  { labels: { en: 'Settings', zh: '设置' }, to: '/settings' }
] as const;

export interface ConsoleHeaderProps {
  language: Language;
  selectedObject: SutTarget;
  objects: readonly SutTarget[];
  auth?: AuthConfig;
  drawerOpen: boolean;
  objectFocusRequest: number;
  objectMetadata?: Readonly<Record<string, { scriptCount: number }>>;
  catalogState?: 'connecting' | 'live' | 'polling' | 'stale' | 'unavailable' | 'mock';
  onObjectChange: (id: string) => void;
  onLanguageToggle: () => void;
  onDrawerOpenChange: (open: boolean) => void;
}

interface ObjectControlProps {
  language: Language;
  selectedObject: SutTarget;
  objects: readonly SutTarget[];
  objectMetadata?: Readonly<Record<string, { scriptCount: number }>>;
  catalogState?: ConsoleHeaderProps['catalogState'];
  testId: string;
  triggerRef?: Ref<HTMLButtonElement>;
  onObjectChange: (id: string) => void;
}

const pickerCopy = {
  en: {
    object: 'Object',
    chooseObject: 'Choose Object',
    product: 'Product',
    scene: 'Scene',
    search: 'Search products or scenes',
    results: 'Available Objects',
    empty: 'No Objects match this search.',
    removed: 'Removed',
    scripts: (count: number) => `${count} ${count === 1 ? 'script' : 'scripts'}`,
    states: {
      connecting: 'Connecting',
      live: 'Live',
      polling: 'Updating',
      stale: 'Stale',
      unavailable: 'Unavailable',
      mock: 'Demo data'
    }
  },
  zh: {
    object: 'Object',
    chooseObject: '选择 Object',
    product: '产品',
    scene: '场景',
    search: '搜索产品或场景',
    results: '可用 Object',
    empty: '没有匹配的 Object。',
    removed: '已移除',
    scripts: (count: number) => `${count} 个脚本`,
    states: {
      connecting: '正在连接',
      live: '实时',
      polling: '正在更新',
      stale: '数据可能过期',
      unavailable: '不可用',
      mock: '演示数据'
    }
  }
} as const;

function ObjectControl({
  language,
  selectedObject,
  objects,
  objectMetadata,
  catalogState,
  testId,
  triggerRef: externalTriggerRef,
  onObjectChange
}: ObjectControlProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const controlRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef(new Map<string, HTMLButtonElement>());
  const pickerId = useId();
  const copy = pickerCopy[language];
  const matchingObjects = useMemo(
    () => objects.filter((object) => objectMatchesSearch(object, query)),
    [objects, query]
  );
  const groups = useMemo(() => groupObjectsByProduct(matchingObjects), [matchingObjects]);
  const selectedIdentity = objectIdentityLabel(selectedObject);
  const selectedObjectIsLive = objects.some((object) => object.id === selectedObject.id);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!controlRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      return;
    }
    searchRef.current?.focus();
  }, [open]);

  const closeAndFocusTrigger = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  const chooseObject = (id: string) => {
    onObjectChange(id);
    closeAndFocusTrigger();
  };

  const focusOption = (index: number) => {
    const boundedIndex = Math.max(0, Math.min(index, matchingObjects.length - 1));
    const object = matchingObjects[boundedIndex];
    if (object) {
      optionRefs.current.get(object.id)?.focus();
    }
  };

  const handleSearchKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      closeAndFocusTrigger();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      focusOption(0);
    }
  };

  const handleOptionKeyDown = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    objectIndex: number,
    objectId: string
  ) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      closeAndFocusTrigger();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      focusOption(objectIndex + 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (objectIndex === 0) {
        searchRef.current?.focus();
      } else {
        focusOption(objectIndex - 1);
      }
    } else if (event.key === 'Home') {
      event.preventDefault();
      focusOption(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      focusOption(matchingObjects.length - 1);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      chooseObject(objectId);
    }
  };

  const handleTriggerKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
    }
  };

  return (
    <div
      ref={controlRef}
      className={`object-control ${open ? 'is-open' : ''}`}
      data-testid={testId}
    >
      <button
        ref={(element) => {
          triggerRef.current = element;
          if (typeof externalTriggerRef === 'function') {
            externalTriggerRef(element);
          } else if (externalTriggerRef) {
            externalTriggerRef.current = element;
          }
        }}
        type="button"
        className="object-control__trigger"
        aria-label={[
          `${copy.chooseObject}: ${selectedIdentity}`,
          !selectedObjectIsLive ? copy.removed : undefined
        ].filter(Boolean).join(' · ')}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={pickerId}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className="object-control__label">{copy.object}</span>
        <span className="object-control__summary" aria-hidden="true">
          <span className="object-control__identity">
            <strong>{selectedIdentity}</strong>
          </span>
          <ChevronDown aria-hidden="true" />
        </span>
      </button>

      {open && (
        <div
          id={pickerId}
          className="object-picker"
          role="dialog"
          aria-label={copy.chooseObject}
        >
          <div className="object-picker__header">
            <div>
              <strong>{copy.chooseObject}</strong>
              {catalogState && (
                <span
                  className={`object-picker__state object-picker__state--${catalogState}`}
                  role="status"
                >
                  <span aria-hidden="true" />
                  {copy.states[catalogState]}
                </span>
              )}
            </div>
            <label className="object-picker__search">
              <Search aria-hidden="true" />
              <span className="sr-only">{copy.search}</span>
              <input
                ref={searchRef}
                type="search"
                value={query}
                placeholder={copy.search}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={handleSearchKeyDown}
              />
            </label>
          </div>

          <div className="object-picker__labels" aria-hidden="true">
            <span>{copy.product}</span>
            <span>{copy.scene}</span>
          </div>

          {groups.length > 0 ? (
            <div className="object-picker__list" role="listbox" aria-label={copy.results}>
              {groups.map((group, groupIndex) => {
                const groupId = `${pickerId}-product-${groupIndex}`;
                return (
                  <div
                    key={group.product}
                    className="object-picker__group"
                    role="group"
                    aria-labelledby={groupId}
                  >
                    <div id={groupId} className="object-picker__product">
                      {productDisplayLabel(group.product)}
                    </div>
                    <div className="object-picker__scenes">
                      {group.objects.map((object) => {
                        const objectIndex = matchingObjects.findIndex(
                          (candidate) => candidate.id === object.id
                        );
                        const scriptCount = objectMetadata?.[object.id]?.scriptCount
                          ?? ('scriptCount' in object && typeof object.scriptCount === 'number'
                            ? object.scriptCount
                            : undefined);
                        const selected = object.id === selectedObject.id;
                        const baseIdentity = objectIdentityLabel(object);
                        const optionIdentity = objectOptionLabel(object, objects);
                        const disambiguator = optionIdentity === baseIdentity
                          ? undefined
                          : object.id;
                        return (
                          <button
                            key={object.id}
                            ref={(element) => {
                              if (element) {
                                optionRefs.current.set(object.id, element);
                              } else {
                                optionRefs.current.delete(object.id);
                              }
                            }}
                            type="button"
                            className={`object-picker__option ${selected ? 'is-selected' : ''}`}
                            role="option"
                            aria-selected={selected}
                            aria-label={[
                              optionIdentity,
                              scriptCount !== undefined
                                ? copy.scripts(scriptCount)
                                : undefined
                            ].filter(Boolean).join(' · ')}
                            onClick={() => chooseObject(object.id)}
                            onKeyDown={(event) => handleOptionKeyDown(
                              event,
                              objectIndex,
                              object.id
                            )}
                          >
                            <span className="object-picker__option-copy">
                              <strong>
                                {sceneDisplayLabel(object.scene)}
                                {disambiguator ? ` · ${disambiguator}` : ''}
                              </strong>
                              {scriptCount !== undefined && (
                                <small>{copy.scripts(scriptCount)}</small>
                              )}
                            </span>
                            {selected && <Check aria-hidden="true" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="object-picker__empty" role="status">{copy.empty}</p>
          )}
        </div>
      )}
    </div>
  );
}

export function ConsoleHeader({
  language,
  selectedObject,
  objects,
  auth,
  drawerOpen,
  objectFocusRequest,
  objectMetadata,
  catalogState,
  onObjectChange,
  onLanguageToggle,
  onDrawerOpenChange
}: ConsoleHeaderProps) {
  const location = useLocation();
  const t = getCopy(language);
  const drawerRef = useRef<HTMLElement>(null);
  const drawerTriggerRef = useRef<HTMLButtonElement>(null);
  const drawerCloseRef = useRef<HTMLButtonElement>(null);
  const desktopObjectRef = useRef<HTMLButtonElement>(null);
  const drawerObjectRef = useRef<HTMLButtonElement>(null);
  const lastObjectFocusRequestRef = useRef(0);
  const pendingDrawerObjectFocusRef = useRef(false);
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
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
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

    const isDrawerLayout = window.matchMedia?.('(max-width: 1329px)').matches ?? false;
    if (!isDrawerLayout) {
      desktopObjectRef.current?.focus();
      return;
    }

    pendingDrawerObjectFocusRef.current = true;
    onDrawerOpenChange(true);
  }, [objectFocusRequest, onDrawerOpenChange]);

  useEffect(() => {
    if (!drawerOpen || !pendingDrawerObjectFocusRef.current) {
      return;
    }

    pendingDrawerObjectFocusRef.current = false;
    window.requestAnimationFrame(() => drawerObjectRef.current?.focus());
  }, [drawerOpen]);

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
          {item.labels[language]}
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
            <GradientGhostLogo />
            <span>Console</span>
          </NavLink>

          {navigation()}

          <div className="app-header__actions">
            <div className="desktop-object-control">
              <ObjectControl
                language={language}
                selectedObject={selectedObject}
                objects={objects}
                objectMetadata={objectMetadata}
                catalogState={catalogState}
                testId="object-control"
                triggerRef={desktopObjectRef}
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
              objectMetadata={objectMetadata}
              catalogState={catalogState}
              testId="drawer-object-control"
              triggerRef={drawerObjectRef}
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
