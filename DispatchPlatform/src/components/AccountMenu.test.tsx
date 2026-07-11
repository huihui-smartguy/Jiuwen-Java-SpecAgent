import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { AccountMenu } from './AccountMenu';

const auth = {
  profileUrl: '/identity/profile',
  loginUrl: '/identity/login',
  registerUrl: '/identity/register',
  logoutUrl: '/identity/logout'
};

function renderMenu(language: 'zh' | 'en' = 'en', config = auth) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });

  return render(
    <QueryClientProvider client={client}>
      <AccountMenu auth={config} language={language} />
    </QueryClientProvider>
  );
}

function response(body: unknown) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body)
  } as Response);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AccountMenu', () => {
  test('shows the signed-in user profile and configured sign-out destination', async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      await response({
        id: 'u-42',
        displayName: 'Li Ming',
        email: 'li.ming@example.com',
        organization: 'Quality Engineering',
        role: 'Test Commander'
      })
    );

    renderMenu();

    await user.click(await screen.findByRole('button', { name: /li ming/i }));

    expect(screen.getByText('Quality Engineering')).toBeInTheDocument();
    expect(screen.getByText('Test Commander')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /sign out/i })).toHaveAttribute(
      'href',
      '/identity/logout'
    );
  });

  test('shows compact Chinese sign-in and registration actions when signed out', async () => {
    const user = userEvent.setup();

    renderMenu('zh', { loginUrl: '/identity/login', registerUrl: '/identity/register' });

    await user.click(screen.getByRole('button', { name: /登录/i }));

    expect(screen.getByRole('menuitem', { name: /登录/i })).toHaveAttribute('href', '/identity/login');
    expect(screen.getByRole('menuitem', { name: /注册/i })).toHaveAttribute(
      'href',
      '/identity/register'
    );
  });

  test('keeps SSO entry actions available when the profile service is unavailable', async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('identity unavailable'));

    renderMenu();

    await user.click(screen.getByRole('button', { name: /account/i }));

    expect(await screen.findByText(/identity unavailable/i)).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /sign in/i })).toHaveAttribute(
      'href',
      '/identity/login'
    );
  });
});
