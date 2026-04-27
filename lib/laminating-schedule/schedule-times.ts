/** Next 15-minute boundary strictly after `d` (local clock). */
export function nextQuarterHourAfter(d: Date): Date {
  const x = new Date(d);
  x.setSeconds(0, 0);
  const m = x.getMinutes();
  const rem = m % 15;
  if (rem !== 0) x.setMinutes(m + (15 - rem));
  x.setMilliseconds(0);
  if (x.getTime() <= d.getTime()) {
    x.setMinutes(x.getMinutes() + 15);
  }
  return x;
}

/** Default laminating block length from estimate run minutes (min 15). */
export function laminatingRunMinutesFromEstimate(estimatedRunTimeMinutes: number | null | undefined): number {
  if (
    estimatedRunTimeMinutes != null &&
    Number.isFinite(estimatedRunTimeMinutes) &&
    estimatedRunTimeMinutes > 0
  ) {
    return Math.max(15, Math.round(estimatedRunTimeMinutes));
  }
  return 60;
}
