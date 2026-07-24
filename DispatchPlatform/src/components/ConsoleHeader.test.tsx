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
    scene: 'WEB',
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
  const onProductChange = vi.fn();
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ConsoleHeader
          language="en"
          selectedProduct="Payments"
          objects={objects}
          drawerOpen={false}
          objectMetadata={{
            'payments-api': { scriptCount: 12 },
            'payments-web': { scriptCount: 4 },
            'accounts-api': { scriptCount: 1 }
          }}
          catalogState="live"
          onProductChange={onProductChange}
          onLanguageToggle={vi.fn()}
          onDrawerOpenChange={vi.fn()}
          {...overrides}
        />
      </MemoryRouter>
    </QueryClientProvider>
  );
  return { onProductChange };
}

describe('ConsoleHeader Product picker', () => {
  test('shows one option per Product with aggregated script counts and no scenarios', async () => {
    const user = userEvent.setup();
    renderHeader();

    const control = screen.getByTestId('object-control');
    expect(control).toHaveTextContent('Product');
    expect(control).toHaveTextContent('Payments');
    expect(control).not.toHaveTextContent('API');
    expect(control).not.toHaveTextContent('WEB');

    await user.click(within(control).getByRole('button', {
      name: 'Choose product: Payments'
    }));

    const picker = screen.getByRole('dialog', { name: 'Choose product' });
    const options = within(picker).getAllByRole('option');
    expect(options).toHaveLength(2);
    expect(options.map((option) => option.textContent)).toEqual([
      'Payments16 scripts',
      'Accounts1 script'
    ]);
    expect(within(picker).queryByText('API')).not.toBeInTheDocument();
    expect(within(picker).queryByText('WEB')).not.toBeInTheDocument();
  });

  test('maps canonical Product labels back to the native backend Product value', async () => {
    const user = userEvent.setup();
    const nativeObjects: SutTarget[] = [
      {
        id: 'native-java-api',
        name: 'Native Java API',
        product: '高码java',
        scene: 'API',
        version: 'live',
        apiBaseUrl: '/api',
        status: 'healthy'
      },
      {
        id: 'native-java-web',
        name: 'Native Java WEB',
        product: '高码java',
        scene: 'WEB',
        version: 'live',
        apiBaseUrl: '/api',
        status: 'healthy'
      },
      {
        id: 'native-python-dfx',
        name: 'Native Python DFX',
        product: '高码python',
        scene: 'DFX',
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
    const { onProductChange } = renderHeader({
      selectedProduct: '高码java',
      objects: nativeObjects,
      objectMetadata: {
        'native-java-api': { scriptCount: 10 },
        'native-java-web': { scriptCount: 5 },
        'native-python-dfx': { scriptCount: 3 },
        'native-unified-scene': { scriptCount: 5 }
      }
    });

    await user.click(screen.getByRole('button', {
      name: 'Choose product: High-Code Java'
    }));
    const picker = screen.getByRole('dialog', { name: 'Choose product' });
    expect(within(picker).getAllByRole('option').map((option) => option.textContent))
      .toEqual([
        'High-Code Java15 scripts',
        'High-Code Python3 scripts',
        'Unified Version5 scripts'
      ]);

    await user.click(within(picker).getByRole('option', {
      name: 'Unified Version · 5 scripts'
    }));
    expect(onProductChange).toHaveBeenCalledWith('合一版本');
  });

  test('searches only Product names and supports keyboard selection', async () => {
    const user = userEvent.setup();
    const { onProductChange } = renderHeader();
    const trigger = screen.getByRole('button', { name: 'Choose product: Payments' });

    await user.click(trigger);
    const search = screen.getByRole('searchbox', { name: 'Search products' });
    expect(search).toHaveFocus();
    await user.type(search, 'web');
    expect(screen.queryByRole('option')).not.toBeInTheDocument();
    expect(screen.getByText('No products match this search.')).toBeInTheDocument();

    await user.clear(search);
    await user.type(search, 'accounts');
    expect(screen.getAllByRole('option')).toHaveLength(1);
    await user.keyboard('{ArrowDown}{Enter}');

    expect(onProductChange).toHaveBeenCalledWith('Accounts');
    expect(screen.queryByRole('dialog', { name: 'Choose product' })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  test('closes the non-modal Product picker when Tab moves focus outside it', async () => {
    const user = userEvent.setup();
    renderHeader();

    await user.click(screen.getByRole('button', { name: 'Choose product: Payments' }));
    expect(screen.getByRole('searchbox', { name: 'Search products' })).toHaveFocus();

    await user.tab();
    await user.tab();
    await user.tab();

    expect(screen.queryByRole('dialog', { name: 'Choose product' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Switch to Chinese' })).toHaveFocus();
  });

  test('announces a removed active Product from the sole accessible trigger', () => {
    renderHeader({ selectedProduct: 'Removed Product' });

    const control = screen.getByTestId('object-control');
    expect(within(control).getByRole('button', {
      name: 'Choose product: Removed Product · Removed'
    })).toBeInTheDocument();
    expect(within(control).queryByRole('combobox')).not.toBeInTheDocument();
  });

  test('localizes Product picker copy and reports stale catalog state', async () => {
    const user = userEvent.setup();
    renderHeader({ language: 'zh', catalogState: 'stale' });

    await user.click(screen.getByRole('button', { name: '选择产品: Payments' }));

    const picker = screen.getByRole('dialog', { name: '选择产品' });
    expect(within(picker).getByRole('searchbox', { name: '搜索产品' }))
      .toBeInTheDocument();
    expect(within(picker).getByRole('status')).toHaveTextContent('数据可能过期');
    expect(within(picker).getByRole('option', {
      name: 'Payments · 16 个脚本'
    })).toBeInTheDocument();
  });

  test('keeps the mobile drawer open when Escape closes its nested picker', async () => {
    const user = userEvent.setup();
    const onDrawerOpenChange = vi.fn();
    renderHeader({ drawerOpen: true, onDrawerOpenChange });

    const drawer = screen.getByRole('dialog', { name: 'Navigation' });
    await user.click(within(drawer).getByRole('button', {
      name: 'Choose product: Payments'
    }));
    expect(within(drawer).getByRole('dialog', { name: 'Choose product' }))
      .toBeInTheDocument();
    onDrawerOpenChange.mockClear();

    await user.keyboard('{Escape}');

    expect(within(drawer).queryByRole('dialog', { name: 'Choose product' }))
      .not.toBeInTheDocument();
    expect(drawer).toBeInTheDocument();
    expect(onDrawerOpenChange).not.toHaveBeenCalled();
  });
});
