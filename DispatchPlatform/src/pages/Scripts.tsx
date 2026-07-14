import { useQuery } from '@tanstack/react-query';
import { ArrowRight, ChevronDown, Search, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { getScripts } from '../api/client';
import { PageHeader } from '../components/PageHeader';
import { PresentationOnlyButton } from '../components/PresentationOnlyButton';
import { mockScripts } from '../data/mockData';
import { getCopy } from '../i18n';
import type { Language, RuntimeConfig, Script, SutTarget } from '../types';

interface ScriptsProps {
  language: Language;
  selectedSut: SutTarget;
  runtimeConfig: RuntimeConfig;
}

type ScriptSource = 'live' | 'mock';
type ScriptLastResult = 'Passed' | 'Failed' | 'Flaky';
type MockScriptId =
  | 'script-ak006'
  | 'script-ak007'
  | 'script-auth021'
  | 'script-session013'
  | 'script-web088';

interface ScriptsQueryData {
  scripts: Script[];
  source: ScriptSource;
}

const allFilter = 'All';
const emptyScripts: Script[] = [];

const mockLastResultByScriptId: Record<MockScriptId, ScriptLastResult> = {
  'script-ak006': 'Passed',
  'script-ak007': 'Passed',
  'script-auth021': 'Failed',
  'script-session013': 'Passed',
  'script-web088': 'Flaky'
};

function fallbackScripts(sut: SutTarget): Script[] {
  return mockScripts.filter((script) => (
    script.product === sut.product && script.scene === sut.scene
  ));
}

function isApiScript(script: Script): boolean {
  return script.scene.toLocaleUpperCase() === 'API' ||
    script.feature.toLocaleLowerCase().includes('api') ||
    script.feature.includes('接口') ||
    /(^|\/)api(\/|$)/i.test(script.path);
}

function isScenarioScript(script: Script): boolean {
  return script.feature.includes('场景') || /(^|\/)(?:ui|web)(\/|$)/i.test(script.path);
}

function formatUpdated(value: string | undefined, source: ScriptSource): string {
  if (!value) {
    return '—';
  }

  if (source === 'mock') {
    const date = value.slice(0, 10);
    if (date === '2026-07-14') {
      return value.slice(11, 16);
    }
    if (date === '2026-07-13') {
      return 'Yesterday';
    }
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'Asia/Shanghai'
  }).format(date);
}

function getMockLastResult(scriptId: string): ScriptLastResult | undefined {
  return mockLastResultByScriptId[scriptId as MockScriptId];
}

export function Scripts({ language, selectedSut, runtimeConfig }: ScriptsProps) {
  const t = getCopy(language);
  const [search, setSearch] = useState('');
  const [level, setLevel] = useState(allFilter);
  const [feature, setFeature] = useState(allFilter);
  const api = useMemo(
    () => ({ apiBaseUrl: selectedSut.apiBaseUrl || runtimeConfig.apiBaseUrl }),
    [runtimeConfig.apiBaseUrl, selectedSut.apiBaseUrl]
  );

  const scriptsQuery = useQuery({
    queryKey: ['scripts', selectedSut.product, selectedSut.scene],
    queryFn: async (): Promise<ScriptsQueryData> => {
      try {
        const response = await getScripts(api, {
          product: selectedSut.product,
          scene: selectedSut.scene
        });
        return { scripts: response.scripts, source: 'live' };
      } catch (error) {
        if (runtimeConfig.enableMockFallback) {
          return { scripts: fallbackScripts(selectedSut), source: 'mock' };
        }
        throw error;
      }
    }
  });

  const scripts = scriptsQuery.data?.scripts ?? emptyScripts;
  const source: ScriptSource = scriptsQuery.data?.source ?? 'live';
  const levelOptions = useMemo(() => (
    Array.from(new Set(scripts.map((script) => script.level))).sort((left, right) => (
      left.localeCompare(right, undefined, { numeric: true })
    ))
  ), [scripts]);
  const featureOptions = useMemo(
    () => Array.from(new Set(scripts.map((script) => script.feature))),
    [scripts]
  );
  const filteredScripts = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase();
    return scripts.filter((script) => (
      (level === allFilter || script.level === level) &&
      (feature === allFilter || script.feature === feature) &&
      (!normalizedSearch || [
        script.name,
        script.filename,
        script.path,
        script.feature,
        script.level
      ].some((value) => value.toLocaleLowerCase().includes(normalizedSearch)))
    ));
  }, [feature, level, scripts, search]);

  const liveSummaryValues = useMemo(() => [
    scripts.length,
    scripts.filter((script) => script.level === 'L0').length,
    scripts.filter(isApiScript).length,
    scripts.filter(isScenarioScript).length
  ], [scripts]);
  const summaryValues = source === 'mock' ? [286, 84, 126, 76] : liveSummaryValues;
  const liveSummaryNotes = useMemo(() => {
    const objectCount = new Set(scripts.map((script) => `${script.product}\u0000${script.scene}`)).size;
    const featureCount = new Set(scripts.map((script) => script.feature)).size;
    const latestUpload = scripts
      .map((script) => script.uploaded_at)
      .filter((value): value is string => Boolean(value))
      .sort((left, right) => Date.parse(right) - Date.parse(left))[0];
    const latestLabel = formatUpdated(latestUpload, 'live');

    return language === 'zh'
      ? [
          `${objectCount} 个测试对象`,
          `最近同步 ${latestLabel}`,
          `${featureCount} 个 Feature`,
          `${liveSummaryValues[3]} 个脚本`
        ]
      : [
          `${objectCount} test Objects`,
          `Last synced ${latestLabel}`,
          `${featureCount} Features`,
          `${liveSummaryValues[3]} scripts`
        ];
  }, [language, liveSummaryValues, scripts]);
  const summaryNotes = source === 'mock'
    ? [
        t.allScriptsNote,
        t.foundationalValidationNote,
        t.apiTestsNote,
        t.scenarioAutomationNote
      ]
    : liveSummaryNotes;
  const summaryCards = [
    {
      label: t.allScripts,
      icon: <Sparkles aria-hidden="true" />
    },
    {
      label: t.foundationalValidation,
      icon: <span>L0</span>
    },
    {
      label: t.apiTests,
      icon: <span>API</span>
    },
    {
      label: t.scenarioAutomation,
      icon: <span>UI</span>
    }
  ] as const;

  return (
    <div className="page-stack scripts-page">
      <PageHeader
        title={t.scripts}
        subtitle={t.scriptsSubtitle}
        action={(
          <PresentationOnlyButton className="scripts-import-action">
            {t.importScripts}
            <ArrowRight aria-hidden="true" />
          </PresentationOnlyButton>
        )}
      />

      <section className="scripts-summary" aria-label={t.scriptsSummary}>
        {summaryCards.map((card, index) => (
          <article className="scripts-summary-card" key={card.label}>
            <span className="scripts-summary-icon">{card.icon}</span>
            <h2>{card.label}</h2>
            <strong data-testid="script-summary-value">{summaryValues[index]}</strong>
            <p>{summaryNotes[index]}</p>
          </article>
        ))}
      </section>

      <section className="scripts-table-card" aria-label={t.scripts}>
        <div className="scripts-toolbar" role="region" aria-label={t.scriptFilters}>
          <label className="scripts-search">
            <Search aria-hidden="true" />
            <span className="sr-only">{t.searchScripts}</span>
            <input
              type="search"
              aria-label={t.searchScripts}
              placeholder={t.scriptSearchPlaceholder}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>

          <div className="scripts-filter-controls">
            <label className="scripts-filter-control scripts-object-control">
              <span className="sr-only">Object</span>
              <input
                aria-label="Object"
                readOnly
                value={`Object · ${selectedSut.product}`}
              />
              <ChevronDown aria-hidden="true" />
            </label>
            <label className="scripts-filter-control">
              <span className="sr-only">Level</span>
              <select aria-label="Level" value={level} onChange={(event) => setLevel(event.target.value)}>
                <option value={allFilter}>Level · All</option>
                {levelOptions.map((option) => <option key={option} value={option}>{`Level · ${option}`}</option>)}
              </select>
              <ChevronDown aria-hidden="true" />
            </label>
            <label className="scripts-filter-control">
              <span className="sr-only">Feature</span>
              <select aria-label="Feature" value={feature} onChange={(event) => setFeature(event.target.value)}>
                <option value={allFilter}>Feature · All</option>
                {featureOptions.map((option) => <option key={option} value={option}>{`Feature · ${option}`}</option>)}
              </select>
              <ChevronDown aria-hidden="true" />
            </label>
          </div>
        </div>

        <div className="scripts-table-scroll">
          <table aria-label={t.scripts}>
            <thead>
              <tr>
                <th>Script</th>
                <th>Feature</th>
                <th>Level</th>
                <th>Last result</th>
                <th>Owner</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {filteredScripts.map((script) => {
                const lastResult = source === 'mock' ? getMockLastResult(script.id) : undefined;
                return (
                  <tr key={script.id}>
                    <td>
                      <strong>{script.name}</strong>
                      <span>{script.path}</span>
                    </td>
                    <td>{script.feature}</td>
                    <td>
                      <span className={`scripts-level-pill is-${script.level.toLocaleLowerCase()}`}>
                        <span aria-hidden="true" />
                        {script.level}
                      </span>
                    </td>
                    <td>
                      {lastResult ? (
                        <span className={`scripts-status-pill is-${lastResult.toLocaleLowerCase()}`}>
                          <span aria-hidden="true" />
                          {lastResult}
                        </span>
                      ) : '—'}
                    </td>
                    <td>{script.uploaded_by || '—'}</td>
                    <td>{formatUpdated(script.uploaded_at, source)}</td>
                  </tr>
                );
              })}
              {!filteredScripts.length && (
                <tr>
                  <td className="scripts-empty-row" colSpan={6}>{t.noMatchingScripts}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
