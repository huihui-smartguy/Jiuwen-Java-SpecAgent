import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  useEffect,
  useRef,
  useState,
  type RefObject
} from 'react';
import { ApiError, createReport, getFeatures, getVersions } from '../api/client';
import type { Language, RuntimeConfig, SutTarget } from '../types';

interface ReportGenerationModalProps {
  language: Language;
  selectedSut: SutTarget;
  runtimeConfig: RuntimeConfig;
  softwareVersion: string;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
  onSoftwareVersionChange: (value: string) => void;
  onClose: () => void;
  onCreated: (reportId: string) => void;
}

const levels = ['L0', 'L1', 'L2', 'L3', 'L4'] as const;

function isExactSoftwareVersion(value: string) {
  const normalized = value.trim();
  return Boolean(normalized) && !/^(?:live|current|latest)$/i.test(normalized);
}

export function ReportGenerationModal({
  language,
  selectedSut,
  runtimeConfig,
  softwareVersion,
  returnFocusRef,
  onSoftwareVersionChange,
  onClose,
  onCreated
}: ReportGenerationModalProps) {
  const isChinese = language === 'zh';
  const queryClient = useQueryClient();
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const [testVersion, setTestVersion] = useState('');
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
    if (!testVersion || !versions.some((version) => version.code === testVersion)) {
      setTestVersion(
        versions.find((version) => version.code === versionsQuery.data?.default_version)?.code
          ?? versions.find((version) => version.is_default)?.code
          ?? versions[0].code
      );
    }
  }, [testVersion, versionsQuery.data]);

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
  const canCreate = isExactSoftwareVersion(softwareVersion)
    && Boolean(testVersion)
    && completeTimeWindow;
  const creation = useMutation({
    mutationFn: () => createReport(api, {
      test_version: testVersion,
      software_version: softwareVersion.trim(),
      scope: {
        product: selectedSut.product,
        scenes: [selectedSut.scene],
        ...(feature ? { features: [feature] } : {}),
        ...(level ? { levels: [level] } : {})
      },
      ...(title.trim() ? { title: title.trim() } : {}),
      ...(timeStart && timeEnd ? { time_window: [timeStart, timeEnd] as [string, string] } : {})
    }),
    onSuccess: (response) => {
      void queryClient.invalidateQueries({ queryKey: ['reports'] });
      onCreated(response.report_id);
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

        <div className="report-generation-fields">
          <label>
            <span>{isChinese ? '被测软件版本' : 'Software/build version'}</span>
            <input
              type="text"
              required
              value={softwareVersion}
              onChange={(event) => onSoftwareVersionChange(event.target.value)}
            />
          </label>
          <label>
            <span>{isChinese ? '测试批次' : 'Test batch'}</span>
            <select
              required
              value={testVersion}
              onChange={(event) => setTestVersion(event.target.value)}
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
          </label>
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

        {!isExactSoftwareVersion(softwareVersion) ? (
          <p className="report-generation-message is-error" role="alert">
            {isChinese
              ? '请输入精确的软件版本或构建号；Live、Current、Latest 不能用于报告。'
              : 'Enter an exact software version or build; Live, Current, and Latest are not valid.'}
          </p>
        ) : !completeTimeWindow ? (
          <p className="report-generation-message is-error" role="alert">
            {isChinese ? '开始和结束时间必须同时填写。' : 'Start and end time must be provided together.'}
          </p>
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
              ? isChinese ? '正在创建…' : 'Creating…'
              : isChinese ? '创建并打开报告' : 'Create and open report'}
          </button>
        </footer>
      </section>
    </div>
  );
}
