/** Hand-drawn underline squiggle. Colour via `currentColor`; stretches to its box. */
export function Squiggle({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 8"
      className={className}
      fill="none"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        d="M1 5.2C13 2 25 2 37 5.2S61 8.4 73 5.2 97 2 119 4.4"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
}
