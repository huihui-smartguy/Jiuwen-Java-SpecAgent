import type {
  ApiContext,
  Feature,
  NormalizedTaskStatus,
  Script,
  ScriptQuery,
  BackendTaskStatus,
  TaskCancelResponse,
  TaskCreateRequest,
  TaskCreateResponse,
  TaskStatus,
  TaskStatusResponse,
  TaskLogEntry,
  TaskLogLevel,
  TaskLogSnapshot,
  TaskLogsWireResponse,
  TaskListQuery,
  TaskListResponse,
  TaskListWireResponse,
  TaskListWireTask,
  TaskListTask,
  TriggerType,
  CreateReportRequest,
  CreateReportResponse,
  DeleteReportResponse,
  ReportDetailResponse,
  ReportDetail,
  ReportDownloadFormat,
  ReportListItem,
  ReportListQuery,
  ReportListResponse,
  StatisticsFilters,
  StatisticsSummaryResponse,
  TaskScriptStatusResponse,
  TestVersionResponse
} from '../types';

interface FeatureResponse {
  success: boolean;
  product: string;
  scene: string;
  features: Feature[];
  total: number;
}

interface ScriptResponse {
  success: boolean;
  scripts: Script[];
  total: number;
  filters?: Record<string, string | null>;
}

type ReportListItemWire = Omit<ReportListItem, 'software_version'> & {
  software_version?: string;
  test_version?: string;
};

type ReportDetailWire = Omit<ReportDetail, 'software_version'> & {
  software_version?: string;
  test_version?: string;
};

interface ReportListResponseWire {
  success: boolean;
  total: number;
  reports: ReportListItemWire[];
}

interface ReportDetailResponseWire {
  success: boolean;
  report: ReportDetailWire;
}

interface LiveTaskCreateResponse {
  success: boolean;
  task_id: string;
  status: BackendTaskStatus;
  message: string;
  queue_position?: number;
  total_scripts?: number;
  created_at?: string;
  estimated_duration?: string;
  version?: string;
}

interface LiveTask {
  id?: string;
  task_id?: string;
  status: BackendTaskStatus;
  progress?: number;
  total_scripts?: number;
  executed_scripts?: number;
  failed_scripts?: number;
  queue_position?: number;
  started_at?: string;
  completed_at?: string;
  log_dir?: string;
  download_url?: string;
  error_message?: string;
  version?: string;
}

interface LiveTaskStatusEnvelope {
  success: boolean;
  task: LiveTask;
}

const backendTaskStatuses = new Set<BackendTaskStatus>([
  'queued',
  'pending',
  'running',
  'completed',
  'failed',
  'cancelled'
]);

export class ApiError extends Error {
  readonly code?: string;
  readonly status?: number;
  readonly details?: unknown;

  constructor(message: string, options?: { code?: string; status?: number; details?: unknown }) {
    super(message);
    this.name = 'ApiError';
    this.code = options?.code;
    this.status = options?.status;
    this.details = options?.details;
  }
}

export class ReportOutcomeUnknownError extends ApiError {
  constructor(details?: unknown) {
    super('Report generation outcome is unknown. Verify the persisted report list before retrying.', {
      code: 'REPORT_OUTCOME_UNKNOWN',
      details
    });
    this.name = 'ReportOutcomeUnknownError';
  }
}

const REPORT_GENERATION_TIMEOUT_MS = 195_000;
const REPORT_SCAN_PAGE_SIZE = 200;
const REPORT_SCAN_PAGE_LIMIT = 1_000;

function trimTrailingSlash(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

function isAbsoluteHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

export function buildApiUrl(
  apiBaseUrl: string,
  path: string,
  params?: object
): string {
  const base = trimTrailingSlash(apiBaseUrl || '/api');
  const url = new URL(`${base}${path}`, 'http://local.test');

  Object.entries(params ?? {}).forEach(([key, value]) => {
    if ((typeof value === 'string' && value) || (typeof value === 'number' && Number.isFinite(value))) {
      url.searchParams.set(key, String(value));
    }
  });

  return isAbsoluteHttpUrl(base) ? url.toString() : `${url.pathname}${url.search}`;
}

async function readJson<T>(response: Response): Promise<T> {
  const body = (await response.json()) as T & {
    success?: boolean;
    message?: string;
    error_code?: string;
    details?: unknown;
  };

  if (!response.ok || body.success === false) {
    throw new ApiError(body.message ?? 'Request failed', {
      code: body.error_code,
      status: response.status,
      details: body.details
    });
  }

  return body;
}

export async function getFeatures(
  context: ApiContext,
  product: string,
  scene: string
): Promise<FeatureResponse> {
  const response = await fetch(buildApiUrl(context.apiBaseUrl, '/features', { product, scene }), {
    headers: { Accept: 'application/json' }
  });
  return readJson<FeatureResponse>(response);
}

export async function getScripts(
  context: ApiContext,
  query: ScriptQuery
): Promise<ScriptResponse> {
  const response = await fetch(buildApiUrl(context.apiBaseUrl, '/scripts', query), {
    headers: { Accept: 'application/json' }
  });
  return readJson<ScriptResponse>(response);
}

export async function getScriptsForFeatures(
  context: ApiContext,
  target: Pick<ScriptQuery, 'product' | 'scene'>,
  featureNames: readonly string[]
): Promise<ScriptResponse> {
  if (!featureNames.length) {
    return {
      success: true,
      scripts: [],
      total: 0,
      filters: { product: target.product, scene: target.scene }
    };
  }

  const responses = await Promise.all(featureNames.map((feature) => getScripts(context, {
    product: target.product,
    scene: target.scene,
    feature
  })));
  const scripts: Script[] = [];
  const seen = new Set<string>();

  for (const response of responses) {
    for (const script of response.scripts) {
      const identity = script.id || script.path || `${script.product}:${script.scene}:${script.feature}:${script.name}`;
      if (seen.has(identity)) {
        continue;
      }
      seen.add(identity);
      scripts.push(script);
    }
  }

  return {
    success: true,
    scripts,
    total: scripts.length,
    filters: { product: target.product, scene: target.scene }
  };
}

export async function getScriptsForScene(
  context: ApiContext,
  product: string,
  scene: string
): Promise<ScriptResponse> {
  const features = await getFeatures(context, product, scene);
  return getScriptsForFeatures(
    context,
    { product, scene },
    features.features.map((feature) => feature.name)
  );
}

export async function getVersions(context: ApiContext): Promise<TestVersionResponse> {
  const response = await fetch(buildApiUrl(context.apiBaseUrl, '/versions'), {
    headers: { Accept: 'application/json' }
  });
  return readJson<TestVersionResponse>(response);
}

export async function getStatisticsSummary(
  context: ApiContext,
  filters: StatisticsFilters = {}
): Promise<StatisticsSummaryResponse> {
  const response = await fetch(buildApiUrl(context.apiBaseUrl, '/statistics/summary', filters), {
    headers: { Accept: 'application/json' }
  });
  return readJson<StatisticsSummaryResponse>(response);
}

export async function getTaskScriptStatus(
  context: ApiContext,
  taskId: string
): Promise<TaskScriptStatusResponse> {
  const response = await fetch(buildApiUrl(context.apiBaseUrl, `/tasks/${taskId}/script-status`), {
    headers: { Accept: 'application/json' }
  });
  return readJson<TaskScriptStatusResponse>(response);
}

export async function createReport(
  context: ApiContext,
  payload: CreateReportRequest,
  options: { timeoutMs?: number } = {}
): Promise<CreateReportResponse> {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? REPORT_GENERATION_TIMEOUT_MS
  );

  try {
    const response = await fetch(buildApiUrl(context.apiBaseUrl, '/reports'), {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      signal: controller.signal,
      body: JSON.stringify({
        ...payload,
        // v1 compatibility alias. It is deliberately identical, never a second UI dimension.
        test_version: payload.software_version
      })
    });
    return await readJson<CreateReportResponse>(response);
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ReportOutcomeUnknownError(error);
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

async function scanExactReports(
  context: ApiContext,
  query: ReportListQuery
): Promise<ReportListItem[]> {
  const exactReports: ReportListItem[] = [];
  const seenReportIds = new Set<string>();
  let backendOffset = 0;

  for (let page = 0; page < REPORT_SCAN_PAGE_LIMIT; page += 1) {
    const response = await fetch(buildApiUrl(context.apiBaseUrl, '/reports', {
      software_version: query.software_version,
      // Older report services require this alias; newer services safely ignore it.
      test_version: query.software_version,
      product: query.product,
      scene: query.scene,
      limit: REPORT_SCAN_PAGE_SIZE,
      offset: backendOffset
    }), {
      headers: { Accept: 'application/json' }
    });
    const body = await readJson<ReportListResponseWire>(response);

    if (!Array.isArray(body.reports) || !Number.isSafeInteger(body.total) || body.total < 0) {
      throw new ApiError('The report list response is malformed', {
        code: 'INVALID_REPORT_RESPONSE',
        status: response.status,
        details: body
      });
    }

    for (const wireReport of body.reports) {
      const report = normalizeReportListItem(wireReport, response.status);
      if (report.software_version !== query.software_version || seenReportIds.has(report.id)) {
        continue;
      }
      seenReportIds.add(report.id);
      exactReports.push(report);
    }

    if (!body.reports.length || backendOffset + body.reports.length >= body.total) {
      return exactReports;
    }
    backendOffset += body.reports.length;
  }

  throw new ApiError('The report list could not be reconciled safely', {
    code: 'REPORT_SCAN_LIMIT_EXCEEDED'
  });
}

export async function listAllReports(
  context: ApiContext,
  query: Omit<ReportListQuery, 'limit' | 'offset'>
): Promise<ReportListResponse> {
  const reports = await scanExactReports(context, query);
  return { success: true, total: reports.length, reports };
}

export async function listReports(
  context: ApiContext,
  query: ReportListQuery
): Promise<ReportListResponse> {
  const reports = await scanExactReports(context, query);
  const offset = Math.max(0, query.offset ?? 0);
  const limit = Math.max(1, query.limit ?? 20);
  return {
    success: true,
    total: reports.length,
    reports: reports.slice(offset, offset + limit)
  };
}

export async function getReport(
  context: ApiContext,
  reportId: string
): Promise<ReportDetailResponse> {
  const response = await fetch(buildApiUrl(context.apiBaseUrl, `/reports/${reportId}`), {
    headers: { Accept: 'application/json' }
  });
  const body = await readJson<ReportDetailResponseWire>(response);
  return {
    success: body.success,
    report: normalizeReportDetail(body.report, response.status)
  };
}

function canonicalReportVersion(
  report: { software_version?: string; test_version?: string },
  status?: number
): string {
  const version = report.software_version?.trim() || report.test_version?.trim();
  if (!version) {
    throw new ApiError('The report response does not include a version', {
      code: 'INVALID_REPORT_RESPONSE',
      status,
      details: report
    });
  }
  return version;
}

function normalizeReportListItem(report: ReportListItemWire, status?: number): ReportListItem {
  return {
    ...report,
    software_version: canonicalReportVersion(report, status)
  };
}

function normalizeReportDetail(report: ReportDetailWire, status?: number): ReportDetail {
  return {
    ...report,
    software_version: canonicalReportVersion(report, status)
  };
}

export function getReportDownloadUrl(
  context: ApiContext,
  reportId: string,
  format: ReportDownloadFormat = 'html'
): string {
  return buildApiUrl(context.apiBaseUrl, `/reports/${reportId}/download`, { format });
}

export function resolvePublicDownloadUrl(
  context: ApiContext,
  downloadUrl: string
): string {
  if (!downloadUrl) {
    return downloadUrl;
  }
  if (!isAbsoluteHttpUrl(context.apiBaseUrl)) {
    return rebaseDownloadUrl(downloadUrl, context.apiBaseUrl) ?? downloadUrl;
  }
  if (isAbsoluteHttpUrl(downloadUrl)) {
    return downloadUrl;
  }

  const base = new URL(context.apiBaseUrl);
  const resolved = new URL(downloadUrl, base.origin);
  const apiPath = trimTrailingSlash(base.pathname);
  if (apiPath !== '/api' && resolved.pathname.startsWith('/api/')) {
    resolved.pathname = `${apiPath}${resolved.pathname.slice('/api'.length)}`;
  }
  return resolved.toString();
}

export async function deleteReport(
  context: ApiContext,
  reportId: string
): Promise<DeleteReportResponse> {
  const response = await fetch(buildApiUrl(context.apiBaseUrl, `/reports/${reportId}`), {
    method: 'DELETE',
    headers: { Accept: 'application/json' }
  });
  return readJson<DeleteReportResponse>(response);
}

export async function createTask(
  context: ApiContext,
  payload: TaskCreateRequest
): Promise<TaskCreateResponse> {
  const response = await fetch(buildApiUrl(context.apiBaseUrl, '/tasks'), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  const body = await readJson<LiveTaskCreateResponse>(response);

  return {
    success: body.success,
    task_id: body.task_id,
    status: mapBackendTaskStatus(body.status),
    trigger_type: triggerTypeForRequest(payload),
    message: body.message,
    created_at: body.created_at,
    estimated_duration: body.estimated_duration,
    backend_status: body.status,
    queue_position: body.queue_position,
    total_scripts: body.total_scripts,
    version: body.version ?? payload.version
  };
}

export async function cancelTask(
  context: ApiContext,
  taskId: string
): Promise<TaskCancelResponse> {
  const response = await fetch(buildApiUrl(context.apiBaseUrl, `/tasks/${taskId}`), {
    method: 'DELETE',
    headers: { Accept: 'application/json' }
  });
  return readJson<TaskCancelResponse>(response);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

function isTaskListWireTask(value: unknown): value is TaskListWireTask {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const task = value as Partial<TaskListWireTask>;
  return typeof task.task_id === 'string'
    && task.task_id.length > 0
    && typeof task.product === 'string'
    && typeof task.scene === 'string'
    && (task.feature === undefined || isNullableString(task.feature))
    && (task.execute_mode === undefined || isNullableString(task.execute_mode))
    && (task.version === undefined || isNullableString(task.version))
    && typeof task.status === 'string'
    && backendTaskStatuses.has(task.status as BackendTaskStatus)
    && typeof task.progress === 'number'
    && Number.isFinite(task.progress)
    && task.progress >= 0
    && task.progress <= 100
    && isNonNegativeInteger(task.total_scripts)
    && isNonNegativeInteger(task.executed_scripts)
    && isNonNegativeInteger(task.failed_scripts)
    && Number.isSafeInteger(task.queue_position)
    && typeof task.created_at === 'string'
    && isNullableString(task.started_at)
    && isNullableString(task.completed_at);
}

function normalizeTaskListTask(
  task: TaskListWireTask,
  sourceApiBaseUrl: string
): TaskListTask {
  // Keep this as an explicit allowlist. Detail-only fields such as logs, script IDs,
  // download URLs, and server filesystem paths must never leak into discovery state.
  return {
    task_id: task.task_id,
    product: task.product,
    scene: task.scene,
    ...(task.feature == null ? {} : { feature: task.feature }),
    ...(task.execute_mode == null ? {} : { execute_mode: task.execute_mode }),
    ...(task.version == null ? {} : { version: task.version }),
    status: task.status,
    progress: task.progress,
    total_scripts: task.total_scripts,
    executed_scripts: task.executed_scripts,
    failed_scripts: task.failed_scripts,
    queue_position: task.queue_position,
    created_at: task.created_at,
    started_at: task.started_at,
    completed_at: task.completed_at,
    sourceApiBaseUrl
  };
}

export async function listTasks(
  context: ApiContext,
  query: TaskListQuery = {}
): Promise<TaskListResponse> {
  const statuses = query.statuses?.join(',');
  const response = await fetch(buildApiUrl(context.apiBaseUrl, '/tasks', {
    product: query.product,
    scene: query.scene,
    status: statuses,
    limit: query.limit,
    offset: query.offset
  }), {
    headers: { Accept: 'application/json' }
  });
  const body = await readJson<TaskListWireResponse>(response);

  if (
    !Array.isArray(body.tasks)
    || !isNonNegativeInteger(body.total)
    || !isNonNegativeInteger(body.limit)
    || !isNonNegativeInteger(body.offset)
    || body.tasks.some((task) => !isTaskListWireTask(task))
  ) {
    throw new ApiError('The task list response is malformed', {
      code: 'INVALID_TASK_LIST_RESPONSE',
      status: response.status,
      details: body
    });
  }

  return {
    success: body.success,
    total: body.total,
    limit: body.limit,
    offset: body.offset,
    tasks: body.tasks.map((task) => normalizeTaskListTask(task, context.apiBaseUrl))
  };
}

export async function getTaskStatus(
  context: ApiContext,
  taskId: string,
  fallbackTriggerType: TriggerType = 'feature'
): Promise<TaskStatusResponse> {
  const response = await fetch(buildApiUrl(context.apiBaseUrl, `/tasks/${taskId}`), {
    headers: { Accept: 'application/json' }
  });
  const body = await readJson<LiveTaskStatusEnvelope | TaskStatusResponse>(response);

  if (isLiveTaskStatusEnvelope(body)) {
    return normalizeLiveTaskStatus(body, fallbackTriggerType, context.apiBaseUrl);
  }

  return rebaseTaskLogs(body, context.apiBaseUrl);
}

export async function getTaskLogs(
  context: ApiContext,
  taskId: string,
  viewUrl?: string
): Promise<TaskLogSnapshot> {
  const requestUrl = viewUrl
    ? resolveTaskLogViewUrl(viewUrl, context.apiBaseUrl)
    : buildApiUrl(context.apiBaseUrl, `/tasks/${taskId}/logs`);
  const response = await fetch(requestUrl, {
    headers: { Accept: 'application/json' }
  });
  const body = await readJson<TaskLogsWireResponse>(response);

  if (!isTaskLogsWireResponse(body)) {
    throw new ApiError('The task log response is malformed', {
      code: 'INVALID_LOG_RESPONSE',
      status: response.status,
      details: body
    });
  }

  const offset = Math.max(body.logs.length - 2000, 0);
  const entries = body.logs.slice(offset).map((entry, index): TaskLogEntry => ({
    id: `${entry.timestamp}:${offset + index}:${entry.level}`,
    timestamp: entry.timestamp,
    level: normalizeTaskLogLevel(entry.level),
    message: entry.message
  }));

  return {
    entries,
    cursor: String(body.total)
  };
}

function resolveTaskLogViewUrl(viewUrl: string, apiBaseUrl: string): string {
  if (!isAbsoluteHttpUrl(apiBaseUrl)) {
    return rebaseDownloadUrl(viewUrl, apiBaseUrl) ?? viewUrl;
  }

  if (isAbsoluteHttpUrl(viewUrl)) {
    return viewUrl;
  }

  const apiBase = new URL(apiBaseUrl);
  const resolved = new URL(viewUrl, `${trimTrailingSlash(apiBaseUrl)}/`);
  const apiPath = trimTrailingSlash(apiBase.pathname);
  if (viewUrl.startsWith('/') && apiPath !== '/api' && resolved.pathname.startsWith('/api/')) {
    resolved.pathname = `${apiPath}${resolved.pathname.slice('/api'.length)}`;
  }
  return resolved.toString();
}

export function normalizeTaskStatus(response: TaskStatusResponse): NormalizedTaskStatus {
  const isTerminal = response.status === 'success' || response.status === 'failed' || response.status === 'cancelled';
  const logDownloadUrl = response.logs?.download_url;

  return {
    ...response,
    uiStatus: response.status,
    isTerminal,
    canExportLogs: Boolean(isTerminal && logDownloadUrl),
    logDownloadUrl
  };
}

export function normalizeCreatedTask(response: TaskCreateResponse): NormalizedTaskStatus {
  return normalizeTaskStatus({
    success: response.success,
    task_id: response.task_id,
    status: response.status,
    trigger_type: response.trigger_type,
    backend_status: response.backend_status,
    queue_position: response.queue_position,
    total_scripts: response.total_scripts,
    progress: response.total_scripts === undefined
      ? undefined
      : {
          total_commands: response.total_scripts,
          completed: 0,
          failed: 0
        },
    started_at: response.created_at,
    estimated_remaining: response.estimated_duration,
    version: response.version
  });
}

function triggerTypeForRequest(payload: TaskCreateRequest): TriggerType {
  if ('script_name' in payload) {
    return 'scripts';
  }
  if ('level' in payload) {
    return 'level';
  }
  return 'feature' in payload ? 'feature' : 'scene';
}

function mapBackendTaskStatus(status: BackendTaskStatus): TaskStatus {
  switch (status) {
    case 'queued':
    case 'pending':
      return 'pending';
    case 'running':
      return 'running';
    case 'completed':
      return 'success';
    case 'cancelled':
      return 'cancelled';
    case 'failed':
      return 'failed';
  }
}

function normalizeLiveTaskStatus(
  response: LiveTaskStatusEnvelope,
  fallbackTriggerType: TriggerType,
  apiBaseUrl: string
): TaskStatusResponse {
  const task = response.task;
  const status = mapBackendTaskStatus(task.status);
  const totalCommands = task.total_scripts ?? 0;
  const completed = task.executed_scripts ?? 0;
  const failed = task.failed_scripts ?? 0;
  const isTerminal = status === 'success' || status === 'failed' || status === 'cancelled';
  const logs = task.log_dir || task.download_url
    ? {
        file_path: task.log_dir ?? '',
        download_url: rebaseDownloadUrl(task.download_url, apiBaseUrl)
      }
    : undefined;

  return {
    success: response.success,
    task_id: task.id ?? task.task_id ?? '',
    status,
    trigger_type: fallbackTriggerType,
    backend_status: task.status,
    queue_position: task.queue_position,
    total_scripts: task.total_scripts,
    progress: {
      total_commands: totalCommands,
      completed,
      failed
    },
    result: isTerminal
      ? {
          total_commands: totalCommands,
          success_count: Math.max(completed - failed, 0),
          failed_count: failed,
          error_message: task.error_message
        }
      : undefined,
    logs,
    started_at: task.started_at,
    completed_at: task.completed_at,
    version: task.version
  };
}

function rebaseDownloadUrl(downloadUrl: string | undefined, apiBaseUrl: string): string | undefined {
  if (!downloadUrl || isAbsoluteHttpUrl(apiBaseUrl)) {
    return downloadUrl;
  }

  const apiPath = new URL(trimTrailingSlash(apiBaseUrl || '/api'), 'http://local.test').pathname;
  const download = new URL(downloadUrl, 'http://local.test');

  if (apiPath === '/api' || !download.pathname.startsWith('/api/')) {
    return downloadUrl;
  }

  return `${apiPath}${download.pathname.slice('/api'.length)}${download.search}${download.hash}`;
}

function rebaseTaskLogs(response: TaskStatusResponse, apiBaseUrl: string): TaskStatusResponse {
  const downloadUrl = response.logs?.download_url;
  const rebasedDownloadUrl = rebaseDownloadUrl(downloadUrl, apiBaseUrl);

  if (!response.logs || !downloadUrl || rebasedDownloadUrl === downloadUrl) {
    return response;
  }

  return {
    ...response,
    logs: {
      ...response.logs,
      download_url: rebasedDownloadUrl
    }
  };
}

function normalizeTaskLogLevel(level: string): TaskLogLevel {
  switch (level.trim().toLowerCase()) {
    case 'debug':
      return 'debug';
    case 'info':
      return 'info';
    case 'warning':
    case 'warn':
      return 'warn';
    case 'error':
    case 'critical':
    case 'fatal':
      return 'error';
    case 'log':
      return 'log';
    default:
      return 'log';
  }
}

function isTaskLogsWireResponse(value: unknown): value is TaskLogsWireResponse {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<TaskLogsWireResponse>;
  return candidate.success === true
    && Array.isArray(candidate.logs)
    && Number.isSafeInteger(candidate.total)
    && (candidate.total ?? -1) >= 0
    && candidate.total === candidate.logs.length
    && candidate.logs.every((entry) => Boolean(entry)
      && typeof entry.timestamp === 'string'
      && typeof entry.level === 'string'
      && typeof entry.message === 'string');
}

function isLiveTaskStatusEnvelope(
  response: LiveTaskStatusEnvelope | TaskStatusResponse
): response is LiveTaskStatusEnvelope {
  return 'task' in response && Boolean(response.task);
}
