import fs from "fs/promises";
import { NextResponse } from "next/server";
import { requirePermission, requireSession } from "@/lib/print-scheduler/api-auth";
import { jobAccessibleByUser } from "@/lib/print-scheduler/machine-scope";
import { prisma } from "@/lib/prisma";
import { getTicketFilePath } from "@/lib/print-scheduler/ticket-storage";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const sess = await requireSession();
  if (sess instanceof NextResponse) return sess;
  const allowed = requirePermission(sess, "canViewSchedule");
  if (allowed !== true) return allowed;

  const { id } = await ctx.params;
  const job = await prisma.printScheduleJob.findUnique({
    where: { id },
    select: { ticketPdfPath: true, sourceFileName: true, machineId: true },
  });
  if (!job?.ticketPdfPath) {
    return NextResponse.json({ error: "No ticket PDF on file for this job." }, { status: 404 });
  }
  if (!jobAccessibleByUser(sess, job.machineId)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const filePath = getTicketFilePath(job.ticketPdfPath);
  try {
    const buffer = await fs.readFile(filePath);
    const filename = job.sourceFileName?.replace(/[^\w.-]+/g, "_") || "ticket.pdf";
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Ticket file missing on disk." }, { status: 404 });
  }
}
