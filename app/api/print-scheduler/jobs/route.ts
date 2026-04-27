import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, requireSession } from "@/lib/print-scheduler/api-auth";
import { jobsWhereForUser } from "@/lib/print-scheduler/machine-scope";

export const runtime = "nodejs";

export async function GET() {
  const sess = await requireSession();
  if (sess instanceof NextResponse) return sess;
  const allowed = requirePermission(sess, "canViewSchedule");
  if (allowed !== true) return allowed;

  try {
    const jobs = await prisma.printScheduleJob.findMany({
      where: jobsWhereForUser(sess),
      include: { machine: true },
      orderBy: [{ dueDate: "asc" }, { jobNumber: "asc" }],
    });
    return NextResponse.json(jobs);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not load jobs from the database.";
    console.error("[GET /api/jobs]", e);
    return NextResponse.json(
      {
        error: message,
        hint:
          'For SQLite: DATABASE_URL="file:./dev.db" then npx prisma db push. For Postgres: provider postgresql + connection URL.',
      },
      { status: 503 },
    );
  }
}
