import Link from "next/link";
import { AdminUsersClient } from "./admin-users-client";

export default function AdminUsersPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-8">
        <Link href="/" className="text-sm font-medium text-zinc-500 hover:text-zinc-800">
          ← Overview
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900">Users & access</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Create accounts and assign modules. Site admins have full access; others only see areas you
          grant.
        </p>
      </header>
      <AdminUsersClient />
    </div>
  );
}
