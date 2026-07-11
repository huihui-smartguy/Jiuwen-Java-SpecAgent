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

export interface TaskCreateRequest {
  product?: string;
  scene?: string;
  feature?: string;
  level?: string;
  script_name?: string[];
}

export type TriggerType = 'feature' | 'level' | 'scripts';

export interface TaskCreateResponse {
  success: boolean;
  task_id: string;
  status: 'pending';
  trigger_type: TriggerType;
  message: string;
  created_at?: string;
  estimated_duration?: string;
}

export type TaskStatus = 'pending' | 'running' | 'success' | 'failed';
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

export interface TaskStatusResponse {
  success: boolean;
  task_id: string;
  status: TaskStatus;
  trigger_type: TriggerType;
  progress?: TaskProgress;
  result?: TaskResult;
  logs?: TaskLogs;
  started_at?: string;
  completed_at?: string;
  elapsed_time?: string;
  estimated_remaining?: string;
}

export interface NormalizedTaskStatus extends TaskStatusResponse {
  uiStatus: UiTaskStatus;
  isTerminal: boolean;
  canExportLogs: boolean;
  logDownloadUrl?: string;
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
