/**
 * Background for one cell of the week, from how many of the filtered people
 * are free in it.
 *
 * The page answers one question — when is *everyone* free — so that state gets
 * the full accent and every partial state stays quiet. The gap between "all but
 * one" and "all" is deliberately a jump rather than one more step on a ramp: a
 * near-miss reads as background, and the hours that actually work are the only
 * saturated thing on screen.
 */
export function heatColor(free: number, total: number): string {
  if (total <= 0 || free <= 0) return "var(--heat-empty)";
  if (free === total) return "var(--heat)";
  const fraction = free / total;
  const mix = Math.round(8 + Math.pow(fraction, 2) * 30);
  return `color-mix(in oklab, var(--heat) ${mix}%, var(--heat-empty))`;
}
