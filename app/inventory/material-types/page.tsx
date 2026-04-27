import Link from "next/link";
import { FilmMaterialTypesClient } from "../film-material-types-client";

export default function MaterialTypesPage() {
  return (
    <div className="mx-auto min-h-screen max-w-3xl px-6 py-10">
      <header className="mb-8">
        <Link
          href="/inventory"
          className="text-sm font-medium text-zinc-500 hover:text-zinc-800"
        >
          ← Film inventory
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Film material types</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Codes appear when adding rolls and PO lines. Match codes in machine speed reduction rules to
          the roll&apos;s material type.
        </p>
      </header>
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <FilmMaterialTypesClient />
      </div>
    </div>
  );
}
