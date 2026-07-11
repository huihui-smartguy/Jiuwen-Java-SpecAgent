import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { activeTask } from '../data/mockData';
import { resolveRuntimeConfig } from '../config/runtime';
import { Tasks } from './Tasks';

const runtimeConfig = resolveRuntimeConfig({ defaultLanguage: 'en', enableMockFallback: false });
const selectedSut = runtimeConfig.sutTargets[0];

function json(body: unknown) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body)
  } as Response);
}

function renderTasks(onTaskCreated = vi.fn()) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <Tasks
          language="en"
          selectedSut={selectedSut}
          activeTask={activeTask}
          runtimeConfig={runtimeConfig}
          sessionTasks={[activeTask]}
          onTaskCreated={onTaskCreated}
        />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Execute Tasks workspace', () => {
  test('separates the task queue from new task creation and labels local records as session data', () => {
    renderTasks();

    expect(screen.getByRole('tab', { name: /task queue/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /new task/i })).toBeInTheDocument();
    expect(screen.getByText(/this session/i)).toBeInTheDocument();
    expect(screen.getByText(activeTask.task_id)).toBeInTheDocument();
  });

  test('creates a task from the selected feature through the documented API payload', async () => {
    const user = userEvent.setup();
    const onTaskCreated = vi.fn();
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = String(input);
      if (url.includes('/features')) {
        return json({
          success: true,
          product: selectedSut.product,
          scene: selectedSut.scene,
          features: [{ id: 'save', name: 'Save API', type: 'L0' }],
          total: 1
        });
      }
      if (url.includes('/scripts')) {
        return json({
          success: true,
          scripts: [
            {
              id: 'save-script',
              name: 'save_api_test',
              filename: 'save_api_test.py',
              extension: '.py',
              product: selectedSut.product,
              scene: selectedSut.scene,
              feature: 'Save API',
              level: 'L0',
              size: 42,
              path: 'tests/save_api_test.py'
            }
          ],
          total: 1
        });
      }
      if (init?.method === 'POST') {
        return json({
          success: true,
          task_id: 'task_feature',
          status: 'pending',
          trigger_type: 'feature',
          message: 'created'
        });
      }
      throw new Error(`unexpected request: ${url}`);
    });

    renderTasks(onTaskCreated);
    await user.click(screen.getByRole('tab', { name: /new task/i }));
    await user.click(screen.getByRole('button', { name: /next/i }));
    await user.click(await screen.findByRole('button', { name: /create task/i }));

    await waitFor(() => expect(onTaskCreated).toHaveBeenCalled());
    const postCall = fetchSpy.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(postCall?.[1]).toEqual(
      expect.objectContaining({
        body: JSON.stringify({
          product: selectedSut.product,
          scene: selectedSut.scene,
          feature: 'Save API'
        })
      })
    );
  });

  test('creates an explicit script task when script trigger mode is selected', async () => {
    const user = userEvent.setup();
    const onTaskCreated = vi.fn();
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = String(input);
      if (url.includes('/features')) {
        return json({ success: true, product: selectedSut.product, scene: selectedSut.scene, features: [], total: 0 });
      }
      if (url.includes('/scripts')) {
        return json({
          success: true,
          scripts: [
            {
              id: 'save-script',
              name: 'save_api_test',
              filename: 'save_api_test.py',
              extension: '.py',
              product: selectedSut.product,
              scene: selectedSut.scene,
              feature: 'Save API',
              level: 'L0',
              size: 42,
              path: 'tests/save_api_test.py'
            }
          ],
          total: 1
        });
      }
      if (init?.method === 'POST') {
        return json({
          success: true,
          task_id: 'task_scripts',
          status: 'pending',
          trigger_type: 'scripts',
          message: 'created'
        });
      }
      throw new Error(`unexpected request: ${url}`);
    });

    renderTasks(onTaskCreated);
    await user.click(screen.getByRole('tab', { name: /new task/i }));
    await user.selectOptions(screen.getByLabelText(/trigger mode/i), 'scripts');
    await user.click(screen.getByRole('button', { name: /next/i }));
    await user.click(await screen.findByRole('checkbox', { name: /save_api_test/i }));
    await user.click(screen.getByRole('button', { name: /create task/i }));

    await waitFor(() => expect(onTaskCreated).toHaveBeenCalled());
    const postCall = fetchSpy.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(postCall?.[1]).toEqual(
      expect.objectContaining({ body: JSON.stringify({ script_name: ['save_api_test'] }) })
    );
  });
});
