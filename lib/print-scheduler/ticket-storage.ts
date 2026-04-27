import fs from "fs/promises";
import path from "path";

const TICKETS_DIR = path.join(process.cwd(), "storage", "tickets");

export async function saveTicketPdf(jobId: string, buffer: Buffer): Promise<string> {
  await fs.mkdir(TICKETS_DIR, { recursive: true });
  const filename = `${jobId}.pdf`;
  await fs.writeFile(path.join(TICKETS_DIR, filename), buffer);
  return filename;
}

export function getTicketFilePath(filename: string): string {
  return path.join(TICKETS_DIR, path.basename(filename));
}
