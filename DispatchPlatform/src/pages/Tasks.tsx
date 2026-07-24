import { useMutation, useQuery } from '@tanstack/react-query';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent
} from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ApiError,
  createTask,
  getFeatures,
  getScripts,
  getScriptsForFeatures,
  getVersions
} from '../api/client';
import {
  useOptionalCatalog,
  type CatalogConnectionState,
  type CatalogQueryData
} from '../catalog/CatalogProvider';
import {
  diffCatalogObjects,
  scriptsForCatalogObject,
  type CatalogObjectDelta
} from '../catalog/model';
import { CatalogSyncStatus } from '../components/CatalogSyncStatus';
import { PageHeader } from '../components/PageHeader';
import {
  TestTypeControl,
  testTypeDisplayLabel,
  type TestTypeControlHandle
} from '../components/TestTypeControl';
import { mockFeatures, mockScripts } from '../data/mockData';
import { getCopy } from '../i18n';
import { productDisplayLabel } from '../objectLabels';
import { formatTestVersionLabel } from '../versionLabels';
import type {
  Feature,
  CatalogObject,
  Language,
  RuntimeConfig,
  Script,
  SutTarget,
  TaskCreateRequest,
  TaskCreateResponse,
  TestVersionResponse,
  TriggerType
} from '../types';

interface TasksProps {
  language: Language;
  selectedSut: SutTarget;
  runtimeConfig: RuntimeConfig;
  catalogObject?: CatalogObject;
  catalogSelectionValid?: boolean;
  objects: readonly SutTarget[];
  objectMetadata?: Readonly<Record<string, { scriptCount: number }>>;
  catalogState?: CatalogConnectionState;
  onTaskCreated: (task: TaskCreateResponse) => void;
  onObjectChange: (id: string) => void;
}

const emptyFeatures: Feature[] = [];
const emptyScripts: Script[] = [];
const emptyVersions: TestVersionResponse['versions'] = [];
const levels = ['L0', 'L1', 'L2', 'L3', 'L4'] as const;

interface PendingCatalogUpdate {
  object: CatalogObject;
  revision: string;
  delta: CatalogObjectDelta;
}
const fallbackVersions: TestVersionResponse = {
  success: true,
  default_version: 'release1',
  versions: [{
    code: 'release1',
    name: 'Release 1',
    description: 'Demo test batch',
    created_at: '2026-07-01T00:00:00Z',
    is_default: true
  }]
};

function fallbackScripts(sut: SutTarget): Script[] {
  return mockScripts.filter((script) => script.product === sut.product && script.scene === sut.scene);
}

function createFallbackTask(payload: TaskCreateRequest, triggerType: TriggerType): TaskCreateResponse {
  return {
    success: true,
    task_id: `demo_${Date.now()}`,
    status: 'pending',
    trigger_type: triggerType,
    message: `Demo task created from ${Object.keys(payload).join(', ')}`,
    version: payload.version
  };
}

function getRequestErrorMessage(
  error: unknown,
  fallback: string,
  language: Language
): string {
  if (error instanceof ApiError) {
    if (language === 'zh') {
      return error.code ? `${fallback} (${error.code})` : fallback;
    }
    return error.code ? `${error.message} (${error.code})` : error.message;
  }

  return fallback;
}

export function Tasks({
  language,
  selectedSut,
  runtimeConfig,
  catalogObject,
  catalogSelectionValid = true,
  objects,
  objectMetadata,
  catalogState,
  onTaskCreated,
  onObjectChange
}: TasksProps) {
  const t = getCopy(language);
  const navigate = useNavigate();
  const catalog = useOptionalCatalog();
  const testTypeControlRef = useRef<TestTypeControlHandle>(null);
  const [mode, setMode] = useState<TriggerType>('feature');
  const [selectedFeature, setSelectedFeature] = useState('');
  const [selectedLevel, setSelectedLevel] = useState('L1');
  const [selectedVersion, setSelectedVersion] = useState('');
  const [selectedScriptIds, setSelectedScriptIds] = useState<string[]>([]);
  const [scriptSearch, setScriptSearch] = useState('');
  const [appliedCatalogObject, setAppliedCatalogObject] = useState<CatalogObject | undefined>(
    catalogObject
  );
  const [appliedCatalogRevision, setAppliedCatalogRevision] = useState(
    catalog?.snapshot?.revision ?? ''
  );
  const [pendingCatalogUpdate, setPendingCatalogUpdate] = useState<PendingCatalogUpdate>();
  const resolvedApiBaseUrl = selectedSut.apiBaseUrl || runtimeConfig.apiBaseUrl;
  const selectedObjectLabel = `${productDisplayLabel(selectedSut.product)} · ${
    testTypeDisplayLabel(selectedSut.scene, language)
  }`;
  const targetIdentity = useMemo(
    () => ({
      id: selectedSut.id,
      product: selectedSut.product,
      scene: selectedSut.scene,
      apiBaseUrl: resolvedApiBaseUrl
    }),
    [resolvedApiBaseUrl, selectedSut.id, selectedSut.product, selectedSut.scene]
  );
  const api = useMemo(
    () => ({ apiBaseUrl: targetIdentity.apiBaseUrl }),
    [targetIdentity.apiBaseUrl]
  );
  const requiresFeature = mode === 'feature' || mode === 'scripts';

  const versionsQuery = useQuery({
    queryKey: ['versions', targetIdentity],
    queryFn: async (): Promise<TestVersionResponse> => {
      try {
        return await getVersions(api);
      } catch (error) {
        if (runtimeConfig.enableMockFallback) {
          return fallbackVersions;
        }
        throw error;
      }
    }
  });
  const versions = versionsQuery.data?.versions ?? emptyVersions;

  const featuresQuery = useQuery({
    queryKey: ['features', targetIdentity],
    queryFn: async (): Promise<Feature[]> => {
      try {
        return (await getFeatures(api, targetIdentity.product, targetIdentity.scene)).features;
      } catch (error) {
        if (runtimeConfig.enableMockFallback) {
          return mockFeatures;
        }
        throw error;
      }
    },
    enabled: !catalog
  });

  const features = appliedCatalogObject?.features ?? featuresQuery.data ?? emptyFeatures;
  const featureNames = useMemo(() => features.map((feature) => feature.name), [features]);
  const scriptQuery = useQuery({
    queryKey: ['scripts', targetIdentity, mode, selectedFeature, selectedLevel, featureNames],
    queryFn: async (): Promise<Script[]> => {
      const query = {
        product: targetIdentity.product,
        scene: targetIdentity.scene,
        feature: requiresFeature ? selectedFeature || undefined : undefined,
        level: mode === 'level' ? selectedLevel : undefined
      };
      try {
        if (mode === 'scene') {
          return (await getScriptsForFeatures(api, {
            product: targetIdentity.product,
            scene: targetIdentity.scene
          }, featureNames)).scripts;
        }
        return (await getScripts(api, query)).scripts;
      } catch (error) {
        if (runtimeConfig.enableMockFallback) {
          return fallbackScripts(selectedSut).filter(
            (script) =>
              (!query.feature || script.feature === query.feature) &&
              (!query.level || script.level === query.level)
          );
        }
        throw error;
      }
    },
    enabled: !catalog && (
      mode === 'scene'
        ? featuresQuery.isSuccess && featureNames.length > 0
        : !requiresFeature || Boolean(selectedFeature)
    )
  });

  const catalogScripts = useMemo(() => {
    if (!appliedCatalogObject) {
      return undefined;
    }
    const allScripts = scriptsForCatalogObject(appliedCatalogObject);
    if (mode === 'level') {
      return allScripts.filter((script) => script.level === selectedLevel);
    }
    if (mode === 'scene') {
      return allScripts;
    }
    return allScripts.filter((script) => script.feature === selectedFeature);
  }, [appliedCatalogObject, mode, selectedFeature, selectedLevel]);
  const scripts = catalogScripts ?? scriptQuery.data ?? emptyScripts;
  const filteredScripts = useMemo(() => {
    const normalizedSearch = scriptSearch.trim().toLocaleLowerCase();
    if (!normalizedSearch) {
      return scripts;
    }
    return scripts.filter((script) => (
      [script.name, script.feature, script.level, script.path]
        .some((value) => value.toLocaleLowerCase().includes(normalizedSearch))
    ));
  }, [scriptSearch, scripts]);

  useEffect(() => {
    if (!versions.length) {
      setSelectedVersion('');
      return;
    }
    if (!selectedVersion || !versions.some((version) => version.code === selectedVersion)) {
      const defaultVersion = versionsQuery.data?.default_version;
      setSelectedVersion(
        versions.find((version) => version.code === defaultVersion)?.code
          ?? versions.find((version) => version.is_default)?.code
          ?? versions[0].code
      );
    }
  }, [selectedVersion, versions, versionsQuery.data?.default_version]);

  useEffect(() => {
    if (!selectedFeature || !features.some((feature) => feature.name === selectedFeature)) {
      setSelectedFeature(features[0]?.name ?? '');
    }
  }, [features, selectedFeature]);

  useEffect(() => {
    setSelectedFeature(catalogObject?.features[0]?.name ?? '');
    setSelectedVersion('');
    setSelectedScriptIds([]);
    setScriptSearch('');
    setAppliedCatalogObject(catalogObject);
    setAppliedCatalogRevision(catalog?.snapshot?.revision ?? '');
    setPendingCatalogUpdate(undefined);
  }, [selectedSut.id]);

  useEffect(() => {
    setSelectedScriptIds((current) => {
      const next = current.filter((id) => scripts.some((script) => script.id === id));
      return next.length === current.length ? current : next;
    });
  }, [scripts]);

  useEffect(() => {
    const revision = catalog?.snapshot?.revision;
    if (!catalog || !catalogSelectionValid || !catalogObject || !revision) {
      return;
    }
    if (!appliedCatalogObject) {
      setAppliedCatalogObject(catalogObject);
      setAppliedCatalogRevision(revision);
      setPendingCatalogUpdate(undefined);
      return;
    }
    if (revision === appliedCatalogRevision) {
      return;
    }
    const delta = diffCatalogObjects(appliedCatalogObject, catalogObject);
    if (delta.hasChanges) {
      setPendingCatalogUpdate({ object: catalogObject, revision, delta });
      return;
    }
    setAppliedCatalogObject(catalogObject);
    setAppliedCatalogRevision(revision);
    setPendingCatalogUpdate(undefined);
  }, [
    appliedCatalogObject,
    appliedCatalogRevision,
    catalog,
    catalogObject,
    catalogSelectionValid
  ]);

  const creation = useMutation({
    mutationFn: async (payload: TaskCreateRequest) => {
      try {
        let request = payload;
        if (catalog) {
          let latest: CatalogQueryData | undefined;
          try {
            latest = await catalog.refresh(true);
          } catch (error) {
            if (runtimeConfig.enableMockFallback && catalog.state === 'mock') {
              return createFallbackTask(payload, mode);
            }
            throw error;
          }
          if (runtimeConfig.enableMockFallback && latest?.source === 'mock') {
            return createFallbackTask(payload, mode);
          }
          if (!latest || !appliedCatalogObject) {
            throw new ApiError('The latest catalog could not be verified.', {
              code: 'CATALOG_UNAVAILABLE'
            });
          }
          const latestObject = latest.snapshot.objects.find((object) => object.id === selectedSut.id)
            ?? latest.snapshot.objects.find((object) => (
              object.product === selectedSut.product && object.scene === selectedSut.scene
            ));
          if (!latestObject) {
            throw new ApiError('The selected Object no longer exists in the catalog.', {
              code: 'CATALOG_CHANGED',
              status: 409
            });
          }
          if (latest.snapshot.revision !== appliedCatalogRevision) {
            const delta = diffCatalogObjects(appliedCatalogObject, latestObject);
            if (delta.hasChanges) {
              throw new ApiError('The script catalog changed. Review the latest update before launch.', {
                code: 'CATALOG_CHANGED',
                status: 409,
                details: delta
              });
            }
            request = {
              ...payload,
              catalog_revision: latest.snapshot.revision
            } as TaskCreateRequest;
          }
        }
        return await createTask(api, request);
      } catch (error) {
        if (runtimeConfig.enableMockFallback && !(error instanceof ApiError)) {
          return createFallbackTask(payload, mode);
        }
        throw error;
      }
    },
    onSuccess: (task) => {
      onTaskCreated(task);
      navigate('/observation', {
        state: {
          testwiseLaunch: {
            taskId: task.task_id,
            apiBaseUrl: api.apiBaseUrl
          }
        }
      });
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === 'CATALOG_CHANGED') {
        void catalog?.refresh().catch(() => undefined);
      }
    }
  });

  const selectedScripts = useMemo(
    () => selectedScriptIds.flatMap((id) => {
      const script = scripts.find((candidate) => candidate.id === id);
      return script ? [script] : [];
    }),
    [scripts, selectedScriptIds]
  );
  const payload = useMemo<TaskCreateRequest>(() => {
    const base = {
      product: selectedSut.product,
      scene: selectedSut.scene,
      version: selectedVersion,
      ...(catalog ? { catalog_revision: appliedCatalogRevision } : {})
    };
    if (mode === 'level') {
      return { ...base, level: selectedLevel };
    }
    if (mode === 'scripts') {
      return {
        ...base,
        feature: selectedFeature,
        script_name: selectedScripts.map((script) => script.name),
        ...(catalog ? { script_ids: selectedScripts.map((script) => script.id) } : {})
      };
    }
    if (mode === 'scene') {
      return base;
    }
    return { ...base, feature: selectedFeature };
  }, [
    appliedCatalogRevision,
    catalog,
    mode,
    selectedFeature,
    selectedLevel,
    selectedScripts,
    selectedSut.product,
    selectedSut.scene,
    selectedVersion
  ]);

  const catalogBlocksLaunch = Boolean(catalog) && (
    !catalogSelectionValid
    || !appliedCatalogRevision
    || Boolean(pendingCatalogUpdate)
    || catalog?.state === 'stale'
    || catalog?.state === 'unavailable'
    || catalog?.state === 'connecting'
  );
  const canCreate =
    !creation.isPending &&
    !catalogBlocksLaunch &&
    Boolean(selectedVersion) &&
    (mode !== 'scripts' || selectedScripts.length > 0) &&
    (!requiresFeature || Boolean(selectedFeature));
  const launchScriptCount = mode === 'scripts' ? selectedScripts.length : scripts.length;
  const modeSummary = mode === 'feature'
    ? `${t.feature} · ${selectedFeature || '—'}`
    : mode === 'level'
      ? `${t.level} · ${selectedLevel}`
      : mode === 'scripts'
        ? `${t.byScripts} · ${selectedScripts.length} ${t.scriptsCount}`
        : `${t.entireScene} · ${t.allScripts}`;

  const toggleScript = (id: string) => {
    setSelectedScriptIds((current) => (
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    ));
  };
  const handleScriptRowKeyDown = (event: KeyboardEvent<HTMLTableRowElement>, id: string) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }
    event.preventDefault();
    toggleScript(id);
  };
  const handleScriptRowClick = (event: MouseEvent<HTMLTableRowElement>, id: string) => {
    if ((event.target as HTMLElement).tagName !== 'INPUT') {
      toggleScript(id);
    }
  };

  const applyPendingCatalogUpdate = () => {
    if (!pendingCatalogUpdate) {
      return;
    }
    const latestIds = new Set(
      scriptsForCatalogObject(pendingCatalogUpdate.object).map((script) => script.id)
    );
    setSelectedScriptIds((current) => current.filter((id) => latestIds.has(id)));
    setAppliedCatalogObject(pendingCatalogUpdate.object);
    setAppliedCatalogRevision(pendingCatalogUpdate.revision);
    setPendingCatalogUpdate(undefined);
    creation.reset();
  };

  return (
    <div className="page-stack tasks-page">
      <PageHeader
        title={t.tasks}
        subtitle={t.tasksSubtitle}
        action={(
          <div className="tasks-page-actions">
            <TestTypeControl
              ref={testTypeControlRef}
              language={language}
              selectedObject={selectedSut}
              objects={objects}
              objectMetadata={objectMetadata}
              catalogState={catalogState}
              onObjectChange={onObjectChange}
            />
            {catalog ? <CatalogSyncStatus language={language} /> : null}
          </div>
        )}
      />

      <div className="tasks-layout">
        <div className="tasks-left-column">
          <section className="tasks-card tasks-config-card" aria-labelledby="tasks-config-title">
            <div className="tasks-card-heading tasks-config-heading">
              <h2 id="tasks-config-title">{t.configureTask}</h2>
              <span className={`tasks-ready-pill ${canCreate ? 'is-ready' : ''}`}>
                {canCreate ? t.ready : t.guardrailChecking}
              </span>
            </div>

            <ol className="tasks-steps" aria-label={t.taskStepsLabel}>
              <li>
                <span className="tasks-step-number">1</span>
                <span>
                  <strong>
                    {t.product} {language === 'zh' ? '与' : '&'} {t.testType}
                  </strong>
                  <small>{t.objectStepDescription}</small>
                </span>
              </li>
              <li>
                <span className="tasks-step-number">2</span>
                <span><strong>{t.triggerMode}</strong><small>{t.triggerStepDescription}</small></span>
              </li>
              <li>
                <span className="tasks-step-number">3</span>
                <span>
                  <strong>{language === 'zh' ? '脚本范围' : 'Script scope'}</strong>
                  <small>{t.scopeStepDescription}</small>
                </span>
              </li>
            </ol>

            <div className="tasks-object-summary" data-testid="task-context-summary">
              <div>
                <span>{t.selectedProduct}</span>
                <strong>{productDisplayLabel(selectedSut.product)}</strong>
                <small>{t.selectedTestType} · {testTypeDisplayLabel(selectedSut.scene, language)}</small>
              </div>
              <button type="button" onClick={() => testTypeControlRef.current?.open()}>
                {t.selectTestType}
                <span aria-hidden="true">→</span>
              </button>
            </div>

            {pendingCatalogUpdate ? (
              <div className="tasks-catalog-update" role="alert">
                <div>
                  <strong>
                    {language === 'zh' ? '脚本目录已有更新' : 'Script catalog update available'}
                  </strong>
                  <span>
                    {language === 'zh'
                      ? `新增 ${pendingCatalogUpdate.delta.added.length}，移除 ${pendingCatalogUpdate.delta.removed.length}，变更 ${pendingCatalogUpdate.delta.changed.length}`
                      : `${pendingCatalogUpdate.delta.added.length} added, ${pendingCatalogUpdate.delta.removed.length} removed, ${pendingCatalogUpdate.delta.changed.length} changed`}
                  </span>
                </div>
                <button type="button" onClick={applyPendingCatalogUpdate}>
                  {language === 'zh' ? '应用最新目录' : 'Apply latest catalog'}
                </button>
              </div>
            ) : null}
            {catalog && (!catalogSelectionValid || catalog.state === 'stale' || catalog.state === 'unavailable') ? (
              <div className="tasks-catalog-update is-blocking" role="alert">
                <div>
                  <strong>{language === 'zh' ? '已暂停启动' : 'Launch paused'}</strong>
                  <span>
                    {!catalogSelectionValid
                      ? language === 'zh'
                        ? '当前测试对象已从目录中移除，请更换对象。'
                        : 'The current test Object was removed. Select another Object.'
                      : language === 'zh'
                        ? '无法验证最新目录。最近一次快照仍可查看，但不能启动任务。'
                        : 'The latest catalog cannot be verified. The last snapshot remains visible, but launch is disabled.'}
                  </span>
                </div>
              </div>
            ) : null}

            <div className="tasks-mode-row">
              <fieldset className="tasks-segmented" role="radiogroup" aria-label={t.taskModeLabel}>
                <legend className="sr-only">{t.taskModeLabel}</legend>
                {([
                  ['feature', t.byFeature, t.feature],
                  ['level', t.byLevel, t.level],
                  ['scripts', t.byScripts, t.script],
                  ['scene', t.entireScene, language === 'zh' ? '场景' : 'Scene']
                ] as const).map(([value, label, visibleLabel]) => (
                  <label key={value}>
                    <input
                      className="sr-only"
                      type="radio"
                      name="task-trigger-mode"
                      value={value}
                      aria-label={label}
                      checked={mode === value}
                      onChange={() => setMode(value)}
                    />
                    <span>{visibleLabel}</span>
                  </label>
                ))}
              </fieldset>
              <span className="tasks-match-count">{scripts.length} {t.scriptsMatched}</span>
            </div>

            <div className="tasks-fields">
              {requiresFeature ? (
                <label className="tasks-field">
                  <span>{t.feature}</span>
                  <select value={selectedFeature} onChange={(event) => setSelectedFeature(event.target.value)}>
                    {features.map((feature) => (
                      <option key={feature.id} value={feature.name}>{feature.name}</option>
                    ))}
                  </select>
                </label>
              ) : mode === 'level' ? (
                <label className="tasks-field">
                  <span>{t.level}</span>
                  <select value={selectedLevel} onChange={(event) => setSelectedLevel(event.target.value)}>
                    {levels.map((level) => <option key={level} value={level}>{level}</option>)}
                  </select>
                </label>
              ) : (
                <label className="tasks-field">
                  <span>{language === 'zh' ? '场景' : 'Scene'}</span>
                  <select value={selectedSut.scene} disabled>
                    <option value={selectedSut.scene}>
                      {testTypeDisplayLabel(selectedSut.scene, language)}
                    </option>
                  </select>
                </label>
              )}
              <label className="tasks-field">
                <span>{t.testVersion}</span>
                <select
                  value={selectedVersion}
                  onChange={(event) => setSelectedVersion(event.target.value)}
                  disabled={versionsQuery.isLoading || versions.length === 0}
                >
                  {versionsQuery.isLoading ? <option value="">{t.loadingVersions}</option> : null}
                  {!versionsQuery.isLoading && versions.length === 0 ? (
                    <option value="">{t.versionsUnavailable}</option>
                  ) : null}
                  {versions.map((version) => (
                    <option key={version.code} value={version.code}>
                      {formatTestVersionLabel(version, {
                        isDefault: version.code === versionsQuery.data?.default_version,
                        defaultLabel: t.defaultVersion
                      })}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {((!catalog && (featuresQuery.isError || scriptQuery.isError)) || versionsQuery.isError) && (
              <p className="tasks-inline-error" role="alert">
                {getRequestErrorMessage(
                  featuresQuery.error ?? scriptQuery.error ?? versionsQuery.error,
                  t.contextLoadFailed,
                  language
                )}
              </p>
            )}
          </section>

          <section className="tasks-card tasks-snapshot-card" aria-labelledby="script-snapshot-title">
            <div className="tasks-snapshot-heading">
              <h2 id="script-snapshot-title">{t.scriptSnapshot} · {t.readOnlySelection}</h2>
              <label className="tasks-script-search">
                <span className="sr-only">{t.searchScripts}</span>
                <input
                  type="search"
                  value={scriptSearch}
                  aria-label={t.searchScripts}
                  placeholder={t.searchScripts}
                  onChange={(event) => setScriptSearch(event.target.value)}
                />
              </label>
            </div>
            <div className="tasks-table-scroll">
              <table aria-label={t.scriptSnapshot}>
                <thead>
                  <tr>
                    <th>{t.script}</th>
                    <th>{t.feature}</th>
                    <th>{t.level}</th>
                    <th>{t.path}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredScripts.map((script) => {
                    const selected = selectedScriptIds.includes(script.id);
                    const explicitlySelectable = mode === 'scripts';
                    return (
                      <tr
                        key={script.id}
                        className={selected ? 'is-selected' : undefined}
                        tabIndex={explicitlySelectable ? 0 : undefined}
                        aria-selected={explicitlySelectable ? selected : undefined}
                        onClick={explicitlySelectable ? (event) => handleScriptRowClick(event, script.id) : undefined}
                        onKeyDown={explicitlySelectable ? (event) => handleScriptRowKeyDown(event, script.id) : undefined}
                      >
                        <td>
                          {explicitlySelectable && (
                            <input
                              className="sr-only"
                              type="checkbox"
                              tabIndex={-1}
                              aria-label={`${t.selectScript} ${script.name}`}
                              checked={selected}
                              onChange={() => toggleScript(script.id)}
                            />
                          )}
                          <strong>{script.name}</strong>
                        </td>
                        <td>{script.feature}</td>
                        <td><strong className="tasks-level-text">{script.level}</strong></td>
                        <td className="mono-cell">{script.path}</td>
                      </tr>
                    );
                  })}
                  {!filteredScripts.length && (
                    <tr>
                      <td className="tasks-empty-row" colSpan={4}>{t.noMatchingScripts}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <aside className="tasks-right-rail" aria-label={t.launchControls}>
          <section className="tasks-card tasks-launch-card" aria-labelledby="launch-summary-title">
            <div className="tasks-card-heading">
              <h2 id="launch-summary-title">{t.launchSummary}</h2>
            </div>
            <dl className="tasks-launch-list">
              <div>
                <dt>{t.launchObject}</dt>
                <dd>{selectedObjectLabel}</dd>
              </div>
              <div><dt>{t.launchMode}</dt><dd data-testid="task-mode-summary">{modeSummary}</dd></div>
              <div><dt>{t.executionProfile}</dt><dd>{t.liveStandard}</dd></div>
              <div>
                <dt>{t.launchReportVersion}</dt>
                <dd data-testid="task-version-summary">{selectedVersion || '—'}</dd>
              </div>
              <div><dt>{t.launchVersionSource}</dt><dd>{t.backendRegistry}</dd></div>
              <div><dt>{t.launchScriptCount}</dt><dd>{launchScriptCount} {t.scriptsCount}</dd></div>
              <div>
                <dt>{t.launchEstimate}</dt>
                <dd data-testid="launch-estimate">{launchScriptCount > 0 ? t.estimatedDuration : '—'}</dd>
              </div>
              <div>
                <dt>{t.launchReadiness}</dt>
                <dd className={canCreate ? 'is-ready' : 'is-incomplete'}>
                  {canCreate ? t.ready : t.completeConfiguration}
                </dd>
              </div>
            </dl>
            {creation.isError && (
              <p className="tasks-inline-error tasks-creation-error" role="alert">
                {creation.error instanceof ApiError && creation.error.code === 'CATALOG_CHANGED'
                  ? language === 'zh'
                    ? '目录在启动前发生变化。请应用最新目录并核对脚本选择。'
                    : 'The catalog changed before launch. Apply the latest catalog and review the script selection.'
                  : getRequestErrorMessage(creation.error, t.taskCreateFailed, language)}
              </p>
            )}
            <button
              className="button button--primary tasks-launch-button"
              type="button"
              disabled={!canCreate}
              onClick={() => creation.mutate(payload)}
            >
              {creation.isPending ? t.launchingExecution : t.launchExecution}
              <span aria-hidden="true">→</span>
            </button>
          </section>
        </aside>
      </div>
    </div>
  );
}
