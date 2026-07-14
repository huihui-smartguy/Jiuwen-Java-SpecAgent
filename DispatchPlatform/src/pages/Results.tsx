import {
  ArrowRight,
  CalendarDays,
  ChartNoAxesCombined,
  CircleAlert,
  Clock3,
  Search
} from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import { MetricCard } from '../components/MetricCard';
import { PageHeader } from '../components/PageHeader';
import { PresentationOnlyButton } from '../components/PresentationOnlyButton';
import { getCopy } from '../i18n';
import type {
  Language,
  NormalizedTaskStatus,
  RuntimeConfig,
  SutTarget,
  UiTaskStatus
} from '../types';

interface ResultsProps {
  language: Language;
  selectedSut: SutTarget;
  activeTask: NormalizedTaskStatus | null;
  sessionTasks: NormalizedTaskStatus[];
  runtimeConfig: RuntimeConfig;
}

type ResultTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

interface ReportRow {
  id: string;
  object: string;
  result: string;
  resultTone: ResultTone;
  passRate: string;
  passRateValue?: number;
  completed: string;
  trendLabel: string;
}

interface TrendPoint {
  label: string;
  value: number;
}

interface FailureRow {
  label: string;
  count: number;
  tone: 'danger' | 'warning' | 'accent';
}

interface ResultsViewModel {
  metrics: [string, string, string, string];
  metricNotes: [string, string, string, string];
  trendPoints: TrendPoint[];
  trendChange?: string;
  trendObject: string;
  failures: FailureRow[];
  reports: ReportRow[];
}

const mockTrendPoints: TrendPoint[] = [
  { label: '07/08', value: 91.5 },
  { label: '07/09', value: 92.3 },
  { label: '07/10', value: 92.9 },
  { label: '07/11', value: 92.7 },
  { label: '07/12', value: 93.2 },
  { label: '07/13', value: 93.0 },
  { label: '07/14', value: 93.6 }
];

const mockFailures: FailureRow[] = [
  { label: 'API 密钥', count: 7, tone: 'danger' },
  { label: '用户权限', count: 5, tone: 'warning' },
  { label: '会话管理', count: 3, tone: 'accent' },
  { label: '其他', count: 2, tone: 'accent' }
];

const mockReports: ReportRow[] = [
  {
    id: 'EXEC-2042',
    object: '合一版本 API',
    result: 'Success',
    resultTone: 'success',
    passRate: '96.2%',
    passRateValue: 96.2,
    completed: 'Today · 10:42',
    trendLabel: 'Today · 10:42'
  },
  {
    id: 'EXEC-2041',
    object: '高码 Python',
    result: 'Partial',
    resultTone: 'warning',
    passRate: '88.9%',
    passRateValue: 88.9,
    completed: 'Today · 09:18',
    trendLabel: 'Today · 09:18'
  },
  {
    id: 'EXEC-2039',
    object: '合一版本 Web',
    result: 'Success',
    resultTone: 'success',
    passRate: '94.7%',
    passRateValue: 94.7,
    completed: 'Yesterday',
    trendLabel: 'Yesterday'
  }
];

function uniqueTasks(
  sessionTasks: NormalizedTaskStatus[],
  activeTask: NormalizedTaskStatus | null
): NormalizedTaskStatus[] {
  const seen = new Set<string>();
  const tasks: NormalizedTaskStatus[] = [];

  if (activeTask?.task_id) {
    seen.add(activeTask.task_id);
    tasks.push(activeTask);
  }

  for (const task of sessionTasks) {
    if (!task.task_id || seen.has(task.task_id)) {
      continue;
    }
    seen.add(task.task_id);
    tasks.push(task);
  }

  return tasks;
}

function passRateForTask(task: NormalizedTaskStatus): number | undefined {
  const result = task.result;
  if (!result || result.total_commands <= 0) {
    return undefined;
  }
  return Math.max(0, Math.min(100, (result.success_count / result.total_commands) * 100));
}

function resultForTask(
  task: NormalizedTaskStatus,
  labels: Record<UiTaskStatus | 'partial', string>
): { label: string; tone: ResultTone } {
  if (task.uiStatus === 'success' && task.result?.failed_count) {
    return task.result.success_count > 0
      ? { label: labels.partial, tone: 'warning' }
      : { label: labels.failed, tone: 'danger' };
  }

  const status = task.uiStatus;
  switch (status) {
    case 'success':
      return { label: labels.success, tone: 'success' };
    case 'failed':
      return { label: labels.failed, tone: 'danger' };
    case 'cancelled':
      return { label: labels.cancelled, tone: 'neutral' };
    case 'running':
      return { label: labels.running, tone: 'info' };
    case 'pending':
      return { label: labels.pending, tone: 'neutral' };
    case 'polling_error':
      return { label: labels.polling_error, tone: 'danger' };
  }
}

function displayTaskTime(value: string | undefined): string {
  if (!value) {
    return '—';
  }
  const iso = value.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
  return iso ? `${iso[1]} · ${iso[2]}` : value;
}

function durationInSeconds(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }
  const normalized = value.trim();
  const clock = normalized.match(/^(?:(\d+):)?(\d+):(\d{2})$/);
  if (clock) {
    const [, hours, minutes, seconds] = clock;
    return Number(hours ?? 0) * 3600 + Number(minutes) * 60 + Number(seconds);
  }
  const localized = normalized.match(/^(?:(\d+)\s*(?:小时|h(?:ours?)?))?\s*(?:(\d+)\s*(?:分(?:钟)?|m(?:in(?:utes?)?)?))?\s*(?:(\d+)\s*(?:秒|s(?:ec(?:onds?)?)?))?$/i);
  if (!localized || !localized.slice(1).some(Boolean)) {
    return undefined;
  }
  return Number(localized[1] ?? 0) * 3600
    + Number(localized[2] ?? 0) * 60
    + Number(localized[3] ?? 0);
}

function taskDurationInSeconds(task: NormalizedTaskStatus): number | undefined {
  const elapsed = durationInSeconds(task.elapsed_time);
  if (elapsed !== undefined) {
    return elapsed;
  }
  if (!task.started_at || !task.completed_at) {
    return undefined;
  }
  const started = Date.parse(task.started_at);
  const completed = Date.parse(task.completed_at);
  if (!Number.isFinite(started) || !Number.isFinite(completed) || completed < started) {
    return undefined;
  }
  return Math.round((completed - started) / 1000);
}

function formatDuration(seconds: number | undefined): string {
  if (seconds === undefined) {
    return '—';
  }
  const rounded = Math.max(0, Math.round(seconds));
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const remainingSeconds = rounded % 60;
  return hours > 0
    ? [hours, minutes, remainingSeconds].map((part) => String(part).padStart(2, '0')).join(':')
    : [minutes, remainingSeconds].map((part) => String(part).padStart(2, '0')).join(':');
}

function liveViewModel(
  tasks: NormalizedTaskStatus[],
  selectedSut: SutTarget,
  labels: Record<UiTaskStatus | 'partial', string>,
  notes: {
    session: string;
    withResults: string;
    returnedFailures: string;
    withDuration: string;
  }
): ResultsViewModel {
  const object = `${selectedSut.product} ${selectedSut.scene}`.trim();
  const reports = tasks.map((task): ReportRow => {
    const result = resultForTask(task, labels);
    const passRateValue = passRateForTask(task);
    const sourceTime = task.completed_at ?? task.started_at;
    return {
      id: task.task_id,
      object,
      result: result.label,
      resultTone: result.tone,
      passRate: passRateValue === undefined ? '—' : `${passRateValue.toFixed(1)}%`,
      passRateValue,
      completed: displayTaskTime(sourceTime),
      trendLabel: displayTaskTime(sourceTime) === '—' ? task.task_id : displayTaskTime(sourceTime)
    };
  });
  const resultTasks = tasks.filter((task) => Boolean(task.result && task.result.total_commands > 0));
  const totalCommands = resultTasks.reduce((total, task) => total + (task.result?.total_commands ?? 0), 0);
  const passedCommands = resultTasks.reduce((total, task) => total + (task.result?.success_count ?? 0), 0);
  const failedCommands = tasks.reduce(
    (total, task) => total + (task.result?.failed_count ?? 0),
    0
  );
  const durations = tasks
    .map(taskDurationInSeconds)
    .filter((duration): duration is number => duration !== undefined);
  const averageDuration = durations.length
    ? durations.reduce((total, duration) => total + duration, 0) / durations.length
    : undefined;
  const trendPoints = reports
    .filter((report): report is ReportRow & { passRateValue: number } => report.passRateValue !== undefined)
    .slice(0, 7)
    .reverse()
    .map((report) => ({ label: report.trendLabel, value: report.passRateValue }));

  return {
    metrics: [
      String(tasks.length),
      totalCommands > 0 ? `${((passedCommands / totalCommands) * 100).toFixed(1)}%` : '—',
      String(failedCommands),
      formatDuration(averageDuration)
    ],
    metricNotes: [
      notes.session,
      resultTasks.length ? `${resultTasks.length} ${notes.withResults}` : '—',
      notes.returnedFailures,
      durations.length ? `${durations.length} ${notes.withDuration}` : '—'
    ],
    trendPoints,
    trendObject: object,
    failures: [],
    reports
  };
}

function chartPath(points: TrendPoint[]): string {
  if (!points.length) {
    return '';
  }
  const width = 660;
  const top = 12;
  const bottom = 132;
  const values = points.map((point) => point.value);
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const span = Math.max(maximum - minimum, 0.1);
  const padding = Math.max(span * 0.08, 0.05);
  const domainMinimum = minimum - padding;
  const domainMaximum = maximum + padding;
  const coordinates = points.map((point, index) => ({
    x: points.length === 1 ? width / 2 : (index / (points.length - 1)) * width,
    y: bottom - ((point.value - domainMinimum) / (domainMaximum - domainMinimum)) * (bottom - top)
  }));

  if (coordinates.length === 1) {
    return `M 0 ${coordinates[0].y.toFixed(2)} L ${width} ${coordinates[0].y.toFixed(2)}`;
  }

  let path = `M ${coordinates[0].x.toFixed(2)} ${coordinates[0].y.toFixed(2)}`;
  for (let index = 0; index < coordinates.length - 1; index += 1) {
    const previous = coordinates[index - 1] ?? coordinates[index];
    const current = coordinates[index];
    const next = coordinates[index + 1];
    const following = coordinates[index + 2] ?? next;
    const firstControlX = current.x + (next.x - previous.x) / 6;
    const firstControlY = current.y + (next.y - previous.y) / 6;
    const secondControlX = next.x - (following.x - current.x) / 6;
    const secondControlY = next.y - (following.y - current.y) / 6;
    path += ` C ${firstControlX.toFixed(2)} ${firstControlY.toFixed(2)}, ${secondControlX.toFixed(2)} ${secondControlY.toFixed(2)}, ${next.x.toFixed(2)} ${next.y.toFixed(2)}`;
  }
  return path;
}

function TrendChart({
  title,
  unavailable,
  points
}: {
  title: string;
  unavailable: string;
  points: TrendPoint[];
}) {
  const titleId = useId();
  const descriptionId = useId();
  const linePath = chartPath(points);
  const description = points.length
    ? points.map((point) => `${point.label} ${point.value.toFixed(1)}%`).join('，')
    : unavailable;

  return (
    <svg
      className="results-trend-chart"
      viewBox="0 0 660 150"
      preserveAspectRatio="none"
      role="img"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      data-point-count={points.length}
    >
      <title id={titleId}>{title}</title>
      <desc id={descriptionId}>{description}</desc>
      <g className="results-trend-chart__grid" aria-hidden="true">
        <line x1="0" y1="24" x2="660" y2="24" />
        <line x1="0" y1="75" x2="660" y2="75" />
        <line x1="0" y1="126" x2="660" y2="126" />
      </g>
      {linePath ? (
        <>
          <path className="results-trend-chart__area" d={`${linePath} L 660 150 L 0 150 Z`} />
          <path className="results-trend-chart__line" d={linePath} />
        </>
      ) : null}
    </svg>
  );
}

export function Results({
  language,
  selectedSut,
  activeTask,
  sessionTasks,
  runtimeConfig
}: ResultsProps) {
  const t = getCopy(language);
  const [reportSearch, setReportSearch] = useState('');
  const viewModel = useMemo(() => {
    if (runtimeConfig.enableMockFallback) {
      return {
        metrics: ['42', '93.6%', '17', '05:48'],
        metricNotes: [
          t.weeklyReportsMockNote,
          t.consecutiveImprovement,
          t.highPriorityFailures,
          t.durationChange
        ],
        trendPoints: mockTrendPoints,
        trendChange: '+2.1%',
        trendObject: '合一版本 API',
        failures: mockFailures,
        reports: mockReports
      } satisfies ResultsViewModel;
    }

    return liveViewModel(
      uniqueTasks(sessionTasks, activeTask),
      selectedSut,
      {
        success: 'Success',
        failed: 'Failed',
        cancelled: 'Cancelled',
        running: 'Running',
        pending: 'Pending',
        polling_error: 'Polling error',
        partial: 'Partial'
      },
      {
        session: t.sessionReportsNote,
        withResults: t.reportsWithResults,
        returnedFailures: t.returnedFailureCount,
        withDuration: t.reportsWithDuration
      }
    );
  }, [activeTask, runtimeConfig.enableMockFallback, selectedSut, sessionTasks, t]);
  const normalizedSearch = reportSearch.trim().toLocaleLowerCase();
  const filteredReports = normalizedSearch
    ? viewModel.reports.filter((report) => (
      [report.id, report.object, report.result, report.passRate, report.completed]
        .some((value) => value.toLocaleLowerCase().includes(normalizedSearch))
    ))
    : viewModel.reports;
  const maximumFailureCount = Math.max(...viewModel.failures.map((failure) => failure.count), 1);

  return (
    <div className="page-stack results-page">
      <PageHeader
        title={t.results}
        subtitle={t.resultsSubtitle}
        action={(
          <div className="results-header-actions">
            <PresentationOnlyButton className="results-header-action results-filter-action">
              {t.filterResults}
            </PresentationOnlyButton>
            <PresentationOnlyButton className="results-header-action results-export-action">
              {t.exportReport}
              <ArrowRight aria-hidden="true" />
            </PresentationOnlyButton>
          </div>
        )}
      />

      <section className="results-metrics" aria-labelledby="results-metrics-title">
        <h2 className="sr-only" id="results-metrics-title">{t.resultsMetrics}</h2>
        <MetricCard
          className="results-metric-card"
          label={t.weeklyReports}
          value={viewModel.metrics[0]}
          note={viewModel.metricNotes[0]}
          icon={<CalendarDays aria-hidden="true" />}
        />
        <MetricCard
          className="results-metric-card"
          label={t.overallPassRate}
          value={viewModel.metrics[1]}
          note={viewModel.metricNotes[1]}
          icon={<ChartNoAxesCombined aria-hidden="true" />}
        />
        <MetricCard
          className="results-metric-card"
          label={t.failedCases}
          value={viewModel.metrics[2]}
          note={viewModel.metricNotes[2]}
          icon={<CircleAlert aria-hidden="true" />}
        />
        <MetricCard
          className="results-metric-card"
          label={t.averageDuration}
          value={viewModel.metrics[3]}
          note={viewModel.metricNotes[3]}
          icon={<Clock3 aria-hidden="true" />}
        />
      </section>

      <div className="results-chart-grid">
        <section
          className="results-chart-card results-trend-card"
          aria-labelledby="results-trend-title"
        >
          <div className="results-card-heading">
            <div>
              <h2 id="results-trend-title">{t.sevenDayPassTrend}</h2>
              <p>{viewModel.trendObject} · {t.allResultLevels}</p>
            </div>
            {viewModel.trendChange ? (
              <span className="results-trend-change">
                <span aria-hidden="true" />
                {viewModel.trendChange}
              </span>
            ) : null}
          </div>
          <TrendChart
            title={t.sevenDayPassTrend}
            unavailable={t.notAvailable}
            points={viewModel.trendPoints}
          />
        </section>

        <section
          className="results-chart-card results-failure-card"
          aria-labelledby="results-failure-title"
        >
          <div className="results-card-heading results-failure-heading">
            <h2 id="results-failure-title">{t.failureDistribution}</h2>
            <PresentationOnlyButton className="results-view-cases">
              {t.viewCases}
              <ArrowRight aria-hidden="true" />
            </PresentationOnlyButton>
          </div>
          <ul className="results-failure-list" aria-label={t.failureDistribution}>
            {viewModel.failures.map((failure) => (
              <li key={failure.label}>
                <span className="results-failure-label">{failure.label}</span>
                <span className="results-failure-track" aria-hidden="true">
                  <span
                    className={`is-${failure.tone}`}
                    style={{ width: `${(failure.count / maximumFailureCount) * 100}%` }}
                  />
                </span>
                <strong>{failure.count}</strong>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section
        className="results-reports-card"
        aria-labelledby="recent-reports-title"
      >
        <div className="results-reports-heading">
          <div>
            <h2 id="recent-reports-title">{t.recentReports}</h2>
            <p>TRACEABLE ARTIFACTS</p>
          </div>
          <label className="results-report-search">
            <Search aria-hidden="true" />
            <span className="sr-only">{t.searchReports}</span>
            <input
              type="search"
              value={reportSearch}
              aria-label={t.searchReports}
              placeholder={t.searchReports}
              onChange={(event) => setReportSearch(event.target.value)}
            />
          </label>
        </div>
        <div className="results-table-scroll">
          <table aria-label={t.recentReports}>
            <thead>
              <tr>
                <th>Report</th>
                <th>Object</th>
                <th>Result</th>
                <th>Pass rate</th>
                <th>Completed</th>
              </tr>
            </thead>
            <tbody>
              {filteredReports.map((report) => (
                <tr key={report.id}>
                  <td className="results-report-id">{report.id}</td>
                  <td>{report.object}</td>
                  <td>
                    <span className={`results-status-pill is-${report.resultTone}`}>
                      <span aria-hidden="true" />
                      {report.result}
                    </span>
                  </td>
                  <td className="results-pass-rate">{report.passRate}</td>
                  <td>{report.completed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
