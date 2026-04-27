"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { CrmCommandPalette } from "@/components/crm/crm-command-palette";
import type { SiteSession } from "@/lib/auth/session";
import { AppHeader } from "./app-header";
import { AppSidebar } from "./app-sidebar";

export function AppChrome({
  children,
  session,
}: {
  children: React.ReactNode;
  session: SiteSession | null;
}) {
  const pathname = usePathname();
  const printScheduler =
    pathname.startsWith("/schedule/digital-print") || pathname.startsWith("/schedule/laminating");
  const quoteLetter = pathname.includes("/quote-letter");
  const jobTicketLetter = pathname.includes("/job-ticket");
  const printLetterDocument = quoteLetter || jobTicketLetter;

  return (
    <div
      className={cn(
        "flex min-h-screen bg-[var(--dashboard-bg)] print:block print:min-h-0 print:bg-white",
        printLetterDocument && "print:h-auto",
      )}
    >
      <div className="print:hidden">
        <CrmCommandPalette />
      </div>
      <div className="print:hidden">
        <AppSidebar session={session} />
      </div>
      <div
        className={cn(
          "flex min-w-0 flex-1 flex-col print:block",
          printLetterDocument && "print:h-auto print:min-h-0",
        )}
      >
        <div className="print:hidden">
          <AppHeader session={session} />
        </div>
        <main
          className={cn(
            "min-h-0 flex-1 overflow-y-auto",
            printScheduler ? "p-0" : "px-4 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-10",
            printLetterDocument &&
              cn(
                "print:m-0 print:w-full print:max-w-none print:overflow-visible print:bg-white",
                "print:p-0 print:!block print:h-auto print:min-h-0 print:flex-none",
              ),
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
