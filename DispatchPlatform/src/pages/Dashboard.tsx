import {
  ArrowRight,
  ChartNoAxesCombined,
  Check,
  CircleDot,
  SquareActivity,
  Target
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { ExecutionFocus } from '../components/ExecutionFocus';
import { MetricCard } from '../components/MetricCard';
import { PageHeader } from '../components/PageHeader';
import { PresentationOnlyButton } from '../components/PresentationOnlyButton';
import { getCopy } from '../i18n';
import type { Language, NormalizedTaskStatus, RuntimeConfig, SutTarget } from '../types';

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

export function Dashboard({
  language,
  selectedSut,
  activeTask,
  runtimeConfig
}: PageProps) {
  const t = getCopy(language);
  const showPresentationFallback = runtimeConfig.enableMockFallback;
  const qualitySignals: QualitySignal[] = [
    { label: t.basic, value: '96%', percent: 96, tone: 'accent' },
    { label: t.performance, value: '91%', percent: 91, tone: 'accent' },
    { label: t.scenario, value: '88%', percent: 88, tone: 'warning' },
    { label: t.dfx, value: '93%', percent: 93, tone: 'accent' }
  ];
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
            <ArrowRight aria-hidden="true" />
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
            <div className="quality-score" aria-label={`${t.overallQuality} ${showPresentationFallback ? '93.6' : t.notAvailable}`}>
              <svg viewBox="0 0 120 120" aria-hidden="true">
                <circle className="quality-score__track" cx="60" cy="60" r="51" pathLength="100" />
                {showPresentationFallback ? (
                  <circle
                    className="quality-score__value"
                    cx="60"
                    cy="60"
                    r="51"
                    pathLength="100"
                    strokeDasharray="93.6 100"
                  />
                ) : null}
              </svg>
              <div>
                <strong>{showPresentationFallback ? '93.6' : '—'}</strong>
                <span>{t.overallQuality}</span>
              </div>
            </div>
            <div className="overview-quality-card__message">
              {showPresentationFallback ? (
                <>
                  <strong>{t.qualityAttentionCount}</strong>
                  <p>{t.qualitySummaryDetail}</p>
                </>
              ) : (
                <p>{t.notAvailable}</p>
              )}
            </div>
          </div>

          {showPresentationFallback ? (
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
              value={showPresentationFallback ? '24' : '—'}
              change={showPresentationFallback ? '+12.5%' : undefined}
              changeTone="positive"
              note={showPresentationFallback ? t.completedTasksToday : t.notAvailable}
              icon={<SquareActivity aria-hidden="true" />}
            />
            <MetricCard
              label={t.passRate}
              value={showPresentationFallback ? '93.6%' : '—'}
              change={showPresentationFallback ? '+2.1%' : undefined}
              changeTone="positive"
              note={showPresentationFallback ? t.pastSevenDaysImproved : t.notAvailable}
              icon={<ChartNoAxesCombined aria-hidden="true" />}
            />
            <MetricCard
              label={t.overviewActiveIssues}
              value={showPresentationFallback ? '7' : '—'}
              change={showPresentationFallback ? t.threeNeedAttention : undefined}
              changeTone="warning"
              note={showPresentationFallback ? t.unclaimedIssues : t.notAvailable}
              icon={<Target aria-hidden="true" />}
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
                  <ArrowRight aria-hidden="true" />
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
                <CircleDot aria-hidden="true" />
              </div>
              <p>{t.attentionDetail}</p>
              <PresentationOnlyButton className="overview-attention-card__action">
                {t.viewInteractionGuide}
                <ArrowRight aria-hidden="true" />
              </PresentationOnlyButton>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
