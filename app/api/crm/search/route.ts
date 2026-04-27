import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length === 0) {
    return NextResponse.json({
      accounts: [],
      contacts: [],
      estimates: [],
      jobs: [],
    });
  }

  const take = 10;
  const qNum = Number(q);
  const estimateNumClause =
    Number.isInteger(qNum) && qNum > 0 ? [{ estimateNumber: qNum } as const] : [];

  const [accounts, contacts, estimates, jobs] = await Promise.all([
    prisma.company.findMany({
      where: { name: { contains: q } },
      take,
      orderBy: { name: "asc" },
      select: { id: true, name: true, type: true },
    }),
    prisma.contact.findMany({
      where: {
        OR: [
          { firstName: { contains: q } },
          { lastName: { contains: q } },
          { email: { contains: q } },
        ],
      },
      take,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        companyId: true,
        company: { select: { name: true } },
      },
    }),
    prisma.estimate.findMany({
      where: {
        OR: [
          { quoteCompanyName: { contains: q } },
          { filmType: { contains: q } },
          { company: { name: { contains: q } } },
          ...estimateNumClause,
          ...(q.length >= 8 ? [{ id: { startsWith: q } } as Prisma.EstimateWhereInput] : []),
        ],
      },
      take,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        estimateNumber: true,
        totalCost: true,
        quoteCompanyName: true,
        company: { select: { name: true } },
      },
    }),
    prisma.jobTicket.findMany({
      where: {
        OR: [
          { machineAssigned: { contains: q } },
          { machine: { name: { contains: q } } },
          ...(q.length >= 6 ? [{ id: { contains: q } }] : []),
        ],
      },
      take,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        status: true,
        machineAssigned: true,
        machine: { select: { name: true } },
        estimate: {
          select: {
            estimateNumber: true,
            quoteCompanyName: true,
            company: { select: { name: true } },
          },
        },
      },
    }),
  ]);

  return NextResponse.json({
    accounts: accounts.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
    })),
    contacts: contacts.map((c) => ({
      id: c.id,
      name: `${c.firstName} ${c.lastName}`.trim(),
      email: c.email,
      companyId: c.companyId,
      companyName: c.company.name,
    })),
    estimates: estimates.map((e) => {
      const co = e.quoteCompanyName ?? e.company?.name ?? "—";
      const label =
        e.estimateNumber != null ? `Estimate #${e.estimateNumber}` : `Estimate ${e.id.slice(0, 8)}…`;
      return {
        id: e.id,
        label,
        subtitle: `${co} · $${e.totalCost.toFixed(2)}`,
      };
    }),
    jobs: jobs.map((j) => {
      const m = j.machine?.name ?? j.machineAssigned;
      const est = j.estimate;
      const sub = est
        ? `${est.estimateNumber != null ? `#${est.estimateNumber}` : "Quote"} · ${est.quoteCompanyName ?? est.company?.name ?? "—"}`
        : "No estimate link";
      return {
        id: j.id,
        label: `Job ${j.id.slice(0, 8)}…`,
        subtitle: `${m} · ${sub}`,
        machineName: m,
      };
    }),
  });
}
