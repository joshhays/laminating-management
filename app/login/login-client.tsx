"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

export function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "/";

  const [bootLoading, setBootLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [needsBootstrap, setNeedsBootstrap] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");

  const load = useCallback(async () => {
    setBootLoading(true);
    try {
      const res = await fetch("/api/auth/me");
      const data = (await res.json()) as { needsBootstrap?: boolean };
      setNeedsBootstrap(Boolean(data.needsBootstrap));
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBootLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Login failed");
        return;
      }
      router.push(nextPath.startsWith("/") ? nextPath : "/");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleBootstrap(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/register-first", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          password,
          displayName: displayName || username,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not create account");
        return;
      }
      router.push("/");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  if (bootLoading && !needsBootstrap) {
    return <p className="text-sm text-zinc-600">Checking…</p>;
  }

  if (needsBootstrap) {
    return (
      <form onSubmit={(e) => void handleBootstrap(e)} className="space-y-4">
        <p className="text-sm text-zinc-600">
          Create the first administrator account. After this, use{" "}
          <span className="font-medium text-zinc-800">Admin → Users</span> to add more people.
        </p>
        <div>
          <label className="block text-xs font-medium text-zinc-600">Display name</label>
          <input
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Josh"
            autoComplete="name"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-600">Username</label>
          <input
            required
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="josh"
            autoComplete="username"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-600">Password</label>
          <input
            required
            type="password"
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            minLength={8}
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-zinc-900 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
        >
          {submitting ? "Saving…" : "Create admin & sign in"}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={(e) => void handleLogin(e)} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-zinc-600">Username</label>
        <input
          required
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-zinc-600">Password</label>
        <input
          required
          type="password"
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-lg bg-zinc-900 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
      >
        {submitting ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
