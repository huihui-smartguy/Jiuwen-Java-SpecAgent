import type { LucideIcon } from 'lucide-react';
import { getCopy, type CopyKey } from '../i18n';
import type { Language, NormalizedTaskStatus, RuntimeConfig, SutTarget } from '../types';

export interface ShellPageBaseProps {
  language: Language;
  selectedSut: SutTarget;
  activeTask: NormalizedTaskStatus;
  runtimeConfig: RuntimeConfig;
}

export function ShellPage({
  language,
  titleKey,
  bodyKey,
  icon: Icon
}: ShellPageBaseProps & {
  titleKey: CopyKey;
  bodyKey: CopyKey;
  icon: LucideIcon;
}) {
  const t = getCopy(language);

  return (
    <div className="page-stack">
      <div className="page-title-row">
        <div>
          <p className="eyebrow">TestWise</p>
          <h1>{t[titleKey]}</h1>
        </div>
      </div>
      <section className="panel shell-panel">
        <Icon aria-hidden="true" className="shell-icon" />
        <h2>{t[titleKey]}</h2>
        <p>{t[bodyKey]}</p>
      </section>
    </div>
  );
}
