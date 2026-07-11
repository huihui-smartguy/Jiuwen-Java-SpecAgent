import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { LogExportPanel } from './LogExportPanel';
import type { NormalizedTaskStatus } from '../types';

const runningTask: NormalizedTaskStatus = {
  success: true,
  task_id: 'task_1',
  status: 'running',
  uiStatus: 'running',
  trigger_type: 'feature',
  isTerminal: false,
  canExportLogs: false,
  progress: {
    completed: 2,
    failed: 0,
    total_commands: 5,
    current_command: '执行命令: pytest testcase/save'
  }
};

const completedTask: NormalizedTaskStatus = {
  ...runningTask,
  status: 'success',
  uiStatus: 'success',
  isTerminal: true,
  canExportLogs: true,
  logDownloadUrl: '/api/tasks/task_1/logs/download',
  logs: {
    file_path: 'logs/pipeline_20260710.log',
    download_url: '/api/tasks/task_1/logs/download'
  }
};

describe('LogExportPanel', () => {
  test('keeps log export disabled while execution is running', () => {
    render(<LogExportPanel task={runningTask} language="en" />);

    expect(screen.getByRole('link', { name: /export logs/i })).toHaveAttribute(
      'aria-disabled',
      'true'
    );
  });

  test('enables log export only after a terminal state exposes download_url', () => {
    render(<LogExportPanel task={completedTask} language="en" />);

    const link = screen.getByRole('link', { name: /export logs/i });
    expect(link).toHaveAttribute('href', '/api/tasks/task_1/logs/download');
    expect(link).not.toHaveAttribute('aria-disabled', 'true');
  });
});
