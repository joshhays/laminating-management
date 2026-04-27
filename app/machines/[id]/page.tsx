import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { usesCutterEstimateFields } from "@/lib/machine-equipment-profile";
import { MachineDetailClient } from "../machine-detail-client";

type PageProps = { params: Promise<{ id: string }> };

export default async function MachineDetailPage({ params }: PageProps) {
  const { id } = await params;
  const machine = await prisma.machine.findUnique({
    where: { id },
    include: {
      speedReductionRules: { orderBy: { sortOrder: "asc" } },
      spoilageRules: { orderBy: { sortOrder: "asc" } },
      machineType: true,
    },
  });
  if (!machine) notFound();

  return (
    <div className="mx-auto min-h-screen max-w-4xl px-6 py-10">
      <header className="mb-8">
        <Link
          href="/module-setup/estimating"
          className="text-sm font-medium text-zinc-500 hover:text-zinc-800"
        >
          ← Estimating setup
        </Link>
        <h1 className="mt-2 font-mono text-lg font-semibold tracking-tight text-zinc-900 sm:text-xl">
          {machine.name}
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          {usesCutterEstimateFields(machine.machineType)
            ? "Cutter setup (hours), capacity, per-cut pricing, and hourly rates. No lamination line rules."
            : "Equipment profile, technical JSON, and (for laminators / presses) speed reduction rules and spoilage bands."}
        </p>
      </header>
      <MachineDetailClient
        key={machine.updatedAt.toISOString()}
        initial={machine}
      />
    </div>
  );
}
