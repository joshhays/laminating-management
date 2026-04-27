import { NextResponse } from "next/server";
import pdfParse from "pdf-parse";
import { requirePermission, requireSession } from "@/lib/print-scheduler/api-auth";
import { prisma } from "@/lib/prisma";
import { parsePaceJobTicketText } from "@/lib/print-scheduler/parse-pace-ticket";
import { saveTicketPdf } from "@/lib/print-scheduler/ticket-storage";

export const runtime = "nodejs";

const RAW_TEXT_MAX = 250_000;

export async function POST(request: Request) {
  const sess = await requireSession();
  if (sess instanceof NextResponse) return sess;
  const allowed = requirePermission(sess, "canImportJobs");
  if (allowed !== true) return allowed;

  const form = await request.formData();
  const file = form.get("file");

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Expected file field." }, { status: 400 });
  }

  if (!file.name.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "Only PDF uploads are supported." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  let text: string;
  try {
    const parsed = await pdfParse(buffer);
    text = parsed.text ?? "";
  } catch {
    return NextResponse.json(
      { error: "Could not read PDF text. The file may be scanned or encrypted." },
      { status: 422 },
    );
  }

  if (!text.trim()) {
    return NextResponse.json(
      { error: "No extractable text in PDF (try OCR for scanned tickets)." },
      { status: 422 },
    );
  }

  const ticket = parsePaceJobTicketText(text);
  if (!ticket.jobNumber || ticket.jobNumber === "unknown") {
    return NextResponse.json(
      {
        error:
          "Could not find a Pace-style job number. Tickets from other systems may need a custom parser.",
      },
      { status: 422 },
    );
  }

  const rawPdfText =
    text.length > RAW_TEXT_MAX ? `${text.slice(0, RAW_TEXT_MAX)}\n…[truncated]` : text;

  const title =
    [ticket.description, ticket.customerName].filter(Boolean).join(" — ").trim() ||
    `Job ${ticket.jobNumber}`;

  try {
    let job = await prisma.printScheduleJob.upsert({
      where: { jobNumber: ticket.jobNumber },
      create: {
        jobNumber: ticket.jobNumber,
        title,
        partCount: ticket.partCount,
        dueDate: ticket.dueDate ?? undefined,
        proofDue: ticket.proofDue ?? undefined,
        needInHandsAt: ticket.needInHandsAt ?? undefined,
        customerName: ticket.customerName,
        poNumber: ticket.poNumber,
        description: ticket.description,
        stockDescription: ticket.stockDescription,
        runSheetSize: ticket.runSheetSize,
        quantity: ticket.quantity,
        pressModel: ticket.pressModel,
        sheetsToPress: ticket.sheetsToPress,
        sheetsOnPress: ticket.sheetsOnPress,
        duplex: ticket.duplex === true ? true : null,
        salesperson: ticket.salesperson,
        csr: ticket.csr,
        priority: ticket.priority,
        estimateNumber: ticket.estimateNumber,
        jobOrderType: ticket.jobOrderType,
        rawPdfText,
        sourceFileName: file.name,
      },
      update: {
        title,
        partCount: ticket.partCount,
        dueDate: ticket.dueDate ?? null,
        proofDue: ticket.proofDue ?? null,
        needInHandsAt: ticket.needInHandsAt ?? null,
        customerName: ticket.customerName,
        poNumber: ticket.poNumber,
        description: ticket.description,
        stockDescription: ticket.stockDescription,
        runSheetSize: ticket.runSheetSize,
        quantity: ticket.quantity,
        pressModel: ticket.pressModel,
        sheetsToPress: ticket.sheetsToPress,
        sheetsOnPress: ticket.sheetsOnPress,
        duplex: ticket.duplex === true ? true : null,
        salesperson: ticket.salesperson,
        csr: ticket.csr,
        priority: ticket.priority,
        estimateNumber: ticket.estimateNumber,
        jobOrderType: ticket.jobOrderType,
        rawPdfText,
        sourceFileName: file.name,
      },
    });

    try {
      const filename = await saveTicketPdf(job.id, buffer);
      job = await prisma.printScheduleJob.update({
        where: { id: job.id },
        data: { ticketPdfPath: filename },
      });
    } catch (err) {
      console.error("[import] ticket PDF save failed", err);
    }

    return NextResponse.json({ job, parsed: ticket });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not save job to the database.";
    console.error("[POST /api/jobs/import]", e);
    return NextResponse.json(
      {
        error: message,
        hint:
          'Run npx prisma db push && npx prisma db seed. Local SQLite: DATABASE_URL="file:./dev.db"; Supabase: set provider = "postgresql" in prisma/schema.prisma.',
      },
      { status: 503 },
    );
  }
}
