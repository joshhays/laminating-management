import { z } from "zod";
import { inferDuplexFromTicketText } from "@/lib/print-scheduler/paper-from-stock";
import { parseUsShortDate } from "./dates";

/**
 * Structured fields parsed from Pace eProductivity "jobcontrol-jacket" style PDFs.
 * Layout varies by shop; this targets common header + PRINT + notes patterns.
 */
export const parsedTicketSchema = z.object({
  jobNumber: z.string(),
  partCount: z.number().int().optional(),
  dueDate: z.date().nullable(),
  proofDue: z.date().nullable(),
  needInHandsAt: z.date().nullable(),
  customerName: z.string().optional(),
  poNumber: z.string().optional(),
  description: z.string().optional(),
  stockDescription: z.string().optional(),
  runSheetSize: z.string().optional(),
  quantity: z.number().int().optional(),
  pressModel: z.string().optional(),
  sheetsToPress: z.number().int().optional(),
  sheetsOnPress: z.number().int().optional(),
  salesperson: z.string().optional(),
  csr: z.string().optional(),
  priority: z.string().optional(),
  estimateNumber: z.string().optional(),
  jobOrderType: z.string().optional(),
  duplex: z.boolean().optional(),
});

export type ParsedTicket = z.infer<typeof parsedTicketSchema>;

function firstMatch(
  text: string,
  re: RegExp,
  group = 1,
): string | undefined {
  const m = text.match(re);
  const g = m?.[group];
  return g?.trim() || undefined;
}

function parseIntLoose(s: string | undefined): number | undefined {
  if (!s) return undefined;
  const n = Number(String(s).replace(/,/g, ""));
  return Number.isFinite(n) ? Math.trunc(n) : undefined;
}

/**
 * Pace PDF text can glue sheet columns, e.g. `3,1213,257` for 3,121 and 3,257 sheets.
 * Many jackets list **# Up**, then sheets on press, then sheets to press — the first small
 * number is *not* a sheet count; prefer {@link extractLabeledSheetCount} when headers exist.
 */
function parseVersantSheetCounts(body: string):
  | { pressModel: string; sheetsOnPress?: number; sheetsToPress?: number }
  | undefined {
  const head = body.match(/Versant\s+(\d+)/i);
  if (!head) return undefined;
  const pressModel = `Versant ${head[1]}`;
  const win = body.slice(body.indexOf(head[0]), body.indexOf(head[0]) + 320);
  const merged = win.match(/(\d),(\d{3})(\d),(\d{3})/);
  if (merged) {
    const sheetsOnPress = Number(`${merged[1]}${merged[2]}`);
    const sheetsToPress = Number(`${merged[3]}${merged[4]}`);
    return { pressModel, sheetsOnPress, sheetsToPress };
  }
  const loose = win.match(
    /Versant\s+\d+\D+([\d,]+)\D+([\d,]+)(?:\D+([\d,]+))?/i,
  );
  if (loose) {
    const g3 = loose[3]?.trim();
    if (g3) {
      return {
        pressModel,
        sheetsOnPress: parseIntLoose(loose[2]),
        sheetsToPress: parseIntLoose(g3),
      };
    }
    return {
      pressModel,
      sheetsOnPress: parseIntLoose(loose[1]),
      sheetsToPress: parseIntLoose(loose[2]),
    };
  }
  return { pressModel };
}

/**
 * Reads a count from explicit PRINT column headers (works across layout variants).
 * Tries the first page slice, then the full document.
 */
function extractLabeledSheetCount(
  fullText: string,
  which: "on" | "to",
): number | undefined {
  const mid = which === "on" ? "on" : "to";
  const glued = which === "on" ? "On" : "To";
  const patterns: RegExp[] = [
    new RegExp(
      String.raw`Sheets\s*[\n\r\t]+\s*${mid}\s*[\n\r\t]+\s*press\s*[\n\r\t]*\s*([\d,]+)`,
      "i",
    ),
    new RegExp(
      String.raw`Sheets\s+${mid}\s+press\s*:?\s*[\n\r\t]*\s*([\d,]+)`,
      "i",
    ),
    new RegExp(String.raw`Sheets${glued}Press\s*:?\s*([\d,]+)`, "i"),
  ];
  const chunks = [firstTicketSection(fullText), fullText];
  for (const chunk of chunks) {
    for (const re of patterns) {
      const m = chunk.match(re);
      const n = parseIntLoose(m?.[1]);
      if (n != null && n > 0) return n;
    }
  }
  return undefined;
}

/** Prefer the first page header block (before repeated "Page N of M"). */
function firstTicketSection(text: string): string {
  const cut =
    text.search(/Page\s+1\s+of\s+\d+/i) >= 0
      ? text.split(/Page\s+1\s+of\s+\d+/i)[0]
      : text.split(/--\s*1\s+of\s+\d+\s*--/i)[0] || text;
  return cut.slice(0, 12_000);
}

const INCH_DIM = String.raw`(\d+(?:\.\d+)?"\s*x\s*\d+(?:\.\d+)?")`;

/**
 * Pace "Job Jacket" puts substrate copy under a **MATERIALS** heading (not "Stock:").
 * Stops before weight line (`80.0 lb/...`) or stock-code / size rows.
 */
function extractMaterialsStockDescription(fullText: string): string | undefined {
  const block = fullText.match(/\bMATERIALS\b([\s\S]*?)(?=\n\s*\bINK\b)/i);
  if (!block) return undefined;
  const lines = block[1]
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !/^MATERIALS$/i.test(l));
  const desc: string[] = [];
  for (const line of lines) {
    if (/PartDescription\s*\/\s*PO/i.test(line)) continue;
    if (/Stock\s*#\s*Wgt|Buy QtyStock/i.test(line)) continue;
    if (/^\d{2}$/.test(line) && desc.length === 0) continue;
    if (/^\d+\.\d+\s*lb\//i.test(line)) break;
    if (new RegExp(`^${INCH_DIM}`, "i").test(line) && desc.length > 0) break;
    if (new RegExp(`^${INCH_DIM}\\w`, "i").test(line) && desc.length > 0) break;
    desc.push(line);
  }
  const joined = desc.join(" ").replace(/\s+/g, " ").trim();
  return joined || undefined;
}

/**
 * Run sheet size lives under **PRINT**, often glued as `13" x 19"Versant` on page 2+.
 * `firstTicketSection` often excludes that page — parse from full document text.
 */
function extractPrintRunSize(fullText: string): string | undefined {
  const dimBeforePress = fullText.match(
    new RegExp(`${INCH_DIM}\\s*Versant`, "i"),
  );
  if (dimBeforePress) {
    return dimBeforePress[1].replace(/\s+/g, " ").trim();
  }
  const dimBeforeIndigo = fullText.match(
    new RegExp(`${INCH_DIM}\\s*Indigo`, "i"),
  );
  if (dimBeforeIndigo) {
    return dimBeforeIndigo[1].replace(/\s+/g, " ").trim();
  }
  const afterMailing = fullText.match(
    new RegExp(String.raw`T\s*\+\s*Mailing\s*${INCH_DIM}`, "i"),
  );
  if (afterMailing) {
    return afterMailing[1].replace(/\s+/g, " ").trim();
  }
  const ptBlock = fullText.match(
    /PtRun\s+Size[^\n]*\n([\s\S]{0,1200}?)(?=\n\s*FINISHING\b)/i,
  );
  if (ptBlock) {
    const dims = [...ptBlock[1].matchAll(new RegExp(INCH_DIM, "gi"))];
    for (const d of dims) {
      const raw = d[1].replace(/\s+/g, "");
      if (/99["']x99/i.test(raw) || /^99"/i.test(d[1].trim())) continue;
      return d[1].replace(/\s+/g, " ").trim();
    }
  }
  const simplePrint = fullText.match(
    /PartQuantityDescriptionPgsRuns#\s*UpRun Size[^\n]*\n02\d[^\n]*?(\d+(?:\.\d+)?"\s*x\s*\d+(?:\.\d+)?")/i,
  );
  if (simplePrint) {
    return simplePrint[1].replace(/\s+/g, " ").trim();
  }
  return (
    firstMatch(fullText, /Run\s+Size\s*:\s*([^\n]+)/i)?.trim() ||
    firstMatch(fullText, /Sheet\s+Size\s*:\s*([^\n]+)/i)?.trim() ||
    undefined
  );
}

export function parsePaceJobTicketText(fullText: string): ParsedTicket {
  const normalized = fullText.replace(/\r\n/g, "\n");
  const text = firstTicketSection(normalized);

  const jobNumber =
    firstMatch(text, /Job:\s*(\d+)/i) ?? "unknown";
  const partCount = parseIntLoose(
    firstMatch(text, /Job:\s*\d+\s*\((\d+)\s+Parts\)/i) ?? "",
  );

  // "Proof Due:" also contains "Due:" — avoid matching that as the job due.
  const dueRaw =
    firstMatch(text, /(?:^|[\r\n])\s*Due:\s*([^\n]+)/im) ??
    firstMatch(text, /(?:^|[\r\n])\s*Due\s*Date:\s*([^\n]+)/im);
  const dueDate = dueRaw ? parseUsShortDate(dueRaw) : null;

  const jobOrderType = firstMatch(text, /^(.+?)Job Order Type:/im);

  const poNumber = firstMatch(
    text,
    /Job Order Type:\s*\n+\s*([^\n]+)\s*\n+\s*PO #:/i,
  );

  let description = firstMatch(
    text,
    /Description:\s*(.+?)Job Type:/i,
  );
  description = description?.replace(/\s+/g, " ").trim();

  const stockFromMaterials = extractMaterialsStockDescription(normalized);
  const stockDescription =
    stockFromMaterials ||
    firstMatch(text, /Stock(?:\s*Description)?\s*:\s*([^\n]+)/i)?.trim() ||
    firstMatch(text, /Paper\s*:\s*([^\n]+)/i)?.trim() ||
    firstMatch(text, /Substrate\s*:\s*([^\n]+)/i)?.trim();

  const runFromPrint = extractPrintRunSize(normalized);
  const runSheetSize =
    runFromPrint ||
    firstMatch(text, /Run\s+Size\s*:\s*([^\n]+)/i)?.trim() ||
    firstMatch(text, /Sheet\s+Size\s*:\s*([^\n]+)/i)?.trim() ||
    firstMatch(text, /Press\s+Sheet\s*:\s*([^\n]+)/i)?.trim() ||
    firstMatch(text, /Trim\s+Size\s*:\s*([^\n]+)/i)?.trim() ||
    firstMatch(text, /Finished\s+Size\s*:\s*([^\n]+)/i)?.trim();

  let salesperson = firstMatch(text, /Salesperson:\s*([^\t\n]+)/i);
  if (salesperson?.endsWith("Digital")) {
    salesperson = salesperson.replace(/\s*Digital\s*$/i, "").trim();
  }
  const csr = firstMatch(text, /([^\n]+?)CSR:/i);

  const priority = firstMatch(text, /CSR:([^\n]+?)Priority:/i);
  const customerName = firstMatch(
    text,
    /Priority:\s*\n+\s*([^\n]+)\s*\n+\s*Customer:/i,
  )?.trim();

  const estimateNumber = firstMatch(text, /Estimate #:\s*(\d+)/i);

  const qtyRaw = firstMatch(text, /Qty:\s*([\d,]+)/i);
  const quantity = parseIntLoose(qtyRaw);

  const proofRaw = firstMatch(text, /Proof Due:\s*([^\n]+)/i);
  const proofDue = proofRaw ? parseUsShortDate(proofRaw) : null;

  const needRaw = firstMatch(normalized, /NEED IN HANDS\s+([^\n]+)/i);
  const needInHandsAt = needRaw ? parseUsShortDate(needRaw) : null;

  const press = parseVersantSheetCounts(normalized);
  const pressModel = press?.pressModel;
  const sheetsOnPress =
    extractLabeledSheetCount(normalized, "on") ?? press?.sheetsOnPress;
  const sheetsToPress =
    extractLabeledSheetCount(normalized, "to") ?? press?.sheetsToPress;

  const duplexHint = inferDuplexFromTicketText(normalized);
  const duplex = duplexHint === true ? true : undefined;

  const parsed: ParsedTicket = {
    jobNumber,
    partCount: partCount || undefined,
    dueDate,
    proofDue,
    needInHandsAt,
    customerName,
    poNumber,
    description,
    stockDescription: stockDescription || undefined,
    runSheetSize: runSheetSize || undefined,
    quantity,
    pressModel,
    sheetsToPress,
    sheetsOnPress,
    salesperson,
    csr,
    priority,
    estimateNumber,
    jobOrderType,
    duplex,
  };

  return parsedTicketSchema.parse(parsed);
}
