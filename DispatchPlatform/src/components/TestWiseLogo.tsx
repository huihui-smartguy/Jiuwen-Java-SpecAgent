import type { ImgHTMLAttributes } from 'react';

interface TestWiseLogoProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  size?: number;
}

export function TestWiseLogo({
  size = 28,
  className = '',
  alt = 'TestWise gourd logo',
  ...props
}: TestWiseLogoProps) {
  return (
    <img
      src={`${import.meta.env.BASE_URL}testwise-gourd.png`}
      width={size}
      height={size}
      alt={alt}
      className={`testwise-logo ${className}`.trim()}
      {...props}
    />
  );
}
