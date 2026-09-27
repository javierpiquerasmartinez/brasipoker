export function SpadeLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <path
        fill="currentColor"
        d="M50 12c0 0-34 26-34 48 0 15 13 23 24 17 5-3 8-7 8-12 1 9-3 18-11 25h26c-8-7-12-16-11-25 0 5 3 9 8 12 11 6 24-2 24-17 0-22-34-48-34-48Z"
      />
    </svg>
  );
}
