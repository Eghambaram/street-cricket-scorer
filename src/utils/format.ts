/** Format a Date timestamp to "Apr 10, 2026". */
export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Format score display: "142/4". */
export function formatScore(runs: number, wickets: number): string {
  return `${runs}/${wickets}`;
}

/** Format overs as "8.3". */
export function formatOversShort(legalBalls: number): string {
  return `${Math.floor(legalBalls / 6)}.${legalBalls % 6}`;
}

/** Auto-generate match name. */
export function autoMatchName(): string {
  const today = new Date();
  return `Street Match – ${today.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`;
}

/** Capitalize first letter. */
export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Truncate text with ellipsis. */
export function truncate(s: string, max = 20): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

/** Tailwind colour class for economy rate: green ≤ 6, gold 6–9, red > 9. */
export function econColor(economy: number): string {
  if (economy <= 6) return 'text-runs';
  if (economy <= 9) return 'text-gold';
  return 'text-wicket';
}
