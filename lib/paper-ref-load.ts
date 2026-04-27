import fs from "fs";
import path from "path";
import { parsePaperRefCsv, type PaperRefRow } from "@/lib/paper-ref";

let cached: PaperRefRow[] | null = null;

/** Reads Paper Reference/PaperRef.csv from project root (Node / server only). */
export function loadPaperRefRowsSync(): PaperRefRow[] {
  if (cached) return cached;
  const csvPath = path.join(process.cwd(), "Paper Reference", "PaperRef.csv");
  const text = fs.readFileSync(csvPath, "utf8");
  cached = parsePaperRefCsv(text);
  return cached;
}
