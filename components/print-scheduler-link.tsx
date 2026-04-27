import Link from "next/link";
import type { ReactNode } from "react";
import { getPrintSchedulerBaseUrl } from "@/lib/print-scheduler-url";

type PrintSchedulerLinkProps = {
  className?: string;
  children: ReactNode;
};

/** Link to the digital print board (`/schedule/digital-print` or `NEXT_PUBLIC_PRINT_SCHEDULER_URL`). */
export function PrintSchedulerLink({ className, children }: PrintSchedulerLinkProps) {
  const href = getPrintSchedulerBaseUrl();
  const isAbsolute = /^https?:\/\//i.test(href);
  if (isAbsolute) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
