"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  CalendarRange,
  ClipboardList,
  Layers,
  LayoutDashboard,
  Package,
  PlusCircle,
  Printer,
  Settings,
  ShoppingCart,
  Ticket,
  Timer,
  Users,
  Warehouse,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { sessionMayNavTo } from "@/lib/auth/nav-access";
import type { SiteSession } from "@/lib/auth/session";

const mainNav = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/estimates", label: "Estimates", icon: ClipboardList },
  { href: "/estimate/new", label: "New estimate", icon: PlusCircle },
  { href: "/jobs", label: "Jobs", icon: Ticket },
  { href: "/shop-floor", label: "Shop floor", icon: Timer },
  { href: "/crm", label: "CRM", icon: Building2 },
  { href: "/purchasing", label: "Purchasing", icon: ShoppingCart },
  { href: "/inventory", label: "Inventory", icon: Package },
  { href: "/module-setup", label: "Setup", icon: Warehouse },
] as const;

const scheduleSub = [
  { href: "/schedule/digital-print", label: "Digital print", icon: Printer },
  { href: "/schedule/laminating", label: "Laminating", icon: Layers },
] as const;

export function AppSidebar({ session }: { session: SiteSession | null }) {
  const pathname = usePathname();

  function active(href: string) {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  const scheduleOpen = pathname.startsWith("/schedule");
  const canSchedule = session && sessionMayNavTo(session, "/schedule");
  const canAdmin =
    session && (session.isAdmin || session.modules.includes("ADMIN"));

  return (
    <aside className="flex w-[72px] shrink-0 flex-col border-r border-white/60 bg-white/70 py-6 backdrop-blur-md lg:w-[220px] lg:px-4">
      <Link
        href="/"
        className="mb-10 flex items-center justify-center gap-2 lg:justify-start lg:px-2"
        aria-label="Yorke Flow home"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--dashboard-accent)] text-sm font-bold text-white shadow-lg shadow-[#3F3DBC]/25">
          YF
        </span>
        <span className="hidden min-w-0 flex-col text-left leading-tight lg:flex">
          <span className="text-sm font-semibold tracking-tight text-zinc-900">Yorke</span>
          <span className="text-sm font-semibold tracking-tight text-zinc-900">Flow</span>
        </span>
      </Link>

      <nav className="flex flex-1 flex-col gap-1">
        {mainNav
          .filter(({ href }) => !session || sessionMayNavTo(session, href))
          .map(({ href, label, icon: Icon }) => {
            const on = active(href);
            return (
              <Link
                key={href}
                href={href}
                title={label}
                className={cn(
                  "flex items-center justify-center gap-3 rounded-2xl py-3 text-zinc-500 transition-colors lg:justify-start lg:px-3",
                  on
                    ? "bg-[var(--dashboard-accent)] text-white shadow-md shadow-[#3F3DBC]/20"
                    : "hover:bg-white hover:text-zinc-900",
                )}
              >
                <Icon className="size-5 shrink-0" strokeWidth={on ? 2.25 : 1.75} />
                <span className="hidden text-sm font-medium lg:inline">{label}</span>
              </Link>
            );
          })}

        {canSchedule && (
          <div className="mt-1">
            <Link
              href="/schedule"
              title="Schedule"
              className={cn(
                "flex items-center justify-center gap-3 rounded-2xl py-3 text-zinc-500 transition-colors lg:justify-start lg:px-3",
                pathname === "/schedule"
                  ? "bg-[var(--dashboard-accent)] text-white shadow-md shadow-[#3F3DBC]/20"
                  : scheduleOpen && pathname !== "/schedule"
                    ? "bg-zinc-100/90 text-zinc-800"
                    : "hover:bg-white hover:text-zinc-900",
              )}
            >
              <CalendarRange
                className="size-5 shrink-0"
                strokeWidth={pathname === "/schedule" ? 2.25 : 1.75}
              />
              <span className="hidden text-sm font-medium lg:inline">Schedule</span>
            </Link>
            <div className="hidden border-l border-zinc-200/90 py-1 pl-2 lg:ml-4 lg:block">
              {scheduleSub
                .filter(({ href }) => sessionMayNavTo(session!, href))
                .map(({ href, label, icon: Icon }) => {
                  const on = active(href);
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={cn(
                        "flex items-center gap-2 rounded-xl py-2 pr-2 pl-3 text-xs font-medium transition-colors",
                        on
                          ? "bg-[var(--dashboard-accent)]/12 text-[var(--dashboard-accent)]"
                          : "text-zinc-500 hover:bg-white/80 hover:text-zinc-900",
                      )}
                    >
                      <Icon className="size-3.5 shrink-0 opacity-80" strokeWidth={2} />
                      {label}
                    </Link>
                  );
                })}
            </div>
          </div>
        )}
      </nav>

      <div className="mt-auto flex flex-col gap-1 border-t border-zinc-200/80 pt-4">
        {session && sessionMayNavTo(session, "/module-setup/shipping") && (
          <Link
            href="/module-setup/shipping"
            title="Shipping and skid pack"
            className={cn(
              "flex items-center justify-center gap-3 rounded-2xl py-3 text-zinc-500 transition-colors lg:justify-start lg:px-3",
              pathname.startsWith("/module-setup/shipping")
                ? "bg-[var(--dashboard-accent)] text-white shadow-md"
                : "hover:bg-white hover:text-zinc-900",
            )}
          >
            <Settings className="size-5 shrink-0" strokeWidth={1.75} />
            <span className="hidden text-sm font-medium lg:inline">Shipping</span>
          </Link>
        )}
        {canAdmin && (
          <Link
            href="/admin/users"
            title="Users & access"
            className={cn(
              "flex items-center justify-center gap-3 rounded-2xl py-3 text-zinc-500 transition-colors lg:justify-start lg:px-3",
              pathname.startsWith("/admin")
                ? "bg-[var(--dashboard-accent)] text-white shadow-md"
                : "hover:bg-white hover:text-zinc-900",
            )}
          >
            <Users className="size-5 shrink-0" strokeWidth={1.75} />
            <span className="hidden text-sm font-medium lg:inline">Users</span>
          </Link>
        )}
      </div>
    </aside>
  );
}
