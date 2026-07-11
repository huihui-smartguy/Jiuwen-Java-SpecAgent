import { normalizeTaskStatus } from '../api/client';
import type { Feature, NormalizedTaskStatus, Script, TaskStatusResponse } from '../types';

export const mockFeatures: Feature[] = [
  { id: 'feature-save', name: '保存接口', type: 'L0' },
  { id: 'feature-query', name: '查询接口', type: 'L0' },
  { id: 'feature-performance', name: '基线性能', type: 'L1' },
  { id: 'feature-workflow', name: '释放-加载端到端', type: 'L0' }
];

export const mockScripts: Script[] = [
  {
    id: 'script-save',
    name: 'tc_save_inmemory',
    filename: 'tc_save_inmemory.py',
    extension: '.py',
    product: '高码java',
    scene: '场景',
    feature: '保存接口',
    level: 'L0',
    size: 2048,
    uploaded_at: '2026-07-10T10:30:00',
    uploaded_by: 'asset-admin',
    path: 'testcase/场景/保存接口/tc_save_inmemory.py'
  },
  {
    id: 'script-query',
    name: 'tc_query_checkpoint',
    filename: 'tc_query_checkpoint.py',
    extension: '.py',
    product: '高码java',
    scene: '场景',
    feature: '查询接口',
    level: 'L0',
    size: 1840,
    uploaded_at: '2026-07-10T11:00:00',
    uploaded_by: 'asset-admin',
    path: 'testcase/场景/查询接口/tc_query_checkpoint.py'
  },
  {
    id: 'script-perf',
    name: 'tc_perf_baseline',
    filename: 'tc_perf_baseline.py',
    extension: '.py',
    product: '高码java',
    scene: '场景',
    feature: '基线性能',
    level: 'L1',
    size: 3120,
    uploaded_at: '2026-07-10T12:00:00',
    uploaded_by: 'perf-owner',
    path: 'testcase/场景/基线性能/tc_perf_baseline.py'
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

export const activity = [
  'EXEC-2041 created from 保存接口 feature',
  'EXEC-2039 completed and report summary generated',
  'Logs exported for EXEC-2036',
  'SUT 营销系统 Java SUT health checked'
];
