import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { usesCutterEstimateFields } from "@/lib/machine-equipment-profile";
import type { EstimatingEquipmentSection } from "@/lib/estimating-equipment-filters";
import {
  machineMatchesEstimatingSection,
  machineTypeMatchesSection,
} from "@/lib/estimating-equipment-filters";
import { AddMachineForm } from "@/app/machines/add-machine-form";
import { MachineTypesSection } from "@/app/machines/machine-types-section";

export const dynamic = "force-dynamic";

function money(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function typeLabel(
  mt: { name: string; kind: string; pressTechnology?: string | null; finishingKind?: string | null },
) {
  const tech =
    mt.kind === "PRESS" && mt.pressTechnology
      ? ` — ${mt.pressTechnology}`
      : mt.kind === "FINISHING" && mt.finishingKind
        ? ` — ${mt.finishingKind}`
        : "";
  return `${mt.name}${tech}`;
}

export async function EquipmentListPage(props: {
  section: EstimatingEquipmentSection;
  title: string;
  description: string;
  breadcrumbs: { href: string; label: string }[];
}) {
  const machineTypes = await prisma.machineType.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  const typesForForms = machineTypes.filter((t) => machineTypeMatchesSection(t, props.section));

  const machines = await prisma.machine.findMany({
    orderBy: { name: "asc" },
    include: { machineType: true },
  });
  const list = machines.filter((m) => machineMatchesEstimatingSection(m.machineType, props.section));

  return (
    <div className="mx-auto min-h-screen max-w-5xl px-6 py-10">
      <header className="mb-8">
        <nav className="flex flex-wrap gap-x-2 gap-y-1 text-sm text-zinc-500">
          {props.breadcrumbs.map((b, i) => (
            <span key={b.href} className="flex items-center gap-x-2">
              {i > 0 ? <span aria-hidden>/</span> : null}
              <Link href={b.href} className="font-medium hover:text-zinc-800">
                {b.label}
              </Link>
            </span>
          ))}
        </nav>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-900">{props.title}</h1>
        <p className="mt-1 text-sm text-zinc-600">{props.description}</p>
      </header>

      <MachineTypesSection initial={machineTypes} variant={props.section} />

      <div className="mb-10">
        <AddMachineForm
          machineTypes={typesForForms}
          estimatingSection={props.section}
          allowUntyped={props.section === "laminating"}
        />
      </div>

      <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-200 px-6 py-4">
          <h2 className="text-lg font-medium text-zinc-900">Equipment</h2>
          <p className="mt-1 text-sm text-zinc-600">
            {props.section === "laminating" &&
              "Laminators drive lamination estimates: line speed, slowdown rules, and sheet bounds."}
            {props.section === "press" &&
              "Presses are set up by technology (offset, toner, inkjet). Use technical specs JSON for plate size, max sheet, and other type-specific fields."}
            {props.section === "finishing" &&
              "Cutters power automatic trim on estimates when final size differs from the parent sheet. Other finishing types are stored for future costing."}
            {props.section === "mailing" &&
              "Mailing / inserting lines for estimating setup. Extend with technical specs as you define rate models."}
          </p>
        </div>
        {list.length === 0 ? (
          <p className="px-6 py-8 text-sm text-zinc-500">No equipment in this category yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-zinc-50 text-xs font-medium uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Type</th>
                  {(props.section === "laminating" || props.section === "press") && (
                    <>
                      <th className="px-4 py-3">Max width (in)</th>
                      <th className="px-4 py-3">Max m/min</th>
                    </>
                  )}
                  {props.section === "finishing" && (
                    <th className="px-4 py-3">Cutter / detail</th>
                  )}
                  <th className="px-4 py-3">Machine $/hr</th>
                  <th className="px-4 py-3">Labor $/hr</th>
                  <th className="px-4 py-3">Active</th>
                  <th className="w-24 px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {list.map((m) => {
                  const cutterLike =
                    m.machineType != null && usesCutterEstimateFields(m.machineType);
                  const detailFinishing =
                    props.section === "finishing"
                      ? cutterLike
                        ? m.cutterMaxHeightInches != null
                          ? `max H ${m.cutterMaxHeightInches}`
                          : "—"
                        : "—"
                      : null;
                  return (
                    <tr key={m.id} className={!m.active ? "opacity-60" : ""}>
                      <td className="px-4 py-3 font-medium text-zinc-900">{m.name}</td>
                      <td className="px-4 py-3 text-zinc-600">
                        {m.machineType ? typeLabel(m.machineType) : "—"}
                      </td>
                      {(props.section === "laminating" || props.section === "press") && (
                        <>
                          <td className="px-4 py-3 tabular-nums">{m.maxWidthInches}</td>
                          <td className="px-4 py-3 tabular-nums">{m.maxSpeedMetersMin}</td>
                        </>
                      )}
                      {props.section === "finishing" && (
                        <td className="px-4 py-3 text-zinc-700">{detailFinishing}</td>
                      )}
                      <td className="px-4 py-3 tabular-nums">${money(m.hourlyRate)}</td>
                      <td className="px-4 py-3 tabular-nums">${money(m.laborHourlyRate)}</td>
                      <td className="px-4 py-3">{m.active ? "Yes" : "No"}</td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/machines/${m.id}`}
                          className="text-sm font-medium text-zinc-800 underline hover:text-zinc-950"
                        >
                          Edit
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
