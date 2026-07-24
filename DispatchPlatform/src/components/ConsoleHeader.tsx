import { Check, ChevronDown, Menu, Search, X } from 'lucide-react';
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent
} from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { getCopy } from '../i18n';
import { productDisplayLabel } from '../objectLabels';
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
  selectedProduct: string;
  objects: readonly SutTarget[];
  auth?: AuthConfig;
  drawerOpen: boolean;
  objectMetadata?: Readonly<Record<string, { scriptCount: number }>>;
  catalogState?: 'connecting' | 'live' | 'polling' | 'stale' | 'unavailable' | 'mock';
  onProductChange: (product: string) => void;
  onLanguageToggle: () => void;
  onDrawerOpenChange: (open: boolean) => void;
}

interface ProductControlProps {
  language: Language;
  selectedProduct: string;
  objects: readonly SutTarget[];
  objectMetadata?: Readonly<Record<string, { scriptCount: number }>>;
  catalogState?: ConsoleHeaderProps['catalogState'];
  testId: string;
  onProductChange: (product: string) => void;
}

const pickerCopy = {
  en: {
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

interface ProductOption {
  key: string;
  nativeProduct: string;
  displayLabel: string;
  scriptCount?: number;
}

function productOptions(
  objects: readonly SutTarget[],
  objectMetadata?: Readonly<Record<string, { scriptCount: number }>>
): ProductOption[] {
  const options = new Map<string, ProductOption>();

  objects.forEach((object) => {
    const displayLabel = productDisplayLabel(object.product);
    const key = displayLabel.toLocaleLowerCase();
    const scriptCount = objectMetadata?.[object.id]?.scriptCount
      ?? ('scriptCount' in object && typeof object.scriptCount === 'number'
        ? object.scriptCount
        : undefined);
    const current = options.get(key);
    if (current) {
      options.set(key, {
        ...current,
        scriptCount: current.scriptCount === undefined && scriptCount === undefined
          ? undefined
          : (current.scriptCount ?? 0) + (scriptCount ?? 0)
      });
      return;
    }
    options.set(key, {
      key,
      nativeProduct: object.product,
      displayLabel,
      scriptCount
    });
  });

  return Array.from(options.values());
}

function ProductControl({
  language,
  selectedProduct,
  objects,
  objectMetadata,
  catalogState,
  testId,
  onProductChange
}: ProductControlProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const controlRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef(new Map<string, HTMLButtonElement>());
  const pickerId = useId();
  const t = getCopy(language);
  const copy = pickerCopy[language];
  const products = useMemo(
    () => productOptions(objects, objectMetadata),
    [objectMetadata, objects]
  );
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const matchingProducts = useMemo(
    () => products.filter((product) => (
      !normalizedQuery
      || product.nativeProduct.toLocaleLowerCase().includes(normalizedQuery)
      || product.displayLabel.toLocaleLowerCase().includes(normalizedQuery)
    )),
    [normalizedQuery, products]
  );
  const selectedIdentity = productDisplayLabel(selectedProduct);
  const selectedProductIsLive = products.some(
    (product) => product.displayLabel === selectedIdentity
  );

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

  const chooseProduct = (product: string) => {
    onProductChange(product);
    closeAndFocusTrigger();
  };

  const focusOption = (index: number) => {
    const boundedIndex = Math.max(0, Math.min(index, matchingProducts.length - 1));
    const product = matchingProducts[boundedIndex];
    if (product) {
      optionRefs.current.get(product.key)?.focus();
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
    productIndex: number,
    product: string
  ) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      closeAndFocusTrigger();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      focusOption(productIndex + 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (productIndex === 0) {
        searchRef.current?.focus();
      } else {
        focusOption(productIndex - 1);
      }
    } else if (event.key === 'Home') {
      event.preventDefault();
      focusOption(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      focusOption(matchingProducts.length - 1);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      chooseProduct(product);
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
      onBlur={(event) => {
        const nextTarget = event.relatedTarget;
        if (open && (!nextTarget || !event.currentTarget.contains(nextTarget))) {
          setOpen(false);
          setQuery('');
        }
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        className="object-control__trigger"
        aria-label={[
          `${t.chooseProduct}: ${selectedIdentity}`,
          !selectedProductIsLive ? t.removed : undefined
        ].filter(Boolean).join(' · ')}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={pickerId}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className="object-control__label">{t.product}</span>
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
          aria-label={t.chooseProduct}
        >
          <div className="object-picker__header">
            <div>
              <strong>{t.chooseProduct}</strong>
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
              <span className="sr-only">{t.searchProducts}</span>
              <input
                ref={searchRef}
                type="search"
                value={query}
                placeholder={t.searchProducts}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={handleSearchKeyDown}
              />
            </label>
          </div>

          {matchingProducts.length > 0 ? (
            <div className="object-picker__list" role="listbox" aria-label={t.availableProducts}>
              {matchingProducts.map((product, productIndex) => {
                const selected = product.displayLabel === selectedIdentity;
                return (
                  <button
                    key={product.key}
                    ref={(element) => {
                      if (element) {
                        optionRefs.current.set(product.key, element);
                      } else {
                        optionRefs.current.delete(product.key);
                      }
                    }}
                    type="button"
                    className={`object-picker__option ${selected ? 'is-selected' : ''}`}
                    role="option"
                    aria-selected={selected}
                    aria-label={[
                      product.displayLabel,
                      product.scriptCount !== undefined
                        ? copy.scripts(product.scriptCount)
                        : undefined
                    ].filter(Boolean).join(' · ')}
                    onClick={() => chooseProduct(product.nativeProduct)}
                    onKeyDown={(event) => handleOptionKeyDown(
                      event,
                      productIndex,
                      product.nativeProduct
                    )}
                  >
                    <span className="object-picker__option-copy">
                      <strong>{product.displayLabel}</strong>
                      {product.scriptCount !== undefined && (
                        <small>{copy.scripts(product.scriptCount)}</small>
                      )}
                    </span>
                    {selected && <Check aria-hidden="true" />}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="object-picker__empty" role="status">{t.noProductsMatch}</p>
          )}
        </div>
      )}
    </div>
  );
}

export function ConsoleHeader({
  language,
  selectedProduct,
  objects,
  auth,
  drawerOpen,
  objectMetadata,
  catalogState,
  onProductChange,
  onLanguageToggle,
  onDrawerOpenChange
}: ConsoleHeaderProps) {
  const location = useLocation();
  const t = getCopy(language);
  const drawerRef = useRef<HTMLElement>(null);
  const drawerTriggerRef = useRef<HTMLButtonElement>(null);
  const drawerCloseRef = useRef<HTMLButtonElement>(null);
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

  const navigation = (closeDrawer = false) => (
    <nav
      className={closeDrawer ? 'mobile-navigation' : 'desktop-navigation'}
      aria-label={t.primaryNavigation}
    >
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
          <NavLink className="brand-link" to="/" aria-label={t.consoleHome}>
            <GradientGhostLogo />
            <span>Console</span>
          </NavLink>

          {navigation()}

          <div className="app-header__actions">
            <div className="desktop-object-control">
              <ProductControl
                language={language}
                selectedProduct={selectedProduct}
                objects={objects}
                objectMetadata={objectMetadata}
                catalogState={catalogState}
                testId="object-control"
                onProductChange={onProductChange}
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

            <ProductControl
              language={language}
              selectedProduct={selectedProduct}
              objects={objects}
              objectMetadata={objectMetadata}
              catalogState={catalogState}
              testId="drawer-object-control"
              onProductChange={onProductChange}
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
