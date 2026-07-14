import type { ReactNode } from 'react';

export interface PresentationOnlyButtonProps {
  children: ReactNode;
  className?: string;
}

export function PresentationOnlyButton({
  children,
  className = ''
}: PresentationOnlyButtonProps) {
  return (
    <button
      type="button"
      className={`presentation-only-button ${className}`.trim()}
      aria-disabled="true"
    >
      {children}
    </button>
  );
}
