"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { sessionMayNavTo } from "@/lib/auth/nav-access";
import type { SiteSession } from "@/lib/auth/session";

const pills = [
  { href: "/", label: "Overview" },
  { href: "/estimates", label: "Estimates" },
  { href: "/estimate/new", label: "New quote" },
  { href: "/inventory", label: "Inventory" },
  { href: "/module-setup", label: "Setup" },
  { href: "/schedule", label: "Schedule" },
] as const;

function initials(session: SiteSession): string {
  const s = session.displayName || session.username;
  const parts = s.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  }
  return s.slice(0, 2).toUpperCase();
}

export function AppHeader({ session }: { session: SiteSession | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const [greeting, setGreeting] = useState("Welcome");

  useEffect(() => {
    const h = new Date().getHours();
    if (h < 12) setGreeting("Good morning");
    else if (h < 17) setGreeting("Good afternoon");
    else setGreeting("Good evening");
  }, []);

  function pillActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const visiblePills = session
    ? pills.filter(({ href }) => sessionMayNavTo(session, href))
    : [];

  return (
    <header className="shrink-0 border-b border-white/60 bg-white/50 px-4 py-5 backdrop-blur-md sm:px-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-[1.65rem]">
            {greeting}
            {session ? (
              <span className="text-zinc-600">, {session.displayName || session.username}</span>
            ) : null}
          </h1>
          <p className="mt-0.5 text-sm text-zinc-500">Here’s what’s happening in production today.</p>
        </div>

        <nav
          className="flex flex-wrap items-center gap-2 overflow-x-auto pb-1 lg:max-w-[50%] lg:flex-nowrap lg:justify-center"
          aria-label="Section"
        >
          {visiblePills.map(({ href, label }) => {
            const on = pillActive(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-all",
                  on
                    ? "bg-[var(--dashboard-accent)] text-white shadow-md shadow-[#3F3DBC]/25"
                    : "text-zinc-600 hover:bg-white/80 hover:text-zinc-900",
                )}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center justify-end gap-2 sm:gap-3">
          <button
            type="button"
            className="flex size-11 items-center justify-center rounded-2xl border border-zinc-200/80 bg-white/80 text-zinc-500 transition-colors hover:bg-white hover:text-zinc-800"
            aria-label="Search"
          >
            <Search className="size-[1.15rem]" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            className="relative flex size-11 items-center justify-center rounded-2xl border border-zinc-200/80 bg-white/80 text-zinc-500 transition-colors hover:bg-white hover:text-zinc-800"
            aria-label="Notifications"
          >
            <Bell className="size-[1.15rem]" strokeWidth={1.75} />
            <span className="absolute right-2.5 top-2.5 size-2 rounded-full bg-emerald-500 ring-2 ring-white" />
          </button>
          {session ? (
            <>
              <button
                type="button"
                onClick={() => void logout()}
                className="hidden rounded-full border border-zinc-200/80 bg-white/80 px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-white sm:inline"
              >
                Sign out
              </button>
              <div
                className="flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--dashboard-accent)] to-indigo-600 text-xs font-semibold text-white shadow-md"
                aria-hidden
              >
                {initials(session)}
              </div>
            </>
          ) : (
            <div
              className="flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--dashboard-accent)] to-indigo-600 text-sm font-semibold text-white shadow-md"
              aria-hidden
            >
              —
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
