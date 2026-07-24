import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronDown } from 'lucide-react';
import {
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState
} from 'react';
import { Link } from 'react-router-dom';
import {
  ApiError,
  getOverviewQuality,
  getOverviewQualityEventsUrl,
  getOverviewQualityVersions,
  parseOverviewQualityEvent
} from '../api/client';
import { ExecutionFocus } from '../components/ExecutionFocus';
import { PageHeader } from '../components/PageHeader';
import {
  getLegacyDimensionSnapshot,
  type LegacyDimensionQuality,
  type LegacyDimensionSnapshot,
  type LegacyQualityDimensionId
} from '../data/overviewLegacyDimensionData';
import { getCopy } from '../i18n';
import type {
  Language,
  NormalizedTaskStatus,
  OverviewFeatureQuality,
  OverviewQualityDataStatus,
  OverviewQualityResponse,
  OverviewQualityVersionsResponse,
  RuntimeConfig,
  SutTarget
} from '../types';

interface PageProps {
  language: Language;
  selectedSut: SutTarget;
  activeTask: NormalizedTaskStatus | null;
  runtimeConfig: RuntimeConfig;
}

type QualityDimensionId = 'basic' | LegacyQualityDimensionId;

interface QualityQueryData<T> {
  response: T;
  etag?: string;
  checkedAt: string;
}

const QUALITY_FALLBACK_POLL_INTERVAL_MS = 30_000;

const dimensionIds: readonly QualityDimensionId[] = [
  'basic',
  'dfx',
  'scenario',
  'performance'
];

function dimensionLabel(language: Language, id: QualityDimensionId) {
  const t = getCopy(language);
  switch (id) {
    case 'basic':
      return t.dimensionBasic;
    case 'dfx':
      return t.dimensionDfx;
    case 'scenario':
      return t.dimensionScenario;
    case 'performance':
      return t.dimensionPerformance;
  }
}

function dimensionConclusion(language: Language, id: Exclude<QualityDimensionId, 'performance'>) {
  const t = getCopy(language);
  switch (id) {
    case 'basic':
      return t.basicQualityConclusion;
    case 'dfx':
      return t.dfxQualityConclusion;
    case 'scenario':
      return t.scenarioQualityConclusion;
  }
}

function QualityRing({
  score,
  label,
  size = 'large',
  precision = 2
}: {
  score: number;
  label: string;
  size?: 'large' | 'compact';
  precision?: number;
}) {
  const boundedScore = Math.min(100, Math.max(0, score));
  const formattedScore = boundedScore.toFixed(precision);

  return (
    <div
      className={`overview-quality-ring is-${size}`}
      role="img"
      aria-label={`${label} ${formattedScore}`}
    >
      <div className="overview-quality-ring__visual" aria-hidden="true">
        <svg viewBox="0 0 106 106">
          <circle className="overview-quality-ring__track" cx="53" cy="53" r="44" pathLength="100" />
          <circle
            className="overview-quality-ring__value"
            cx="53"
            cy="53"
            r="44"
            pathLength="100"
            strokeDasharray={`${boundedScore} 100`}
          />
        </svg>
        <strong>{formattedScore}</strong>
      </div>
      <span className="overview-quality-ring__caption">{label}</span>
    </div>
  );
}

function DimensionSelector({
  language,
  value,
  onChange
}: {
  language: Language;
  value: QualityDimensionId;
  onChange: (value: QualityDimensionId) => void;
}) {
  const t = getCopy(language);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(() => dimensionIds.indexOf(value));
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedLabel = dimensionLabel(language, value);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const frame = window.requestAnimationFrame(() => optionRefs.current[activeIndex]?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [activeIndex, open]);

  useEffect(() => {
    setActiveIndex(dimensionIds.indexOf(value));
  }, [value]);

  const closeAndReturnFocus = () => {
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const moveActive = (nextIndex: number) => {
    const normalized = (nextIndex + dimensionIds.length) % dimensionIds.length;
    setActiveIndex(normalized);
  };

  const handleTriggerKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      const selectedIndex = dimensionIds.indexOf(value);
      const nextIndex = event.key === 'ArrowDown'
        ? Math.min(selectedIndex + 1, dimensionIds.length - 1)
        : event.key === 'ArrowUp'
          ? Math.max(selectedIndex - 1, 0)
          : event.key === 'Home'
            ? 0
            : dimensionIds.length - 1;
      setActiveIndex(nextIndex);
      setOpen(true);
    }
  };

  const handleOptionKeyDown = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    index: number,
    id: QualityDimensionId
  ) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        moveActive(index + 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        moveActive(index - 1);
        break;
      case 'Home':
        event.preventDefault();
        moveActive(0);
        break;
      case 'End':
        event.preventDefault();
        moveActive(dimensionIds.length - 1);
        break;
      case 'Escape':
        event.preventDefault();
        closeAndReturnFocus();
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        onChange(id);
        closeAndReturnFocus();
        break;
      case 'Tab':
        setOpen(false);
        break;
    }
  };

  return (
    <div className="dimension-selector" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="dimension-selector__trigger"
        aria-label={`${t.selectQualityDimension}: ${selectedLabel}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        onClick={() => {
          setActiveIndex(dimensionIds.indexOf(value));
          setOpen((current) => !current);
        }}
        onKeyDown={handleTriggerKeyDown}
      >
        <span>{t.qualityDimension}</span>
        <strong>{selectedLabel}</strong>
        <ChevronDown aria-hidden="true" />
      </button>

      {open ? (
        <ul
          id={listboxId}
          className="dimension-selector__menu"
          role="listbox"
          aria-label={t.selectQualityDimension}
        >
          {dimensionIds.map((id, index) => {
            const selected = id === value;
            return (
              <li key={id} role="none">
                <button
                  ref={(node) => {
                    optionRefs.current[index] = node;
                  }}
                  type="button"
                  role="option"
                  className={selected ? 'is-selected' : undefined}
                  aria-selected={selected}
                  tabIndex={index === activeIndex ? 0 : -1}
                  onClick={() => {
                    onChange(id);
                    closeAndReturnFocus();
                  }}
                  onKeyDown={(event) => handleOptionKeyDown(event, index, id)}
                >
                  <span>{dimensionLabel(language, id)}</span>
                  {selected ? <Check aria-hidden="true" /> : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

function VersionSelector({
  language,
  versions,
  value,
  onChange,
  disabled = false
}: {
  language: Language;
  versions: readonly string[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const t = getCopy(language);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(() => Math.max(0, versions.indexOf(value)));
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const frame = window.requestAnimationFrame(() => optionRefs.current[activeIndex]?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [activeIndex, open]);

  useEffect(() => {
    setActiveIndex(Math.max(0, versions.indexOf(value)));
  }, [value, versions]);

  const closeAndReturnFocus = () => {
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const moveActive = (nextIndex: number) => {
    const normalized = (nextIndex + versions.length) % versions.length;
    setActiveIndex(normalized);
  };

  const handleTriggerKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (
      event.key === 'ArrowDown'
      || event.key === 'ArrowUp'
      || event.key === 'Home'
      || event.key === 'End'
    ) {
      event.preventDefault();
      const selectedIndex = Math.max(0, versions.indexOf(value));
      const nextIndex = event.key === 'ArrowDown'
        ? Math.min(selectedIndex + 1, versions.length - 1)
        : event.key === 'ArrowUp'
          ? Math.max(selectedIndex - 1, 0)
          : event.key === 'Home'
            ? 0
            : versions.length - 1;
      setActiveIndex(nextIndex);
      setOpen(true);
    }
  };

  const handleOptionKeyDown = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    index: number,
    version: string
  ) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        moveActive(index + 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        moveActive(index - 1);
        break;
      case 'Home':
        event.preventDefault();
        moveActive(0);
        break;
      case 'End':
        event.preventDefault();
        moveActive(versions.length - 1);
        break;
      case 'Escape':
        event.preventDefault();
        closeAndReturnFocus();
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        onChange(version);
        closeAndReturnFocus();
        break;
      case 'Tab':
        setOpen(false);
        break;
    }
  };

  return (
    <div className="version-selector" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="version-selector__trigger"
        aria-label={`${t.selectVersion}: ${value}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        disabled={disabled}
        onClick={() => {
          setActiveIndex(Math.max(0, versions.indexOf(value)));
          setOpen((current) => !current);
        }}
        onKeyDown={handleTriggerKeyDown}
      >
        <span>{t.qualityVersion}</span>
        <strong>{value}</strong>
        <ChevronDown aria-hidden="true" />
      </button>

      {open && versions.length ? (
        <ul
          id={listboxId}
          className="version-selector__menu"
          role="listbox"
          aria-label={t.selectVersion}
        >
          {versions.map((version, index) => {
            const selected = version === value;
            return (
              <li key={version} role="none">
                <button
                  ref={(node) => {
                    optionRefs.current[index] = node;
                  }}
                  type="button"
                  role="option"
                  className={selected ? 'is-selected' : undefined}
                  aria-selected={selected}
                  tabIndex={index === activeIndex ? 0 : -1}
                  onClick={() => {
                    onChange(version);
                    closeAndReturnFocus();
                  }}
                  onKeyDown={(event) => handleOptionKeyDown(event, index, version)}
                >
                  <span>{version}</span>
                  {selected ? <Check aria-hidden="true" /> : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

function StandardDimensionSummary({
  language,
  dimension
}: {
  language: Language;
  dimension: LegacyDimensionQuality;
}) {
  const t = getCopy(language);
  const issueTotal = Math.max(dimension.issues, 1);
  const failureRatio = (dimension.failed / dimension.total) * 100;
  const statusLabel = dimension.status === 'attention' ? t.needsAttention : t.qualityHealthy;
  const priorityCopy = `${t.priorityBlockingIssue}: ${dimension.criticalIssues}`;

  return (
    <div className="dimension-summary-grid">
      <section className="dimension-summary-zone" aria-labelledby="passed-scripts-title">
        <p id="passed-scripts-title" className="dimension-summary-zone__eyebrow">{t.passedTestScripts}</p>
        <div className="dimension-summary-zone__value-row">
          <strong>{dimension.passed}</strong>
          <span>/ {dimension.total} {t.testScriptsUnit}</span>
        </div>
        <p>
          {t.executionCoverage} 100% · {t.passRate} {dimension.score.toFixed(2)}%
        </p>
        <div
          className="dimension-progress"
          role="progressbar"
          aria-label={`${t.passRate} ${dimension.score.toFixed(2)}%`}
          aria-valuemin={0}
          aria-valuemax={dimension.total}
          aria-valuenow={dimension.passed}
        >
          <span style={{ width: `${dimension.score}%` }} />
        </div>
        <p>{t.overviewFailed} {dimension.failed} · {t.runningCount} {dimension.running}</p>
      </section>

      <section className="dimension-summary-zone" aria-labelledby="quality-assessment-title">
        <p id="quality-assessment-title" className="dimension-summary-zone__eyebrow">
          {t.overallQualityAssessment}
        </p>
        <div className="dimension-assessment">
          <QualityRing score={dimension.score} label={t.dimensionQuality} size="compact" />
          <div className="dimension-assessment__rating">
            <span className={`overview-status-pill is-${dimension.status}`}>
              <span aria-hidden="true" />
              {statusLabel}
            </span>
            <strong>{t.comprehensiveRating} {dimension.rating}</strong>
            <span>{t.failureScriptRatio} {failureRatio.toFixed(2)}%</span>
          </div>
        </div>
        <p className="dimension-conclusion">
          {t.conclusion}: {dimensionConclusion(
            language,
            dimension.id as Exclude<LegacyQualityDimensionId, 'performance'>
          )}
        </p>
      </section>

      <section className="dimension-summary-zone" aria-labelledby="issues-found-title">
        <p id="issues-found-title" className="dimension-summary-zone__eyebrow">{t.issuesFound}</p>
        <div className="dimension-summary-zone__value-row is-danger">
          <strong>{dimension.issues}</strong>
          <span>{t.issuesUnit}</span>
        </div>
        <p>
          {t.criticalIssues} {dimension.criticalIssues} · {t.majorIssues} {dimension.majorIssues} ·{' '}
          {t.minorIssues} {dimension.minorIssues}
        </p>
        <div className="issue-severity" aria-hidden="true">
          <span
            className="is-critical"
            style={{ width: `${(dimension.criticalIssues / issueTotal) * 100}%` }}
          />
          <span
            className="is-major"
            style={{ width: `${(dimension.majorIssues / issueTotal) * 100}%` }}
          />
          <span
            className="is-minor"
            style={{ width: `${(dimension.minorIssues / issueTotal) * 100}%` }}
          />
        </div>
        <p className="dimension-priority">{priorityCopy}</p>
      </section>
    </div>
  );
}

function PerformanceDimensionSummary({
  language,
  snapshot
}: {
  language: Language;
  snapshot: LegacyDimensionSnapshot;
}) {
  const t = getCopy(language);
  const dimension = snapshot.dimensions.performance;
  const performance = snapshot.performance;
  const chart = useMemo(() => {
    const width = 600;
    const left = 8;
    const right = width - 8;
    const top = 12;
    const bottom = 78;
    const readings = performance.trend.map((point) => point.p95);
    const minimumReading = Math.min(...readings);
    const maximumReading = Math.max(...readings);
    const padding = Math.max(10, (maximumReading - minimumReading) * 0.14);
    const min = minimumReading - padding;
    const max = maximumReading + padding;
    const points = performance.trend.map((point, index) => {
      const x = left + ((right - left) * index) / (performance.trend.length - 1);
      const y = top + ((point.p95 - min) / (max - min)) * (bottom - top);
      return { ...point, x, y };
    });

    return {
      points,
      line: points.map((point) => `${point.x},${point.y}`).join(' '),
      area: `${left},${bottom + 8} ${points.map((point) => `${point.x},${point.y}`).join(' ')} ${right},${bottom + 8}`
    };
  }, [performance.trend]);

  return (
    <div className="performance-summary-grid">
      <section className="performance-trend" aria-labelledby="performance-trend-title">
        <div className="performance-trend__heading">
          <div>
            <strong>P95 <span>{performance.p95} ms</span></strong>
            <p id="performance-trend-title">{t.performanceTrend}</p>
          </div>
          <span className="performance-trend__change">
            -{performance.improvementPercent}% {t.comparedWithBaseline}
          </span>
        </div>
        <div className="performance-chart">
          <svg
            viewBox="0 0 600 92"
            preserveAspectRatio="none"
            role="img"
            aria-label={`${t.performanceTrend}. ${performance.trend.map((point) => `${point.version}: ${point.p95} ms`).join(', ')}`}
          >
            <line x1="8" x2="592" y1="24" y2="24" />
            <line x1="8" x2="592" y1="52" y2="52" />
            <line x1="8" x2="592" y1="80" y2="80" />
            <polygon points={chart.area} />
            <polyline points={chart.line} />
            {chart.points.map((point) => (
              <circle key={point.version} cx={point.x} cy={point.y} r="3.5" />
            ))}
          </svg>
          <div className="performance-chart__labels" aria-hidden="true">
            {performance.trend.map((point) => <span key={point.version}>{point.version}</span>)}
          </div>
        </div>
      </section>

      <section className="performance-baseline" aria-labelledby="performance-baseline-title">
        <p id="performance-baseline-title" className="performance-baseline__title">{t.versionBaseline}</p>
        <div className="performance-baseline__summary">
          <span>{t.overviewPassed} {dimension.passed} / {dimension.total}</span>
          <span>{t.overviewRating} {dimension.rating}</span>
          <span>{t.overviewIssuesShort} {dimension.issues}</span>
        </div>
        <dl className="performance-baseline__rows">
          <div>
            <dt>{performance.currentVersion} · {t.currentVersion}</dt>
            <dd className="is-improved">{performance.p95} ms</dd>
          </div>
          <div>
            <dt>{performance.baselineVersion} · {t.performanceBaseline}</dt>
            <dd>{performance.baselineP95} ms</dd>
          </div>
        </dl>
        <p className="performance-baseline__delta">
          {t.baselineImprovement} {performance.improvementMs} ms · -{performance.improvementPercent}%
        </p>
      </section>
    </div>
  );
}

function formatPercent(value: number | null, precision = 2) {
  if (value === null || !Number.isFinite(value)) {
    return '—';
  }
  return `${Number(value.toFixed(precision))}%`;
}

function FeatureQualityMatrix({
  language,
  features
}: {
  language: Language;
  features: readonly OverviewFeatureQuality[];
}) {
  const t = getCopy(language);

  return (
    <section className="feature-quality-card" aria-labelledby="feature-quality-title">
      <div className="feature-quality-card__heading">
        <p id="feature-quality-title">{t.featureQualityAssessment}</p>
        <span>{features.length} {t.featuresUnit}</span>
      </div>
      <div
        className="feature-quality-table-scroll"
        role="region"
        aria-label={t.featureQualityAssessment}
        tabIndex={0}
      >
        <table className="feature-quality-table">
          <thead>
            <tr>
              <th scope="col">{t.featureColumn}</th>
              <th scope="col">{t.executionScriptCount}</th>
              <th scope="col">{t.issuesFoundTotal}</th>
              <th scope="col">{t.criticalIssueCount}</th>
              <th scope="col">{t.criticalIssueRatio}</th>
              <th scope="col">{t.resolvedIssueCount}</th>
              <th scope="col">{t.issueResolutionRate}</th>
            </tr>
          </thead>
          <tbody>
            {features.map((feature) => (
              <tr key={feature.feature_key}>
                <th scope="row">{language === 'zh' ? feature.label_zh : feature.label_en}</th>
                <td>{feature.execution_script_count}</td>
                <td>{feature.issues_found_total}</td>
                <td>{feature.critical_issue_count}</td>
                <td>{formatPercent(feature.critical_issue_ratio)}</td>
                <td>{feature.resolved_issue_count}</td>
                <td>{formatPercent(feature.issue_resolution_rate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function BasicDimensionSummary({
  language,
  quality
}: {
  language: Language;
  quality: OverviewQualityResponse;
}) {
  const t = getCopy(language);
  const { core } = quality;

  return (
    <div className="basic-quality-grid">
      <section className="basic-dimension-quality" aria-labelledby="basic-dimension-quality-title">
        <p id="basic-dimension-quality-title" className="dimension-summary-zone__eyebrow">
          {t.dimensionQuality}
        </p>
        <div className="basic-dimension-quality__score">
          <QualityRing
            score={core.quality_score}
            label={t.dimensionQuality}
            size="compact"
            precision={1}
          />
          <div>
            <strong>{core.passed_case_count}</strong>
            <span>/ {core.total_case_count} {t.testScriptsUnit}</span>
            <p>{t.passRate} {formatPercent(core.pass_rate, 1)}</p>
            <p>{t.nonPassedCases} {core.non_passed_case_count}</p>
          </div>
        </div>
      </section>
      <FeatureQualityMatrix language={language} features={quality.features} />
    </div>
  );
}

type QualityPresentationState =
  | OverviewQualityDataStatus
  | 'stale'
  | 'loading'
  | 'empty'
  | 'error'
  | 'simulated';

function provenanceLabel(language: Language, state: QualityPresentationState) {
  const t = getCopy(language);
  switch (state) {
    case 'authoritative':
      return t.qualityAuthoritative;
    case 'modeled':
      return t.qualityModeled;
    case 'partial':
      return t.qualityPartial;
    case 'stale':
      return t.qualityStale;
    case 'loading':
      return t.qualityLoading;
    case 'empty':
      return t.qualityEmpty;
    case 'error':
      return t.qualityError;
    case 'simulated':
      return t.qualitySimulated;
  }
}

function QualityStatePanel({
  language,
  state,
  onRetry
}: {
  language: Language;
  state: Extract<QualityPresentationState, 'loading' | 'empty' | 'error'>;
  onRetry?: () => void;
}) {
  const t = getCopy(language);
  const detail = state === 'loading'
    ? t.qualityLoadingHint
    : state === 'empty'
      ? t.qualityEmptyHint
      : t.qualityErrorHint;

  return (
    <section
      className={`overview-quality-state is-${state}`}
      role={state === 'error' ? 'alert' : 'status'}
      aria-live={state === 'loading' ? 'polite' : 'assertive'}
      data-quality-state={state}
    >
      <span className="overview-quality-state__mark" aria-hidden="true" />
      <div>
        <h2>{provenanceLabel(language, state)}</h2>
        <p>{detail}</p>
      </div>
      {state !== 'loading' && onRetry ? (
        <button className="button button--secondary" type="button" onClick={onRetry}>
          {t.retry}
        </button>
      ) : null}
    </section>
  );
}

export function Dashboard({
  language,
  selectedSut,
  activeTask,
  runtimeConfig
}: PageProps) {
  const t = getCopy(language);
  const queryClient = useQueryClient();
  const [selectedDimension, setSelectedDimension] = useState<QualityDimensionId>('basic');
  const [versionByProduct, setVersionByProduct] = useState<Record<string, string>>({});
  const [streamState, setStreamState] = useState<'connecting' | 'live' | 'polling'>('connecting');
  const apiBaseUrl = selectedSut.apiBaseUrl || runtimeConfig.apiBaseUrl;
  const product = selectedSut.product;
  const api = useMemo(() => ({ apiBaseUrl }), [apiBaseUrl]);
  const versionsKey = useMemo(
    () => ['overview-quality-versions', apiBaseUrl, product] as const,
    [apiBaseUrl, product]
  );

  const versionsQuery = useQuery<QualityQueryData<OverviewQualityVersionsResponse>>({
    queryKey: versionsKey,
    queryFn: async ({ signal }) => {
      const previous = queryClient.getQueryData<QualityQueryData<OverviewQualityVersionsResponse>>(
        versionsKey
      );
      const result = await getOverviewQualityVersions(api, product, {
        etag: previous?.etag,
        signal
      });
      const checkedAt = new Date().toISOString();
      if (result.kind === 'not-modified') {
        if (!previous) {
          throw new ApiError('Quality versions returned 304 before a snapshot was cached.', {
            code: 'QUALITY_VERSIONS_CACHE_MISS'
          });
        }
        return { ...previous, etag: result.etag ?? previous.etag, checkedAt };
      }
      return { response: result.data, etag: result.etag, checkedAt };
    },
    refetchInterval: streamState === 'live' ? false : QUALITY_FALLBACK_POLL_INTERVAL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: 'always',
    retryDelay: 100,
    retry: (failureCount, error) => (
      !(error instanceof ApiError && error.status === 404) && failureCount < 1
    )
  });

  const versions = versionsQuery.data?.response.versions ?? [];
  const canonicalProduct = versionsQuery.data?.response.product.label;
  const availableVersions = useMemo(
    () => versions.map((version) => version.version),
    [versions]
  );
  const rememberedVersion = versionByProduct[product];
  const defaultVersion = versions.find((version) => version.is_default)?.version
    ?? versions[0]?.version
    ?? '';
  const selectedVersion = rememberedVersion && availableVersions.includes(rememberedVersion)
    ? rememberedVersion
    : defaultVersion;
  const qualityKey = useMemo(
    () => ['overview-quality', apiBaseUrl, product, selectedVersion, 'basic_function'] as const,
    [apiBaseUrl, product, selectedVersion]
  );

  const qualityQuery = useQuery<QualityQueryData<OverviewQualityResponse>>({
    queryKey: qualityKey,
    queryFn: async ({ signal }) => {
      const previous = queryClient.getQueryData<QualityQueryData<OverviewQualityResponse>>(
        qualityKey
      );
      const result = await getOverviewQuality(api, {
        product,
        version: selectedVersion,
        dimension: 'basic_function'
      }, {
        etag: previous?.etag,
        signal
      });
      const checkedAt = new Date().toISOString();
      if (result.kind === 'not-modified') {
        if (!previous) {
          throw new ApiError('Quality overview returned 304 before a snapshot was cached.', {
            code: 'QUALITY_OVERVIEW_CACHE_MISS'
          });
        }
        return { ...previous, etag: result.etag ?? previous.etag, checkedAt };
      }
      return { response: result.data, etag: result.etag, checkedAt };
    },
    enabled: Boolean(selectedVersion),
    refetchInterval: streamState === 'live' ? false : QUALITY_FALLBACK_POLL_INTERVAL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: 'always',
    retryDelay: 100,
    retry: (failureCount, error) => (
      !(error instanceof ApiError && error.status === 404) && failureCount < 1
    )
  });

  useEffect(() => {
    if (typeof EventSource === 'undefined') {
      setStreamState('polling');
      return undefined;
    }
    let disposed = false;
    const source = new EventSource(getOverviewQualityEventsUrl(api, product), {
      withCredentials: true
    });
    setStreamState('connecting');
    const handleQualityEvent = (event: Event) => {
      const qualityEvent = parseOverviewQualityEvent(event as MessageEvent<string>);
      if (
        !qualityEvent
        || (
          qualityEvent.product !== product
          && qualityEvent.product !== canonicalProduct
        )
      ) {
        return;
      }
      const versionsRevision = queryClient.getQueryData<
        QualityQueryData<OverviewQualityVersionsResponse>
      >(versionsKey)?.response.revision;
      const overviewRevision = queryClient.getQueryData<
        QualityQueryData<OverviewQualityResponse>
      >(qualityKey)?.response.revision;
      if (
        qualityEvent.event === 'quality.changed'
        || versionsRevision !== qualityEvent.revision
        || (selectedVersion && overviewRevision !== qualityEvent.revision)
      ) {
        void queryClient.invalidateQueries({ queryKey: versionsKey, exact: true });
        if (selectedVersion) {
          void queryClient.invalidateQueries({ queryKey: qualityKey, exact: true });
        }
      }
    };
    source.onopen = () => {
      if (!disposed) {
        setStreamState('live');
      }
    };
    source.onerror = () => {
      if (!disposed) {
        setStreamState('polling');
      }
    };
    source.addEventListener('quality.ready', handleQualityEvent);
    source.addEventListener('quality.changed', handleQualityEvent);
    return () => {
      disposed = true;
      source.removeEventListener('quality.ready', handleQualityEvent);
      source.removeEventListener('quality.changed', handleQualityEvent);
      source.close();
    };
  }, [
    api,
    canonicalProduct,
    product,
    qualityKey,
    queryClient,
    selectedVersion,
    versionsKey
  ]);

  useEffect(() => {
    if (activeTask?.isTerminal) {
      void queryClient.invalidateQueries({
        queryKey: ['overview-quality', apiBaseUrl, product],
        exact: false
      });
    }
  }, [activeTask?.isTerminal, activeTask?.task_id, apiBaseUrl, product, queryClient]);

  const selectedQuality = qualityQuery.data?.response;
  const qualityMatchesSelection = Boolean(
    selectedQuality
    && (
      selectedQuality.filters.product === product
      || (
        Boolean(canonicalProduct)
        && selectedQuality.filters.product === canonicalProduct
      )
    )
    && selectedQuality.filters.version === selectedVersion
    && selectedQuality.filters.dimension === 'basic_function'
  );
  const currentQuality = qualityMatchesSelection ? selectedQuality : undefined;
  const versionsNotFound = versionsQuery.error instanceof ApiError
    && versionsQuery.error.status === 404;
  const qualityNotFound = qualityQuery.error instanceof ApiError
    && (
      qualityQuery.error.status === 404
      || qualityQuery.error.code === 'QUALITY_SNAPSHOT_NOT_FOUND'
    );
  const presentationState: QualityPresentationState = currentQuality
    ? versionsQuery.isError || qualityQuery.isError
      ? 'stale'
      : currentQuality.data_status === 'partial'
        || currentQuality.coverage.status === 'partial'
        ? 'partial'
        : currentQuality.data_status
    : versionsQuery.isPending || (selectedVersion && qualityQuery.isPending)
      ? 'loading'
      : versionsNotFound || qualityNotFound || versionsQuery.data?.response.versions.length === 0
        ? 'empty'
        : 'error';
  const legacySnapshot = selectedVersion
    ? getLegacyDimensionSnapshot(product, selectedVersion)
    : undefined;
  const selectedLabel = dimensionLabel(language, selectedDimension);
  const hasExceptionalQualityState = presentationState === 'partial'
    || presentationState === 'stale';
  const l1ProvenanceState = selectedDimension === 'basic' ? presentationState : 'simulated';
  const showL1Provenance = selectedDimension !== 'basic' || hasExceptionalQualityState;
  const showL0WarningAlongsideSimulation = selectedDimension !== 'basic'
    && hasExceptionalQualityState;

  const handleVersionChange = (version: string) => {
    if (!availableVersions.includes(version)) {
      return;
    }
    setVersionByProduct((current) => ({ ...current, [product]: version }));
  };
  const handleRetry = () => {
    void versionsQuery.refetch();
    if (selectedVersion) {
      void qualityQuery.refetch();
    }
  };

  return (
    <div className="page-stack overview-page">
      <PageHeader
        title={t.dashboard}
        subtitle={t.dashboardSubtitle}
        action={(
          <div className="overview-header-actions">
            <VersionSelector
              language={language}
              versions={availableVersions}
              value={selectedVersion || '—'}
              onChange={handleVersionChange}
              disabled={!availableVersions.length}
            />
            <Link className="button button--primary overview-create-task" to="/tasks">
              {t.newTask}
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        )}
      />

      <ExecutionFocus language={language} sut={selectedSut} task={activeTask} />

      {currentQuality && selectedVersion ? (
        <div className="overview-quality-hierarchy" data-quality-state={presentationState}>
          <section className="overview-l0-card" aria-labelledby="overview-l0-title">
            <div className="overview-l0-score-zone">
              <div className="overview-hierarchy-heading">
                <span className="overview-hierarchy-heading__spine" aria-hidden="true" />
                <div>
                  <p>{t.l0QualityEyebrow}</p>
                  <h2 id="overview-l0-title">{t.globalQuality}</h2>
                </div>
                {hasExceptionalQualityState ? (
                  <div className="overview-l0-badges">
                    <span
                      className={`overview-provenance-badge is-${presentationState}`}
                      data-quality-provenance={`l0-${presentationState}`}
                      role="status"
                    >
                      {provenanceLabel(language, presentationState)}
                    </span>
                  </div>
                ) : null}
              </div>

              <div className="overview-l0-score-summary">
                <QualityRing
                  score={currentQuality.core.quality_score}
                  label={t.overallQuality}
                  precision={1}
                />
                <div className="overview-l0-score-status">
                  <span className={`overview-status-pill is-${
                    currentQuality.core.quality_score >= 80 ? 'healthy' : 'attention'
                  }`}>
                    <span aria-hidden="true" />
                    {currentQuality.core.quality_score >= 80
                      ? t.qualityHealthy
                      : t.needsAttention}
                  </span>
                  <strong>
                    {currentQuality.core.non_passed_case_count} {t.nonPassedCases}
                  </strong>
                  <span>
                    {currentQuality.core.passed_case_count} / {currentQuality.core.total_case_count}{' '}
                    {t.overviewPassed}
                  </span>
                </div>
              </div>
            </div>

            <div className="overview-l0-divider" aria-hidden="true" />

            <div className="overview-l0-metrics" role="list" aria-label={t.globalQuality}>
              <div className="overview-l0-metric" role="listitem">
                <p>{t.overviewTotalExecutionEyebrow}</p>
                <span>{t.totalCases}</span>
                <strong>{currentQuality.core.total_case_count}</strong>
                <small>{t.qualitySnapshotScope}</small>
              </div>
              <div className="overview-l0-metric" role="listitem">
                <p>{t.overviewOverallPassRateEyebrow}</p>
                <span>{t.overviewOverallPassRate}</span>
                <strong>{formatPercent(currentQuality.core.pass_rate, 1)}</strong>
                <small>
                  {currentQuality.core.passed_case_count} {t.overviewPassed} ·{' '}
                  {currentQuality.core.non_passed_case_count} {t.nonPassed}
                </small>
              </div>
              <div className="overview-l0-metric is-issues" role="listitem">
                <p>{t.nonPassedCasesEyebrow}</p>
                <span>{t.nonPassedCases}</span>
                <strong>{currentQuality.core.non_passed_case_count}</strong>
                <small>{t.qualityScore} {currentQuality.core.quality_score.toFixed(1)}</small>
              </div>
            </div>
          </section>

          <section className="overview-l1-section" aria-labelledby="overview-l1-title">
            <div className="overview-l1-heading">
              <div className="overview-hierarchy-heading">
                <span className="overview-hierarchy-heading__spine" aria-hidden="true" />
                <div>
                  <p>{t.l1QualityEyebrow}</p>
                  <h2 id="overview-l1-title">{t.dimensionQualityAssessment}</h2>
                </div>
              </div>
              {showL1Provenance ? (
                <div className="overview-provenance-badges">
                  {showL0WarningAlongsideSimulation ? (
                    <span
                      className={`overview-provenance-badge is-${presentationState}`}
                      data-quality-provenance={`l0-${presentationState}`}
                      role="status"
                    >
                      L0 · {provenanceLabel(language, presentationState)}
                    </span>
                  ) : null}
                  <span
                    className={`overview-provenance-badge is-${l1ProvenanceState}`}
                    data-quality-provenance={l1ProvenanceState}
                    role={
                      l1ProvenanceState === 'partial' || l1ProvenanceState === 'stale'
                        ? 'status'
                        : undefined
                    }
                  >
                    {provenanceLabel(language, l1ProvenanceState)}
                  </span>
                </div>
              ) : null}
            </div>

            <div className="overview-l1-card" data-dimension={selectedDimension}>
              <div className="overview-l1-card__heading">
                <div>
                  <p>{t.currentDimension}</p>
                  <h3>{selectedLabel}</h3>
                </div>
                <div className="overview-l1-card__controls">
                  <DimensionSelector
                    language={language}
                    value={selectedDimension}
                    onChange={setSelectedDimension}
                  />
                </div>
              </div>
              <div className="overview-l1-card__divider" aria-hidden="true" />

              {selectedDimension === 'basic' ? (
                <BasicDimensionSummary language={language} quality={currentQuality} />
              ) : !legacySnapshot ? (
                <p className="overview-empty-state">{t.qualityDataUnavailable}</p>
              ) : selectedDimension === 'performance' ? (
                <PerformanceDimensionSummary language={language} snapshot={legacySnapshot} />
              ) : (
                <StandardDimensionSummary
                  language={language}
                  dimension={legacySnapshot.dimensions[selectedDimension]}
                />
              )}
            </div>
          </section>
        </div>
      ) : (
        <QualityStatePanel
          language={language}
          state={presentationState === 'loading' || presentationState === 'empty'
            ? presentationState
            : 'error'}
          onRetry={handleRetry}
        />
      )}
    </div>
  );
}
