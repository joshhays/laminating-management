"use client";

import { LaminatingHomeLink } from "@/components/print-scheduler/laminating-home-link";
import { Button } from "@/components/print-scheduler/ui/button";
import { Input } from "@/components/print-scheduler/ui/input";
import { Label } from "@/components/print-scheduler/ui/label";
import type { PublicUser } from "@/lib/print-scheduler/permissions";
import { SCHEDULER_BASE_PATH, schedApi } from "@/lib/print-scheduler/paths";
import { readOkJson } from "@/lib/print-scheduler/response-json";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";

const STORAGE_NAME = "scheduler_operator_name";

export default function LoginClient() {
  const router = useRouter();
  const [nextPath, setNextPath] = useState(SCHEDULER_BASE_PATH);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("next");
    if (q?.startsWith("/")) setNextPath(q);
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(schedApi("auth/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim().toLowerCase(),
          password,
        }),
      });
      const data = await readOkJson<{ user: PublicUser }>(res);
      try {
        sessionStorage.setItem(STORAGE_NAME, data.user.displayName);
      } catch {
        /* ignore */
      }
      router.push(nextPath);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setSubmitting(false);
    }
  }

  const initials = username.trim() ? username.trim().slice(0, 2).toUpperCase() : "In";

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-16">
      <div
        className="pointer-events-none absolute inset-0 -z-10 bg-slate-100"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-90"
        style={{
          background: `
            radial-gradient(ellipse 80% 60% at 20% 20%, rgb(199 210 254 / 0.55), transparent 50%),
            radial-gradient(ellipse 70% 50% at 80% 10%, rgb(186 230 253 / 0.5), transparent 45%),
            radial-gradient(ellipse 60% 60% at 50% 85%, rgb(233 213 255 / 0.45), transparent 50%),
            radial-gradient(ellipse 100% 80% at 70% 60%, rgb(224 231 255 / 0.35), transparent 55%)
          `,
        }}
        aria-hidden
      />

      <div className="w-full max-w-md">
        <div className="rounded-3xl border border-white/40 bg-white/60 p-8 shadow-xl shadow-slate-900/5 backdrop-blur-lg dark:border-white/10 dark:bg-slate-900/45">
          <div className="mb-8 flex flex-col items-center gap-3 text-center">
            <div
              className="flex size-24 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-blue-600 text-2xl font-semibold text-white shadow-lg shadow-sky-500/30 ring-4 ring-white/50"
              aria-hidden
            >
              {initials}
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                Sign in
              </h1>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Use the username and password an admin created for you. Scheduler login must be
                enabled with <code className="rounded bg-slate-200/80 px-1 text-[0.8rem] dark:bg-slate-800/80">ENABLE_SCHEDULER_AUTH=true</code>.
              </p>
            </div>
          </div>

          {error ? (
            <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
              {error}
            </p>
          ) : null}

          <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-5">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                autoComplete="username"
                placeholder="josh"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button
              type="submit"
              className="h-11 w-full rounded-xl font-medium"
              disabled={submitting || !username.trim() || !password}
            >
              {submitting ? "Signing in…" : "Continue"}
            </Button>
          </form>

          <p className="mt-6 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center text-xs text-slate-500">
            <Link
              href={SCHEDULER_BASE_PATH}
              className="font-medium text-sky-700 underline-offset-4 hover:underline"
            >
              Back to digital print
            </Link>
            <LaminatingHomeLink className="font-medium text-sky-700 underline-offset-4 hover:underline" />
          </p>
        </div>
      </div>
    </div>
  );
}
