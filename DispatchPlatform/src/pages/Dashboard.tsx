import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { getStatisticsSummary } from '../api/client';
import { ExecutionFocus } from '../components/ExecutionFocus';
import { MetricCard } from '../components/MetricCard';
import { PageHeader } from '../components/PageHeader';
import { PresentationOnlyButton } from '../components/PresentationOnlyButton';
import { getCopy } from '../i18n';
import type {
  Language,
  NormalizedTaskStatus,
  RuntimeConfig,
  StatisticsBreakdown,
  SutTarget
} from '../types';

interface PageProps {
  language: Language;
  selectedSut: SutTarget;
  activeTask: NormalizedTaskStatus | null;
  runtimeConfig: RuntimeConfig;
}

type QualityTone = 'accent' | 'warning';

interface QualitySignal {
  label: string;
  value: string;
  percent: number;
  tone: QualityTone;
}

interface ActivityItem {
  title: string;
  detail: string;
  time: string;
}

function percentNumber(value: string) {
  const parsed = Number.parseFloat(value.replace('%', ''));
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 0), 100) : 0;
}

function signalForBreakdown(item: StatisticsBreakdown): QualitySignal {
  const percent = item.executed > 0 ? (item.pass / item.executed) * 100 : 0;
  return {
    label: item.feature,
    value: `${percent.toFixed(1)}%`,
    percent,
    tone: item.failed > 0 ? 'warning' : 'accent'
  };
}

export function Dashboard({
  language,
  selectedSut,
  activeTask,
  runtimeConfig
}: PageProps) {
  const t = getCopy(language);
  const showPresentationFallback = runtimeConfig.enableMockFallback;
  const resolvedApiBaseUrl = selectedSut.apiBaseUrl || runtimeConfig.apiBaseUrl;
  const targetIdentity = useMemo(() => ({
    id: selectedSut.id,
    product: selectedSut.product,
    scene: selectedSut.scene,
    apiBaseUrl: resolvedApiBaseUrl
  }), [resolvedApiBaseUrl, selectedSut.id, selectedSut.product, selectedSut.scene]);
  const statisticsQuery = useQuery({
    queryKey: ['statistics-summary', targetIdentity],
    queryFn: () => getStatisticsSummary(
      { apiBaseUrl: targetIdentity.apiBaseUrl },
      { product: targetIdentity.product, scene: targetIdentity.scene }
    ),
    enabled: !showPresentationFallback
  });
  const queryClient = useQueryClient();

  useEffect(() => {
    if (activeTask?.isTerminal) {
      void queryClient.invalidateQueries({ queryKey: ['statistics-summary'] });
    }
  }, [activeTask?.isTerminal, activeTask?.task_id, queryClient]);

  const statistics = statisticsQuery.data?.data;
  const fallbackQualitySignals: QualitySignal[] = [
    { label: t.basic, value: '96%', percent: 96, tone: 'accent' },
    { label: t.performance, value: '91%', percent: 91, tone: 'accent' },
    { label: t.scenario, value: '88%', percent: 88, tone: 'warning' },
    { label: t.dfx, value: '93%', percent: 93, tone: 'accent' }
  ];
  const qualitySignals = showPresentationFallback
    ? fallbackQualitySignals
    : (statistics?.breakdown ?? []).slice(0, 4).map(signalForBreakdown);
  const passRate = showPresentationFallback ? '93.6%' : statistics?.summary.pass_rate;
  const qualityScore = passRate?.replace(/%$/, '');
  const qualityPercent = passRate ? percentNumber(passRate) : 0;
  const pathStages = [
    t.environmentCheck,
    t.scriptPreparation,
    t.saveApi,
    t.queryApi,
    t.summary
  ];
  const activityItems: ActivityItem[] = [
    {
      title: t.activityTaskStarted,
      detail: t.activityTaskStartedDetail,
      time: '10:42'
    },
    {
      title: t.activityRegressionComplete,
      detail: t.activityRegressionCompleteDetail,
      time: '09:18'
    },
    {
      title: t.activityLogsExported,
      detail: t.activityLogsExportedDetail,
      time: '08:56'
    }
  ];

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

      <div className="overview-grid">
        <section
          className="overview-quality-card"
          aria-labelledby="overview-quality-title"
        >
          <div className="overview-quality-card__heading">
            <div>
              <p className="overview-kicker">L0 QUALITY</p>
              <h2 id="overview-quality-title">{t.qualitySummary}</h2>
            </div>
            {showPresentationFallback ? (
              <span className="overview-stability">
                <span aria-hidden="true" />
                {t.stable}
              </span>
            ) : null}
          </div>

          <div className="overview-quality-card__summary">
            <div className="quality-score" aria-label={`${t.overallQuality} ${qualityScore ?? t.notAvailable}`}>
              <svg viewBox="0 0 120 120" aria-hidden="true">
                <circle className="quality-score__track" cx="60" cy="60" r="51" pathLength="100" />
                {qualityScore ? (
                  <circle
                    className="quality-score__value"
                    cx="60"
                    cy="60"
                    r="51"
                    pathLength="100"
                    strokeDasharray={`${qualityPercent} 100`}
                  />
                ) : null}
              </svg>
              <div>
                <strong>{qualityScore ?? '—'}</strong>
                <span>{t.overallQuality}</span>
              </div>
            </div>
            <div className="overview-quality-card__message">
              {showPresentationFallback ? (
                <>
                  <strong>{t.qualityAttentionCount}</strong>
                  <p>{t.qualitySummaryDetail}</p>
                </>
              ) : statistics ? (
                <>
                  <strong>{statistics.summary.failed_count} {t.statisticsFailures}</strong>
                  <p>
                    {statistics.summary.executed_scripts} / {statistics.summary.total_scripts}{' '}
                    {t.statisticsExecuted}
                  </p>
                </>
              ) : statisticsQuery.isError ? (
                <p role="alert">{t.statisticsUnavailable}</p>
              ) : statisticsQuery.isLoading ? (
                <p>{t.loadingStatistics}</p>
              ) : (
                <p>{t.notAvailable}</p>
              )}
            </div>
          </div>

          {qualitySignals.length ? (
            <ul className="quality-signal-list">
              {qualitySignals.map((signal) => (
                <li key={signal.label}>
                  <h3>{signal.label}</h3>
                  <span className="quality-signal-list__track" aria-hidden="true">
                    <span
                      className={`is-${signal.tone}`}
                      style={{ width: `${signal.percent}%` }}
                    />
                  </span>
                  <strong>{signal.value}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p className="overview-empty-state">{t.notAvailable}</p>
          )}
        </section>

        <div className="overview-right-column">
          <div className="overview-metrics">
            <MetricCard
              label={t.todayExecutions}
              value={showPresentationFallback ? '24' : statistics ? String(statistics.summary.executed_scripts) : '—'}
              change={showPresentationFallback ? '+12.5%' : undefined}
              changeTone="positive"
              note={showPresentationFallback
                ? t.completedTasksToday
                : statistics
                  ? `${statistics.summary.execution_rate} ${t.statisticsExecutionRate}`
                  : t.notAvailable}
            />
            <MetricCard
              label={t.passRate}
              value={passRate ?? '—'}
              change={showPresentationFallback ? '+2.1%' : undefined}
              changeTone="positive"
              note={showPresentationFallback
                ? t.pastSevenDaysImproved
                : statistics
                  ? `${statistics.summary.pass_count} ${t.statisticsPassed}`
                  : t.notAvailable}
            />
            <MetricCard
              label={t.overviewActiveIssues}
              value={showPresentationFallback ? '7' : statistics ? String(statistics.summary.failed_count) : '—'}
              change={showPresentationFallback ? t.threeNeedAttention : undefined}
              changeTone="warning"
              note={showPresentationFallback
                ? t.unclaimedIssues
                : statistics
                  ? `${statistics.summary.unexecuted_scripts} ${t.statisticsUnexecuted}`
                  : t.notAvailable}
            />
          </div>

          <section className="overview-path-card" aria-labelledby="overview-path-title">
            <div className="overview-card-heading">
              <div>
                <h2 id="overview-path-title">{t.executionPath}</h2>
                {showPresentationFallback ? (
                  <span className="overview-running-pill">
                    <span aria-hidden="true" />
                    {t.inProgress}
                  </span>
                ) : null}
              </div>
              <span>{showPresentationFallback ? t.threeMinutesRemaining : t.notAvailable}</span>
            </div>
            {showPresentationFallback ? (
              <ol className="overview-path-list">
                {pathStages.map((stage, index) => {
                  const stageState = index < 2 ? 'complete' : index === 2 ? 'current' : 'pending';
                  const stageStatus = stageState === 'complete'
                    ? t.stageComplete
                    : stageState === 'current'
                      ? t.stageCurrent
                      : t.stagePending;

                  return (
                    <li
                      key={stage}
                      className={`is-${stageState}`}
                      aria-current={stageState === 'current' ? 'step' : undefined}
                    >
                      <span className="overview-path-list__track" aria-hidden="true" />
                      <span data-testid="path-stage-label">{stage}</span>
                      <span className="sr-only">{stageStatus}</span>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="overview-empty-state">{t.notAvailable}</p>
            )}
          </section>

          <div className="overview-lower-grid">
            <section className="overview-activity-card" aria-labelledby="overview-activity-title">
              <div className="overview-card-heading">
                <h2 id="overview-activity-title">{t.recentActivity}</h2>
                <PresentationOnlyButton>
                  {t.viewAll}
                  <span aria-hidden="true">→</span>
                </PresentationOnlyButton>
              </div>
              {showPresentationFallback ? (
                <ul className="overview-activity-list">
                  {activityItems.map((item) => (
                    <li key={item.title}>
                      <span className="overview-activity-list__icon" aria-hidden="true">
                        <Check />
                      </span>
                      <div>
                        <strong>{item.title}</strong>
                        <span>{item.detail}</span>
                      </div>
                      <time>{item.time}</time>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="overview-empty-state">{t.notAvailable}</p>
              )}
            </section>

            <aside className="overview-attention-card" aria-labelledby="overview-attention-title">
              <div className="overview-attention-card__heading">
                <h2 id="overview-attention-title">{t.attention}</h2>
              </div>
              <p>{t.attentionDetail}</p>
              <PresentationOnlyButton className="overview-attention-card__action">
                {t.viewInteractionGuide}
                <span aria-hidden="true">→</span>
              </PresentationOnlyButton>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
