import { ChevronDown, Contrast, SquareDashed } from 'lucide-react';
import { useEffect, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { PresentationOnlyButton } from '../components/PresentationOnlyButton';
import { getCopy } from '../i18n';
import type { Language, RuntimeConfig, SutTarget } from '../types';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const REDUCED_MOTION_CLASS = 'settings-reduced-motion';

export interface SettingsProps {
  language: Language;
  selectedSut: SutTarget;
  runtimeConfig: RuntimeConfig;
  onObjectChange: (id: string) => void;
  onLanguageChange: (language: Language) => void;
}

export function SettingsPage({
  language,
  selectedSut,
  runtimeConfig,
  onObjectChange,
  onLanguageChange
}: SettingsProps) {
  const t = getCopy(language);
  const [connectionCheck, setConnectionCheck] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(true);
  const [systemPrefersReducedMotion, setSystemPrefersReducedMotion] = useState(false);
  const [reportFormat, setReportFormat] = useState('pdf-json');
  const [retention, setRetention] = useState('30');
  const resolvedApiBaseUrl = selectedSut.apiBaseUrl || runtimeConfig.apiBaseUrl;
  const deploymentMode = runtimeConfig.deploymentMode === 'container'
    ? t.settingsContainerMode
    : t.settingsProcessMode;
  const objectStatusLabel = selectedSut.status === 'healthy'
    ? t.settingsConnected
    : t[selectedSut.status];

  useEffect(() => {
    const mediaQuery = typeof window.matchMedia === 'function'
      ? window.matchMedia(REDUCED_MOTION_QUERY)
      : null;
    if (!mediaQuery) {
      return undefined;
    }

    const handlePreferenceChange = () => {
      setSystemPrefersReducedMotion(mediaQuery.matches);
    };
    handlePreferenceChange();

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handlePreferenceChange);
      return () => mediaQuery.removeEventListener('change', handlePreferenceChange);
    }

    mediaQuery.addListener(handlePreferenceChange);
    return () => mediaQuery.removeListener(handlePreferenceChange);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle(
      REDUCED_MOTION_CLASS,
      reducedMotion || systemPrefersReducedMotion
    );
    return () => root.classList.remove(REDUCED_MOTION_CLASS);
  }, [reducedMotion, systemPrefersReducedMotion]);

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
          <PresentationOnlyButton className="settings-save">
            {t.saveChanges}
          </PresentationOnlyButton>
        )}
      />

      <div className="settings-grid">
        <section
          className="settings-card settings-card--object"
          aria-labelledby="settings-object-title"
        >
          <div className="settings-card__header">
            <h2 id="settings-object-title">{t.objectConnection}</h2>
            <span className={`settings-status-pill settings-status-pill--${selectedSut.status}`}>
              <span aria-hidden="true" />
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
                  <span className="settings-select-object-name">{selectedSut.name}</span>
                  <span className="settings-select-object-version">{selectedSut.version}</span>
                  <ChevronDown />
                </span>
                <select
                  aria-label={t.defaultObject}
                  value={selectedSut.id}
                  onChange={(event) => onObjectChange(event.target.value)}
                >
                  {runtimeConfig.sutTargets.map((object) => (
                    <option key={object.id} value={object.id}>
                      {object.name} · {object.version}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="settings-row">
              <div className="settings-row__label">
                <strong>{t.connectionCheck}</strong>
                <span>{t.connectionCheckHint}</span>
              </div>
              <button
                type="button"
                role="switch"
                className="settings-switch settings-control"
                aria-label={t.connectionCheck}
                aria-checked={connectionCheck}
                onClick={() => setConnectionCheck((current) => !current)}
              >
                <span className={`settings-switch__track ${connectionCheck ? 'is-on' : ''}`} aria-hidden="true">
                  <span />
                </span>
              </button>
            </div>
          </div>
        </section>

        <section
          className="settings-card settings-card--runtime"
          aria-labelledby="settings-runtime-title"
        >
          <div className="settings-card__header">
            <h2 id="settings-runtime-title">{t.runtimeEnvironment}</h2>
            <span className="settings-runtime-pill">
              <span aria-hidden="true" />
              {deploymentMode}
            </span>
          </div>
          <p className="settings-card__description">{t.runtimeEnvironmentDescription}</p>
          <div className="settings-card__body">
            <div className="settings-row">
              <label className="settings-row__label" htmlFor="settings-deployment-mode">
                <strong>{t.settingsDeploymentMode}</strong>
                <span>{t.readOnlyConfiguration}</span>
              </label>
              <input
                id="settings-deployment-mode"
                className="settings-readonly-value settings-readonly-value--mode"
                aria-label={t.settingsDeploymentMode}
                value={deploymentMode}
                readOnly
              />
            </div>
            <div className="settings-row settings-row--api">
              <label className="settings-row__label" htmlFor="settings-api-base-url">
                <strong>{t.apiBaseUrl}</strong>
                <input
                  id="settings-api-base-url"
                  className="settings-readonly-value settings-readonly-value--api"
                  aria-label={t.apiBaseUrl}
                  value={resolvedApiBaseUrl}
                  readOnly
                />
              </label>
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
        </section>

        <section
          className="settings-card settings-card--preferences"
          aria-labelledby="settings-preferences-title"
        >
          <div className="settings-card__header">
            <h2 id="settings-preferences-title">{t.consolePreferences}</h2>
            <Contrast aria-hidden="true" />
          </div>
          <p className="settings-card__description">{t.consolePreferencesDescription}</p>
          <div className="settings-card__body">
            <div className="settings-row">
              <div className="settings-row__label">
                <strong>{t.settingsLanguage}</strong>
                <span>{t.languageSwitchHint}</span>
              </div>
              <label className="settings-select-shell settings-control">
                <span className="settings-select-visual" aria-hidden="true">
                  <span>{language === 'zh' ? t.simplifiedChinese : t.english}</span>
                  <ChevronDown />
                </span>
                <select
                  aria-label={t.settingsLanguage}
                  value={language}
                  onChange={(event) => onLanguageChange(event.target.value as Language)}
                >
                  <option value="zh">{t.simplifiedChinese}</option>
                  <option value="en">{t.english}</option>
                </select>
              </label>
            </div>
            <div className="settings-row">
              <div className="settings-row__label">
                <strong>{t.reducedMotion}</strong>
                <span>{t.reducedMotionHint}</span>
              </div>
              <button
                type="button"
                role="switch"
                className="settings-switch settings-control"
                aria-label={t.reducedMotion}
                aria-checked={reducedMotion}
                onClick={() => setReducedMotion((current) => !current)}
              >
                <span className={`settings-switch__track ${reducedMotion ? 'is-on' : ''}`} aria-hidden="true">
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
            <SquareDashed aria-hidden="true" />
          </div>
          <p className="settings-card__description">{t.reportsAndLogsDescription}</p>
          <div className="settings-card__body">
            <div className="settings-row">
              <div className="settings-row__label">
                <strong>{t.defaultFormat}</strong>
                <span>{t.defaultFormatHint}</span>
              </div>
              <label className="settings-select-shell settings-control">
                <span className="settings-select-visual" aria-hidden="true">
                  <span>{reportFormat === 'pdf-json' ? t.pdfAndJson : reportFormat.toUpperCase()}</span>
                  <ChevronDown />
                </span>
                <select
                  aria-label={t.defaultFormat}
                  value={reportFormat}
                  onChange={(event) => setReportFormat(event.target.value)}
                >
                  <option value="pdf-json">{t.pdfAndJson}</option>
                  <option value="pdf">PDF</option>
                  <option value="json">JSON</option>
                </select>
              </label>
            </div>
            <div className="settings-row">
              <div className="settings-row__label">
                <strong>{t.retention}</strong>
                <span>{t.retentionHint}</span>
              </div>
              <label className="settings-select-shell settings-control">
                <span className="settings-select-visual" aria-hidden="true">
                  <span>{retention} days</span>
                  <ChevronDown />
                </span>
                <select
                  aria-label={t.retention}
                  value={retention}
                  onChange={(event) => setRetention(event.target.value)}
                >
                  <option value="30">30 days</option>
                  <option value="60">60 days</option>
                  <option value="90">90 days</option>
                </select>
              </label>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
