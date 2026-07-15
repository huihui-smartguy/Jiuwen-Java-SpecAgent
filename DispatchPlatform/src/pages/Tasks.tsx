import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError, createTask, getFeatures, getScripts, getVersions } from '../api/client';
import { PageHeader } from '../components/PageHeader';
import { mockFeatures, mockScripts } from '../data/mockData';
import { getCopy } from '../i18n';
import type {
  Feature,
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
  onTaskCreated: (task: TaskCreateResponse) => void;
  onRequestObjectChange: () => void;
}

const emptyFeatures: Feature[] = [];
const emptyScripts: Script[] = [];
const emptyVersions: TestVersionResponse['versions'] = [];
const levels = ['L0', 'L1', 'L2', 'L3', 'L4'] as const;
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

function getRequestErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    return error.code ? `${error.message} (${error.code})` : error.message;
  }

  return fallback;
}

export function Tasks({
  language,
  selectedSut,
  runtimeConfig,
  onTaskCreated,
  onRequestObjectChange
}: TasksProps) {
  const t = getCopy(language);
  const navigate = useNavigate();
  const firstConfigurationControlRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<TriggerType>('feature');
  const [selectedFeature, setSelectedFeature] = useState('');
  const [selectedLevel, setSelectedLevel] = useState('L1');
  const [selectedVersion, setSelectedVersion] = useState('');
  const [selectedScriptNames, setSelectedScriptNames] = useState<string[]>([]);
  const [scriptSearch, setScriptSearch] = useState('');
  const resolvedApiBaseUrl = selectedSut.apiBaseUrl || runtimeConfig.apiBaseUrl;
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
    }
  });

  const features = featuresQuery.data ?? emptyFeatures;
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
          const responses = await Promise.all(featureNames.map((feature) => getScripts(api, {
            product: targetIdentity.product,
            scene: targetIdentity.scene,
            feature
          })));
          return [...new Map(
            responses.flatMap((response) => response.scripts).map((script) => [script.id, script])
          ).values()];
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
    enabled: mode === 'scene'
      ? featuresQuery.isSuccess && featureNames.length > 0
      : !requiresFeature || Boolean(selectedFeature)
  });

  const scripts = scriptQuery.data ?? emptyScripts;
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
    setSelectedFeature('');
    setSelectedVersion('');
    setSelectedScriptNames([]);
    setScriptSearch('');
  }, [selectedSut.id]);

  useEffect(() => {
    setSelectedScriptNames((current) => {
      const next = current.filter((name) => scripts.some((script) => script.name === name));
      return next.length === current.length ? current : next;
    });
  }, [scripts]);

  const creation = useMutation({
    mutationFn: async (payload: TaskCreateRequest) => {
      try {
        return await createTask(api, payload);
      } catch (error) {
        if (runtimeConfig.enableMockFallback) {
          return createFallbackTask(payload, mode);
        }
        throw error;
      }
    },
    onSuccess: (task) => {
      onTaskCreated(task);
      navigate('/observation');
    }
  });

  const payload = useMemo<TaskCreateRequest>(() => {
    const base = {
      product: selectedSut.product,
      scene: selectedSut.scene,
      version: selectedVersion
    };
    if (mode === 'level') {
      return { ...base, level: selectedLevel };
    }
    if (mode === 'scripts') {
      return {
        ...base,
        feature: selectedFeature,
        script_name: selectedScriptNames
      };
    }
    if (mode === 'scene') {
      return base;
    }
    return { ...base, feature: selectedFeature };
  }, [mode, selectedFeature, selectedLevel, selectedScriptNames, selectedSut.product, selectedSut.scene, selectedVersion]);

  const canCreate =
    !creation.isPending &&
    Boolean(selectedVersion) &&
    (mode !== 'scripts' || selectedScriptNames.length > 0) &&
    (!requiresFeature || Boolean(selectedFeature));
  const objectPassed = selectedSut.status === 'healthy';
  const scriptsPassed = scriptQuery.isSuccess && scripts.length > 0;
  const credentialsPassed = runtimeConfig.enableMockFallback;
  const guardrailsPassed = [objectPassed, scriptsPassed, credentialsPassed].filter(Boolean).length;
  const modeSummary = mode === 'feature'
    ? `Feature · ${selectedFeature || '—'}`
    : mode === 'level'
      ? `Level · ${selectedLevel}`
      : mode === 'scripts'
        ? `Scripts · ${selectedScriptNames.length}`
        : 'Scene · All scripts';

  const toggleScript = (name: string) => {
    setSelectedScriptNames((current) => (
      current.includes(name) ? current.filter((item) => item !== name) : [...current, name]
    ));
  };
  const handleScriptRowKeyDown = (event: KeyboardEvent<HTMLTableRowElement>, name: string) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }
    event.preventDefault();
    toggleScript(name);
  };
  const handleScriptRowClick = (event: MouseEvent<HTMLTableRowElement>, name: string) => {
    if ((event.target as HTMLElement).tagName !== 'INPUT') {
      toggleScript(name);
    }
  };

  const objectGuardrailLabel = selectedSut.status === 'healthy'
    ? t.guardrailPassed
    : selectedSut.status === 'degraded'
      ? t.guardrailAttention
      : t.guardrailUnavailable;
  const scriptsGuardrailLabel = scriptQuery.isLoading
    ? t.guardrailChecking
    : scriptsPassed
      ? t.guardrailPassed
      : t.guardrailUnavailable;

  return (
    <div className="page-stack tasks-page">
      <PageHeader
        title={t.tasks}
        subtitle={t.tasksSubtitle}
        action={(
          <button
            className="button button--primary tasks-create-task"
            type="button"
            onClick={() => firstConfigurationControlRef.current?.focus()}
          >
            {t.tasksPageAction}
            <span aria-hidden="true">→</span>
          </button>
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
                <span><strong>Object</strong><small>{t.objectStepDescription}</small></span>
              </li>
              <li>
                <span className="tasks-step-number">2</span>
                <span><strong>Trigger</strong><small>{t.triggerStepDescription}</small></span>
              </li>
              <li>
                <span className="tasks-step-number">3</span>
                <span><strong>Scope</strong><small>{t.scopeStepDescription}</small></span>
              </li>
            </ol>

            <div className="tasks-object-summary" data-testid="task-context-summary">
              <div>
                <span>{t.selectedObject}</span>
                <strong>{selectedSut.product} {selectedSut.scene}</strong>
              </div>
              <button type="button" onClick={onRequestObjectChange}>
                {t.changeObject}
                <span aria-hidden="true">→</span>
              </button>
            </div>

            <div className="tasks-mode-row">
              <fieldset className="tasks-segmented" role="radiogroup" aria-label={t.taskModeLabel}>
                <legend className="sr-only">{t.taskModeLabel}</legend>
                {([
                  ['feature', t.byFeature, 'Feature'],
                  ['level', t.byLevel, 'Level'],
                  ['scripts', t.byScripts, 'Scripts'],
                  ['scene', t.entireScene, 'Scene']
                ] as const).map(([value, label, visibleLabel]) => (
                  <label key={value}>
                    <input
                      ref={value === 'feature' ? firstConfigurationControlRef : undefined}
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
                  <span>Feature</span>
                  <select value={selectedFeature} onChange={(event) => setSelectedFeature(event.target.value)}>
                    {features.map((feature) => (
                      <option key={feature.id} value={feature.name}>{feature.name}</option>
                    ))}
                  </select>
                </label>
              ) : mode === 'level' ? (
                <label className="tasks-field">
                  <span>Level</span>
                  <select value={selectedLevel} onChange={(event) => setSelectedLevel(event.target.value)}>
                    {levels.map((level) => <option key={level} value={level}>{level}</option>)}
                  </select>
                </label>
              ) : (
                <label className="tasks-field">
                  <span>{language === 'zh' ? '场景' : 'Scene'}</span>
                  <select value={selectedSut.scene} disabled>
                    <option value={selectedSut.scene}>{selectedSut.scene}</option>
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
                      {version.name} · {version.code}
                      {version.code === versionsQuery.data?.default_version ? ` · ${t.defaultVersion}` : ''}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {(featuresQuery.isError || scriptQuery.isError || versionsQuery.isError) && (
              <p className="tasks-inline-error" role="alert">
                {getRequestErrorMessage(
                  featuresQuery.error ?? scriptQuery.error ?? versionsQuery.error,
                  t.contextLoadFailed
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
                    <th>{language === 'zh' ? '脚本' : 'Script'}</th>
                    <th>Feature</th>
                    <th>{language === 'zh' ? '级别' : 'Level'}</th>
                    <th>{language === 'zh' ? '路径' : 'Path'}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredScripts.map((script) => {
                    const selected = selectedScriptNames.includes(script.name);
                    const explicitlySelectable = mode === 'scripts';
                    return (
                      <tr
                        key={script.id}
                        className={selected ? 'is-selected' : undefined}
                        tabIndex={explicitlySelectable ? 0 : undefined}
                        aria-selected={explicitlySelectable ? selected : undefined}
                        onClick={explicitlySelectable ? (event) => handleScriptRowClick(event, script.name) : undefined}
                        onKeyDown={explicitlySelectable ? (event) => handleScriptRowKeyDown(event, script.name) : undefined}
                      >
                        <td>
                          {explicitlySelectable && (
                            <input
                              className="sr-only"
                              type="checkbox"
                              tabIndex={-1}
                              aria-label={`${t.selectScript} ${script.name}`}
                              checked={selected}
                              onChange={() => toggleScript(script.name)}
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
              <h2 id="launch-summary-title">Launch summary</h2>
            </div>
            <dl className="tasks-launch-list">
              <div>
                <dt>Object</dt>
                <dd>
                  {selectedSut.product} {selectedSut.scene} ·{' '}
                  <span data-testid="task-version-summary">{selectedVersion || '—'}</span>
                </dd>
              </div>
              <div><dt>Mode</dt><dd data-testid="task-mode-summary">{modeSummary}</dd></div>
              <div><dt>Scripts</dt><dd>{scripts.length}</dd></div>
              <div><dt>Estimated</dt><dd data-testid="launch-estimate">{runtimeConfig.enableMockFallback ? '~ 6 min' : '—'}</dd></div>
            </dl>
            {creation.isError && (
              <p className="tasks-inline-error tasks-creation-error" role="alert">
                {getRequestErrorMessage(creation.error, t.taskCreateFailed)}
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

          <section className="tasks-card tasks-guardrail-card" aria-labelledby="guardrail-title">
            <div className="tasks-card-heading">
              <h2 id="guardrail-title">{t.guardrails}</h2>
              <span className={`tasks-guardrail-count ${guardrailsPassed === 3 ? 'is-complete' : ''}`}>
                {guardrailsPassed} / 3
              </span>
            </div>
            <dl className="tasks-guardrail-list">
              <div>
                <dt>{t.objectOnline}</dt>
                <dd className={`is-${selectedSut.status === 'healthy' ? 'passed' : selectedSut.status}`}>{objectGuardrailLabel}</dd>
              </div>
              <div>
                <dt>{t.scriptsAvailable}</dt>
                <dd className={scriptsPassed ? 'is-passed' : undefined}>{scriptsGuardrailLabel}</dd>
              </div>
              <div data-testid="guardrail-credentials">
                <dt>{t.credentialsValid}</dt>
                <dd className={credentialsPassed ? 'is-passed' : undefined}>
                  {credentialsPassed ? t.guardrailPassed : t.notVerified}
                </dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>
    </div>
  );
}
