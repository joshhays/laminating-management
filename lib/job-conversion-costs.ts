export type MachineCostRates = {
  hourlyRate: number;
  laborHourlyRate: number;
};

export function conversionMachineCost(
  runTimeHours: number | null | undefined,
  rates: MachineCostRates | null | undefined,
): number {
  if (rates == null || runTimeHours == null || !Number.isFinite(runTimeHours)) return 0;
  return Math.max(0, runTimeHours) * Math.max(0, rates.hourlyRate);
}

export function conversionLaborCost(
  laborHours: number | null | undefined,
  rates: MachineCostRates | null | undefined,
): number {
  if (rates == null || laborHours == null || !Number.isFinite(laborHours)) return 0;
  return Math.max(0, laborHours) * Math.max(0, rates.laborHourlyRate);
}

/**
 * Machine burden = run time only (line turning). Labor = make ready + side change + wash up + all run time.
 */
export function estimateConversionFromRunBreakdown(
  runMinutesTotal: number,
  nonRunLaborMinutes: number,
  rates: MachineCostRates | null | undefined,
): { machine: number; labor: number } {
  if (rates == null) return { machine: 0, labor: 0 };
  if (!Number.isFinite(runMinutesTotal) || !Number.isFinite(nonRunLaborMinutes)) {
    return { machine: 0, labor: 0 };
  }
  const runH = Math.max(0, runMinutesTotal) / 60;
  const laborH = (Math.max(0, nonRunLaborMinutes) + Math.max(0, runMinutesTotal)) / 60;
  return {
    machine: runH * Math.max(0, rates.hourlyRate),
    labor: laborH * Math.max(0, rates.laborHourlyRate),
  };
}
