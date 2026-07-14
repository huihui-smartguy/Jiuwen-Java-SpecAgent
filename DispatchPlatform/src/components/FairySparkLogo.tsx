import { useId, type SVGProps } from 'react';

type FairySparkLogoProps = Omit<SVGProps<SVGSVGElement>, 'role' | 'aria-label'>;

export function FairySparkLogo({ className = '', ...props }: FairySparkLogoProps) {
  const gradientId = `${useId().replaceAll(':', '')}-fairy-spark-gradient`;

  return (
    <svg
      {...props}
      className={`fairy-spark-logo ${className}`.trim()}
      width="28"
      height="28"
      viewBox="0 0 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Fairy spark"
    >
      <defs>
        <linearGradient id={gradientId} x1="3" y1="4" x2="25" y2="24" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F04438" />
          <stop offset="0.25" stopColor="#F5A524" />
          <stop offset="0.5" stopColor="#2EB67D" />
          <stop offset="0.73" stopColor="#3279F9" />
          <stop offset="1" stopColor="#8B5CF6" />
        </linearGradient>
      </defs>
      <path
        d="M14 1.5C14.8 7.4 18.9 11.5 26.5 14C18.9 16.5 14.8 20.6 14 26.5C13.2 20.6 9.1 16.5 1.5 14C9.1 11.5 13.2 7.4 14 1.5Z"
        fill={`url(#${gradientId})`}
      />
    </svg>
  );
}
