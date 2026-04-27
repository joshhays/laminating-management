import { z } from "zod";

export const speedRuleSchema = z.object({
  size: z.enum(["SMALL", "LARGE"]),
  sides: z.enum(["SIMPLEX", "DUPLEX"]),
  gsmMin: z.number().nonnegative(),
  gsmMax: z.number().nonnegative(),
  impressionsPerMinute: z.number().positive(),
});

export type SpeedRule = z.infer<typeof speedRuleSchema>;

export const speedMatrixSchema = z.object({
  version: z.number().int().optional(),
  rules: z.array(speedRuleSchema).min(1),
});

export type SpeedMatrix = z.infer<typeof speedMatrixSchema>;

const DEFAULT_RULES: SpeedRule[] = [
  { size: "SMALL", sides: "SIMPLEX", gsmMin: 0, gsmMax: 300, impressionsPerMinute: 100 },
  { size: "SMALL", sides: "SIMPLEX", gsmMin: 301, gsmMax: 9999, impressionsPerMinute: 80 },
  { size: "SMALL", sides: "DUPLEX", gsmMin: 0, gsmMax: 300, impressionsPerMinute: 100 },
  { size: "SMALL", sides: "DUPLEX", gsmMin: 301, gsmMax: 9999, impressionsPerMinute: 80 },
  { size: "LARGE", sides: "SIMPLEX", gsmMin: 0, gsmMax: 300, impressionsPerMinute: 52 },
  { size: "LARGE", sides: "SIMPLEX", gsmMin: 301, gsmMax: 9999, impressionsPerMinute: 44 },
  { size: "LARGE", sides: "DUPLEX", gsmMin: 0, gsmMax: 300, impressionsPerMinute: 52 },
  { size: "LARGE", sides: "DUPLEX", gsmMin: 301, gsmMax: 9999, impressionsPerMinute: 44 },
];

export function defaultVersant4100SpeedMatrix(): SpeedMatrix {
  return { version: 1, rules: DEFAULT_RULES };
}

export function defaultVersant4100MatrixJson(): string {
  return JSON.stringify(defaultVersant4100SpeedMatrix(), null, 2);
}

export function parseSpeedMatrix(json: string | null | undefined): SpeedMatrix | null {
  if (json == null || !String(json).trim()) return null;
  try {
    const raw = JSON.parse(String(json)) as unknown;
    const parsed = speedMatrixSchema.safeParse(raw);
    if (!parsed.success) return null;
    for (const r of parsed.data.rules) {
      if (r.gsmMax < r.gsmMin) return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

function pickIpm(
  rules: SpeedRule[],
  size: "SMALL" | "LARGE",
  sides: "SIMPLEX" | "DUPLEX",
  gsm: number,
): number | null {
  const inBand = (r: SpeedRule) =>
    r.size === size && gsm >= r.gsmMin && gsm <= r.gsmMax;
  const matchSides = rules.find((r) => r.sides === sides && inBand(r));
  if (matchSides) return matchSides.impressionsPerMinute;
  const matchSimplex = rules.find((r) => r.sides === "SIMPLEX" && inBand(r));
  return matchSimplex?.impressionsPerMinute ?? null;
}

const DEFAULT_GSM_WHEN_UNKNOWN = 200;

export type DigitalRunEstimateInput = {
  matrix: SpeedMatrix;
  finishedSheets: number;
  duplex: boolean;
  size: "SMALL" | "LARGE";
  gsm: number;
};

/**
 * Run length in minutes from total impressions ÷ IPM (no minimum here — caller may clamp).
 */
export function digitalPressRunMinutes(input: DigitalRunEstimateInput): number | null {
  const { matrix, finishedSheets, duplex, size, gsm } = input;
  if (!Number.isFinite(finishedSheets) || finishedSheets <= 0) return null;
  const sides = duplex ? "DUPLEX" : "SIMPLEX";
  const ipm = pickIpm(matrix.rules, size, sides, gsm);
  if (ipm == null || ipm <= 0) return null;
  const impressions = Math.round(finishedSheets * (duplex ? 2 : 1));
  return impressions / ipm;
}

export { DEFAULT_GSM_WHEN_UNKNOWN };
