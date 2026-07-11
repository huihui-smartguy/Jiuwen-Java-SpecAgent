import { afterEach, describe, expect, test, vi } from 'vitest';
import { loadSession } from './session';

const auth = {
  profileUrl: '/identity/profile',
  loginUrl: '/identity/login',
  registerUrl: '/identity/register',
  logoutUrl: '/identity/logout'
};

function response(body: unknown, ok = true, status = 200) {
  return Promise.resolve({
    ok,
    status,
    json: () => Promise.resolve(body)
  } as Response);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SSO session loader', () => {
  test('treats a missing profile URL as signed out without requesting the network', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    await expect(loadSession(undefined)).resolves.toEqual({ kind: 'signed_out' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test('returns the enterprise profile when the SSO gateway responds successfully', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      await response({
        id: 'u-42',
        displayName: 'Li Ming',
        email: 'li.ming@example.com',
        organization: 'Quality Engineering',
        role: 'Test Commander'
      })
    );

    await expect(loadSession(auth)).resolves.toMatchObject({
      kind: 'signed_in',
      user: { id: 'u-42', displayName: 'Li Ming', role: 'Test Commander' }
    });
  });

  test('treats a 401 profile response as signed out', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(await response({}, false, 401));

    await expect(loadSession(auth)).resolves.toEqual({ kind: 'signed_out' });
  });

  test('keeps the application usable when profile lookup fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('gateway unavailable'));

    await expect(loadSession(auth)).resolves.toEqual({ kind: 'unavailable' });
  });
});
