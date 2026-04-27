import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <div className="mx-auto max-w-md px-6 py-20 text-center">
      <h1 className="text-xl font-semibold text-zinc-900">Access denied</h1>
      <p className="mt-2 text-sm text-zinc-600">
        Your account does not include permission for this area. Ask an administrator to grant the
        matching module.
      </p>
      <Link
        href="/"
        className="mt-6 inline-block rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
      >
        Go to overview
      </Link>
    </div>
  );
}
