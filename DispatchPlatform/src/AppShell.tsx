import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { normalizeCreatedTask } from './api/client';
import { CatalogProvider, useCatalog } from './catalog/CatalogProvider';
import { findMigratedTargetId, findTargetByScope } from './catalog/model';
import { ConsoleHeader } from './components/ConsoleHeader';
import { activeTask as initialActiveTask } from './data/mockData';
import { getCopy } from './i18n';
import { productDisplayLabel } from './objectLabels';
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
  saveConsolePreferences,
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

function savedSelectionSnapshot(
  preferences: ConsolePreferencesV1,
  runtimeConfig: RuntimeConfig
): SutTarget | undefined {
  const bootstrapTarget = runtimeConfig.sutTargets.find(
    (target) => target.id === preferences.defaultSutId
  );
  if (bootstrapTarget) {
    return bootstrapTarget;
  }
  if (!preferences.defaultSutProduct || !preferences.defaultSutScene) {
    return undefined;
  }
  return {
    id: preferences.defaultSutId,
    name: `${preferences.defaultSutProduct} ${preferences.defaultSutScene}`,
    product: preferences.defaultSutProduct,
    scene: preferences.defaultSutScene,
    version: 'Removed',
    apiBaseUrl: runtimeConfig.apiBaseUrl,
    status: 'offline'
  };
}

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

function productKey(product: string) {
  return productDisplayLabel(product).toLocaleLowerCase();
}

function isProduct(target: Pick<SutTarget, 'product'>, product: string) {
  return productKey(target.product) === productKey(product);
}

function targetForProduct(
  targets: readonly SutTarget[],
  product: string,
  preferredId?: string
) {
  return targets.find((target) => target.id === preferredId && isProduct(target, product))
    ?? targets.find((target) => isProduct(target, product));
}

function rememberedTargetForProduct(
  targets: readonly SutTarget[],
  product: string,
  remembered?: Pick<SutTarget, 'id' | 'product' | 'scene'>,
  fallback?: Pick<SutTarget, 'id' | 'product' | 'scene'>
) {
  const productTargets = targets.filter((target) => isProduct(target, product));
  return productTargets.find((target) => target.id === remembered?.id)
    ?? (remembered ? findTargetByScope(productTargets, remembered) : undefined)
    ?? productTargets.find((target) => target.id === fallback?.id)
    ?? (fallback ? findTargetByScope(productTargets, fallback) : undefined)
    ?? productTargets[0];
}

export function AppShell({ runtimeConfig }: { runtimeConfig: RuntimeConfig }) {
  return (
    <CatalogProvider runtimeConfig={runtimeConfig}>
      <CatalogAppShell runtimeConfig={runtimeConfig} />
    </CatalogProvider>
  );
}

function CatalogAppShell({ runtimeConfig }: { runtimeConfig: RuntimeConfig }) {
  const location = useLocation();
  const catalog = useCatalog();
  const objects = catalog.snapshot ? catalog.targets : runtimeConfig.sutTargets;
  const effectiveRuntimeConfig = useMemo<RuntimeConfig>(() => ({
    ...runtimeConfig,
    sutTargets: objects
  }), [objects, runtimeConfig]);
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
  const [tasksObjectByProduct, setTasksObjectByProduct] = useState<Record<string, SutTarget>>(() => {
    const target = runtimeConfig.sutTargets.find(
      (candidate) => candidate.id === preferences.defaultSutId
    );
    return target ? { [productKey(target.product)]: target } : {};
  });
  const [scriptsObjectByProduct, setScriptsObjectByProduct] = useState<Record<string, SutTarget>>(() => {
    const target = runtimeConfig.sutTargets.find(
      (candidate) => candidate.id === preferences.defaultSutId
    );
    return target ? { [productKey(target.product)]: target } : {};
  });
  const globalObjectByProductRef = useRef(new Map<string, SutTarget>());
  const mainContentRef = useRef<HTMLElement>(null);
  const previousPathRef = useRef(location.pathname);
  const defaultSutSnapshot = savedSelectionSnapshot(preferences, runtimeConfig);
  const initialSelectedSut = defaultSutSnapshot;
  const lastSelectedSutRef = useRef<
    { selectionId: string; target: SutTarget } | undefined
  >(initialSelectedSut ? {
    selectionId: selectedSutId,
    target: initialSelectedSut
  } : undefined);
  const currentSelectedSut = objects.find((sut) => sut.id === selectedSutId);
  if (currentSelectedSut) {
    lastSelectedSutRef.current = {
      selectionId: selectedSutId,
      target: currentSelectedSut
    };
  }
  const retainedSelectedSut = (
    lastSelectedSutRef.current?.selectionId === selectedSutId
      ? lastSelectedSutRef.current.target
      : undefined
  );
  const preferenceSelectedSut = selectedSutId === preferences.defaultSutId
    ? defaultSutSnapshot
    : undefined;
  const unavailableSelectedSut: SutTarget = {
    id: selectedSutId,
    name: selectedSutId || 'Unavailable Object',
    product: preferenceSelectedSut?.product ?? 'Unavailable',
    scene: preferenceSelectedSut?.scene ?? 'Unavailable',
    version: 'Removed',
    apiBaseUrl: runtimeConfig.apiBaseUrl,
    status: 'offline'
  };
  const selectedSut = currentSelectedSut
    ?? retainedSelectedSut
    ?? preferenceSelectedSut
    ?? runtimeConfig.sutTargets.find((target) => target.id === selectedSutId)
    ?? unavailableSelectedSut;
  const selectedProduct = selectedSut.product;
  if (currentSelectedSut) {
    globalObjectByProductRef.current.set(productKey(selectedProduct), currentSelectedSut);
  }
  const selectedProductKey = productKey(selectedProduct);
  const selectedProductObjects = useMemo(
    () => objects.filter((target) => isProduct(target, selectedProduct)),
    [objects, selectedProduct]
  );
  const tasksSelectedSut = rememberedTargetForProduct(
    selectedProductObjects,
    selectedProduct,
    tasksObjectByProduct[selectedProductKey],
    selectedSut
  ) ?? selectedSut;
  const scriptsSelectedSut = rememberedTargetForProduct(
    selectedProductObjects,
    selectedProduct,
    scriptsObjectByProduct[selectedProductKey],
    selectedSut
  ) ?? selectedSut;
  const tasksCatalogObject = catalog.objectsById.get(tasksSelectedSut.id);
  const scriptsCatalogObject = catalog.objectsById.get(scriptsSelectedSut.id);
  const tasksCatalogSelectionValid = !catalog.snapshot || Boolean(tasksCatalogObject);
  const scriptsCatalogSelectionValid = !catalog.snapshot || Boolean(scriptsCatalogObject);
  const objectMetadata = useMemo(
    () => Object.fromEntries(catalog.targets.map((target) => [
      target.id,
      { scriptCount: target.scriptCount }
    ])),
    [catalog.targets]
  );

  useEffect(() => {
    if (!selectedProductObjects.length) {
      return;
    }
    setTasksObjectByProduct((current) => {
      const remembered = current[selectedProductKey];
      if (
        remembered?.id === tasksSelectedSut.id
        && remembered.product === tasksSelectedSut.product
        && remembered.scene === tasksSelectedSut.scene
      ) {
        return current;
      }
      return {
        ...current,
        [selectedProductKey]: tasksSelectedSut
      };
    });
  }, [
    selectedProductKey,
    selectedProductObjects.length,
    tasksSelectedSut.id,
    tasksSelectedSut.product,
    tasksSelectedSut.scene
  ]);

  useEffect(() => {
    if (!selectedProductObjects.length) {
      return;
    }
    setScriptsObjectByProduct((current) => {
      const remembered = current[selectedProductKey];
      if (
        remembered?.id === scriptsSelectedSut.id
        && remembered.product === scriptsSelectedSut.product
        && remembered.scene === scriptsSelectedSut.scene
      ) {
        return current;
      }
      return {
        ...current,
        [selectedProductKey]: scriptsSelectedSut
      };
    });
  }, [
    scriptsSelectedSut.id,
    scriptsSelectedSut.product,
    scriptsSelectedSut.scene,
    selectedProductKey,
    selectedProductObjects.length
  ]);

  useEffect(() => {
    if (!catalog.targets.length || catalog.targets.some((target) => target.id === selectedSutId)) {
      return;
    }
    const savedScope = (
      preferences.defaultSutProduct
      && preferences.defaultSutScene
    ) ? {
        product: preferences.defaultSutProduct,
        scene: preferences.defaultSutScene
      } : undefined;
    const isSavedDefaultSelection = selectedSutId === preferences.defaultSutId;
    const scopeMatch = isSavedDefaultSelection && savedScope
      ? findTargetByScope(catalog.targets, savedScope)?.id
      : undefined;
    const migratedId = scopeMatch ?? findMigratedTargetId(
      catalog.targets,
      selectedSutId,
      runtimeConfig.sutTargets
    ) ?? targetForProduct(catalog.targets, selectedProduct)?.id;
    if (!migratedId) {
      return;
    }
    setSelectedSutId(migratedId);
    if (!isSavedDefaultSelection) {
      return;
    }

    const migratedTarget = catalog.targets.find((target) => target.id === migratedId);
    const nextPreferences = {
      ...preferences,
      defaultSutId: migratedId,
      defaultSutProduct: migratedTarget?.product,
      defaultSutScene: migratedTarget?.scene
    };
    setPreferences(nextPreferences);
    try {
      saveConsolePreferences(nextPreferences, effectiveRuntimeConfig);
    } catch {
      // Selection migration remains valid for this session when storage is unavailable.
    }
  }, [
    catalog.targets,
    effectiveRuntimeConfig,
    preferences,
    runtimeConfig.sutTargets,
    selectedProduct,
    selectedSutId
  ]);

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

  const sharedProps = {
    language,
    selectedSut,
    activeTask,
    runtimeConfig: effectiveRuntimeConfig
  };
  const t = getCopy(language);
  const observationLaunch = observationLaunchFromState(location.state);
  const handleTaskCreated = useCallback((response: TaskCreateResponse) => {
    const task = {
      ...normalizeCreatedTask(response),
      sourceSut: { ...tasksSelectedSut }
    };
    setActiveTask(task);
    setSessionTasks((current) => [
      task,
      ...current.filter((item) => !isSameTask(item, task, runtimeConfig.apiBaseUrl))
    ]);
  }, [runtimeConfig.apiBaseUrl, tasksSelectedSut]);
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
  const handleProductChange = useCallback((product: string) => {
    const nextTarget = rememberedTargetForProduct(
      objects,
      product,
      globalObjectByProductRef.current.get(productKey(product))
    );
    if (nextTarget) {
      globalObjectByProductRef.current.set(productKey(product), nextTarget);
      setSelectedSutId(nextTarget.id);
    }
  }, [objects]);
  const handleGlobalObjectChange = useCallback((id: string) => {
    const nextTarget = objects.find((target) => target.id === id)
      ?? runtimeConfig.sutTargets.find((target) => target.id === id);
    if (nextTarget) {
      globalObjectByProductRef.current.set(productKey(nextTarget.product), nextTarget);
    }
    setSelectedSutId(id);
  }, [objects, runtimeConfig.sutTargets]);
  const handleTasksObjectChange = useCallback((id: string) => {
    const nextTarget = selectedProductObjects.find((target) => target.id === id);
    if (!nextTarget) {
      return;
    }
    setTasksObjectByProduct((current) => ({
      ...current,
      [selectedProductKey]: nextTarget
    }));
  }, [selectedProductKey, selectedProductObjects]);
  const handleScriptsObjectChange = useCallback((id: string) => {
    const nextTarget = selectedProductObjects.find((target) => target.id === id);
    if (!nextTarget) {
      return;
    }
    setScriptsObjectByProduct((current) => ({
      ...current,
      [selectedProductKey]: nextTarget
    }));
  }, [selectedProductKey, selectedProductObjects]);
  const handlePreferencesChange = useCallback((nextPreferences: ConsolePreferencesV1) => {
    setPreferences(nextPreferences);
  }, []);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">{t.skipToMainContent}</a>
      <ConsoleHeader
        language={language}
        selectedProduct={selectedProduct}
        objects={objects}
        auth={effectiveRuntimeConfig.auth}
        drawerOpen={drawerOpen}
        objectMetadata={objectMetadata}
        catalogState={catalog.state}
        onProductChange={handleProductChange}
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
                selectedSut={tasksSelectedSut}
                runtimeConfig={effectiveRuntimeConfig}
                objects={selectedProductObjects}
                objectMetadata={objectMetadata}
                catalogState={catalog.state}
                catalogObject={tasksCatalogObject}
                catalogSelectionValid={tasksCatalogSelectionValid}
                onTaskCreated={handleTaskCreated}
                onObjectChange={handleTasksObjectChange}
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
                runtimeConfig={effectiveRuntimeConfig}
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
                runtimeConfig={effectiveRuntimeConfig}
                reportDownloadFormat={preferences.reportDownloadFormat}
              />
            )}
          />
          <Route
            path="/scripts"
            element={(
              <Scripts
                language={language}
                selectedSut={scriptsSelectedSut}
                runtimeConfig={effectiveRuntimeConfig}
                objects={selectedProductObjects}
                objectMetadata={objectMetadata}
                catalogState={catalog.state}
                catalogObject={scriptsCatalogObject}
                catalogSelectionValid={scriptsCatalogSelectionValid}
                onObjectChange={handleScriptsObjectChange}
              />
            )}
          />
          <Route path="/knowledge" element={<Knowledge {...sharedProps} />} />
          <Route
            path="/settings"
            element={(
              <SettingsPage
                language={language}
                selectedSut={selectedSut}
                runtimeConfig={effectiveRuntimeConfig}
                preferences={preferences}
                onObjectChange={handleGlobalObjectChange}
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
