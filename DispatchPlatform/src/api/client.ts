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
  TriggerType,
  CreateReportRequest,
  CreateReportResponse,
  DeleteReportResponse,
  ReportDetailResponse,
  ReportDownloadFormat,
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
  payload: CreateReportRequest
): Promise<CreateReportResponse> {
  const response = await fetch(buildApiUrl(context.apiBaseUrl, '/reports'), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  return readJson<CreateReportResponse>(response);
}

export async function listReports(
  context: ApiContext,
  query: ReportListQuery
): Promise<ReportListResponse> {
  const response = await fetch(buildApiUrl(context.apiBaseUrl, '/reports', query), {
    headers: { Accept: 'application/json' }
  });
  return readJson<ReportListResponse>(response);
}

export async function getReport(
  context: ApiContext,
  reportId: string
): Promise<ReportDetailResponse> {
  const response = await fetch(buildApiUrl(context.apiBaseUrl, `/reports/${reportId}`), {
    headers: { Accept: 'application/json' }
  });
  return readJson<ReportDetailResponse>(response);
}

export function getReportDownloadUrl(
  context: ApiContext,
  reportId: string,
  format: ReportDownloadFormat = 'html'
): string {
  return buildApiUrl(context.apiBaseUrl, `/reports/${reportId}/download`, { format });
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
    version: body.version
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
