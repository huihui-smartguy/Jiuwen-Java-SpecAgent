import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, test, vi } from 'vitest';
import type { SutTarget } from '../types';
import { ConsoleHeader } from './ConsoleHeader';

const objects: SutTarget[] = [
  {
    id: 'payments-api',
    name: 'Payments API',
    product: 'Payments',
    scene: 'API',
    version: 'v1',
    apiBaseUrl: '/payments-api',
    status: 'healthy'
  },
  {
    id: 'payments-web',
    name: 'Payments Web',
    product: 'Payments',
    scene: 'Web',
    version: 'v1',
    apiBaseUrl: '/payments-web',
    status: 'healthy'
  },
  {
    id: 'accounts-api',
    name: 'Accounts API',
    product: 'Accounts',
    scene: 'API',
    version: 'v2',
    apiBaseUrl: '/accounts-api',
    status: 'degraded'
  }
];

function renderHeader(overrides: Partial<React.ComponentProps<typeof ConsoleHeader>> = {}) {
  const onObjectChange = vi.fn();
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ConsoleHeader
          language="en"
          selectedObject={objects[0]}
          objects={objects}
          drawerOpen={false}
          objectFocusRequest={0}
          objectMetadata={{
            'payments-api': { scriptCount: 12 },
            'payments-web': { scriptCount: 4 },
            'accounts-api': { scriptCount: 1 }
          }}
          catalogState="live"
          onObjectChange={onObjectChange}
          onLanguageToggle={vi.fn()}
          onDrawerOpenChange={vi.fn()}
          {...overrides}
        />
      </MemoryRouter>
    </QueryClientProvider>
  );
  return { onObjectChange };
}

describe('ConsoleHeader Object picker', () => {
  test('shows canonical product and scene labels while retaining native Object ids', async () => {
    const user = userEvent.setup();
    const nativeObjects: SutTarget[] = [
      {
        id: 'native-python-dfx',
        name: 'Native Python DFX',
        product: '高码python',
        scene: 'DFx',
        version: 'live',
        apiBaseUrl: '/api',
        status: 'healthy'
      },
      {
        id: 'native-unified-scene',
        name: 'Native unified scene',
        product: '合一版本',
        scene: '场景用例',
        version: 'live',
        apiBaseUrl: '/api',
        status: 'healthy'
      }
    ];
    renderHeader({
      selectedObject: nativeObjects[0],
      objects: nativeObjects,
      objectMetadata: {
        'native-python-dfx': { scriptCount: 3 },
        'native-unified-scene': { scriptCount: 5 }
      }
    });

    const control = screen.getByTestId('object-control');
    expect(within(control).queryByRole('combobox')).not.toBeInTheDocument();

    await user.click(within(control).getByRole('button', {
      name: 'Choose Object: High-Code Python DFX'
    }));
    const picker = screen.getByRole('dialog', { name: 'Choose Object' });
    expect(within(picker).getByText('High-Code Python')).toBeInTheDocument();
    expect(within(picker).getByText('Unified Version')).toBeInTheDocument();
    expect(within(picker).getByRole('option', {
      name: 'High-Code Python DFX · 3 scripts'
    }))
      .toBeInTheDocument();
    expect(within(picker).getByRole('option', {
      name: 'Unified Version scene · 5 scripts'
    }))
      .toBeInTheDocument();
  });

  test('exposes one accessible picker with grouped catalog metadata', async () => {
    const user = userEvent.setup();
    renderHeader();

    const control = screen.getByTestId('object-control');
    expect(within(control).getAllByRole('button')).toHaveLength(1);
    expect(within(control).queryByRole('combobox')).not.toBeInTheDocument();

    await user.click(within(control).getByRole('button', {
      name: 'Choose Object: Payments API'
    }));

    const picker = screen.getByRole('dialog', { name: 'Choose Object' });
    expect(within(picker).getByRole('status')).toHaveTextContent('Live');
    expect(within(picker).getAllByRole('group').map((group) => (
      within(group).getByText(/Payments|Accounts/).textContent
    ))).toEqual(['Payments', 'Accounts']);
    expect(within(picker).getByRole('option', {
      name: 'Payments API · 12 scripts'
    }))
      .toHaveAttribute('aria-selected', 'true');
    expect(within(picker).getByRole('option', {
      name: 'Accounts API · 1 script'
    }))
      .toHaveAttribute('aria-selected', 'false');
  });

  test('shows the id disambiguator only for visually duplicate Object identities', async () => {
    const user = userEvent.setup();
    const duplicateObjects: SutTarget[] = [
      {
        ...objects[0],
        id: 'payments-api-a'
      },
      {
        ...objects[0],
        id: 'payments-api-b'
      },
      objects[1]
    ];
    renderHeader({
      selectedObject: duplicateObjects[0],
      objects: duplicateObjects,
      objectMetadata: undefined
    });

    await user.click(screen.getByRole('button', {
      name: 'Choose Object: Payments API'
    }));

    const firstDuplicate = screen.getByRole('option', {
      name: 'Payments API · payments-api-a'
    });
    const secondDuplicate = screen.getByRole('option', {
      name: 'Payments API · payments-api-b'
    });
    expect(firstDuplicate).toHaveTextContent('API · payments-api-a');
    expect(secondDuplicate).toHaveTextContent('API · payments-api-b');
    expect(screen.getByRole('option', { name: 'Payments Web' }))
      .not.toHaveTextContent('payments-web');
  });

  test('announces a removed active Object from the sole accessible trigger', () => {
    const removedObject: SutTarget = {
      ...objects[0],
      id: 'removed-payments-api'
    };
    renderHeader({ selectedObject: removedObject, objects: objects.slice(1) });

    const control = screen.getByTestId('object-control');
    expect(within(control).getByRole('button', {
      name: 'Choose Object: Payments API · Removed'
    })).toBeInTheDocument();
    expect(within(control).queryByRole('combobox')).not.toBeInTheDocument();
  });

  test('searches products and scenes and selects with the keyboard', async () => {
    const user = userEvent.setup();
    const { onObjectChange } = renderHeader();

    const trigger = screen.getByRole('button', { name: 'Choose Object: Payments API' });
    await user.click(trigger);

    const search = screen.getByRole('searchbox', { name: 'Search products or scenes' });
    expect(search).toHaveFocus();
    await user.type(search, 'web');

    const picker = screen.getByRole('dialog', { name: 'Choose Object' });
    expect(within(picker).getAllByRole('option')).toHaveLength(1);
    expect(within(picker).getByRole('option', {
      name: 'Payments Web · 4 scripts'
    })).toBeInTheDocument();

    await user.keyboard('{ArrowDown}{Enter}');

    expect(onObjectChange).toHaveBeenCalledWith('payments-web');
    expect(screen.queryByRole('dialog', { name: 'Choose Object' })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  test('localizes picker copy and reports stale catalog state', async () => {
    const user = userEvent.setup();
    renderHeader({ language: 'zh', catalogState: 'stale' });

    await user.click(screen.getByRole('button', { name: '选择 Object: Payments API' }));

    const picker = screen.getByRole('dialog', { name: '选择 Object' });
    expect(within(picker).getByRole('searchbox', { name: '搜索产品或场景' }))
      .toBeInTheDocument();
    expect(within(picker).getByRole('status')).toHaveTextContent('数据可能过期');
    expect(within(picker).getByRole('option', {
      name: 'Payments API · 12 个脚本'
    }))
      .toBeInTheDocument();
  });

  test('keeps the mobile drawer open when Escape closes its nested picker', async () => {
    const user = userEvent.setup();
    const onDrawerOpenChange = vi.fn();
    renderHeader({ drawerOpen: true, onDrawerOpenChange });

    const drawer = screen.getByRole('dialog', { name: 'Navigation' });
    await user.click(within(drawer).getByRole('button', {
      name: 'Choose Object: Payments API'
    }));
    expect(within(drawer).getByRole('dialog', { name: 'Choose Object' }))
      .toBeInTheDocument();
    onDrawerOpenChange.mockClear();

    await user.keyboard('{Escape}');

    expect(within(drawer).queryByRole('dialog', { name: 'Choose Object' }))
      .not.toBeInTheDocument();
    expect(drawer).toBeInTheDocument();
    expect(onDrawerOpenChange).not.toHaveBeenCalled();
  });
});
