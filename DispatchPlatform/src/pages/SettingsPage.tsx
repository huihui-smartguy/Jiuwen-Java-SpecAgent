import { ChevronDown } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { PageHeader } from '../components/PageHeader';
import { getCopy } from '../i18n';
import { objectOptionLabel } from '../objectLabels';
import {
  areConsolePreferencesEqual,
  loadConsolePreferences,
  resolveConsolePreferences,
  saveConsolePreferences,
  subscribeToConsolePreferences,
  type ConsolePreferencesV1
} from '../preferences';
import type { Language, ReportDownloadFormat, RuntimeConfig, SutTarget } from '../types';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const settingsPageCopy = {
  zh: {
    saving: '正在保存…',
    saved: '设置已保存并应用。',
    saveError: '无法保存设置。请检查浏览器存储权限后重试。',
    language: '语言',
    languageHint: '保存后用于当前会话和下次启动',
    reducedMotion: '减少动态效果',
    reducedMotionHint: '与操作系统的减少动态效果设置共同生效',
    reportsDescription: '选择报告下载的首选格式；HTML 与 Markdown 始终都可使用。',
    defaultFormat: '默认下载格式',
    defaultFormatHint: '报告下载的主操作将优先使用此格式',
    markdown: 'Markdown',
    deploymentMode: '部署模式'
  },
  en: {
    saving: 'Saving…',
    saved: 'Settings saved and applied.',
    saveError: 'Settings could not be saved. Check browser storage access and try again.',
    language: 'Language',
    languageHint: 'Used in this session and on the next launch after saving',
    reducedMotion: 'Reduced motion',
    reducedMotionHint: 'Combined with the operating system reduced-motion setting',
    reportsDescription: 'Choose the preferred report download format; HTML and Markdown remain available.',
    defaultFormat: 'Default download format',
    defaultFormatHint: 'The primary report action will prefer this format',
    markdown: 'Markdown',
    deploymentMode: 'Deployment mode'
  }
} as const;

export interface SettingsProps {
  language: Language;
  selectedSut: SutTarget;
  runtimeConfig: RuntimeConfig;
  preferences?: ConsolePreferencesV1;
  onObjectChange: (id: string) => void;
  onLanguageChange: (language: Language) => void;
  onPreferencesChange?: (preferences: ConsolePreferencesV1) => void;
}

export function SettingsPage({
  language,
  selectedSut,
  runtimeConfig,
  preferences,
  onObjectChange,
  onLanguageChange,
  onPreferencesChange
}: SettingsProps) {
  const t = getCopy(language);
  const settingsCopy = settingsPageCopy[language];
  const initialPreferences = useMemo(
    () => resolveConsolePreferences(
      preferences ?? loadConsolePreferences(runtimeConfig),
      runtimeConfig
    ),
    [preferences, runtimeConfig]
  );
  const [persistedPreferences, setPersistedPreferences] = useState(initialPreferences);
  const [draft, setDraft] = useState(initialPreferences);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const locallySavedPreferencesRef = useRef<ConsolePreferencesV1 | null>(null);

  useEffect(() => {
    if (!preferences) {
      return;
    }

    const nextPreferences = resolveConsolePreferences(preferences, runtimeConfig);
    const confirmsLocalSave = Boolean(
      locallySavedPreferencesRef.current
      && areConsolePreferencesEqual(locallySavedPreferencesRef.current, nextPreferences)
    );
    setPersistedPreferences(nextPreferences);
    setDraft(nextPreferences);
    if (!confirmsLocalSave) {
      setSaveState('idle');
    }
    locallySavedPreferencesRef.current = null;
  }, [preferences, runtimeConfig]);

  useEffect(() => {
    if (preferences) {
      return undefined;
    }

    return subscribeToConsolePreferences(runtimeConfig, (nextPreferences) => {
      setPersistedPreferences(nextPreferences);
      setDraft(nextPreferences);
      setSaveState('idle');
      onPreferencesChange?.(nextPreferences);
      onObjectChange(nextPreferences.defaultSutId);
      onLanguageChange(nextPreferences.language);
    });
  }, [onLanguageChange, onObjectChange, onPreferencesChange, preferences, runtimeConfig]);

  const draftSut = runtimeConfig.sutTargets.find((sut) => sut.id === draft.defaultSutId)
    ?? runtimeConfig.sutTargets[0]
    ?? selectedSut;
  const isDirty = !areConsolePreferencesEqual(draft, persistedPreferences);
  const isSaving = saveState === 'saving';
  const resolvedApiBaseUrl = selectedSut.apiBaseUrl || runtimeConfig.apiBaseUrl;
  const deploymentMode = runtimeConfig.deploymentMode === 'container'
    ? t.settingsContainerMode
    : t.settingsProcessMode;
  const objectStatusLabel = t[draftSut.status];

  const updateDraft = (update: Partial<ConsolePreferencesV1>) => {
    setDraft((current) => ({ ...current, ...update }));
    setSaveState('idle');
  };

  const saveChanges = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isDirty || isSaving) {
      return;
    }

    setSaveState('saving');
    await Promise.resolve();

    const nextPreferences: ConsolePreferencesV1 = { ...draft };
    try {
      saveConsolePreferences(nextPreferences, runtimeConfig);
    } catch {
      setSaveState('error');
      return;
    }

    setPersistedPreferences(nextPreferences);
    setSaveState('saved');
    locallySavedPreferencesRef.current = nextPreferences;
    onPreferencesChange?.(nextPreferences);
    onObjectChange(nextPreferences.defaultSutId);
    onLanguageChange(nextPreferences.language);
  };

  const copyApiBaseUrl = () => {
    const clipboard = navigator.clipboard;
    if (!clipboard?.writeText) {
      return;
    }
    void clipboard.writeText(resolvedApiBaseUrl).catch(() => undefined);
  };

  return (
    <div className="page-stack settings-page">
      <PageHeader
        title={t.settings}
        subtitle={t.settingsSubtitle}
        action={(
          <div className="settings-save-cluster">
            <button
              type="submit"
              form="settings-preferences-form"
              className="settings-save"
              disabled={!isDirty || isSaving}
            >
              <span>{isSaving ? settingsCopy.saving : t.saveChanges}</span>
              {!isSaving && <span aria-hidden="true">→</span>}
            </button>
            <div className="settings-save-feedback" aria-live="polite">
              {saveState === 'saved' && (
                <span role="status">{settingsCopy.saved}</span>
              )}
              {saveState === 'error' && (
                <span role="alert">{settingsCopy.saveError}</span>
              )}
            </div>
          </div>
        )}
      />

      <form id="settings-preferences-form" onSubmit={saveChanges} noValidate>
        <div className="settings-grid">
          <section
            className="settings-card settings-card--object"
            aria-labelledby="settings-object-title"
          >
            <div className="settings-card__header">
              <h2 id="settings-object-title">{t.objectConnection}</h2>
              <span className={`settings-status-pill settings-status-pill--${draftSut.status}`}>
                {objectStatusLabel}
              </span>
            </div>
            <p className="settings-card__description">{t.objectConnectionDescription}</p>
            <div className="settings-card__body">
              <div className="settings-row">
                <div className="settings-row__label">
                  <strong>{t.defaultObject}</strong>
                  <span>{t.defaultObjectHint}</span>
                </div>
                <label className="settings-select-shell settings-select-shell--object settings-control">
                  <span className="settings-select-visual" aria-hidden="true">
                    <span className="settings-select-object-name">{draftSut.name}</span>
                    <ChevronDown />
                  </span>
                  <select
                    aria-label={t.defaultObject}
                    value={draft.defaultSutId}
                    onChange={(event) => updateDraft({ defaultSutId: event.target.value })}
                  >
                    {runtimeConfig.sutTargets.map((object) => (
                      <option key={object.id} value={object.id}>
                        {objectOptionLabel(object, runtimeConfig.sutTargets, 'name')}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          </section>

          <section
            className="settings-card settings-card--runtime"
            aria-labelledby="settings-runtime-title"
          >
            <div className="settings-card__header">
              <h2 id="settings-runtime-title">{t.runtimeEnvironment}</h2>
              <span className="settings-runtime-pill">{t.readOnlyConfiguration}</span>
            </div>
            <p className="settings-card__description">{t.runtimeEnvironmentDescription}</p>
            <div className="settings-card__body">
              <div className="settings-row settings-runtime-row">
                <label className="settings-runtime-label" htmlFor="settings-deployment-mode">
                  {settingsCopy.deploymentMode}
                </label>
                <input
                  id="settings-deployment-mode"
                  className="settings-readonly-value settings-readonly-value--mode"
                  aria-label={settingsCopy.deploymentMode}
                  value={deploymentMode}
                  readOnly
                />
              </div>
              <div className="settings-row settings-row--api settings-runtime-row">
                <label className="settings-runtime-label" htmlFor="settings-api-base-url">
                  {t.apiBaseUrl}
                </label>
                <div className="settings-api-controls">
                  <input
                    id="settings-api-base-url"
                    className="settings-readonly-value settings-readonly-value--api"
                    aria-label={t.apiBaseUrl}
                    value={resolvedApiBaseUrl}
                    readOnly
                  />
                  <button
                    type="button"
                    className="settings-copy settings-control"
                    aria-label={`${t.copy} API base URL`}
                    onClick={copyApiBaseUrl}
                  >
                    {t.copy}
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section
            className="settings-card settings-card--preferences"
            aria-labelledby="settings-preferences-title"
          >
            <div className="settings-card__header">
              <h2 id="settings-preferences-title">{t.consolePreferences}</h2>
            </div>
            <p className="settings-card__description">{t.consolePreferencesDescription}</p>
            <div className="settings-card__body">
              <div className="settings-row">
                <div className="settings-row__label">
                  <strong>{settingsCopy.language}</strong>
                  <span>{settingsCopy.languageHint}</span>
                </div>
                <label className="settings-select-shell settings-control">
                  <span className="settings-select-visual" aria-hidden="true">
                    <span>{draft.language === 'zh' ? t.simplifiedChinese : t.english}</span>
                    <ChevronDown />
                  </span>
                  <select
                    aria-label={settingsCopy.language}
                    value={draft.language}
                    onChange={(event) => updateDraft({ language: event.target.value as Language })}
                  >
                    <option value="zh">{t.simplifiedChinese}</option>
                    <option value="en">{t.english}</option>
                  </select>
                </label>
              </div>
              <div className="settings-row">
                <div className="settings-row__label">
                  <strong>{settingsCopy.reducedMotion}</strong>
                  <span>{settingsCopy.reducedMotionHint}</span>
                </div>
                <button
                  type="button"
                  role="switch"
                  className="settings-switch settings-control"
                  aria-label={settingsCopy.reducedMotion}
                  aria-checked={draft.reducedMotion}
                  onClick={() => updateDraft({ reducedMotion: !draft.reducedMotion })}
                >
                  <span
                    className={`settings-switch__track ${draft.reducedMotion ? 'is-on' : ''}`}
                    aria-hidden="true"
                  >
                    <span />
                  </span>
                </button>
              </div>
            </div>
          </section>

          <section
            className="settings-card settings-card--reports"
            aria-labelledby="settings-reports-title"
          >
            <div className="settings-card__header">
              <h2 id="settings-reports-title">{t.reportsAndLogs}</h2>
            </div>
            <p className="settings-card__description">{settingsCopy.reportsDescription}</p>
            <div className="settings-card__body">
              <div className="settings-row">
                <div className="settings-row__label">
                  <strong>{settingsCopy.defaultFormat}</strong>
                  <span>{settingsCopy.defaultFormatHint}</span>
                </div>
                <label className="settings-select-shell settings-control">
                  <span className="settings-select-visual" aria-hidden="true">
                    <span>
                      {draft.reportDownloadFormat === 'html' ? 'HTML' : settingsCopy.markdown}
                    </span>
                    <ChevronDown />
                  </span>
                  <select
                    aria-label={settingsCopy.defaultFormat}
                    value={draft.reportDownloadFormat}
                    onChange={(event) => updateDraft({
                      reportDownloadFormat: event.target.value as ReportDownloadFormat
                    })}
                  >
                    <option value="html">HTML</option>
                    <option value="md">{settingsCopy.markdown}</option>
                  </select>
                </label>
              </div>
            </div>
          </section>
        </div>
      </form>
    </div>
  );
}
