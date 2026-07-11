import type { AuthConfig, AuthUser, SessionState } from '../types';

function isAuthUser(value: unknown): value is AuthUser {
  return Boolean(
    value &&
      typeof value === 'object' &&
      typeof (value as AuthUser).id === 'string' &&
      typeof (value as AuthUser).displayName === 'string'
  );
}

export async function loadSession(auth?: AuthConfig): Promise<SessionState> {
  if (!auth?.profileUrl) {
    return { kind: 'signed_out' };
  }

  try {
    const response = await fetch(auth.profileUrl, {
      credentials: 'include',
      headers: { Accept: 'application/json' }
    });

    if (response.status === 401) {
      return { kind: 'signed_out' };
    }

    if (!response.ok) {
      return { kind: 'unavailable' };
    }

    const profile = (await response.json()) as unknown;
    return isAuthUser(profile)
      ? { kind: 'signed_in', user: profile }
      : { kind: 'unavailable' };
  } catch {
    return { kind: 'unavailable' };
  }
}
