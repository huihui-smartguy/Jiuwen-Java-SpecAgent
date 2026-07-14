import type { ReactNode } from 'react';

export interface PageHeaderProps {
  title: string;
  subtitle: string;
  action?: ReactNode;
}

export function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <div className="page-title-row page-header">
      <div>
        <h1>{title}</h1>
        <p className="page-subtitle">{subtitle}</p>
      </div>
      {action}
    </div>
  );
}
