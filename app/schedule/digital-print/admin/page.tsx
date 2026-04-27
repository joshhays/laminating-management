"use client";

import { Button } from "@/components/print-scheduler/ui/button";
import { Input } from "@/components/print-scheduler/ui/input";
import { Label } from "@/components/print-scheduler/ui/label";
import type { PublicUser } from "@/lib/print-scheduler/permissions";
import { ROLES } from "@/lib/print-scheduler/permissions";
import { SCHEDULER_BASE_PATH, schedApi } from "@/lib/print-scheduler/paths";
import { readOkJsonWithAuth } from "@/lib/print-scheduler/response-json";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type MachineOption = {
  id: string;
  slug: string;
  name: string;
};

type MeResponse = {
  user: PublicUser;
  effective: Pick<
    PublicUser,
    | "canViewSchedule"
    | "canEditSchedule"
    | "canImportJobs"
    | "canManageMachines"
    | "canViewCompletedTab"
    | "canViewCancelledTab"
    | "canManageUsers"
  >;
};

const FLAG_KEYS = [
  "canViewSchedule",
  "canEditSchedule",
  "canImportJobs",
  "canManageMachines",
  "canViewCompletedTab",
  "canViewCancelledTab",
  "canManageUsers",
] as const;

const FLAG_LABELS: Record<(typeof FLAG_KEYS)[number], string> = {
  canViewSchedule: "View schedule & jobs",
  canEditSchedule: "Edit schedule (drag, press run, cancel)",
  canImportJobs: "Import new jobs (PDF)",
  canManageMachines: "Manage machines",
  canViewCompletedTab: "View Completed tab",
  canViewCancelledTab: "View Cancelled tab",
  canManageUsers: "Manage users (this admin)",
};

export default function AdminUsersPage() {
  const router = useRouter();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [meUserId, setMeUserId] = useState<string | null>(null);
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [newUsername, setNewUsername] = useState("");
  const [newName, setNewName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<string>("VIEWER");
  const [newMachineId, setNewMachineId] = useState("");
  const [machines, setMachines] = useState<MachineOption[]>([]);

  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState("VIEWER");
  const [editMachineId, setEditMachineId] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editFlags, setEditFlags] = useState<Record<(typeof FLAG_KEYS)[number], boolean>>({
    canViewSchedule: true,
    canEditSchedule: false,
    canImportJobs: false,
    canManageMachines: false,
    canViewCompletedTab: false,
    canViewCancelledTab: false,
    canManageUsers: false,
  });

  const loadUsers = useCallback(async () => {
    setLoadErr(null);
    try {
      const res = await fetch(schedApi("admin/users"));
      const data = await readOkJsonWithAuth<{ users: PublicUser[] }>(res);
      setUsers(data.users);
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : "Could not load users");
    }
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(schedApi("auth/me"));
        const data = await readOkJsonWithAuth<MeResponse>(res);
        if (!data.effective.canManageUsers) {
          router.replace("/");
          return;
        }
        setMeUserId(data.user.id);
        setAllowed(true);
      } catch {
        setAllowed(false);
      }
    })();
  }, [router]);

  useEffect(() => {
    if (allowed) void loadUsers();
  }, [allowed, loadUsers]);

  useEffect(() => {
    if (!allowed) return;
    void (async () => {
      try {
        const res = await fetch(schedApi("machines"));
        const list = await readOkJsonWithAuth<MachineOption[]>(res);
        setMachines(list);
      } catch {
        setMachines([]);
      }
    })();
  }, [allowed]);

  function startEdit(u: PublicUser) {
    setEditId(u.id);
    setEditName(u.displayName);
    setEditRole(u.role);
    setEditMachineId(u.machineId ?? "");
    setEditPassword("");
    setEditFlags({
      canViewSchedule: u.canViewSchedule,
      canEditSchedule: u.canEditSchedule,
      canImportJobs: u.canImportJobs,
      canManageMachines: u.canManageMachines,
      canViewCompletedTab: u.canViewCompletedTab,
      canViewCancelledTab: u.canViewCancelledTab,
      canManageUsers: u.canManageUsers,
    });
  }

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setLoadErr(null);
    try {
      const payload: Record<string, unknown> = {
        username: newUsername.trim().toLowerCase(),
        displayName: newName.trim(),
        password: newPassword,
        role: newRole,
      };
      if (newRole === "MACHINE") {
        payload.machineId = newMachineId;
      }
      const res = await fetch(schedApi("admin/users"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      await readOkJsonWithAuth(res);
      setNewUsername("");
      setNewName("");
      setNewPassword("");
      setNewRole("VIEWER");
      setNewMachineId("");
      await loadUsers();
    } catch (err) {
      setLoadErr(err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit() {
    if (!editId) return;
    setBusy(true);
    setLoadErr(null);
    try {
      const body: Record<string, unknown> = {
        displayName: editName.trim(),
        role: editRole,
        ...editFlags,
      };
      if (editRole === "MACHINE") {
        body.machineId = editMachineId || null;
      }
      if (editPassword.trim().length > 0) {
        body.password = editPassword;
      }
      const res = await fetch(schedApi(`admin/users/${editId}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      await readOkJsonWithAuth(res);
      setEditId(null);
      setEditPassword("");
      await loadUsers();
    } catch (err) {
      setLoadErr(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function removeUser(id: string) {
    if (!confirm("Delete this user? They will not be able to sign in.")) return;
    setBusy(true);
    setLoadErr(null);
    try {
      const res = await fetch(schedApi(`admin/users/${id}`), { method: "DELETE" });
      await readOkJsonWithAuth(res);
      if (editId === id) setEditId(null);
      await loadUsers();
    } catch (err) {
      setLoadErr(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  if (allowed === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 text-sm text-zinc-600">
        Checking access…
      </div>
    );
  }

  if (!allowed) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-zinc-100/80 px-4 py-10 dark:from-zinc-950 dark:to-zinc-900">
      <div className="mx-auto max-w-3xl space-y-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Admin</p>
            <h1 className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Users & access</h1>
            <p className="mt-2 max-w-xl text-sm text-zinc-600 dark:text-zinc-400">
              Create sign-ins and choose what each person can see and do. ADMIN always has full access
              in the app regardless of toggles. The{" "}
              <span className="font-medium text-zinc-700 dark:text-zinc-300">MACHINE</span> preset limits
              the schedule to one press — pick the machine when you create or edit that user.
            </p>
          </div>
          <Link
            href={SCHEDULER_BASE_PATH}
            className="text-sm font-medium text-sky-700 underline-offset-4 hover:underline dark:text-sky-400"
          >
            ← Digital print
          </Link>
        </div>

        {loadErr ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
            {loadErr}
          </p>
        ) : null}

        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60">
          <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">Add user</h2>
          <form onSubmit={createUser} className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="nu-username">Username</Label>
              <Input
                id="nu-username"
                type="text"
                autoComplete="off"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nu-name">Display name</Label>
              <Input
                id="nu-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nu-role">Role preset</Label>
              <select
                id="nu-role"
                className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r === "MACHINE" ? "MACHINE (single press schedule)" : r}
                  </option>
                ))}
              </select>
            </div>
            {newRole === "MACHINE" ? (
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="nu-machine">Assigned press</Label>
                <select
                  id="nu-machine"
                  required
                  className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                  value={newMachineId}
                  onChange={(e) => setNewMachineId(e.target.value)}
                >
                  <option value="">Select a machine…</option>
                  {machines.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.slug})
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="nu-pass">Password (min 8 characters)</Label>
              <Input
                id="nu-pass"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={busy}>
                Create user
              </Button>
            </div>
          </form>
          <p className="mt-3 text-xs text-zinc-500">
            New users get permissions from the role preset; edit a user afterward to customize toggles.
          </p>
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60">
          <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">Existing users</h2>
          <ul className="mt-4 divide-y divide-zinc-100 dark:divide-zinc-800">
            {users.map((u) => (
              <li key={u.id} className="flex flex-col gap-3 py-4 first:pt-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-zinc-900 dark:text-zinc-100">{u.displayName}</p>
                    <p className="text-sm text-zinc-500">@{u.username}</p>
                    <p className="text-xs text-zinc-400">
                      Role: {u.role}
                      {u.role === "ADMIN" ? " · full access" : ""}
                      {u.role === "MACHINE" && u.machine ? ` · ${u.machine.name}` : ""}
                      {u.role === "MACHINE" && !u.machine ? " · no press assigned" : ""}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="secondary" size="sm" onClick={() => startEdit(u)}>
                      Edit access
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="text-red-700 dark:text-red-400"
                      disabled={busy || u.id === meUserId}
                      title={u.id === meUserId ? "You cannot delete your own account" : undefined}
                      onClick={() => void removeUser(u.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
                {editId === u.id ? (
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-700 dark:bg-zinc-900/50">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Display name</Label>
                        <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>Role (applies preset to flags; adjust below)</Label>
                        <select
                          className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                          value={editRole}
                          onChange={(e) => setEditRole(e.target.value)}
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r}>
                              {r === "MACHINE" ? "MACHINE (single press schedule)" : r}
                            </option>
                          ))}
                        </select>
                      </div>
                      {editRole === "MACHINE" ? (
                        <div className="space-y-2 sm:col-span-2">
                          <Label htmlFor="edit-machine">Assigned press</Label>
                          <select
                            id="edit-machine"
                            className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                            value={editMachineId}
                            onChange={(e) => setEditMachineId(e.target.value)}
                          >
                            <option value="">Select a machine…</option>
                            {machines.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name} ({m.slug})
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : null}
                      <div className="space-y-2 sm:col-span-2">
                        <Label>New password (optional)</Label>
                        <Input
                          type="password"
                          autoComplete="new-password"
                          value={editPassword}
                          onChange={(e) => setEditPassword(e.target.value)}
                          placeholder="Leave blank to keep current"
                        />
                      </div>
                    </div>
                    <fieldset
                      disabled={editRole === "ADMIN"}
                      className="mt-4 space-y-2 border-0 p-0 disabled:opacity-60"
                    >
                      <legend className="mb-2 text-xs font-medium text-zinc-500">
                        Permissions {editRole === "ADMIN" ? "(ADMIN always has all)" : ""}
                      </legend>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {FLAG_KEYS.map((k) => (
                          <label key={k} className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              className="size-4 rounded border-zinc-300"
                              checked={editFlags[k]}
                              onChange={(e) =>
                                setEditFlags((f) => ({ ...f, [k]: e.target.checked }))
                              }
                            />
                            {FLAG_LABELS[k]}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                    <div className="mt-4 flex gap-2">
                      <Button type="button" disabled={busy} onClick={() => void saveEdit()}>
                        Save
                      </Button>
                      <Button type="button" variant="secondary" onClick={() => setEditId(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
