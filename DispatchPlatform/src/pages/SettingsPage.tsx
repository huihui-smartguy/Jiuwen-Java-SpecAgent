import { ServerCog } from 'lucide-react';
import { getCopy } from '../i18n';
import type { Language, NormalizedTaskStatus, RuntimeConfig, SutTarget } from '../types';

export function SettingsPage({
  language,
  runtimeConfig
}: {
  language: Language;
  selectedSut: SutTarget;
  activeTask: NormalizedTaskStatus | null;
  runtimeConfig: RuntimeConfig;
}) {
  const t = getCopy(language);
  return (
    <div className="page-stack">
      <div className="page-title-row">
        <div>
          <p className="eyebrow">{t.runtimeConfig}</p>
          <h1>{t.settings}</h1>
        </div>
      </div>
      <section className="panel shell-panel">
        <ServerCog aria-hidden="true" className="shell-icon" />
        <h2>{t.deploymentMode}</h2>
        <p>{runtimeConfig.deploymentMode === 'container' ? t.containerMode : t.processMode}</p>
        <dl className="settings-list">
          <div>
            <dt>API</dt>
            <dd>{runtimeConfig.apiBaseUrl}</dd>
          </div>
          <div>
            <dt>SUT</dt>
            <dd>{runtimeConfig.sutTargets.length}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
