"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { getLaminatingAppBaseUrl } from "@/lib/print-scheduler/laminating-app-url";
import { cn } from "@/lib/print-scheduler/utils";

type LaminatingHomeLinkProps = {
  className?: string;
  children?: ReactNode;
};

/** Link to the main laminating app; same tab when merged, new tab only for external base URL. */
export function LaminatingHomeLink({
  className,
  children = "Yorke Flow home →",
}: LaminatingHomeLinkProps) {
  const href = getLaminatingAppBaseUrl();
  if (!href) return null;
  const isAbsolute = /^https?:\/\//i.test(href);
  if (isAbsolute) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cn(className)}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={cn(className)}>
      {children}
    </Link>
  );
}
