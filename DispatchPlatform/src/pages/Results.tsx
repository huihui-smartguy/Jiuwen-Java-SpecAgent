import { useQuery } from '@tanstack/react-query';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent
} from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError, getVersions, listReports } from '../api/client';
import { MetricCard } from '../components/MetricCard';
import { PageHeader } from '../components/PageHeader';
import { ReportGenerationModal } from '../components/ReportGenerationModal';
import { getCopy } from '../i18n';
import type {
  Language,
  NormalizedTaskStatus,
  ReportListItem,
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
  const reports = tasks.map((task): ReportRow => {
    const result = resultForTask(task, labels);
    const passRateValue = passRateForTask(task);
    const sourceTime = task.completed_at;
    const taskSut = task.sourceSut ?? selectedSut;
    return {
      title: `${notes.reportPrefix} · ${task.task_id}`,
      id: task.task_id,
      object: `${taskSut.product} ${taskSut.scene}`.trim(),
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

type ResultsTab = 'session' | 'persisted';

function softwareVersionStorageKey(objectId: string) {
  return `testwise.reportSoftwareVersion:${objectId}`;
}

function initialSoftwareVersion(sut: SutTarget) {
  try {
    return window.localStorage.getItem(softwareVersionStorageKey(sut.id)) ?? sut.version;
  } catch {
    return sut.version;
  }
}

function hasExactSoftwareVersion(value: string) {
  const normalized = value.trim();
  return Boolean(normalized) && !/^(?:live|current|latest)$/i.test(normalized);
}

function persistedReportMatches(report: ReportListItem, search: string) {
  if (!search) {
    return true;
  }
  return [
    report.title,
    report.id,
    report.software_version,
    report.test_version,
    report.conclusion.verdict,
    report.created_by,
    report.created_at
  ].some((value) => value.toLocaleLowerCase().includes(search));
}

export function Results({
  language,
  selectedSut,
  activeTask,
  sessionTasks,
  runtimeConfig
}: ResultsProps) {
  const t = getCopy(language);
  const navigate = useNavigate();
  const generateButtonRef = useRef<HTMLButtonElement>(null);
  const sessionTaskSnapshot = useMemo(
    () => uniqueTasks(sessionTasks, activeTask),
    [activeTask, sessionTasks]
  );
  const hasSessionRows = runtimeConfig.enableMockFallback || sessionTaskSnapshot.length > 0;
  const [activeTab, setActiveTab] = useState<ResultsTab>(() => (
    hasSessionRows ? 'session' : 'persisted'
  ));
  const [reportSearch, setReportSearch] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [softwareVersion, setSoftwareVersion] = useState(() => initialSoftwareVersion(selectedSut));
  const [softwareVersionObjectId, setSoftwareVersionObjectId] = useState(selectedSut.id);
  const [testVersionFilter, setTestVersionFilter] = useState('');
  const [reportPage, setReportPage] = useState(0);
  const trendTitle = language === 'zh' ? '通过率趋势' : 'Pass rate trend';
  const trendPeriod = language === 'zh' ? '近 7 天' : 'Last 7 days';
  const searchReportsLabel = language === 'zh' ? '搜索报告或任务' : 'Search reports or tasks';
  const resolvedApiBaseUrl = selectedSut.apiBaseUrl || runtimeConfig.apiBaseUrl;
  const targetIdentity = useMemo(() => ({
    id: selectedSut.id,
    product: selectedSut.product,
    scene: selectedSut.scene,
    apiBaseUrl: resolvedApiBaseUrl
  }), [resolvedApiBaseUrl, selectedSut.id, selectedSut.product, selectedSut.scene]);
  const api = useMemo(() => ({ apiBaseUrl: targetIdentity.apiBaseUrl }), [targetIdentity.apiBaseUrl]);
  const exactSoftwareVersion = hasExactSoftwareVersion(softwareVersion);
  const versionsQuery = useQuery({
    queryKey: ['versions', targetIdentity],
    queryFn: () => getVersions(api),
    enabled: !runtimeConfig.enableMockFallback && (activeTab === 'persisted' || filtersOpen)
  });
  const reportsQuery = useQuery({
    queryKey: [
      'reports',
      targetIdentity,
      {
        softwareVersion: softwareVersion.trim(),
        testVersion: testVersionFilter,
        limit: 20,
        offset: reportPage * 20
      }
    ],
    queryFn: () => listReports(api, {
      software_version: softwareVersion.trim(),
      ...(testVersionFilter ? { test_version: testVersionFilter } : {}),
      limit: 20,
      offset: reportPage * 20
    }),
    enabled: !runtimeConfig.enableMockFallback
      && activeTab === 'persisted'
      && softwareVersionObjectId === selectedSut.id
      && exactSoftwareVersion
  });

  useEffect(() => {
    setSoftwareVersion(initialSoftwareVersion(selectedSut));
    setSoftwareVersionObjectId(selectedSut.id);
    setTestVersionFilter('');
    setReportPage(0);
  }, [selectedSut.id]);

  const updateSoftwareVersion = (value: string) => {
    setSoftwareVersion(value);
    setSoftwareVersionObjectId(selectedSut.id);
    setReportPage(0);
    try {
      window.localStorage.setItem(softwareVersionStorageKey(selectedSut.id), value);
    } catch {
      // Browsers may disable storage; the current edit still remains usable for this session.
    }
  };
  const handleTabKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
      return;
    }
    event.preventDefault();
    const nextTab: ResultsTab = event.key === 'ArrowLeft' || event.key === 'Home'
      ? 'session'
      : 'persisted';
    setActiveTab(nextTab);
    if (nextTab === 'persisted') {
      setReportPage(0);
    }
    requestAnimationFrame(() => {
      document.getElementById(`results-${nextTab}-tab`)?.focus();
    });
  };
  const viewModel = useMemo(() => {
    if (runtimeConfig.enableMockFallback) {
      return mockViewModel(language);
    }

    return liveViewModel(
      sessionTaskSnapshot,
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
  }, [language, runtimeConfig.enableMockFallback, selectedSut, sessionTaskSnapshot, t]);
  const normalizedSearch = reportSearch.trim().toLocaleLowerCase();
  const filteredReports = normalizedSearch
    ? viewModel.reports.filter((report) => (
      [report.title, report.id, report.object, report.result, report.passRate, report.completed]
        .some((value) => value.toLocaleLowerCase().includes(normalizedSearch))
    ))
    : viewModel.reports;
  const persistedReports = (reportsQuery.data?.reports ?? []).filter((report) => (
    persistedReportMatches(report, normalizedSearch)
  ));
  const reportPageCount = Math.max(1, Math.ceil((reportsQuery.data?.total ?? 0) / 20));
  const maximumFailureCount = Math.max(...viewModel.failures.map((failure) => failure.count), 1);

  return (
    <div className="page-stack results-page">
      <PageHeader
        title={t.results}
        subtitle={t.resultsSubtitle}
        action={(
          <div className="results-header-actions">
            <button
              type="button"
              className="results-header-action results-filter-action"
              aria-expanded={filtersOpen}
              onClick={() => setFiltersOpen((current) => !current)}
            >
              {t.filterResults}
            </button>
            <button
              ref={generateButtonRef}
              type="button"
              className="results-header-action results-export-action"
              aria-disabled={runtimeConfig.enableMockFallback || undefined}
              onClick={() => {
                if (!runtimeConfig.enableMockFallback) {
                  setGenerateOpen(true);
                }
              }}
            >
              {language === 'zh' ? '生成报告' : 'Generate Report'}
            </button>
          </div>
        )}
      />

      {filtersOpen ? (
        <section
          className="results-filter-panel"
          aria-label={language === 'zh' ? '报告筛选条件' : 'Report filters'}
        >
          <label>
            <span>{language === 'zh' ? '被测软件版本' : 'Software/build version'}</span>
            <input
              type="text"
              value={softwareVersion}
              onChange={(event) => updateSoftwareVersion(event.target.value)}
            />
          </label>
          <label>
            <span>{language === 'zh' ? '测试批次（可选）' : 'Test batch (optional)'}</span>
            <select
              value={testVersionFilter}
              onChange={(event) => {
                setTestVersionFilter(event.target.value);
                setReportPage(0);
              }}
              disabled={runtimeConfig.enableMockFallback || versionsQuery.isLoading}
            >
              <option value="">{language === 'zh' ? '全部批次' : 'All batches'}</option>
              {(versionsQuery.data?.versions ?? []).map((version) => (
                <option key={version.code} value={version.code}>{version.name} · {version.code}</option>
              ))}
            </select>
          </label>
          {!exactSoftwareVersion ? (
            <p>{language === 'zh'
              ? '请输入精确的软件版本或构建号。'
              : 'Enter an exact software version or build.'}</p>
          ) : null}
        </section>
      ) : null}

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
          <div className="results-report-tools">
            <div
              className="results-report-tabs"
              role="tablist"
              aria-label={language === 'zh' ? '结果来源' : 'Result source'}
            >
              <button
                id="results-session-tab"
                type="button"
                role="tab"
                aria-selected={activeTab === 'session'}
                aria-controls="results-report-panel"
                tabIndex={activeTab === 'session' ? 0 : -1}
                onKeyDown={handleTabKeyDown}
                onClick={() => setActiveTab('session')}
              >
                {language === 'zh' ? '会话结果' : 'Session Results'}
              </button>
              <button
                id="results-persisted-tab"
                type="button"
                role="tab"
                aria-selected={activeTab === 'persisted'}
                aria-controls="results-report-panel"
                tabIndex={activeTab === 'persisted' ? 0 : -1}
                onKeyDown={handleTabKeyDown}
                onClick={() => {
                  setActiveTab('persisted');
                  setReportPage(0);
                }}
              >
                {language === 'zh' ? '持久化报告' : 'Persisted Reports'}
              </button>
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
        </div>
        <div
          id="results-report-panel"
          className="results-table-scroll"
          role="tabpanel"
          aria-labelledby={`results-${activeTab}-tab`}
        >
          {activeTab === 'session' ? (
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
          ) : !exactSoftwareVersion ? (
            <p className="results-persisted-state" role="status">
              {language === 'zh'
                ? '请输入精确的软件版本或构建号后查询报告。'
                : 'Enter an exact software version or build before querying reports.'}
            </p>
          ) : reportsQuery.isLoading ? (
            <p className="results-persisted-state" role="status">
              {language === 'zh' ? '正在加载持久化报告…' : 'Loading persisted reports…'}
            </p>
          ) : reportsQuery.isError ? (
            <p className="results-persisted-state is-error" role="alert">
              {reportsQuery.error instanceof ApiError
                ? reportsQuery.error.message
                : language === 'zh' ? '报告列表加载失败。' : 'Unable to load reports.'}
            </p>
          ) : (
            <>
              <table aria-label={t.recentReports} className="results-persisted-table">
                <thead>
                  <tr>
                    <th>{language === 'zh' ? '报告' : 'Report'}</th>
                    <th>{language === 'zh' ? '软件版本' : 'Software version'}</th>
                    <th>{language === 'zh' ? '测试批次' : 'Test batch'}</th>
                    <th>{language === 'zh' ? '结论' : 'Conclusion'}</th>
                    <th>{language === 'zh' ? '创建时间' : 'Created'}</th>
                    <th>{language === 'zh' ? '操作' : 'Action'}</th>
                  </tr>
                </thead>
                <tbody>
                  {persistedReports.map((report) => (
                    <tr key={report.id}>
                      <td className="results-report-title">{report.title}</td>
                      <td>{report.software_version}</td>
                      <td className="results-report-id">{report.test_version}</td>
                      <td>
                        <span
                          className={`results-status-pill is-${report.conclusion.passed ? 'success' : 'danger'}`}
                          aria-label={`${report.conclusion.verdict}, ${report.summary.success_rate.toFixed(1)}%`}
                        >
                          {report.conclusion.verdict}
                        </span>
                      </td>
                      <td>{displayTaskTime(report.created_at)}</td>
                      <td>
                        <Link
                          className="results-report-action"
                          to={`/results/${encodeURIComponent(report.id)}`}
                        >
                          {language === 'zh' ? '打开报告  →' : 'Open report  →'}
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {!persistedReports.length ? (
                    <tr className="results-empty-row">
                      <td>{language === 'zh' ? '没有匹配的持久化报告' : 'No matching persisted reports'}</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
              <nav className="results-pagination" aria-label={language === 'zh' ? '报告分页' : 'Report pagination'}>
                <button
                  type="button"
                  disabled={reportPage === 0}
                  onClick={() => setReportPage((current) => Math.max(0, current - 1))}
                >
                  {language === 'zh' ? '上一页' : 'Previous'}
                </button>
                <span>{language === 'zh'
                  ? `第 ${reportPage + 1} / ${reportPageCount} 页`
                  : `Page ${reportPage + 1} of ${reportPageCount}`}</span>
                <button
                  type="button"
                  disabled={reportPage + 1 >= reportPageCount}
                  onClick={() => setReportPage((current) => current + 1)}
                >
                  {language === 'zh' ? '下一页' : 'Next'}
                </button>
              </nav>
            </>
          )}
        </div>
      </section>

      {generateOpen ? (
        <ReportGenerationModal
          language={language}
          selectedSut={selectedSut}
          runtimeConfig={runtimeConfig}
          softwareVersion={softwareVersion}
          returnFocusRef={generateButtonRef}
          onSoftwareVersionChange={updateSoftwareVersion}
          onClose={() => setGenerateOpen(false)}
          onCreated={(reportId) => {
            setGenerateOpen(false);
            navigate(`/results/${encodeURIComponent(reportId)}`);
          }}
        />
      ) : null}
    </div>
  );
}
