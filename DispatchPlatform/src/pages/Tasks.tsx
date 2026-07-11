import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowRight, ChevronLeft, Play, Plus, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError, createTask, getFeatures, getScripts } from '../api/client';
import { getCopy } from '../i18n';
import { mockFeatures, mockScripts } from '../data/mockData';
import { StatusBadge } from '../components/StatusBadge';
import type {
  Feature,
  Language,
  NormalizedTaskStatus,
  RuntimeConfig,
  Script,
  SutTarget,
  TaskCreateRequest,
  TaskCreateResponse,
  TriggerType
} from '../types';

interface PageProps {
  language: Language;
  selectedSut: SutTarget;
  activeTask: NormalizedTaskStatus;
  runtimeConfig: RuntimeConfig;
  sessionTasks: NormalizedTaskStatus[];
  onTaskCreated: (task: TaskCreateResponse) => void;
}

type WorkspaceTab = 'queue' | 'new';
type BuilderStep = 1 | 2;
const emptyFeatures: Feature[] = [];
const emptyScripts: Script[] = [];

function fallbackScripts(sut: SutTarget): Script[] {
  return mockScripts.filter((script) => script.product === sut.product && script.scene === sut.scene);
}

function createFallbackTask(payload: TaskCreateRequest, triggerType: TriggerType): TaskCreateResponse {
  return {
    success: true,
    task_id: `demo_${Date.now()}`,
    status: 'pending',
    trigger_type: triggerType,
    message: `Demo task created from ${Object.keys(payload).join(', ')}`
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
  sessionTasks,
  onTaskCreated
}: PageProps) {
  const t = getCopy(language);
  const navigate = useNavigate();
  const [tab, setTab] = useState<WorkspaceTab>('queue');
  const [step, setStep] = useState<BuilderStep>(1);
  const [mode, setMode] = useState<TriggerType>('feature');
  const [selectedFeature, setSelectedFeature] = useState('');
  const [selectedLevel, setSelectedLevel] = useState('L0');
  const [selectedScriptNames, setSelectedScriptNames] = useState<string[]>([]);
  const api = useMemo(() => ({ apiBaseUrl: selectedSut.apiBaseUrl || runtimeConfig.apiBaseUrl }), [selectedSut.apiBaseUrl, runtimeConfig.apiBaseUrl]);
  const requiresFeature = mode === 'feature' || mode === 'scripts';

  const featuresQuery = useQuery({
    queryKey: ['features', selectedSut.product, selectedSut.scene],
    queryFn: async (): Promise<Feature[]> => {
      try {
        return (await getFeatures(api, selectedSut.product, selectedSut.scene)).features;
      } catch (error) {
        if (runtimeConfig.enableMockFallback) {
          return mockFeatures;
        }
        throw error;
      }
    }
  });

  const features = featuresQuery.data ?? emptyFeatures;
  const scriptQuery = useQuery({
    queryKey: ['scripts', selectedSut.product, selectedSut.scene, mode, selectedFeature, selectedLevel],
    queryFn: async (): Promise<Script[]> => {
      const query = {
        product: selectedSut.product,
        scene: selectedSut.scene,
        feature: requiresFeature ? selectedFeature || undefined : undefined,
        level: mode === 'level' ? selectedLevel : undefined
      };
      try {
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
    }
  });

  const scripts = scriptQuery.data ?? emptyScripts;

  useEffect(() => {
    if (!selectedFeature || !features.some((feature) => feature.name === selectedFeature)) {
      setSelectedFeature(features[0]?.name ?? '');
    }
  }, [features, selectedFeature]);

  useEffect(() => {
    setStep(1);
    setSelectedFeature('');
    setSelectedScriptNames([]);
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
    if (mode === 'level') {
      return { product: selectedSut.product, scene: selectedSut.scene, level: selectedLevel };
    }
    if (mode === 'scripts') {
      return {
        product: selectedSut.product,
        scene: selectedSut.scene,
        feature: selectedFeature,
        script_name: selectedScriptNames
      };
    }
    return { product: selectedSut.product, scene: selectedSut.scene, feature: selectedFeature };
  }, [mode, selectedFeature, selectedLevel, selectedScriptNames, selectedSut.product, selectedSut.scene]);

  const canAdvance = !requiresFeature || Boolean(selectedFeature);
  const canCreate =
    !creation.isPending &&
    (mode !== 'scripts' || selectedScriptNames.length > 0) &&
    (!requiresFeature || Boolean(selectedFeature));
  const modeLabel = (value: TriggerType) =>
    value === 'feature' ? t.byFeature : value === 'level' ? t.byLevel : t.byScripts;

  const openNewTask = () => {
    setTab('new');
    setStep(1);
  };
  const toggleScript = (name: string) => {
    setSelectedScriptNames((current) =>
      current.includes(name) ? current.filter((item) => item !== name) : [...current, name]
    );
  };

  return (
    <div className="page-stack">
      <div className="page-title-row">
        <div>
          <p className="eyebrow">TestWise</p>
          <h1>{t.tasks}</h1>
          <p className="page-subtitle">{t.tasksSubtitle}</p>
        </div>
        <button className="button button--primary" type="button" onClick={openNewTask}>
          <Plus aria-hidden="true" />
          {t.newTaskTab}
        </button>
      </div>

      <div className="task-tabs" role="tablist" aria-label={t.tasks}>
        <button
          className={`task-tab ${tab === 'queue' ? 'active' : ''}`}
          type="button"
          role="tab"
          aria-selected={tab === 'queue'}
          onClick={() => setTab('queue')}
        >
          {t.taskQueue}
        </button>
        <button
          className={`task-tab ${tab === 'new' ? 'active' : ''}`}
          type="button"
          role="tab"
          aria-selected={tab === 'new'}
          onClick={openNewTask}
        >
          {t.newTaskTab}
        </button>
      </div>

      {tab === 'queue' ? (
        <section className="panel task-queue-panel" role="tabpanel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">{t.thisSession}</p>
              <h2>{t.taskQueue}</h2>
            </div>
            <span className="session-note">{t.sessionTaskNote}</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t.taskId}</th>
                  <th>{t.triggerMode}</th>
                  <th>{t.status}</th>
                  <th>{t.progress}</th>
                  <th>{t.action}</th>
                </tr>
              </thead>
              <tbody>
                {sessionTasks.map((task) => (
                  <tr key={task.task_id}>
                    <td className="mono-cell">{task.task_id}</td>
                    <td>{modeLabel(task.trigger_type)}</td>
                    <td>
                      <div className="queue-status">
                        <StatusBadge status={task.uiStatus} language={language} />
                        {task.backend_status === 'queued' && (task.queue_position ?? -1) > 0 && (
                          <span className="queue-position">{t.queuePosition}: {task.queue_position}</span>
                        )}
                      </div>
                    </td>
                    <td>
                      {task.progress?.completed ?? 0}/{task.progress?.total_commands ?? task.result?.total_commands ?? 0}
                    </td>
                    <td>
                      <Link className="table-link" to="/observation">
                        {t.openObservation}
                        <ArrowRight aria-hidden="true" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <section className="task-builder" role="tabpanel">
          <div className="task-stepper" aria-label={t.newTaskTab}>
            <div className={`task-step ${step === 1 ? 'active' : ''}`}>
              <span>1</span>
              {t.taskStepContext}
            </div>
            <div className={`task-step ${step === 2 ? 'active' : ''}`}>
              <span>2</span>
              {t.taskStepSnapshot}
            </div>
          </div>

          {step === 1 ? (
            <section className="panel task-builder__panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">{t.selectedContext}</p>
                  <h2>{t.taskStepContext}</h2>
                </div>
              </div>
              <div className="form-grid">
                <div data-testid="task-context-summary" className="context-card">
                  <span>{selectedSut.name}</span>
                  <strong>{selectedSut.product} · {selectedSut.scene} · {selectedSut.version}</strong>
                </div>
                <label className="field">
                  <span>{t.triggerMode}</span>
                  <select value={mode} onChange={(event) => setMode(event.target.value as TriggerType)}>
                    <option value="feature">{t.byFeature}</option>
                    <option value="level">{t.byLevel}</option>
                    <option value="scripts">{t.byScripts}</option>
                  </select>
                </label>
                <div className="task-builder__api-note">{selectedSut.product} · {selectedSut.scene}</div>
              </div>
              <div className="task-builder__actions">
                <button className="button button--primary" type="button" disabled={!canAdvance} onClick={() => setStep(2)}>
                  {t.next}
                  <ArrowRight aria-hidden="true" />
                </button>
              </div>
            </section>
          ) : (
            <section className="panel task-builder__panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">{modeLabel(mode)}</p>
                  <h2>{t.taskStepSnapshot}</h2>
                </div>
                <span className="readonly-tag">{t.readOnlySnapshot}</span>
              </div>
              <div className="task-builder-grid">
                <div className="task-selector-panel">
                  {requiresFeature && (
                    <label className="field">
                      <span>{t.feature}</span>
                      <select value={selectedFeature} onChange={(event) => setSelectedFeature(event.target.value)}>
                        {features.map((feature) => <option key={feature.id} value={feature.name}>{feature.name} · {feature.type}</option>)}
                      </select>
                    </label>
                  )}
                  {mode === 'level' && (
                    <label className="field">
                      <span>{t.level}</span>
                      <select value={selectedLevel} onChange={(event) => setSelectedLevel(event.target.value)}>
                        {['L0', 'L1', 'L2', 'L3', 'L4'].map((level) => <option key={level}>{level}</option>)}
                      </select>
                    </label>
                  )}
                  {mode === 'scripts' && (
                    <fieldset className="script-select-list">
                      <legend>{t.selectScripts}</legend>
                      {scripts.map((script) => (
                        <label key={script.id}>
                          <input
                            type="checkbox"
                            checked={selectedScriptNames.includes(script.name)}
                            onChange={() => toggleScript(script.name)}
                          />
                          <span>{script.name}</span>
                        </label>
                      ))}
                    </fieldset>
                  )}
                  {(featuresQuery.isError || scriptQuery.isError) && (
                    <p className="helper-text">
                      {getRequestErrorMessage(featuresQuery.error ?? scriptQuery.error, t.contextLoadFailed)}
                    </p>
                  )}
                </div>
                <div className="task-snapshot-panel">
                  <div className="table-search">
                    <Search aria-hidden="true" />
                    <span>{scripts.length} {t.scriptsCount}</span>
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>{t.script}</th>
                          <th>{t.feature}</th>
                          <th>{t.level}</th>
                          <th>{t.path}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {scripts.map((script) => (
                          <tr key={script.id}>
                            <td>{script.name}</td>
                            <td>{script.feature}</td>
                            <td>{script.level}</td>
                            <td className="mono-cell">{script.path}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
              {creation.isError && (
                <p className="helper-text task-error">
                  {getRequestErrorMessage(creation.error, t.taskCreateFailed)}
                </p>
              )}
              <div className="task-builder__actions">
                <button className="button button--secondary" type="button" onClick={() => setStep(1)}>
                  <ChevronLeft aria-hidden="true" />
                  {t.back}
                </button>
                <button className="button button--primary" type="button" disabled={!canCreate} onClick={() => creation.mutate(payload)}>
                  <Play aria-hidden="true" />
                  {creation.isPending ? t.creatingTask : t.createTask}
                </button>
              </div>
            </section>
          )}
        </section>
      )}
    </div>
  );
}
