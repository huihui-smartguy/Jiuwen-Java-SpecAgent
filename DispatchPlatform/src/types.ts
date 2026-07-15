export type Language = 'zh' | 'en';

export type DeploymentMode = 'process' | 'container';

export type SutHealth = 'healthy' | 'degraded' | 'offline';

export interface AuthConfig {
  profileUrl?: string;
  loginUrl: string;
  registerUrl: string;
  logoutUrl?: string;
}

export interface AuthUser {
  id: string;
  displayName: string;
  email?: string;
  organization?: string;
  role?: string;
  avatarUrl?: string;
}

export type SessionState =
  | { kind: 'signed_in'; user: AuthUser }
  | { kind: 'signed_out' }
  | { kind: 'unavailable' };

export interface SutTarget {
  id: string;
  name: string;
  product: string;
  scene: string;
  version: string;
  apiBaseUrl: string;
  status: SutHealth;
}

export interface RuntimeConfig {
  apiBaseUrl: string;
  deploymentMode: DeploymentMode;
  defaultLanguage: Language;
  enableMockFallback: boolean;
  sutTargets: SutTarget[];
  auth?: AuthConfig;
}

export interface Feature {
  id: string;
  name: string;
  type: string;
}

export interface Script {
  id: string;
  name: string;
  filename: string;
  extension: string;
  product: string;
  scene: string;
  feature: string;
  level: string;
  size: number;
  uploaded_at?: string;
  uploaded_by?: string;
  path: string;
}

export type TriggerType = 'feature' | 'level' | 'scripts' | 'scene';

interface TaskCreateBase {
  product: string;
  scene: string;
  version?: string;
}

export type TaskCreateRequest =
  | (TaskCreateBase & {
      feature: string;
      level?: never;
      script_name?: never;
    })
  | (TaskCreateBase & {
      level: string;
      feature?: never;
      script_name?: never;
    })
  | (TaskCreateBase & {
      feature: string;
      script_name: string[];
      level?: never;
    })
  | (TaskCreateBase & {
      feature?: never;
      level?: never;
      script_name?: never;
    });

export type BackendTaskStatus =
  | 'queued'
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface TaskCreateResponse {
  success: boolean;
  task_id: string;
  status: TaskStatus;
  trigger_type: TriggerType;
  message: string;
  created_at?: string;
  estimated_duration?: string;
  backend_status?: BackendTaskStatus;
  queue_position?: number;
  total_scripts?: number;
  version?: string;
}

export interface TaskCancelResponse {
  success: boolean;
  task_id: string;
  message: string;
  previous_status?: BackendTaskStatus;
  current_status?: BackendTaskStatus;
}

export type TaskStatus = 'pending' | 'running' | 'success' | 'failed' | 'cancelled';
export type UiTaskStatus = TaskStatus | 'polling_error';

export interface TaskProgress {
  total_commands: number;
  completed: number;
  failed: number;
  current_command?: string;
}

export interface TaskResult {
  total_commands: number;
  success_count: number;
  failed_count: number;
  error_message?: string;
}

export interface TaskLogs {
  file_path: string;
  download_url?: string;
  view_url?: string;
}

export type TaskLogLevel = 'debug' | 'info' | 'warn' | 'error' | 'log';

export interface TaskLogEntry {
  id: string;
  timestamp?: string;
  level: TaskLogLevel;
  message: string;
}

export interface TaskLogSnapshot {
  entries: TaskLogEntry[];
  cursor?: string;
}

/** Exact wire shape observed from GET /api/tasks/{task_id}/logs on 2026-07-13. */
export interface TaskLogsWireEntry {
  timestamp: string;
  level: string;
  message: string;
}

export interface TaskLogsWireResponse {
  success: boolean;
  total: number;
  logs: TaskLogsWireEntry[];
}

export interface TaskStatusResponse {
  success: boolean;
  task_id: string;
  status: TaskStatus;
  trigger_type: TriggerType;
  backend_status?: BackendTaskStatus;
  queue_position?: number;
  total_scripts?: number;
  progress?: TaskProgress;
  result?: TaskResult;
  logs?: TaskLogs;
  started_at?: string;
  completed_at?: string;
  elapsed_time?: string;
  estimated_remaining?: string;
  version?: string;
}

export interface NormalizedTaskStatus extends TaskStatusResponse {
  uiStatus: UiTaskStatus;
  isTerminal: boolean;
  canExportLogs: boolean;
  logDownloadUrl?: string;
  /** Immutable Object snapshot used to keep task-scoped requests on their originating API. */
  sourceSut?: SutTarget;
}

export interface ApiContext {
  apiBaseUrl: string;
}

export interface ScriptQuery {
  product: string;
  scene: string;
  feature?: string;
  level?: string;
}

export interface TestVersion {
  code: string;
  name: string;
  description: string;
  created_at: string;
  is_default: boolean;
}

export interface TestVersionResponse {
  success: boolean;
  default_version: string;
  versions: TestVersion[];
}

export interface StatisticsFilters {
  product?: string;
  scene?: string;
}

export interface StatisticsSummary {
  total_scripts: number;
  executed_scripts: number;
  unexecuted_scripts: number;
  pass_count: number;
  failed_count: number;
  running_count: number;
  pass_rate: string;
  execution_rate: string;
}

export interface StatisticsBreakdown {
  product: string;
  scene: string;
  feature: string;
  total_scripts: number;
  executed: number;
  unexecuted: number;
  pass: number;
  failed: number;
  running: number;
}

export interface StatisticsSummaryResponse {
  success: boolean;
  message: string;
  data: {
    summary: StatisticsSummary;
    breakdown: StatisticsBreakdown[];
    filters: { product: string | null; scene: string | null };
  };
}

export type TaskScriptExecutionStatus = 'todo' | 'pass' | 'failed' | 'running';

export interface TaskScriptStatus {
  script_id: string;
  script_name: string;
  version: string;
  status: TaskScriptExecutionStatus;
  started_at: string | null;
  completed_at: string | null;
  duration_seconds: number | null;
  error_message: string | null;
}

export interface TaskScriptStatusResponse {
  success: boolean;
  task_id: string;
  scripts_status: TaskScriptStatus[];
  summary: {
    todo_count: number;
    pass_count: number;
    failed_count: number;
    running_count: number;
  };
}

export interface ReportFeatureScope {
  name: string;
  feature_version?: string;
}

export interface ReportScope {
  product: string;
  scenes: string[];
  features?: Array<string | ReportFeatureScope>;
  levels?: string[];
}

export interface CreateReportRequest {
  test_version: string;
  software_version: string;
  scope: ReportScope;
  title?: string;
  time_window?: [string, string] | null;
  created_by?: string;
}

export interface CreateReportResponse {
  success: boolean;
  report_id: string;
}

export interface ReportFeatureSummary {
  feature: string;
  total: number;
  pass: number;
  failed: number;
  skipped: number;
  running?: number;
  success_rate: number;
}

export interface ReportSummary {
  total: number;
  pass: number;
  failed: number;
  skipped: number;
  running?: number;
  success_rate: number;
  total_duration_seconds: number;
  by_feature?: ReportFeatureSummary[];
}

export interface ReportGate {
  name: string;
  required: string;
  actual: string;
  passed: boolean;
}

export interface ReportConclusion {
  passed: boolean;
  verdict: string;
  reason: string;
  gates?: ReportGate[];
}

export interface ReportRisk {
  level: 'high' | 'medium' | 'low' | string;
  category: string;
  title: string;
  count: number;
  evidence: string[];
  recommendation: string;
}

export interface ReportEnvironment {
  test_version?: string;
  execute_mode?: string;
  env_vars?: Record<string, string>;
  sut?: {
    software_version?: string;
    base_url?: string;
    server_info?: string;
  };
  test_runner?: {
    os?: string;
    python_version?: string;
    pytest_version?: string;
    exec_host?: string;
  };
}

export type ReportResultStatus = 'pass' | 'failed' | 'skipped' | 'running' | string;

export interface ReportResultRow {
  script_id: string;
  filename: string;
  level: string;
  scene: string;
  feature: string;
  execute_mode: string;
  status: ReportResultStatus;
  pytest_status?: string;
  duration_seconds: number | null;
  started_at: string | null;
  completed_at: string | null;
  error_message?: string | null;
  failure_detail?: string | null;
  failure_source?: string | null;
  log_file?: string | null;
  log_download_url?: string | null;
  task_id?: string;
}

export interface ReportListItem {
  id: string;
  title: string;
  software_version: string;
  test_version: string;
  summary: ReportSummary;
  conclusion: ReportConclusion;
  created_at: string;
  created_by: string;
}

export interface ReportDetail extends ReportListItem {
  scope: ReportScope;
  environment: ReportEnvironment;
  risks: ReportRisk[];
  result_data: ReportResultRow[];
  time_start?: string | null;
  time_end?: string | null;
}

export interface ReportListQuery {
  software_version: string;
  test_version?: string;
  limit?: number;
  offset?: number;
}

export interface ReportListResponse {
  success: boolean;
  total: number;
  reports: ReportListItem[];
}

export interface ReportDetailResponse {
  success: boolean;
  report: ReportDetail;
}

export interface DeleteReportResponse {
  success: boolean;
  message: string;
}

export type ReportDownloadFormat = 'md' | 'html';
