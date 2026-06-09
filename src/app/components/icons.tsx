import type { ReactNode } from "react";

/** Shared SVG wrapper — holds the stroke styling every icon repeats. */
export function Icon({
  children,
  className,
  strokeWidth = 2,
}: {
  children: ReactNode;
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

/** Reusable icon path sets. */
export const SPARK = <path d="M22 12h-4l-3 9L9 3l-3 9H2" />;
export const ARROW = <path d="M5 12h14M12 5l7 7-7 7" />;
