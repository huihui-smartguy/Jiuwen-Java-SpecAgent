import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  useEffect,
  useRef,
  useState,
  type RefObject
} from 'react';
import {
  ApiError,
  ReportOutcomeUnknownError,
  createReport,
  getFeatures,
  getVersions
} from '../api/client';
import type { Language, RuntimeConfig, SutTarget } from '../types';

interface ReportGenerationModalProps {
  language: Language;
  selectedSut: SutTarget;
  runtimeConfig: RuntimeConfig;
  reportVersion: string;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
  onReportVersionChange: (value: string) => void;
  onClose: () => void;
  onCreated: (reportId: string) => void;
  onOutcomeUnknown: () => void;
}

const levels = ['L0', 'L1', 'L2', 'L3', 'L4'] as const;

export function ReportGenerationModal({
  language,
  selectedSut,
  runtimeConfig,
  reportVersion,
  returnFocusRef,
  onReportVersionChange,
  onClose,
  onCreated,
  onOutcomeUnknown
}: ReportGenerationModalProps) {
  const isChinese = language === 'zh';
  const queryClient = useQueryClient();
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const [feature, setFeature] = useState('');
  const [level, setLevel] = useState('');
  const [title, setTitle] = useState('');
  const [timeStart, setTimeStart] = useState('');
  const [timeEnd, setTimeEnd] = useState('');
  const apiBaseUrl = selectedSut.apiBaseUrl || runtimeConfig.apiBaseUrl;
  const targetIdentity = {
    id: selectedSut.id,
    product: selectedSut.product,
    scene: selectedSut.scene,
    apiBaseUrl
  };
  const api = { apiBaseUrl };
  const versionsQuery = useQuery({
    queryKey: ['versions', targetIdentity],
    queryFn: () => getVersions(api)
  });
  const featuresQuery = useQuery({
    queryKey: ['features', targetIdentity],
    queryFn: () => getFeatures(api, selectedSut.product, selectedSut.scene)
  });

  useEffect(() => {
    const versions = versionsQuery.data?.versions ?? [];
    if (!versions.length) {
      return;
    }
    if (!reportVersion || !versions.some((version) => version.code === reportVersion)) {
      onReportVersionChange(
        versions.find((version) => version.code === versionsQuery.data?.default_version)?.code
          ?? versions.find((version) => version.is_default)?.code
          ?? versions[0].code
      );
    }
  }, [onReportVersionChange, reportVersion, versionsQuery.data]);

  const close = () => {
    onClose();
    queueMicrotask(() => returnFocusRef.current?.focus());
  };

  useEffect(() => {
    closeRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        queueMicrotask(() => returnFocusRef.current?.focus());
        return;
      }
      if (event.key !== 'Tab') {
        return;
      }
      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])'
        ) ?? []
      );
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) {
        event.preventDefault();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const completeTimeWindow = Boolean(timeStart) === Boolean(timeEnd);
  const canCreate = Boolean(reportVersion) && completeTimeWindow;
  const creation = useMutation({
    mutationFn: () => createReport(api, {
      software_version: reportVersion,
      scope: {
        product: selectedSut.product,
        scenes: [selectedSut.scene],
        ...(feature ? { features: [feature] } : {}),
        ...(level ? { levels: [level] } : {})
      },
      ...(title.trim() ? { title: title.trim() } : {}),
      ...(timeStart && timeEnd ? { time_window: [timeStart, timeEnd] as [string, string] } : {})
    }),
    retry: false,
    onSuccess: (response) => {
      void queryClient.invalidateQueries({ queryKey: ['reports'] });
      onCreated(response.report_id);
    },
    onError: (error) => {
      if (error instanceof ReportOutcomeUnknownError) {
        void queryClient.invalidateQueries({ queryKey: ['reports'] });
      }
    }
  });

  return (
    <div
      className="report-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          close();
        }
      }}
    >
      <section
        ref={dialogRef}
        className="report-generation-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-generation-title"
      >
        <header>
          <div>
            <p>{selectedSut.product} · {selectedSut.scene}</p>
            <h2 id="report-generation-title">{isChinese ? '生成报告' : 'Generate Report'}</h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            aria-label={isChinese ? '关闭生成报告' : 'Close Generate Report'}
            onClick={close}
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>

        <p className="report-generation-lede">
          {isChinese
            ? '报告同步生成，可能需要数分钟。网络超时后不会自动重复提交。'
            : 'Reports are generated synchronously and may take several minutes. A timeout is never retried automatically.'}
        </p>

        <div className="report-generation-fields">
          <label className="report-generation-version-field">
            <span>{isChinese ? '执行 / 报告版本' : 'Execution / report version'}</span>
            <select
              required
              value={reportVersion}
              onChange={(event) => onReportVersionChange(event.target.value)}
              disabled={versionsQuery.isLoading || !versionsQuery.data?.versions.length}
            >
              {versionsQuery.isLoading ? (
                <option value="">{isChinese ? '正在加载…' : 'Loading…'}</option>
              ) : null}
              {(versionsQuery.data?.versions ?? []).map((version) => (
                <option key={version.code} value={version.code}>
                  {version.name} · {version.code}
                </option>
              ))}
            </select>
            <small>task.version → report.software_version</small>
          </label>
          <div className="report-version-source-card">
            <span>{isChinese ? '版本来源' : 'Version source'}</span>
            <strong>{isChinese ? '后端版本注册表' : 'Backend registry'}</strong>
            <small>GET /api/versions</small>
          </div>
          <label>
            <span>{isChinese ? 'Feature（可选）' : 'Feature (optional)'}</span>
            <select value={feature} onChange={(event) => setFeature(event.target.value)}>
              <option value="">{isChinese ? '全部' : 'All'}</option>
              {(featuresQuery.data?.features ?? []).map((item) => (
                <option key={item.id} value={item.name}>{item.name}</option>
              ))}
            </select>
          </label>
          <label>
            <span>{isChinese ? '级别（可选）' : 'Level (optional)'}</span>
            <select value={level} onChange={(event) => setLevel(event.target.value)}>
              <option value="">{isChinese ? '全部' : 'All'}</option>
              {levels.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="report-generation-wide-field">
            <span>{isChinese ? '报告标题（可选）' : 'Report title (optional)'}</span>
            <input type="text" value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>
          <label>
            <span>{isChinese ? '开始时间（可选）' : 'Start time (optional)'}</span>
            <input
              type="datetime-local"
              value={timeStart}
              onChange={(event) => setTimeStart(event.target.value)}
            />
          </label>
          <label>
            <span>{isChinese ? '结束时间（可选）' : 'End time (optional)'}</span>
            <input
              type="datetime-local"
              value={timeEnd}
              onChange={(event) => setTimeEnd(event.target.value)}
            />
          </label>
        </div>

        {!completeTimeWindow ? (
          <p className="report-generation-message is-error" role="alert">
            {isChinese ? '开始和结束时间必须同时填写。' : 'Start and end time must be provided together.'}
          </p>
        ) : creation.error instanceof ReportOutcomeUnknownError ? (
          <div className="report-generation-message is-warning" role="status">
            <p>{isChinese
              ? '生成结果暂时未知。后端可能已经保存报告；请先核对持久化报告，避免重复快照。'
              : 'The outcome is unknown. The backend may already have saved the report; verify persisted reports before retrying.'}</p>
            <button type="button" onClick={onOutcomeUnknown}>
              {isChinese ? '查看持久化报告' : 'View persisted reports'}
            </button>
          </div>
        ) : creation.isError ? (
          <p className="report-generation-message is-error" role="alert">
            {creation.error instanceof ApiError
              ? creation.error.message
              : isChinese ? '报告生成失败。' : 'Report generation failed.'}
          </p>
        ) : featuresQuery.isError || versionsQuery.isError ? (
          <p className="report-generation-message is-error" role="alert">
            {isChinese ? '报告范围加载失败。' : 'Unable to load report scope.'}
          </p>
        ) : (
          <p className="report-generation-message">
            {isChinese
              ? '“全部”不会向后端发送 Feature 或级别限制。'
              : 'All omits Feature and level restrictions from the request.'}
          </p>
        )}

        <footer>
          <button type="button" className="button button--secondary" onClick={close}>
            {isChinese ? '取消' : 'Cancel'}
          </button>
          <button
            type="button"
            className="button button--primary"
            disabled={!canCreate || creation.isPending}
            onClick={() => creation.mutate()}
          >
            {creation.isPending
              ? isChinese ? '正在生成…' : 'Generating…'
              : isChinese ? '创建并打开报告' : 'Create and open report'}
          </button>
        </footer>
      </section>
    </div>
  );
}
