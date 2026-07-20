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
import { ExecutionFocus } from '../components/ExecutionFocus';
import { PageHeader } from '../components/PageHeader';
import {
  overviewQualityMock,
  type DimensionQualityMock,
  type QualityDimensionId
} from '../data/overviewMockData';
import { getCopy } from '../i18n';
import type { Language, NormalizedTaskStatus, RuntimeConfig, SutTarget } from '../types';

interface PageProps {
  language: Language;
  selectedSut: SutTarget;
  activeTask: NormalizedTaskStatus | null;
  runtimeConfig: RuntimeConfig;
}

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

function dimensionTechnicalLabel(id: QualityDimensionId) {
  switch (id) {
    case 'basic':
      return 'BASIC FUNCTIONALITY';
    case 'dfx':
      return 'DFX';
    case 'scenario':
      return 'SCENARIO-BASED';
    case 'performance':
      return 'PERFORMANCE';
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
  size = 'large'
}: {
  score: number;
  label: string;
  size?: 'large' | 'compact';
}) {
  const boundedScore = Math.min(100, Math.max(0, score));

  return (
    <div
      className={`overview-quality-ring is-${size}`}
      role="img"
      aria-label={`${label} ${boundedScore.toFixed(2)}`}
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
        <strong>{boundedScore.toFixed(2)}</strong>
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

function StandardDimensionSummary({
  language,
  dimension
}: {
  language: Language;
  dimension: DimensionQualityMock & { id: Exclude<QualityDimensionId, 'performance'> };
}) {
  const t = getCopy(language);
  const issueTotal = Math.max(dimension.issues, 1);
  const failureRatio = (dimension.failed / dimension.total) * 100;
  const statusLabel = dimension.status === 'attention' ? t.needsAttention : t.qualityHealthy;
  const priorityCopy = dimension.criticalIssues > 0
    ? language === 'zh'
      ? `优先处理 ${dimension.criticalIssues} 个阻断型问题`
      : `Prioritize ${dimension.criticalIssues} blocking ${dimension.criticalIssues === 1 ? 'issue' : 'issues'}`
    : language === 'zh'
      ? '暂无阻断型问题'
      : 'No blocking issues';

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
          {t.conclusion}: {dimensionConclusion(language, dimension.id)}
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

function PerformanceDimensionSummary({ language }: { language: Language }) {
  const t = getCopy(language);
  const dimension = overviewQualityMock.dimensions.performance;
  const performance = overviewQualityMock.performance;
  const chart = useMemo(() => {
    const width = 600;
    const left = 8;
    const right = width - 8;
    const top = 12;
    const bottom = 78;
    const min = 400;
    const max = 510;
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

export function Dashboard({ language, selectedSut, activeTask }: PageProps) {
  const t = getCopy(language);
  const [selectedDimension, setSelectedDimension] = useState<QualityDimensionId>('basic');
  const selectedMock = overviewQualityMock.dimensions[selectedDimension];
  const selectedLabel = dimensionLabel(language, selectedDimension);

  return (
    <div className="page-stack overview-page">
      <PageHeader
        title={t.dashboard}
        subtitle={t.dashboardSubtitle}
        action={(
          <Link className="button button--primary overview-create-task" to="/tasks">
            {t.newTask}
            <span aria-hidden="true">→</span>
          </Link>
        )}
      />

      <ExecutionFocus language={language} sut={selectedSut} task={activeTask} />

      <div className="overview-quality-hierarchy">
        <section className="overview-l0-card" aria-labelledby="overview-l0-title">
          <div className="overview-l0-score-zone">
            <div className="overview-hierarchy-heading">
              <span className="overview-hierarchy-heading__spine" aria-hidden="true" />
              <div>
                <p>{t.l0QualityEyebrow}</p>
                <h2 id="overview-l0-title">{t.globalQuality}</h2>
              </div>
            </div>

            <div className="overview-l0-score-summary">
              <QualityRing score={overviewQualityMock.overallPassRate} label={t.overallQuality} />
              <div className="overview-l0-score-status">
                <span className="overview-status-pill is-attention">
                  <span aria-hidden="true" />
                  {t.needsAttention}
                </span>
                <strong>{overviewQualityMock.totalIssues} {t.overviewIssuesShort}</strong>
                <span>{overviewQualityMock.executed} / {overviewQualityMock.totalExecutions} {t.overviewExecuted}</span>
              </div>
            </div>
          </div>

          <div className="overview-l0-divider" aria-hidden="true" />

          <div className="overview-l0-metrics" role="list" aria-label={t.globalQuality}>
            <div className="overview-l0-metric" role="listitem">
              <p>{t.overviewTotalExecutionEyebrow}</p>
              <span>{t.overviewTotalExecution}</span>
              <strong>{overviewQualityMock.totalExecutions}</strong>
              <small>
                {overviewQualityMock.executed} {t.overviewExecuted} · {overviewQualityMock.unexecuted} {t.overviewUnexecuted}
              </small>
            </div>
            <div className="overview-l0-metric" role="listitem">
              <p>{t.overviewOverallPassRateEyebrow}</p>
              <span>{t.overviewOverallPassRate}</span>
              <strong>{overviewQualityMock.overallPassRate.toFixed(2)}%</strong>
              <small>
                {overviewQualityMock.passed} {t.overviewPassed} · {overviewQualityMock.failed} {t.overviewFailed}
              </small>
            </div>
            <div className="overview-l0-metric is-issues" role="listitem">
              <p>{t.overviewTotalIssuesEyebrow}</p>
              <span>{t.overviewTotalIssues}</span>
              <strong>{overviewQualityMock.totalIssues}</strong>
              <small>{t.overviewIssueDataNote}</small>
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
            <span className="overview-mock-badge">{t.frontendMockData}</span>
          </div>

          <div className="overview-l1-card" data-dimension={selectedDimension}>
            <div className="overview-l1-card__heading">
              <div>
                <p>{t.currentDimension} · {dimensionTechnicalLabel(selectedDimension)}</p>
                <h3>{selectedLabel}</h3>
              </div>
              <DimensionSelector
                language={language}
                value={selectedDimension}
                onChange={setSelectedDimension}
              />
            </div>
            <div className="overview-l1-card__divider" aria-hidden="true" />

            {selectedDimension === 'performance' ? (
              <PerformanceDimensionSummary language={language} />
            ) : (
              <StandardDimensionSummary
                language={language}
                dimension={selectedMock as DimensionQualityMock & {
                  id: Exclude<QualityDimensionId, 'performance'>;
                }}
              />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
