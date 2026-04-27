import Link from "next/link";
import { FilmRollEditClient } from "./film-roll-edit-client";
import { FilmRollUsage } from "./film-roll-usage";

export default async function FilmRollEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="mx-auto min-h-screen max-w-4xl px-6 py-10">
      <header className="mb-8">
        <Link
          href="/inventory"
          className="text-sm font-medium text-zinc-500 hover:text-zinc-800"
        >
          ← Film inventory
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900">
          Edit film item
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          Update pricing, description, roll dimensions, vendor, and whether this line is on-floor stock
          or catalog-only. Changes apply everywhere this roll is referenced.
        </p>
      </header>
      <FilmRollEditClient id={id} />
      <FilmRollUsage filmInventoryId={id} />
    </div>
  );
}
