import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ApiError,
  deleteReport,
  getReport,
  getReportDownloadUrl,
  resolvePublicDownloadUrl
} from '../api/client';
import { PageHeader } from '../components/PageHeader';
import { productDisplayLabel, sceneDisplayLabel } from '../objectLabels';
import { reportOutcome } from '../reportSemantics';
import type {
  Language,
  ReportDownloadFormat,
  ReportFeatureScope,
  RuntimeConfig,
  SutTarget
} from '../types';

interface ReportDetailPageProps {
  language: Language;
  selectedSut: SutTarget;
  runtimeConfig: RuntimeConfig;
  reportDownloadFormat?: ReportDownloadFormat;
}

function displayDate(value: string | null | undefined, fallback: string) {
  if (!value) {
    return fallback;
  }
  return value.replace('T', ' ').replace(/Z$/, ' UTC');
}

function featureLabel(feature: string | ReportFeatureScope) {
  return typeof feature === 'string'
    ? feature
    : feature.feature_version
      ? `${feature.name} · ${feature.feature_version}`
      : feature.name;
}

function displayList(values: Array<string | null | undefined> | null | undefined, fallback: string) {
  const provided = values?.filter((value): value is string => Boolean(value?.trim())) ?? [];
  return provided.length ? provided.join(', ') : fallback;
}

export function ReportDetailPage({
  language,
  selectedSut,
  runtimeConfig,
  reportDownloadFormat = 'html'
}: ReportDetailPageProps) {
  const isChinese = language === 'zh';
  const { reportId = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [actionsOpen, setActionsOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const moreActionsRef = useRef<HTMLButtonElement>(null);
  const confirmationDialogRef = useRef<HTMLElement>(null);
  const confirmationCloseRef = useRef<HTMLButtonElement>(null);
  const api = useMemo(() => ({
    apiBaseUrl: selectedSut.apiBaseUrl || runtimeConfig.apiBaseUrl
  }), [runtimeConfig.apiBaseUrl, selectedSut.apiBaseUrl]);
  const reportQuery = useQuery({
    queryKey: ['report-detail', api.apiBaseUrl, reportId],
    queryFn: () => getReport(api, reportId),
    enabled: Boolean(reportId) && !runtimeConfig.enableMockFallback
  });
  const deletion = useMutation({
    mutationFn: () => deleteReport(api, reportId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['reports'] });
      queryClient.removeQueries({ queryKey: ['report-detail', api.apiBaseUrl, reportId] });
      navigate('/results');
    }
  });

  useEffect(() => {
    if (!confirmDelete) {
      return undefined;
    }
    confirmationCloseRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setConfirmDelete(false);
        queueMicrotask(() => moreActionsRef.current?.focus());
        return;
      }
      if (event.key !== 'Tab') {
        return;
      }
      const focusable = Array.from(
        confirmationDialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []
      );
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [confirmDelete]);

  if (runtimeConfig.enableMockFallback) {
    return (
      <div className="report-detail-page">
        <Link className="report-detail-back" to="/results">← {isChinese ? '返回报告列表' : 'Back to reports'}</Link>
        <p className="report-detail-state is-error" role="alert">
          {isChinese
            ? '演示模式下不提供持久化报告。'
            : 'Persisted reports are unavailable in demo mode.'}
        </p>
      </div>
    );
  }

  if (reportQuery.isLoading) {
    return (
      <div className="report-detail-page">
        <Link className="report-detail-back" to="/results">← {isChinese ? '返回报告列表' : 'Back to reports'}</Link>
        <p className="report-detail-state" role="status">
          {isChinese ? '正在加载报告…' : 'Loading report…'}
        </p>
      </div>
    );
  }

  if (reportQuery.isError || !reportQuery.data?.report) {
    return (
      <div className="report-detail-page">
        <Link className="report-detail-back" to="/results">← {isChinese ? '返回报告列表' : 'Back to reports'}</Link>
        <p className="report-detail-state is-error" role="alert">
          {reportQuery.error instanceof ApiError
            ? reportQuery.error.message
            : isChinese ? '报告加载失败。' : 'Unable to load report.'}
        </p>
      </div>
    );
  }

  const report = reportQuery.data.report;
  const notAvailable = isChinese ? '未提供' : 'Not provided';
  const allValues = isChinese ? '全部' : 'All';
  const reportTitle = report.title?.trim() || (isChinese ? '未命名报告' : 'Untitled report');
  const reportVersion = report.software_version?.trim() || notAvailable;
  const outcome = reportOutcome(report.summary, report.conclusion, language);
  const hasNoResults = outcome.kind === 'no_results';
  const outcomeLabel = hasNoResults
    ? (isChinese ? '无匹配执行数据' : 'No matching execution data')
    : outcome.label;
  const conclusionReason = hasNoResults
    ? (isChinese
        ? '该版本与范围内没有匹配的执行记录，因此不能判定为通过或失败。'
        : 'No execution rows matched this version and scope, so this report cannot be judged as passed or failed.')
    : (report.conclusion.reason?.trim() || notAvailable);
  const features = report.scope.features?.map(featureLabel);
  const timeWindow = report.time_start || report.time_end
    ? `${displayDate(report.time_start, notAvailable)} → ${displayDate(report.time_end, notAvailable)}`
    : notAvailable;
  const registeredScriptCount = typeof report.scope.total_scripts === 'number'
    ? report.scope.total_scripts
    : null;
  const allExecutedPassed = report.summary.total > 0
    && report.summary.pass === report.summary.total
    && report.summary.failed === 0
    && report.summary.skipped === 0
    && (report.summary.running ?? 0) === 0;
  const markdownUrl = getReportDownloadUrl(api, report.id, 'md');
  const htmlUrl = getReportDownloadUrl(api, report.id, 'html');
  const downloads = {
    html: {
      url: htmlUrl,
      label: isChinese ? '下载 HTML' : 'Download HTML'
    },
    md: {
      url: markdownUrl,
      label: isChinese ? '下载 Markdown' : 'Download Markdown'
    }
  } as const;
  const primaryDownload = downloads[reportDownloadFormat];
  const secondaryDownload = downloads[reportDownloadFormat === 'html' ? 'md' : 'html'];

  return (
    <div className="page-stack report-detail-page">
      <Link className="report-detail-back" to="/results">← {isChinese ? '返回报告列表' : 'Back to reports'}</Link>
      <PageHeader
        title={reportTitle}
        subtitle={`${isChinese ? '执行/报告版本' : 'Execution/report version'}: ${reportVersion} · ${displayDate(report.created_at, notAvailable)}`}
        action={(
          <div className="report-detail-header-actions">
            <a className="button button--secondary" href={secondaryDownload.url} download>
              {secondaryDownload.label}
            </a>
            <a className="button button--primary" href={primaryDownload.url} download>
              {primaryDownload.label}
            </a>
            <div className="report-detail-overflow">
              <button
                ref={moreActionsRef}
                type="button"
                aria-label={isChinese ? '更多报告操作' : 'More report actions'}
                aria-expanded={actionsOpen}
                onClick={() => setActionsOpen((current) => !current)}
              >
                •••
              </button>
              {actionsOpen ? (
                <div className="report-detail-overflow-menu">
                  <button
                    type="button"
                    onClick={() => {
                      setActionsOpen(false);
                      setConfirmDelete(true);
                    }}
                  >
                    {isChinese ? '删除报告' : 'Delete report'}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        )}
      />

      <section className="report-detail-card report-provenance-card" aria-labelledby="report-provenance-title">
        <header>
          <div>
            <span className="report-detail-eyebrow">{isChinese ? '持久化证据' : 'Persisted evidence'}</span>
            <h2 id="report-provenance-title">{isChinese ? '来源与范围' : 'Provenance & scope'}</h2>
          </div>
          <span className="report-snapshot-badge">{isChinese ? '不可变快照' : 'Immutable snapshot'}</span>
        </header>
        <dl className="report-provenance-list">
          <div><dt>{isChinese ? '执行/报告版本' : 'Execution/report version'}</dt><dd>{reportVersion}</dd></div>
          <div><dt>{isChinese ? '报告快照' : 'Report snapshot'}</dt><dd>{isChinese ? '已持久化且不可变' : 'Persisted and immutable'} · {report.id || notAvailable}</dd></div>
          <div>
            <dt>{isChinese ? '产品' : 'Product'}</dt>
            <dd>
              {report.scope.product?.trim()
                ? productDisplayLabel(report.scope.product)
                : notAvailable}
            </dd>
          </div>
          <div>
            <dt>{isChinese ? '场景' : 'Scene'}</dt>
            <dd>
              {displayList(report.scope.scenes?.map(sceneDisplayLabel), allValues)}
            </dd>
          </div>
          <div><dt>Feature</dt><dd>{displayList(features, allValues)}</dd></div>
          <div><dt>{isChinese ? '级别' : 'Level'}</dt><dd>{displayList(report.scope.levels, allValues)}</dd></div>
          <div><dt>{isChinese ? '时间窗口' : 'Time window'}</dt><dd>{timeWindow}</dd></div>
          <div className="report-task-association"><dt>{isChinese ? 'Task 关联' : 'Task association'}</dt><dd>{isChinese ? '未绑定 / 不可用' : 'Unbound / unavailable'}</dd></div>
        </dl>
        <p className="report-provenance-note">
          {isChinese
            ? '当前后端未提供报告与任务的精确关联，因此不推测或生成 Task 链接。'
            : 'The backend does not provide an exact report-to-task correlation, so TestWise does not infer or fabricate a Task link.'}
        </p>
      </section>

      <section className="report-detail-summary" aria-label={isChinese ? '报告摘要' : 'Report summary'}>
        <article><span>{isChinese ? '实际执行记录' : 'Actual executed rows'}</span><strong>{report.summary.total}</strong></article>
        {registeredScriptCount !== null ? (
          <article><span>{isChinese ? '范围内已注册脚本' : 'Registered scripts in scope'}</span><strong>{registeredScriptCount}</strong></article>
        ) : null}
        <article><span>{isChinese ? '通过记录' : 'Passed rows'}</span><strong>{report.summary.pass}</strong></article>
        <article><span>{isChinese ? '失败记录' : 'Failed rows'}</span><strong>{report.summary.failed}</strong></article>
        <article><span>{isChinese ? '成功率' : 'Success rate'}</span><strong>{outcome.rate}</strong></article>
        <article><span>{isChinese ? '总耗时' : 'Duration'}</span><strong>{report.summary.total_duration_seconds.toFixed(1)}s</strong></article>
      </section>

      <div className="report-detail-grid">
        <section className="report-detail-card report-conclusion-card" aria-labelledby="report-conclusion-title">
          <header>
            <h2 id="report-conclusion-title">{isChinese ? '结论与门禁' : 'Conclusion & gates'}</h2>
            <span className={`is-${outcome.tone}`}>
              {outcomeLabel}
            </span>
          </header>
          <p>{conclusionReason}</p>
          {hasNoResults ? (
            <p className="report-no-results-note">
              {isChinese ? '后端结论与门禁已被中性结果覆盖。' : 'Backend verdict and gates are overridden by the neutral no-data state.'}
            </p>
          ) : (
            <ul className="report-gates">
              {(report.conclusion.gates ?? []).map((gate) => (
                <li key={gate.name}>
                  <div><strong>{gate.name || notAvailable}</strong><span>{gate.actual || notAvailable} / {gate.required || notAvailable}</span></div>
                  <span className={gate.passed ? 'is-passed' : 'is-failed'}>
                    {gate.passed ? (isChinese ? '通过' : 'Passed') : (isChinese ? '未通过' : 'Failed')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="report-detail-card" aria-labelledby="report-scope-title">
          <h2 id="report-scope-title">{isChinese ? '执行环境' : 'Execution environment'}</h2>
          <dl className="report-environment">
            <div><dt>{isChinese ? '执行方式' : 'Runner mode'}</dt><dd>{report.environment.execute_mode ?? notAvailable}</dd></div>
            <div><dt>{isChinese ? '被测地址' : 'SUT URL'}</dt><dd>{report.environment.sut?.base_url ?? notAvailable}</dd></div>
            <div><dt>{isChinese ? '执行主机' : 'Execution host'}</dt><dd>{report.environment.test_runner?.exec_host ?? notAvailable}</dd></div>
            <div><dt>OS</dt><dd>{report.environment.test_runner?.os ?? notAvailable}</dd></div>
            <div><dt>Python / pytest</dt><dd>{[report.environment.test_runner?.python_version, report.environment.test_runner?.pytest_version].filter(Boolean).join(' / ') || notAvailable}</dd></div>
          </dl>
        </section>
      </div>

      <section className="report-detail-card" aria-labelledby="report-risks-title">
        <h2 id="report-risks-title">{isChinese ? '风险与建议' : 'Risks & recommendations'}</h2>
        {report.risks.length ? (
          <ul className="report-risks">
            {report.risks.map((risk, index) => (
              <li key={`${risk.title}-${index}`} className={`is-${risk.level}`}>
                <div><span>{risk.level.toUpperCase()}</span><strong>{risk.title}</strong><small>{risk.category} · {risk.count}</small></div>
                <p>{risk.recommendation}</p>
                {risk.evidence.length ? <code>{risk.evidence[0]}</code> : null}
              </li>
            ))}
          </ul>
        ) : <p>{isChinese ? '未识别到风险。' : 'No risks identified.'}</p>}
      </section>

      <section className="report-detail-card report-results-card" aria-labelledby="report-results-title">
        <header className="report-results-header">
          <div>
            <h2 id="report-results-title">{isChinese ? '用例结果' : 'Case results'}</h2>
            <p>{isChinese ? '详细行由报告后端持久化，可能仅包含需要关注的结果。' : 'Detailed rows are persisted by the report backend and may include only results that need attention.'}</p>
          </div>
        </header>
        {report.result_data.length ? (
          <div className="report-results-scroll">
            <table>
            <thead>
              <tr>
                <th>{isChinese ? '用例' : 'Case'}</th>
                <th>Feature / {isChinese ? '级别' : 'Level'}</th>
                <th>{isChinese ? '状态' : 'Status'}</th>
                <th>{isChinese ? '耗时' : 'Duration'}</th>
                <th>{isChinese ? '失败信息' : 'Failure'}</th>
                <th>{isChinese ? '日志' : 'Log'}</th>
              </tr>
            </thead>
            <tbody>
              {report.result_data.map((result) => (
                <tr key={result.script_id}>
                  <td><strong>{result.filename || notAvailable}</strong></td>
                  <td>{displayList([result.feature, result.level], notAvailable).replace(', ', ' · ')}</td>
                  <td><span className={`report-case-status is-${result.status}`}>{result.status}</span></td>
                  <td>{result.duration_seconds === null ? '—' : `${result.duration_seconds.toFixed(1)}s`}</td>
                  <td>{result.error_message ?? result.failure_detail ?? '—'}</td>
                  <td>
                    {result.log_download_url ? (
                      <a
                        href={resolvePublicDownloadUrl(api, result.log_download_url)}
                        download
                      >
                        {isChinese ? '下载用例日志' : 'Download case log'}
                      </a>
                    ) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
            </table>
          </div>
        ) : (
          <div className={`report-results-empty${hasNoResults ? ' is-neutral' : ''}`} role="status">
            <strong>
              {hasNoResults
                ? (isChinese ? '无匹配执行数据' : 'No matching execution data')
                : allExecutedPassed
                  ? (isChinese ? '所有已执行用例均已通过' : 'All executed cases passed')
                  : (isChinese ? '未持久化用例明细' : 'Case details were not persisted')}
            </strong>
            <p>
              {hasNoResults
                ? (isChinese ? '请检查执行/报告版本、范围和时间窗口。' : 'Check the execution/report version, scope, and time window.')
                : allExecutedPassed
                  ? (isChinese ? '没有失败或跳过的明细行需要展示。' : 'There are no failed or skipped detail rows to display.')
                  : (isChinese ? '摘要包含失败或跳过记录，但后端未提供对应明细。' : 'The summary contains failed or skipped rows, but the backend did not provide matching details.')}
            </p>
          </div>
        )}
      </section>

      {confirmDelete ? (
        <div className="report-delete-backdrop">
          <section
            ref={confirmationDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-delete-title"
            className="report-delete-dialog"
          >
            <h2 id="report-delete-title">{isChinese ? '删除报告？' : 'Delete report?'}</h2>
            <p>{isChinese
              ? '此操作会删除持久化快照，且无法撤销。'
              : 'This permanently removes the persisted snapshot and cannot be undone.'}</p>
            {deletion.isError ? (
              <p role="alert" className="is-error">
                {deletion.error instanceof ApiError
                  ? deletion.error.message
                  : isChinese ? '删除失败。' : 'Delete failed.'}
              </p>
            ) : null}
            <div>
              <button
                ref={confirmationCloseRef}
                type="button"
                onClick={() => {
                  setConfirmDelete(false);
                  queueMicrotask(() => moreActionsRef.current?.focus());
                }}
              >
                {isChinese ? '取消' : 'Cancel'}
              </button>
              <button type="button" disabled={deletion.isPending} onClick={() => deletion.mutate()}>
                {deletion.isPending
                  ? isChinese ? '正在删除…' : 'Deleting…'
                  : isChinese ? '永久删除' : 'Delete permanently'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
