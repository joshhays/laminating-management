"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { AppModuleKey } from "@/lib/auth/path-access";
import { MODULE_OPTIONS } from "@/lib/auth/module-labels";

type UserRow = {
  id: string;
  username: string;
  displayName: string | null;
  isAdmin: boolean;
  modules: string[];
};

export function AdminUsersClient() {
  const router = useRouter();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newIsAdmin, setNewIsAdmin] = useState(false);
  const [newModules, setNewModules] = useState<Set<AppModuleKey>>(
    () => new Set(MODULE_OPTIONS.map((m) => m.value).filter((v) => v !== "ADMIN")),
  );

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await fetch("/api/admin/users");
      const data = (await res.json()) as { users?: UserRow[]; error?: string };
      if (!res.ok) {
        setLoadError(typeof data.error === "string" ? data.error : "Could not load users");
        return;
      }
      setUsers(data.users ?? []);
    } catch {
      setLoadError("Could not load users");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function toggleModule(set: Set<AppModuleKey>, m: AppModuleKey): Set<AppModuleKey> {
    const next = new Set(set);
    if (next.has(m)) next.delete(m);
    else next.add(m);
    return next;
  }

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: newUsername,
        password: newPassword,
        displayName: newDisplayName,
        isAdmin: newIsAdmin,
        modules: newIsAdmin ? [] : [...newModules],
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      alert(typeof data.error === "string" ? data.error : "Create failed");
      return;
    }
    setNewUsername("");
    setNewPassword("");
    setNewDisplayName("");
    setNewIsAdmin(false);
    await load();
    router.refresh();
  }

  return (
    <div className="space-y-10">
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">Add user</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Usernames are stored in lowercase. Site admins can create other admins; module-only admins
          can add users but cannot grant the admin flag.
        </p>
        <form onSubmit={(e) => void createUser(e)} className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-zinc-600">Username</label>
              <input
                required
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-600">Display name</label>
              <input
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                value={newDisplayName}
                onChange={(e) => setNewDisplayName(e.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-zinc-600">Password</label>
              <input
                required
                type="password"
                minLength={8}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-zinc-800">
            <input
              type="checkbox"
              checked={newIsAdmin}
              onChange={(e) => setNewIsAdmin(e.target.checked)}
            />
            Site admin (full access)
          </label>
          {!newIsAdmin && (
            <fieldset className="space-y-2">
              <legend className="text-xs font-medium text-zinc-600">Modules</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {MODULE_OPTIONS.filter((m) => m.value !== "ADMIN").map((m) => (
                  <label key={m.value} className="flex items-center gap-2 text-sm text-zinc-700">
                    <input
                      type="checkbox"
                      checked={newModules.has(m.value)}
                      onChange={() => setNewModules((s) => toggleModule(s, m.value))}
                    />
                    {m.label}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          <button
            type="submit"
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Create user
          </button>
        </form>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-zinc-900">Users</h2>
        {loadError && <p className="mt-2 text-sm text-red-600">{loadError}</p>}
        {!loadError && users.length === 0 && (
          <p className="mt-2 text-sm text-zinc-500">No users yet.</p>
        )}
        <ul className="mt-4 divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white">
          {users.map((u) => (
            <li key={u.id} className="px-4 py-3 text-sm">
              <div className="font-medium text-zinc-900">
                {u.displayName ?? u.username}{" "}
                <span className="font-normal text-zinc-500">({u.username})</span>
              </div>
              <div className="mt-1 text-xs text-zinc-600">
                {u.isAdmin ? (
                  <span className="font-medium text-emerald-800">Site admin</span>
                ) : (
                  <span>Modules: {u.modules.join(", ") || "—"}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
