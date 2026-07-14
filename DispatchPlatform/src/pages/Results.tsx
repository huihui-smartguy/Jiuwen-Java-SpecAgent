import { useMemo, useState } from 'react';
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
  title: string;
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
  barHeight?: number;
}

interface FailureRow {
  label: string;
  count: number;
  tone: 'danger' | 'warning' | 'accent';
  barWidth?: number;
}

interface ResultsViewModel {
  metrics: [string, string, string, string];
  metricNotes: [string, string, string, string];
  trendPoints: TrendPoint[];
  failures: FailureRow[];
  failureTotal: number;
  reports: ReportRow[];
}

const mockTrendValues = [88.4, 89.7, 90.5, 89.9, 91.2, 90.8, 91.8];
const mockTrendHeights = [72, 88, 96, 82, 104, 94, 112];
const mockFailureCounts = [3, 2, 1, 1];
const mockFailureWidths = [316, 213, 130, 102];

function mockViewModel(language: Language): ResultsViewModel {
  const isChinese = language === 'zh';
  const trendLabels = isChinese
    ? ['周一', '周二', '周三', '周四', '周五', '周六', '今天']
    : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Today'];
  const failureLabels = isChinese
    ? ['断言失败', '环境异常', '执行超时', '数据准备']
    : ['Assertion failure', 'Environment error', 'Execution timeout', 'Data preparation'];
  const reportTitles = isChinese
    ? ['回归验证 · API 密钥管理', '角色权限边界验证', '会话过期策略回归', '数据源配置冒烟']
    : [
        'Regression validation · API key management',
        'Role permission boundary validation',
        'Session expiry policy regression',
        'Data source configuration smoke test'
      ];
  const reportResults = isChinese
    ? ['通过', '失败', '通过', '部分通过']
    : ['Passed', 'Failed', 'Passed', 'Partial'];
  const completed = isChinese
    ? ['今天 10:42', '今天 09:18', '昨天 16:26', '7 月 13 日']
    : ['Today 10:42', 'Today 09:18', 'Yesterday 16:26', 'Jul 13'];
  const ids = ['task-ad06c8e5', 'task-c91b2d4a', 'task-7f1820bd', 'task-2e9a170c'];
  const resultTones: ResultTone[] = ['success', 'danger', 'success', 'warning'];
  const passRates = ['100.0%', '75.0%', '100.0%', '80.0%'];
  const passRateValues = [100, 75, 100, 80];

  return {
    metrics: ['18', '91.8%', '7', isChinese ? '6分42秒' : '6m 42s'],
    metricNotes: isChinese
      ? ['较上周 +3', '近 7 天 +2.4%', '需要复核', '较上周 -38秒']
      : ['Compared with last week +3', 'Last 7 days +2.4%', 'Review required', 'Compared with last week -38s'],
    trendPoints: trendLabels.map((label, index) => ({
      label,
      value: mockTrendValues[index],
      barHeight: mockTrendHeights[index]
    })),
    failures: failureLabels.map((label, index) => ({
      label,
      count: mockFailureCounts[index],
      tone: index === 0 ? 'danger' : 'warning',
      barWidth: mockFailureWidths[index]
    })),
    failureTotal: 7,
    reports: ids.map((id, index) => ({
      title: reportTitles[index],
      id,
      object: '合一版本 API',
      result: reportResults[index],
      resultTone: resultTones[index],
      passRate: passRates[index],
      passRateValue: passRateValues[index],
      completed: completed[index],
      trendLabel: completed[index]
    }))
  };
}

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
    reportPrefix: string;
  }
): ResultsViewModel {
  const object = `${selectedSut.product} ${selectedSut.scene}`.trim();
  const reports = tasks.map((task): ReportRow => {
    const result = resultForTask(task, labels);
    const passRateValue = passRateForTask(task);
    const sourceTime = task.completed_at;
    return {
      title: `${notes.reportPrefix} · ${task.task_id}`,
      id: task.task_id,
      object,
      result: result.label,
      resultTone: result.tone,
      passRate: passRateValue === undefined ? '—' : `${passRateValue.toFixed(1)}%`,
      passRateValue,
      completed: displayTaskTime(sourceTime),
      trendLabel: displayTaskTime(sourceTime)
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
    failures: [],
    failureTotal: failedCommands,
    reports
  };
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
  const description = points.length
    ? points.map((point) => `${point.label} ${point.value.toFixed(1)}%`).join('，')
    : unavailable;

  return (
    <div
      className="results-trend-chart"
      role="img"
      aria-label={`${title}：${description}`}
      data-point-count={points.length}
    >
      {points.map((point, index) => (
        <div className="results-trend-item" key={`${point.label}-${index}`} aria-hidden="true">
          <span className="results-trend-bar-track">
            <span
              className={`results-trend-bar${index === points.length - 1 ? ' is-current' : ''}`}
              style={{
                height: `${point.barHeight ?? Math.max(12, Math.min(112, point.value * 1.12))}px`
              }}
            />
          </span>
          <span className="results-trend-label">{point.label}</span>
        </div>
      ))}
    </div>
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
  const trendTitle = language === 'zh' ? '通过率趋势' : 'Pass rate trend';
  const trendPeriod = language === 'zh' ? '近 7 天' : 'Last 7 days';
  const searchReportsLabel = language === 'zh' ? '搜索报告或任务' : 'Search reports or tasks';
  const viewModel = useMemo(() => {
    if (runtimeConfig.enableMockFallback) {
      return mockViewModel(language);
    }

    return liveViewModel(
      uniqueTasks(sessionTasks, activeTask),
      selectedSut,
      {
        success: t.success,
        failed: t.failed,
        cancelled: t.cancelled,
        running: t.running,
        pending: t.pending,
        polling_error: t.polling_error,
        partial: language === 'zh' ? '部分通过' : 'Partial'
      },
      {
        session: t.sessionReportsNote,
        withResults: t.reportsWithResults,
        returnedFailures: t.returnedFailureCount,
        withDuration: t.reportsWithDuration,
        reportPrefix: language === 'zh' ? '报告' : 'Report'
      }
    );
  }, [activeTask, language, runtimeConfig.enableMockFallback, selectedSut, sessionTasks, t]);
  const normalizedSearch = reportSearch.trim().toLocaleLowerCase();
  const filteredReports = normalizedSearch
    ? viewModel.reports.filter((report) => (
      [report.title, report.id, report.object, report.result, report.passRate, report.completed]
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
              {language === 'zh' ? '导出' : 'Export'}
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
        />
        <MetricCard
          className="results-metric-card"
          label={t.overallPassRate}
          value={viewModel.metrics[1]}
          note={viewModel.metricNotes[1]}
        />
        <MetricCard
          className="results-metric-card"
          label={t.failedCases}
          value={viewModel.metrics[2]}
          note={viewModel.metricNotes[2]}
        />
        <MetricCard
          className="results-metric-card"
          label={t.averageDuration}
          value={viewModel.metrics[3]}
          note={viewModel.metricNotes[3]}
        />
      </section>

      <div className="results-chart-grid">
        <section
          className="results-chart-card results-trend-card"
          aria-labelledby="results-trend-title"
        >
          <div className="results-card-heading results-trend-heading">
            <h2 id="results-trend-title">{trendTitle}</h2>
            <span className="results-trend-period">{trendPeriod}</span>
          </div>
          <TrendChart
            title={trendTitle}
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
            <span className="results-failure-total">
              {language === 'zh' ? `${viewModel.failureTotal} 个用例` : `${viewModel.failureTotal} cases`}
            </span>
          </div>
          <ul className="results-failure-list" aria-label={t.failureDistribution}>
            {viewModel.failures.map((failure) => (
              <li key={failure.label}>
                <span className="results-failure-label">{failure.label}</span>
                <span className="results-failure-track" aria-hidden="true">
                  <span
                    className={`is-${failure.tone}`}
                    style={{
                      width: failure.barWidth === undefined
                        ? `${(failure.count / maximumFailureCount) * 100}%`
                        : `${failure.barWidth}px`
                    }}
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
            <p>TRACEABLE ARTIFACTS</p>
            <h2 id="recent-reports-title">{t.recentReports}</h2>
          </div>
          <label className="results-report-search">
            <span className="results-report-search-glyph" aria-hidden="true">⌕</span>
            <span className="sr-only">{searchReportsLabel}</span>
            <input
              type="search"
              value={reportSearch}
              aria-label={searchReportsLabel}
              placeholder={searchReportsLabel}
              onChange={(event) => setReportSearch(event.target.value)}
            />
          </label>
        </div>
        <div className="results-table-scroll">
          <table aria-label={t.recentReports}>
            <thead>
              <tr>
                <th>{language === 'zh' ? '报告' : 'Report'}</th>
                <th>Object</th>
                <th>{language === 'zh' ? '任务' : 'Task'}</th>
                <th>{language === 'zh' ? '结果' : 'Result'}</th>
                <th>{language === 'zh' ? '完成时间' : 'Completed'}</th>
                <th>{language === 'zh' ? '操作' : 'Action'}</th>
              </tr>
            </thead>
            <tbody>
              {filteredReports.map((report) => (
                <tr key={report.id}>
                  <td className="results-report-title">{report.title}</td>
                  <td>{report.object}</td>
                  <td className="results-report-id">{report.id}</td>
                  <td>
                    <span
                      className={`results-status-pill is-${report.resultTone}`}
                      aria-label={language === 'zh'
                        ? `${report.result}，通过率 ${report.passRate}`
                        : `${report.result}, Pass rate ${report.passRate}`}
                    >
                      {report.result}
                    </span>
                  </td>
                  <td>{report.completed}</td>
                  <td>
                    <button
                      type="button"
                      className="presentation-only-button results-report-action"
                      aria-disabled="true"
                      aria-label={language === 'zh'
                        ? `${t.viewCases}：${report.title}，${report.id}`
                        : `${t.viewCases}: ${report.title}, ${report.id}`}
                    >
                      {`${t.viewCases}  →`}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
