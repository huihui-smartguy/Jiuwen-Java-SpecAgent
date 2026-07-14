import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import type { NormalizedTaskStatus } from '../types';
import { LogExportAction } from './LogExportAction';

const runningTask: NormalizedTaskStatus = {
  success: true,
  task_id: 'task_1',
  status: 'running',
  uiStatus: 'running',
  trigger_type: 'feature',
  isTerminal: false,
  canExportLogs: false
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

describe('LogExportAction', () => {
  test('exposes a disabled download action and prevents activation before terminal export is available', () => {
    const { container } = render(<LogExportAction task={runningTask} language="en" />);

    const link = screen.getByRole('link', { name: /export logs/i });
    expect(link).toHaveAttribute('aria-disabled', 'true');
    expect(link).toHaveAttribute('href', '#');
    expect(link).toHaveAttribute('download');
    expect(fireEvent.click(link)).toBe(false);
    expect(container.querySelector('svg')).toBeNull();
  });

  test('uses the normalized backend URL for terminal log downloads', () => {
    render(<LogExportAction task={completedTask} language="en" />);

    const link = screen.getByRole('link', { name: /export logs/i });
    expect(link).toHaveAttribute('href', '/api/tasks/task_1/logs/download');
    expect(link).toHaveAttribute('download');
    expect(link).not.toHaveAttribute('aria-disabled');
  });
});
