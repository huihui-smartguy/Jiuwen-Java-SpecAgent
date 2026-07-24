import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, test } from 'vitest';
import type { NormalizedTaskStatus, SutTarget } from '../types';
import { ExecutionFocus } from './ExecutionFocus';

const sut: SutTarget = {
  id: 'high-code-java-scene',
  name: '高码java 场景用例',
  product: '高码java',
  scene: '场景用例',
  version: 'catalog-r10',
  apiBaseUrl: '/api',
  status: 'healthy'
};

const runningTask: NormalizedTaskStatus = {
  success: true,
  task_id: 'task-r10',
  status: 'running',
  trigger_type: 'scene',
  message: 'running',
  backend_status: 'queued',
  uiStatus: 'running',
  isTerminal: false,
  canExportLogs: false,
  progress: {
    total_commands: 4,
    completed: 1,
    failed: 0,
    current_command: 'command: pytest tests/live'
  }
};

describe('ExecutionFocus localization', () => {
  test('uses the localized UI status and localized scene label in Chinese', () => {
    render(
      <MemoryRouter>
        <ExecutionFocus language="zh" sut={sut} task={runningTask} />
      </MemoryRouter>
    );

    const region = screen.getByRole('region', { name: '当前执行' });
    expect(within(region).getByText('当前执行 · 执行中')).toBeInTheDocument();
    expect(within(region).queryByText(/QUEUED/u)).not.toBeInTheDocument();
    expect(within(region).getByText('High-Code Java 场景化 · catalog-r10')).toHaveClass(
      'sr-only'
    );
  });

  test('uses the English UI status and Scene label in English', () => {
    render(
      <MemoryRouter>
        <ExecutionFocus language="en" sut={sut} task={runningTask} />
      </MemoryRouter>
    );

    const region = screen.getByRole('region', { name: 'Active run' });
    expect(within(region).getByText('Active run · Running')).toBeInTheDocument();
    expect(within(region).getByText('High-Code Java Scene · catalog-r10')).toHaveClass(
      'sr-only'
    );
  });

  test('keeps active-run identity bound to the immutable task source after product changes', () => {
    const currentHeaderSut: SutTarget = {
      ...sut,
      id: 'high-code-python-api',
      name: '高码python API',
      product: '高码python',
      scene: 'API',
      version: 'v1.8.0'
    };
    render(
      <MemoryRouter>
        <ExecutionFocus
          language="zh"
          sut={currentHeaderSut}
          task={{ ...runningTask, sourceSut: sut }}
        />
      </MemoryRouter>
    );

    const region = screen.getByRole('region', { name: '当前执行' });
    expect(within(region).getByText('High-Code Java 场景化 · catalog-r10')).toHaveClass(
      'sr-only'
    );
    expect(within(region).queryByText(/High-Code Python/u)).not.toBeInTheDocument();
  });
});
