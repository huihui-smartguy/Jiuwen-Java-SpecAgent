import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import type { SutTarget } from '../types';
import { TestTypeControl } from './TestTypeControl';

const selectedObject: SutTarget = {
  id: 'java-api',
  name: '高码java API',
  product: '高码java',
  scene: 'API',
  version: 'live',
  apiBaseUrl: '/api',
  status: 'healthy'
};

const objects: SutTarget[] = [
  selectedObject,
  {
    ...selectedObject,
    id: 'java-web-alias',
    name: 'High-Code Java WEB',
    product: 'High-Code Java',
    scene: 'WEB'
  },
  {
    ...selectedObject,
    id: 'java-dfx',
    name: '高码java DFX',
    scene: 'DFX'
  }
];

describe('TestTypeControl catalog truthfulness', () => {
  test('keeps true zero counts, omits unknown counts, and includes canonical Product aliases', async () => {
    const user = userEvent.setup();
    const onObjectChange = vi.fn();
    render(
      <TestTypeControl
        language="zh"
        selectedObject={selectedObject}
        objects={objects}
        objectMetadata={{
          'java-api': { scriptCount: 0 },
          'java-web-alias': { scriptCount: 2 }
        }}
        catalogState="connecting"
        onObjectChange={onObjectChange}
      />
    );

    await user.click(screen.getByRole('button', { name: /选择测试类型 API/u }));
    const listbox = screen.getByRole('listbox', { name: '可用测试类型' });
    expect(within(listbox).getByRole('option', { name: 'API 0 个脚本' }))
      .toBeInTheDocument();
    expect(within(listbox).getByRole('option', { name: 'WEB 2 个脚本' }))
      .toBeInTheDocument();
    const unknownCount = within(listbox).getByRole('option', { name: 'DFX' });
    expect(unknownCount).not.toHaveTextContent('0 个脚本');

    await user.click(within(listbox).getByRole('option', { name: 'WEB 2 个脚本' }));
    expect(onObjectChange).toHaveBeenCalledWith('java-web-alias');
  });
});
