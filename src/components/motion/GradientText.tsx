import type { ReactNode } from 'react';
import './motion.css';

export default function GradientText({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <span className={`fw-grad-text ${className ?? ''}`}>{children}</span>;
}
