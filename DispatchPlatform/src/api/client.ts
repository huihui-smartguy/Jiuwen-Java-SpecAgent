import type {
  ApiContext,
  Feature,
  NormalizedTaskStatus,
  Script,
  ScriptQuery,
  TaskCreateRequest,
  TaskCreateResponse,
  TaskStatusResponse
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

export function buildApiUrl(
  apiBaseUrl: string,
  path: string,
  params?: object
): string {
  const base = trimTrailingSlash(apiBaseUrl || '/api');
  const url = new URL(`${base}${path}`, 'http://local.test');

  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (typeof value === 'string' && value) {
      url.searchParams.set(key, value);
    }
  });

  return `${url.pathname}${url.search}`;
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
  return readJson<TaskCreateResponse>(response);
}

export async function getTaskStatus(
  context: ApiContext,
  taskId: string
): Promise<TaskStatusResponse> {
  const response = await fetch(buildApiUrl(context.apiBaseUrl, `/tasks/${taskId}`), {
    headers: { Accept: 'application/json' }
  });
  return readJson<TaskStatusResponse>(response);
}

export function normalizeTaskStatus(response: TaskStatusResponse): NormalizedTaskStatus {
  const isTerminal = response.status === 'success' || response.status === 'failed';
  const logDownloadUrl = response.logs?.download_url;

  return {
    ...response,
    uiStatus: response.status,
    isTerminal,
    canExportLogs: Boolean(isTerminal && logDownloadUrl),
    logDownloadUrl
  };
}
