/**
 * Background for one cell of the week, from how many of the filtered people
 * are free in it.
 *
 * Free time is what the page is for, so more free means more colour. The ramp
 * tops out well short of the full accent: an early-quarter group is free most
 * of the week, and a saturated fill across five days buries the hours that are
 * not free instead of showing them.
 */
export function heatColor(free: number, total: number): string {
  if (total <= 0 || free <= 0) return "var(--heat-empty)";
  const fraction = Math.min(1, free / total);
  const mix = Math.round(14 + Math.pow(fraction, 1.8) * 52);
  return `color-mix(in oklab, var(--heat) ${mix}%, var(--heat-empty))`;
}
