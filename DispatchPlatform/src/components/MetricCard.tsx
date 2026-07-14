import type { ReactNode } from 'react';

export type MetricChangeTone = 'positive' | 'warning' | 'neutral';

export interface MetricCardProps {
  label: string;
  value: string;
  note: string;
  change?: string;
  changeTone?: MetricChangeTone;
  icon?: ReactNode;
  className?: string;
}

export function MetricCard({
  label,
  value,
  note,
  change,
  changeTone = 'neutral',
  icon,
  className = ''
}: MetricCardProps) {
  return (
    <article className={`overview-metric-card ${className}`.trim()} aria-label={label}>
      <div className="overview-metric-card__heading">
        <h3>{label}</h3>
        {icon}
      </div>
      <div className="overview-metric-card__reading">
        <strong data-testid="metric-value">{value}</strong>
        {change ? (
          <span className={`overview-metric-card__change is-${changeTone}`}>{change}</span>
        ) : null}
      </div>
      <p>{note}</p>
    </article>
  );
}
