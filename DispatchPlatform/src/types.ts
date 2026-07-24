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

export interface CatalogFeature extends Feature {
  script_count: number;
  scripts: Script[];
}

export interface CatalogObject {
  id: string;
  product: string;
  scene: string;
  feature_count: number;
  script_count: number;
  latest_changed_at?: string;
  features: CatalogFeature[];
}

export interface CatalogTotals {
  products: number;
  objects: number;
  features: number;
  scripts: number;
}

export interface CatalogSnapshot {
  success: true;
  revision: string;
  generated_at: string;
  products: string[];
  objects: CatalogObject[];
  totals: CatalogTotals;
}

export interface CatalogSutTarget extends SutTarget {
  catalogObjectId: string;
  catalogRevision: string;
  featureCount: number;
  scriptCount: number;
  latestChangedAt?: string;
}

export type TriggerType = 'feature' | 'level' | 'scripts' | 'scene';

interface TaskCreateBase {
  product: string;
  scene: string;
  version?: string;
  catalog_revision?: string;
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
      script_ids?: string[];
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

export type ActiveBackendTaskStatus = Extract<
  BackendTaskStatus,
  'queued' | 'pending' | 'running'
>;

/** Safe allowlisted task summary returned by GET /api/tasks. */
export interface TaskListWireTask {
  task_id: string;
  product: string;
  scene: string;
  feature?: string | null;
  execute_mode?: string | null;
  version?: string | null;
  status: BackendTaskStatus;
  progress: number;
  total_scripts: number;
  executed_scripts: number;
  failed_scripts: number;
  queue_position: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface TaskListWireResponse {
  success: boolean;
  total: number;
  limit: number;
  offset: number;
  tasks: TaskListWireTask[];
}

/** A task summary pinned to the backend that supplied it. */
export interface TaskListTask extends Omit<
  TaskListWireTask,
  'feature' | 'execute_mode' | 'version'
> {
  feature?: string;
  execute_mode?: string;
  version?: string;
  sourceApiBaseUrl: string;
}

export interface TaskListResponse
  extends Omit<TaskListWireResponse, 'tasks'> {
  tasks: TaskListTask[];
}

export interface TaskListQuery {
  product?: string;
  scene?: string;
  statuses?: readonly BackendTaskStatus[];
  limit?: number;
  offset?: number;
}

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
  catalog_revision?: string;
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

export type OverviewQualityDataStatus = 'authoritative' | 'modeled' | 'partial';

export interface OverviewQualityVersion {
  version: string;
  label: string;
  data_status: OverviewQualityDataStatus;
  is_default: boolean;
  generated_at: string;
}

export interface OverviewQualityVersionsResponse {
  success: true;
  schema_version: '1.0';
  revision: string;
  generated_at: string;
  product: {
    key: string;
    label: string;
  };
  versions: OverviewQualityVersion[];
}

export interface OverviewQualityScoreInputs {
  population_scope: 'approved_version_quality_assessment';
  pass_rate: number;
  issue_resolution_rate: number;
  critical_issue_ratio: number;
  weights: {
    pass_rate: number;
    issue_resolution_rate: number;
    non_critical_ratio: number;
  };
}

export interface OverviewQualityCore {
  total_case_count: number;
  passed_case_count: number;
  non_passed_case_count: number;
  pass_rate: number;
  quality_score: number;
  score_formula_version: string;
  score_inputs: OverviewQualityScoreInputs;
}

export interface OverviewFeatureQuality {
  feature_key: string;
  label_zh: string;
  label_en: string;
  execution_script_count: number;
  issues_found_total: number;
  critical_issue_count: number;
  critical_issue_ratio: number | null;
  resolved_issue_count: number;
  issue_resolution_rate: number | null;
}

export interface OverviewQualityCoverage {
  status: 'complete' | 'partial';
  source_type: 'quality_snapshot' | 'modeled_snapshot';
  feature_issue_count_total: number;
  unmapped_issue_count: number | null;
}

export interface OverviewQualityResponse {
  success: true;
  schema_version: '1.0';
  revision: string;
  generated_at: string;
  data_status: OverviewQualityDataStatus;
  filters: {
    product: string;
    version: string;
    dimension: 'basic_function';
  };
  core: OverviewQualityCore;
  features: OverviewFeatureQuality[];
  coverage: OverviewQualityCoverage;
}

export interface OverviewQualityEvent {
  event: 'quality.ready' | 'quality.changed';
  revision: string;
  generated_at: string;
  product: string;
  versions: string[];
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

export type StatisticsFilters =
  | { product?: never; scene?: never }
  | { product: string; scene?: string };

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
export type TaskScriptActualStatus = 'PASSED' | 'FAILED' | 'SKIPPED' | 'ERROR';

export interface TaskScriptStatus {
  script_id: string;
  script_name: string;
  version: string;
  status: TaskScriptExecutionStatus;
  started_at: string | null;
  completed_at: string | null;
  duration_seconds: number | null;
  error_message: string | null;
  /** Raw pytest status exposed separately from the lowercase display status. */
  actual_status?: TaskScriptActualStatus | null;
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
    actual_status_distribution?: Record<TaskScriptActualStatus, number>;
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
  /** Registered scripts in the persisted scope; distinct from summary.total executions. */
  total_scripts?: number | null;
}

export interface CreateReportRequest {
  /** Canonical execution/report version. The API client supplies a same-value v1 alias on the wire. */
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
  level: 'high' | 'medium' | 'low';
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

export type ReportResultStatus = 'pass' | 'failed' | 'skipped' | 'running';

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
  /** Legacy v1 field. New report responses intentionally omit it. */
  test_version?: string;
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
  product?: string;
  scene?: string;
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
