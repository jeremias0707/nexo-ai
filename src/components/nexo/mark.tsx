export function Mark({ className = "size-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <circle cx="16" cy="16" r="14.2" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.28" />
      <g className="mark-orbit">
        <circle cx="16" cy="16" r="14.2" fill="none" stroke="transparent" />
        <path
          d="M16 1.8 a14.2 14.2 0 0 1 12.3 7.1"
          fill="none"
          stroke="var(--color-accent-r)"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
        <path
          d="M29.6 18.6 a14.2 14.2 0 0 1 -10.4 11.1"
          fill="none"
          stroke="var(--color-accent-g)"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
        <path
          d="M13.2 29.8 a14.2 14.2 0 0 1 -10.6 -12.6"
          fill="none"
          stroke="var(--color-accent-b)"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      </g>
      <g fill="currentColor">
        <rect x="8.6" y="8.4" width="3.15" height="15.2" rx="0.3" />
        <rect x="20.25" y="8.4" width="3.15" height="15.2" rx="0.3" />
        <polygon points="11.75,8.4 15.15,8.4 23.4,23.6 20,23.6" />
      </g>
    </svg>
  );
}
