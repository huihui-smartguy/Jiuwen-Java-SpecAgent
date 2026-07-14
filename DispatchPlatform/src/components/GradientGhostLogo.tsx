import { useId, type SVGProps } from 'react';

type GradientGhostLogoProps = Omit<SVGProps<SVGSVGElement>, 'role' | 'aria-label'>;

export function GradientGhostLogo({ className = '', ...props }: GradientGhostLogoProps) {
  const gradientId = `${useId().replaceAll(':', '')}-testwise-ghost-gradient`;

  return (
    <svg
      {...props}
      className={`gradient-ghost-logo ${className}`.trim()}
      width="32"
      height="32"
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="TestWise ghost"
    >
      <defs>
        <linearGradient id={gradientId} x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F04438" />
          <stop offset="0.25" stopColor="#F5A524" />
          <stop offset="0.5" stopColor="#2EB67D" />
          <stop offset="0.73" stopColor="#3279F9" />
          <stop offset="1" stopColor="#8B5CF6" />
        </linearGradient>
      </defs>
      <path
        d="M16.5 2.5C11 2.5 8 6.5 7.25 12.75C6.9 15.4 5.4 16.1 3.4 17.2C1.6 18.2 1.4 20.1 3.1 21.35L6.75 23.85L6.4 26.05C6.15 27.7 8.05 28.8 9.4 27.8L11.1 26.55C12.55 29.7 15.85 29.55 17.5 27.15C19.05 29.6 22.35 28.75 22.9 25.85L23.25 23.75L27.4 22.3C30.05 21.35 30.25 18.75 28.05 17.4C26.8 16.65 25.7 16.65 24.45 17.15C24.4 8.2 21.75 2.5 16.5 2.5Z"
        fill={`url(#${gradientId})`}
      />
      <path
        d="M14.8464 15.1218C15.9402 15.2755 17.0076 14.1144 17.2305 12.5283C17.4534 10.9423 16.7474 9.53195 15.6536 9.37822C14.5598 9.2245 13.4924 10.3856 13.2695 11.9717C13.0466 13.5577 13.7526 14.9681 14.8464 15.1218Z"
        fill="#15171D"
      />
      <path
        d="M21.0531 15.7841C22.1517 15.6687 22.9065 14.2838 22.739 12.6909C22.5716 11.0981 21.5454 9.90043 20.4469 10.0159C19.3483 10.1313 18.5935 11.5162 18.761 13.1091C18.9284 14.7019 19.9546 15.8996 21.0531 15.7841Z"
        fill="#15171D"
      />
      <path
        d="M8.75 13.75C8.35 18.25 8.3 21.4 11.25 23.25"
        stroke="white"
        strokeOpacity="0.52"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
    </svg>
  );
}
