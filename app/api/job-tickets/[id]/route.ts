import { ActivityType, JobStatus, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { recordActivity } from "@/lib/crm-activity";
import { parseCustomFieldsInput } from "@/lib/crm-custom-fields";
import { prisma } from "@/lib/prisma";

const STATUSES = new Set<string>(Object.values(JobStatus));

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;

  const existing = await prisma.jobTicket.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  if (existing.workflowStatus === "COMPLETE" || existing.workflowLockedAt != null) {
    return NextResponse.json(
      { error: "This job is complete and locked. Open Reporting for a read-only view." },
      { status: 403 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const data: {
      operatorNotes?: string | null;
      machineAssigned?: string;
      status?: JobStatus;
      machineId?: string | null;
      scheduledStart?: Date | null;
      scheduledEnd?: Date | null;
      customFields?: Prisma.InputJsonValue | typeof Prisma.DbNull;
      dueDate?: Date | null;
      ticketTitle?: string | null;
      ticketDescriptionAdditional?: string | null;
      stockInformation?: string | null;
      filmInformation?: string | null;
      pressRunInformation?: string | null;
      binderyInstructions?: string | null;
      shippingInstructions?: string | null;
      customerCompanyName?: string | null;
      customerAddress?: string | null;
      customerContactName?: string | null;
      customerContactEmail?: string | null;
    } = {};

    if ("operatorNotes" in body) {
      data.operatorNotes =
        body.operatorNotes == null ? null : String(body.operatorNotes).trim() || null;
    }

    if ("machineAssigned" in body) {
      data.machineAssigned = String(body.machineAssigned ?? "").trim() || "Unassigned";
    }

    if ("status" in body) {
      const s = String(body.status ?? "").toUpperCase();
      if (!STATUSES.has(s)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      }
      data.status = s as JobStatus;
    }

    if ("machineId" in body) {
      const raw = body.machineId;
      if (raw === null || raw === "") {
        data.machineId = null;
        data.machineAssigned = "Unassigned";
      } else {
        const mid = String(raw);
        const m = await prisma.machine.findUnique({ where: { id: mid } });
        if (!m) {
          return NextResponse.json({ error: "Machine not found" }, { status: 400 });
        }
        data.machineId = m.id;
        data.machineAssigned = m.name;
      }
    }

    if ("scheduledStart" in body) {
      const raw = body.scheduledStart;
      if (raw === null || raw === "") {
        data.scheduledStart = null;
      } else {
        const t = new Date(String(raw));
        if (Number.isNaN(t.getTime())) {
          return NextResponse.json({ error: "Invalid scheduledStart" }, { status: 400 });
        }
        data.scheduledStart = t;
      }
    }

    if ("scheduledEnd" in body) {
      const raw = body.scheduledEnd;
      if (raw === null || raw === "") {
        data.scheduledEnd = null;
      } else {
        const t = new Date(String(raw));
        if (Number.isNaN(t.getTime())) {
          return NextResponse.json({ error: "Invalid scheduledEnd" }, { status: 400 });
        }
        data.scheduledEnd = t;
      }
    }

    if ("customFields" in body) {
      if (body.customFields === null) {
        data.customFields = Prisma.DbNull;
      } else {
        try {
          const parsed = parseCustomFieldsInput(body.customFields);
          data.customFields = parsed === undefined ? {} : parsed;
        } catch (e) {
          return NextResponse.json(
            { error: e instanceof Error ? e.message : "Invalid customFields" },
            { status: 400 },
          );
        }
      }
    }

    if ("dueDate" in body) {
      const raw = body.dueDate;
      if (raw === null || raw === "") {
        data.dueDate = null;
      } else {
        const s = String(raw).trim();
        const d = /^\d{4}-\d{2}-\d{2}$/.test(s)
          ? new Date(`${s}T12:00:00.000Z`)
          : new Date(s);
        if (Number.isNaN(d.getTime())) {
          return NextResponse.json({ error: "Invalid dueDate" }, { status: 400 });
        }
        data.dueDate = d;
      }
    }

    const optionalLongTextKeys = [
      "ticketTitle",
      "ticketDescriptionAdditional",
      "stockInformation",
      "filmInformation",
      "pressRunInformation",
      "binderyInstructions",
      "shippingInstructions",
      "customerCompanyName",
      "customerAddress",
      "customerContactName",
      "customerContactEmail",
    ] as const;
    for (const k of optionalLongTextKeys) {
      if (k in body) {
        const v = body[k];
        if (v === null) {
          data[k] = null;
          continue;
        }
        if (v === undefined) continue;
        const s = String(v);
        data[k] = s.trim() === "" ? null : s;
      }
    }

    if (data.scheduledStart != null && data.scheduledEnd != null) {
      if (data.scheduledEnd.getTime() <= data.scheduledStart.getTime()) {
        return NextResponse.json(
          { error: "scheduledEnd must be after scheduledStart" },
          { status: 400 },
        );
      }
    } else if (
      (data.scheduledStart !== undefined && data.scheduledEnd === undefined) ||
      (data.scheduledEnd !== undefined && data.scheduledStart === undefined)
    ) {
      const nextStart = data.scheduledStart ?? existing.scheduledStart;
      const nextEnd = data.scheduledEnd ?? existing.scheduledEnd;
      if (nextStart != null && nextEnd != null && nextEnd.getTime() <= nextStart.getTime()) {
        return NextResponse.json(
          { error: "scheduledEnd must be after scheduledStart" },
          { status: 400 },
        );
      }
    }

    const patch: Prisma.JobTicketUncheckedUpdateInput = {};
    if (data.operatorNotes !== undefined) patch.operatorNotes = data.operatorNotes;
    if (data.machineAssigned !== undefined) patch.machineAssigned = data.machineAssigned;
    if (data.status !== undefined) patch.status = data.status;
    if (data.machineId !== undefined) patch.machineId = data.machineId;
    if (data.scheduledStart !== undefined) patch.scheduledStart = data.scheduledStart;
    if (data.scheduledEnd !== undefined) patch.scheduledEnd = data.scheduledEnd;
    if (data.customFields !== undefined) patch.customFields = data.customFields;
    if (data.dueDate !== undefined) patch.dueDate = data.dueDate;
    if (data.ticketTitle !== undefined) patch.ticketTitle = data.ticketTitle;
    if (data.ticketDescriptionAdditional !== undefined) {
      patch.ticketDescriptionAdditional = data.ticketDescriptionAdditional;
    }
    if (data.stockInformation !== undefined) patch.stockInformation = data.stockInformation;
    if (data.filmInformation !== undefined) patch.filmInformation = data.filmInformation;
    if (data.pressRunInformation !== undefined) {
      patch.pressRunInformation = data.pressRunInformation;
    }
    if (data.binderyInstructions !== undefined) {
      patch.binderyInstructions = data.binderyInstructions;
    }
    if (data.shippingInstructions !== undefined) {
      patch.shippingInstructions = data.shippingInstructions;
    }
    if (data.customerCompanyName !== undefined) {
      patch.customerCompanyName = data.customerCompanyName;
    }
    if (data.customerAddress !== undefined) patch.customerAddress = data.customerAddress;
    if (data.customerContactName !== undefined) {
      patch.customerContactName = data.customerContactName;
    }
    if (data.customerContactEmail !== undefined) {
      patch.customerContactEmail = data.customerContactEmail;
    }

    const updated = await prisma.jobTicket.update({
      where: { id },
      data: patch,
      include: { machine: true, estimate: true },
    });

    if (data.status !== undefined && data.status !== existing.status) {
      const isStart = data.status === "IN_PROGRESS" && existing.status !== "IN_PROGRESS";
      await recordActivity(prisma, {
        type: ActivityType.JOB_STATUS_CHANGED,
        title: isStart
          ? `Job started on ${updated.machine?.name ?? updated.machineAssigned}`
          : `Job status: ${existing.status} → ${updated.status}`,
        metadata: { from: existing.status, to: updated.status },
        companyId: updated.estimate?.companyId ?? null,
        contactId: updated.estimate?.contactId ?? null,
        estimateId: updated.estimateId,
        jobTicketId: updated.id,
        machineId: updated.machineId,
      });
    }

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Update failed" }, { status: 400 });
  }
}
