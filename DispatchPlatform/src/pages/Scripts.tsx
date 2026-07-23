import { useQuery } from '@tanstack/react-query';
import { ChevronDown } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { getScriptsForScene } from '../api/client';
import { useOptionalCatalog } from '../catalog/CatalogProvider';
import { scriptsForCatalogObject } from '../catalog/model';
import { CatalogSyncStatus } from '../components/CatalogSyncStatus';
import { PageHeader } from '../components/PageHeader';
import { PresentationOnlyButton } from '../components/PresentationOnlyButton';
import { mockScripts } from '../data/mockData';
import { getCopy } from '../i18n';
import { objectIdentityLabel } from '../objectLabels';
import type { CatalogObject, Language, RuntimeConfig, Script, SutTarget } from '../types';

interface ScriptsProps {
  language: Language;
  selectedSut: SutTarget;
  runtimeConfig: RuntimeConfig;
  catalogObject?: CatalogObject;
  catalogSelectionValid?: boolean;
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
const approvedFallbackScriptIds = new Set([
  'script-ak006',
  'script-ak007',
  'script-auth021',
  'script-session013'
]);

const mockLastResultByScriptId: Record<MockScriptId, ScriptLastResult> = {
  'script-ak006': 'Passed',
  'script-ak007': 'Passed',
  'script-auth021': 'Failed',
  'script-session013': 'Passed',
  'script-web088': 'Flaky'
};

function fallbackScripts(sut: Pick<SutTarget, 'product' | 'scene'>): Script[] {
  return mockScripts.filter((script) => (
    approvedFallbackScriptIds.has(script.id) &&
    script.product === sut.product &&
    script.scene === sut.scene
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

function formatUpdated(
  value: string | undefined,
  source: ScriptSource,
  language: Language
): string {
  if (!value) {
    return '—';
  }

  if (source === 'mock') {
    const date = value.slice(0, 10);
    if (date === '2026-07-14') {
      return language === 'zh' ? `今天 ${value.slice(11, 16)}` : value.slice(11, 16);
    }
    if (date === '2026-07-13') {
      return language === 'zh' ? `昨天 ${value.slice(11, 16)}` : 'Yesterday';
    }
    if (language === 'zh') {
      const [, month, day] = date.split('-').map(Number);
      return `${month} 月 ${day} 日`;
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

function getLastResultLabel(result: ScriptLastResult, language: Language): string {
  if (language !== 'zh') {
    return result;
  }

  return {
    Passed: '通过',
    Failed: '失败',
    Flaky: '波动'
  }[result];
}

export function Scripts({
  language,
  selectedSut,
  runtimeConfig,
  catalogObject,
  catalogSelectionValid = true
}: ScriptsProps) {
  const t = getCopy(language);
  const catalog = useOptionalCatalog();
  const [search, setSearch] = useState('');
  const [level, setLevel] = useState(allFilter);
  const [feature, setFeature] = useState(allFilter);
  const resolvedApiBaseUrl = selectedSut.apiBaseUrl || runtimeConfig.apiBaseUrl;
  const selectedObjectLabel = objectIdentityLabel(selectedSut);
  const targetIdentity = useMemo(
    () => ({
      id: selectedSut.id,
      product: selectedSut.product,
      scene: selectedSut.scene,
      apiBaseUrl: resolvedApiBaseUrl
    }),
    [resolvedApiBaseUrl, selectedSut.id, selectedSut.product, selectedSut.scene]
  );

  const scriptsQuery = useQuery({
    queryKey: ['scripts', targetIdentity],
    queryFn: async (): Promise<ScriptsQueryData> => {
      try {
        const response = await getScriptsForScene(
          { apiBaseUrl: targetIdentity.apiBaseUrl },
          targetIdentity.product,
          targetIdentity.scene
        );
        return { scripts: response.scripts, source: 'live' };
      } catch (error) {
        if (runtimeConfig.enableMockFallback) {
          return { scripts: fallbackScripts(targetIdentity), source: 'mock' };
        }
        throw error;
      }
    },
    enabled: !catalog && !catalogObject
  });

  useEffect(() => {
    setLevel(allFilter);
    setFeature(allFilter);
  }, [targetIdentity]);

  const snapshotScripts = useMemo(
    () => catalogObject ? scriptsForCatalogObject(catalogObject) : undefined,
    [catalogObject]
  );
  const scripts = snapshotScripts ?? (catalog ? emptyScripts : scriptsQuery.data?.scripts ?? emptyScripts);
  const source: ScriptSource = catalog?.state === 'mock'
    ? 'mock'
    : scriptsQuery.data?.source ?? 'live';
  const levelOptions = useMemo(() => (
    Array.from(new Set(scripts.map((script) => script.level))).sort((left, right) => (
      left.localeCompare(right, undefined, { numeric: true })
    ))
  ), [scripts]);
  const featureOptions = useMemo(
    () => Array.from(new Set(scripts.map((script) => script.feature))),
    [scripts]
  );
  useEffect(() => {
    if (level !== allFilter && !levelOptions.includes(level)) {
      setLevel(allFilter);
    }
    if (feature !== allFilter && !featureOptions.includes(feature)) {
      setFeature(allFilter);
    }
  }, [feature, featureOptions, level, levelOptions]);
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
  const isPending = catalog ? catalog.isInitialLoading : scriptsQuery.isPending;
  const isUnavailable = catalog
    ? !catalog.snapshot && catalog.state === 'unavailable'
    : scriptsQuery.isError;
  const summaryValues = isPending || isUnavailable
    ? ['—', '—', '—', '—']
    : catalog?.snapshot
      ? [
          catalog.snapshot.totals.scripts,
          scripts.length,
          catalogObject?.feature_count ?? 0,
          catalog.snapshot.totals.objects
        ]
    : source === 'mock'
      ? [286, 84, 126, 76]
      : liveSummaryValues;
  const liveSummaryNotes = useMemo(() => {
    const objectCount = new Set(scripts.map((script) => `${script.product}\u0000${script.scene}`)).size;
    const featureCount = new Set(scripts.map((script) => script.feature)).size;
    const latestUpload = scripts
      .map((script) => script.uploaded_at)
      .filter((value): value is string => Boolean(value))
      .sort((left, right) => Date.parse(right) - Date.parse(left))[0];
    const latestLabel = formatUpdated(latestUpload, 'live', language);

    if (catalog?.snapshot) {
      const checked = formatUpdated(catalog.checkedAt, 'live', language);
      return language === 'zh'
        ? [
            `${catalog.snapshot.totals.products} 个产品`,
            selectedObjectLabel,
            `目录检查于 ${checked}`,
            `${catalog.snapshot.totals.objects} 个测试对象`
          ]
        : [
            `${catalog.snapshot.totals.products} products`,
            selectedObjectLabel,
            `Catalog checked ${checked}`,
            `${catalog.snapshot.totals.objects} test Objects`
          ];
    }
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
  }, [catalog?.checkedAt, catalog?.snapshot, language, liveSummaryValues, scripts, selectedObjectLabel]);
  const summaryNotes = isPending || isUnavailable
    ? ['—', '—', '—', '—']
    : catalog?.snapshot
      ? liveSummaryNotes
      : source === 'mock'
      ? [
          t.allScriptsNote,
          t.foundationalValidationNote,
          t.apiTestsNote,
          t.scenarioAutomationNote
        ]
      : liveSummaryNotes;
  const summaryCards = catalog
    ? language === 'zh'
      ? ['全部脚本', '当前对象脚本', '当前对象 Feature', '测试对象']
      : ['All scripts', 'Selected Object scripts', 'Selected Object Features', 'Test Objects']
    : [
        t.allScripts,
        t.foundationalValidation,
        t.apiTests,
        t.scenarioAutomation
      ];
  const tableHeadings = language === 'zh'
    ? ['脚本', 'Feature', '级别', '最近结果', '负责人', '更新时间']
    : ['Script', 'Feature', 'Level', 'Last result', 'Owner', 'Updated'];

  return (
    <div className="page-stack scripts-page">
      <PageHeader
        title={t.scripts}
        subtitle={t.scriptsSubtitle}
        action={catalog ? (
          <CatalogSyncStatus language={language} className="scripts-catalog-sync" />
        ) : (
          <PresentationOnlyButton className="scripts-import-action">
            {t.importScripts}
            <span aria-hidden="true">→</span>
          </PresentationOnlyButton>
        )}
      />

      <section className="scripts-summary" aria-label={t.scriptsSummary}>
        {summaryCards.map((label, index) => (
          <article className="scripts-summary-card" key={label}>
            <h2>{label}</h2>
            <strong data-testid="script-summary-value">{summaryValues[index]}</strong>
            <p>{summaryNotes[index]}</p>
          </article>
        ))}
      </section>

      <section
        className="scripts-table-card"
        aria-label={t.scripts}
        aria-busy={isPending}
      >
        {catalog && !catalogSelectionValid ? (
          <div className="scripts-catalog-warning" role="alert">
            {language === 'zh'
              ? '此测试对象已从最新目录中移除。当前列表保留为只读快照，请选择其他对象。'
              : 'This test Object was removed from the latest catalog. The current list is retained as a read-only snapshot; select another Object.'}
          </div>
        ) : null}
        {catalog?.state === 'stale' ? (
          <div className="scripts-catalog-warning" role="alert">
            {language === 'zh'
              ? '实时目录暂时无法刷新，正在显示最近一次成功同步的数据。'
              : 'The live catalog could not refresh. Showing the last successful snapshot.'}
          </div>
        ) : null}
        <div className="scripts-toolbar" role="region" aria-label={t.scriptFilters}>
          <label className="scripts-search-control">
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
            {!catalog ? (
              <label className="scripts-filter-control scripts-filter-control--object">
                <span className="sr-only">Object</span>
                <input
                  aria-label="Object"
                  readOnly
                  value={`Object · ${selectedObjectLabel}`}
                />
                <ChevronDown aria-hidden="true" />
              </label>
            ) : null}
            <label className="scripts-filter-control scripts-filter-control--level">
              <span className="sr-only">Level</span>
              <select aria-label="Level" value={level} onChange={(event) => setLevel(event.target.value)}>
                <option value={allFilter}>{language === 'zh' ? '全部级别' : 'All levels'}</option>
                {levelOptions.map((option) => (
                  <option key={option} value={option}>
                    {language === 'zh' ? `级别 · ${option}` : `Level · ${option}`}
                  </option>
                ))}
              </select>
              <ChevronDown aria-hidden="true" />
            </label>
            <label className="scripts-filter-control scripts-filter-control--feature">
              <span className="sr-only">Feature</span>
              <select aria-label="Feature" value={feature} onChange={(event) => setFeature(event.target.value)}>
                <option value={allFilter}>{language === 'zh' ? '全部 Feature' : 'All Features'}</option>
                {featureOptions.map((option) => <option key={option} value={option}>{`Feature · ${option}`}</option>)}
              </select>
              <ChevronDown aria-hidden="true" />
            </label>
          </div>
        </div>

        <div className="scripts-table-scroll">
          <table className="scripts-table" aria-label={t.scripts}>
            <thead>
              <tr>
                {tableHeadings.map((heading) => <th key={heading}>{heading}</th>)}
              </tr>
            </thead>
            <tbody>
              {isPending ? (
                <tr>
                  <td className="scripts-empty-row" colSpan={6}>
                    <span role="status">{t.loadingScripts}</span>
                  </td>
                </tr>
              ) : isUnavailable ? (
                <tr>
                  <td className="scripts-empty-row" colSpan={6}>
                    <span role="alert">{t.scriptsUnavailable}</span>
                  </td>
                </tr>
              ) : (
                <>
                  {filteredScripts.map((script) => {
                    const lastResult = source === 'mock' ? getMockLastResult(script.id) : undefined;
                    return (
                      <tr key={script.id}>
                        <td>
                          <strong>{script.name}</strong>
                          <span>{script.path}</span>
                        </td>
                        <td>{script.feature}</td>
                        <td><strong className="scripts-level">{script.level}</strong></td>
                        <td>
                          {lastResult ? (
                            <span className={`scripts-status-pill is-${lastResult.toLocaleLowerCase()}`}>
                              {getLastResultLabel(lastResult, language)}
                            </span>
                          ) : '—'}
                        </td>
                        <td>{script.uploaded_by || '—'}</td>
                        <td>{formatUpdated(script.uploaded_at, source, language)}</td>
                      </tr>
                    );
                  })}
                  {!filteredScripts.length && (
                    <tr>
                      <td className="scripts-empty-row" colSpan={6}>{t.noMatchingScripts}</td>
                    </tr>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
