import {
  ChevronDown,
  ListFilter,
  X
} from 'lucide-react';
import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent
} from 'react';
import type { CatalogConnectionState } from '../catalog/CatalogProvider';
import { getCopy } from '../i18n';
import {
  objectOptionLabel,
  productDisplayLabel
} from '../objectLabels';
import type { Language, SutTarget } from '../types';
import '../styles/components/test-type-control.css';

export interface TestTypeControlHandle {
  focus: () => void;
  open: () => void;
}

export interface TestTypeControlProps {
  language: Language;
  selectedObject: SutTarget;
  objects: readonly SutTarget[];
  objectMetadata?: Readonly<Record<string, { scriptCount: number }>>;
  catalogState?: CatalogConnectionState;
  className?: string;
  onObjectChange: (id: string) => void;
}

const sceneAliases = new Set(['scene', '场景', '场景用例']);

const selectorCopy = {
  zh: {
    description: '仅显示当前产品可用的测试类型',
    available: '可用测试类型',
    noOptions: '当前产品暂无测试类型',
    scripts: (count: number) => `${count} 个脚本`,
    states: {
      connecting: '正在连接',
      live: '实时',
      polling: '轮询',
      stale: '目录已过期',
      unavailable: '目录不可用',
      mock: '演示目录'
    }
  },
  en: {
    description: 'Only test types available for the current product are shown',
    available: 'Available test types',
    noOptions: 'No test types are available for this product',
    scripts: (count: number) => `${count} ${count === 1 ? 'script' : 'scripts'}`,
    states: {
      connecting: 'Connecting',
      live: 'Live',
      polling: 'Polling',
      stale: 'Catalog stale',
      unavailable: 'Catalog unavailable',
      mock: 'Demo catalog'
    }
  }
} as const;

function normalizedScene(value: string) {
  return value.trim().toLocaleLowerCase();
}

function sceneRank(value: string) {
  const normalized = normalizedScene(value);
  if (normalized === 'api') {
    return 0;
  }
  if (normalized === 'web') {
    return 1;
  }
  if (normalized === 'dfx') {
    return 2;
  }
  if (sceneAliases.has(normalized)) {
    return 3;
  }
  return 4;
}

export function testTypeDisplayLabel(scene: string, language: Language) {
  const normalized = normalizedScene(scene);
  if (normalized === 'api') {
    return 'API';
  }
  if (normalized === 'web') {
    return 'WEB';
  }
  if (normalized === 'dfx') {
    return 'DFX';
  }
  if (sceneAliases.has(normalized)) {
    return language === 'zh' ? '场景化' : 'Scene';
  }
  return scene;
}

export const TestTypeControl = forwardRef<TestTypeControlHandle, TestTypeControlProps>(
  function TestTypeControl({
    language,
    selectedObject,
    objects,
    objectMetadata,
    catalogState,
    className = '',
    onObjectChange
  }, forwardedRef) {
    const t = selectorCopy[language];
    const ui = getCopy(language);
    const dialogId = useId();
    const descriptionId = useId();
    const listboxId = useId();
    const rootRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const closeRef = useRef<HTMLButtonElement>(null);
    const optionRefs = useRef(new Map<string, HTMLButtonElement>());
    const initialFocusRef = useRef<'selected' | 'first' | 'last'>('selected');
    const [open, setOpen] = useState(false);

    const productObjects = useMemo(() => (
      objects
        .map((object, index) => ({ index, object }))
        .filter(({ object }) => (
          productDisplayLabel(object.product).toLocaleLowerCase()
          === productDisplayLabel(selectedObject.product).toLocaleLowerCase()
        ))
        .sort((left, right) => (
          sceneRank(left.object.scene) - sceneRank(right.object.scene)
          || left.index - right.index
        ))
        .map(({ object }) => object)
    ), [objects, selectedObject.product]);

    const close = useCallback((restoreFocus = true) => {
      setOpen(false);
      if (restoreFocus) {
        queueMicrotask(() => triggerRef.current?.focus());
      }
    }, []);

    const openControl = useCallback((
      initialFocus: 'selected' | 'first' | 'last' = 'selected'
    ) => {
      if (!productObjects.length) {
        triggerRef.current?.focus();
        return;
      }
      initialFocusRef.current = initialFocus;
      setOpen(true);
    }, [productObjects.length]);

    useImperativeHandle(forwardedRef, () => ({
      focus: () => triggerRef.current?.focus(),
      open: () => openControl()
    }), [openControl]);

    useEffect(() => {
      if (!open) {
        return;
      }
      const preferred = initialFocusRef.current === 'first'
        ? productObjects[0]
        : initialFocusRef.current === 'last'
          ? productObjects[productObjects.length - 1]
          : productObjects.find((object) => object.id === selectedObject.id) ?? productObjects[0];
      queueMicrotask(() => {
        if (preferred) {
          optionRefs.current.get(preferred.id)?.focus();
        } else {
          closeRef.current?.focus();
        }
      });
    }, [open, productObjects, selectedObject.id]);

    useEffect(() => {
      if (!open) {
        return;
      }
      const handlePointerDown = (event: PointerEvent) => {
        if (!rootRef.current?.contains(event.target as Node)) {
          close(false);
        }
      };
      document.addEventListener('pointerdown', handlePointerDown);
      return () => document.removeEventListener('pointerdown', handlePointerDown);
    }, [close, open]);

    useEffect(() => {
      setOpen(false);
    }, [selectedObject.product]);

    const focusOption = (index: number) => {
      const option = productObjects[index];
      if (option) {
        optionRefs.current.get(option.id)?.focus();
      }
    };

    const handleOptionKeyDown = (
      event: KeyboardEvent<HTMLButtonElement>,
      index: number
    ) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        focusOption((index + 1) % productObjects.length);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        focusOption((index - 1 + productObjects.length) % productObjects.length);
      } else if (event.key === 'Home') {
        event.preventDefault();
        focusOption(0);
      } else if (event.key === 'End') {
        event.preventDefault();
        focusOption(productObjects.length - 1);
      }
    };

    const handleDialogKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== 'Tab') {
        return;
      }
      const focusable = Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
        ) ?? []
      );
      if (!focusable.length) {
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    const selectedType = testTypeDisplayLabel(selectedObject.scene, language);

    return (
      <div
        ref={rootRef}
        className={`test-type-control ${className}`.trim()}
        data-catalog-state={catalogState}
      >
        <button
          ref={triggerRef}
          className="test-type-control__trigger"
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={dialogId}
          disabled={!productObjects.length}
          onClick={() => open ? close() : openControl()}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              openControl('first');
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              openControl('last');
            }
          }}
        >
          <ListFilter aria-hidden="true" />
          <span>{ui.selectTestType}</span>
          <strong>{selectedType}</strong>
          <ChevronDown aria-hidden="true" className={open ? 'is-open' : undefined} />
        </button>

        {open ? (
          <div
            ref={panelRef}
            id={dialogId}
            className="test-type-control__panel"
            role="dialog"
            aria-label={ui.testTypeDialogTitle}
            aria-describedby={descriptionId}
            onKeyDown={handleDialogKeyDown}
          >
            <header className="test-type-control__panel-header">
              <div>
                <span>{ui.selectedProduct}</span>
                <h2>{productDisplayLabel(selectedObject.product)}</h2>
                <p id={descriptionId}>{t.description}</p>
              </div>
              <button
                ref={closeRef}
                type="button"
                aria-label={`${ui.close}: ${ui.testTypeDialogTitle}`}
                onClick={() => close()}
              >
                <X aria-hidden="true" />
              </button>
            </header>

            <div className="test-type-control__list-heading">
              <span>{t.available}</span>
              {catalogState ? (
                <small className={`is-${catalogState}`}>
                  <span aria-hidden="true" />
                  {t.states[catalogState]}
                </small>
              ) : null}
            </div>

            {productObjects.length ? (
              <div
                id={listboxId}
                className="test-type-control__list"
                role="listbox"
                aria-label={t.available}
              >
                {productObjects.map((object, index) => {
                  const displayLabel = testTypeDisplayLabel(object.scene, language);
                  const duplicateScene = productObjects.filter(
                    (candidate) => testTypeDisplayLabel(candidate.scene, language) === displayLabel
                  ).length > 1;
                  const uniqueLabel = duplicateScene
                    ? objectOptionLabel(object, productObjects, 'identity', language).replace(
                        productDisplayLabel(object.product),
                        ''
                      ).trim()
                    : displayLabel;
                  const count = objectMetadata?.[object.id]?.scriptCount
                    ?? ('scriptCount' in object && typeof object.scriptCount === 'number'
                      ? object.scriptCount
                      : undefined);
                  const selected = object.id === selectedObject.id;
                  return (
                    <button
                      key={object.id}
                      ref={(node) => {
                        if (node) {
                          optionRefs.current.set(object.id, node);
                        } else {
                          optionRefs.current.delete(object.id);
                        }
                      }}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      className={selected ? 'is-selected' : undefined}
                      onClick={() => {
                        if (!selected) {
                          onObjectChange(object.id);
                        }
                        close();
                      }}
                      onKeyDown={(event) => handleOptionKeyDown(event, index)}
                    >
                      <span className="test-type-control__option-mark" aria-hidden="true" />
                      <span>
                        <strong>{uniqueLabel}</strong>
                        {count !== undefined ? <small>{t.scripts(count)}</small> : null}
                      </span>
                      {selected ? <span className="test-type-control__selected-dot" aria-hidden="true" /> : null}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="test-type-control__empty">{t.noOptions}</p>
            )}
          </div>
        ) : null}
      </div>
    );
  }
);
