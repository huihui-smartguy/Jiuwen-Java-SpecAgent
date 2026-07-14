import { normalizeTaskStatus } from '../api/client';
import type {
  Feature,
  NormalizedTaskStatus,
  Script,
  TaskLogEntry,
  TaskStatusResponse
} from '../types';

export const mockFeatures: Feature[] = [
  { id: 'feature-api-keys', name: 'API 密钥管理', type: 'L1' },
  { id: 'feature-auth', name: '用户权限', type: 'L2' },
  { id: 'feature-session', name: '会话管理', type: 'L1' },
  { id: 'feature-scenario', name: '场景自动化', type: 'L3' }
];

export const mockScripts: Script[] = [
  {
    id: 'script-ak006',
    name: 'test_ak006_list_api_keys',
    filename: 'test_ak006_list_api_keys.py',
    extension: '.py',
    product: '高码java',
    scene: '场景',
    feature: 'API 密钥管理',
    level: 'L1',
    size: 1948,
    uploaded_at: '2026-07-14T10:36:00+08:00',
    uploaded_by: 'huihui',
    path: 'api/keys/list.py'
  },
  {
    id: 'script-ak007',
    name: 'test_ak007_create_key',
    filename: 'test_ak007_create_key.py',
    extension: '.py',
    product: '高码java',
    scene: '场景',
    feature: 'API 密钥管理',
    level: 'L1',
    size: 2076,
    uploaded_at: '2026-07-14T10:31:00+08:00',
    uploaded_by: 'huihui',
    path: 'api/keys/create.py'
  },
  {
    id: 'script-auth021',
    name: 'test_auth021_role_scope',
    filename: 'test_auth021_role_scope.py',
    extension: '.py',
    product: '高码java',
    scene: '场景',
    feature: '用户权限',
    level: 'L2',
    size: 1812,
    uploaded_at: '2026-07-13T16:22:00+08:00',
    uploaded_by: 'liuming',
    path: 'auth/role/scope.py'
  },
  {
    id: 'script-session013',
    name: 'test_session013_expire',
    filename: 'test_session013_expire.py',
    extension: '.py',
    product: '高码java',
    scene: '场景',
    feature: '会话管理',
    level: 'L1',
    size: 1634,
    uploaded_at: '2026-07-12T14:09:00+08:00',
    uploaded_by: 'wangqi',
    path: 'session/expire.py'
  },
  {
    id: 'script-web088',
    name: 'test_web088_save_flow',
    filename: 'test_web088_save_flow.py',
    extension: '.py',
    product: '高码java',
    scene: '场景',
    feature: '场景自动化',
    level: 'L3',
    size: 2840,
    uploaded_at: '2026-07-11T11:45:00+08:00',
    uploaded_by: 'chenyu',
    path: 'web/save/flow.py'
  }
];

const runningTask: TaskStatusResponse = {
  success: true,
  task_id: 'task_20260710_143000_abc123',
  status: 'running',
  trigger_type: 'feature',
  progress: {
    total_commands: 5,
    completed: 2,
    failed: 0,
    current_command: '执行命令: pytest testcase/save'
  },
  started_at: '2026-07-10T14:30:01',
  elapsed_time: '15秒',
  estimated_remaining: '未知'
};

export const activeTask: NormalizedTaskStatus = normalizeTaskStatus(runningTask);

export const completedTask: NormalizedTaskStatus = normalizeTaskStatus({
  ...runningTask,
  task_id: 'task_20260710_140000_done',
  status: 'success',
  result: {
    total_commands: 5,
    success_count: 5,
    failed_count: 0
  },
  logs: {
    file_path: 'logs/pipeline_高码java_场景_test_20260710_143000.log',
    download_url: '/api/tasks/task_20260710_140000_done/logs/download',
    view_url: '/api/tasks/task_20260710_140000_done/logs'
  },
  completed_at: '2026-07-10T14:35:30',
  elapsed_time: '5分29秒'
});

export const mockObservationEvents: readonly TaskLogEntry[] = [
  {
    id: 'observe-sample-environment',
    timestamp: '14:30:02',
    level: 'info',
    message: '✓ Environment validation passed'
  },
  {
    id: 'observe-sample-scripts',
    timestamp: '14:30:14',
    level: 'info',
    message: '✓ 18 scripts resolved from feature scope'
  },
  {
    id: 'observe-sample-command',
    timestamp: '14:30:42',
    level: 'info',
    message: '› Running command 2 of 5'
  },
  {
    id: 'observe-sample-command-detail',
    timestamp: undefined,
    level: 'debug',
    message: 'pytest testcase/save'
  },
  {
    id: 'observe-sample-transition',
    timestamp: '14:31:58',
    level: 'log',
    message: '• Waiting for backend task transition'
  }
];

export const activity = [
  'EXEC-2041 created from 保存接口 feature',
  'EXEC-2039 completed and report summary generated',
  'Logs exported for EXEC-2036',
  'SUT 营销系统 Java SUT health checked'
];
