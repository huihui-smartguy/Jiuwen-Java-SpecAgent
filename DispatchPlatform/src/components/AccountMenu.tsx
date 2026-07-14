import { useQuery } from '@tanstack/react-query';
import { Building2, CircleAlert, LogIn, LogOut, UserPlus } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { loadSession } from '../auth/session';
import { getCopy } from '../i18n';
import type { AuthConfig, Language } from '../types';

export function AccountMenu({ auth, language }: { auth?: AuthConfig; language: Language }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const t = getCopy(language);
  const { data: session } = useQuery({
    queryKey: ['identity-profile', auth?.profileUrl],
    queryFn: () => loadSession(auth),
    retry: false,
    staleTime: 5 * 60 * 1000
  });
  const isSignedIn = session?.kind === 'signed_in';
  const triggerLabel = isSignedIn
    ? session.user.displayName
    : auth?.profileUrl && !session
      ? t.account
      : session?.kind === 'unavailable'
        ? t.account
        : t.signIn;

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const closeOnOutsidePress = (event: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('pointerdown', closeOnOutsidePress, true);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePress, true);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  const closeMenu = () => setOpen(false);
  const user = isSignedIn ? session.user : undefined;
  const initials = user?.displayName.slice(0, 1).toUpperCase();

  return (
    <div className="account-menu" ref={containerRef}>
      <button
        className="account-menu__trigger"
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        aria-label={triggerLabel}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="account-menu__monogram" aria-hidden="true">TW</span>
      </button>

      {open && (
        <div className="account-menu__popover" id={menuId} role="menu" aria-label={t.account}>
          {user ? (
            <>
              <div className="account-menu__profile">
                <span className="account-avatar account-avatar--large" aria-hidden="true">
                  {initials}
                </span>
                <div>
                  <strong>{user.displayName}</strong>
                  {user.email && <span>{user.email}</span>}
                </div>
              </div>
              <dl className="account-menu__details">
                {user.organization && (
                  <div>
                    <dt>{t.organization}</dt>
                    <dd>{user.organization}</dd>
                  </div>
                )}
                {user.role && (
                  <div>
                    <dt>{t.accountRole}</dt>
                    <dd>{user.role}</dd>
                  </div>
                )}
              </dl>
              {auth?.logoutUrl && (
                <a className="account-menu__action" href={auth.logoutUrl} role="menuitem" onClick={closeMenu}>
                  <LogOut aria-hidden="true" />
                  {t.signOut}
                </a>
              )}
            </>
          ) : (
            <>
              <div className="account-menu__state">
                {session?.kind === 'unavailable' ? (
                  <>
                    <CircleAlert aria-hidden="true" />
                    <span>{t.identityUnavailable}</span>
                  </>
                ) : auth ? (
                  <>
                    <Building2 aria-hidden="true" />
                    <span>{t.signedOut}</span>
                  </>
                ) : (
                  <span>{t.identityNotConfigured}</span>
                )}
              </div>
              {auth?.loginUrl && (
                <a className="account-menu__action account-menu__action--primary" href={auth.loginUrl} role="menuitem" onClick={closeMenu}>
                  <LogIn aria-hidden="true" />
                  {t.signIn}
                </a>
              )}
              {auth?.registerUrl && (
                <a className="account-menu__action" href={auth.registerUrl} role="menuitem" onClick={closeMenu}>
                  <UserPlus aria-hidden="true" />
                  {t.register}
                </a>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
