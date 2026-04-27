import type { ReactNode } from "react";

/** Numbered vertical stepper panel — native `<details>` for a11y without client JS. */
export function JobCollapsibleSection({
  step,
  title,
  description,
  defaultOpen = false,
  children,
}: {
  step: number;
  title: string;
  description?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details
      open={defaultOpen}
      className="group mb-4 scroll-mt-4 rounded-xl border border-zinc-200 bg-white shadow-sm open:shadow-md"
    >
      <summary className="flex cursor-pointer list-none items-start gap-3 px-4 py-3.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 [&::-webkit-details-marker]:hidden">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-zinc-300 bg-zinc-50 text-xs font-bold text-zinc-800">
          {step}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-zinc-900">{title}</span>
          {description ? (
            <span className="mt-0.5 block text-xs leading-snug text-zinc-500">{description}</span>
          ) : null}
        </span>
        <svg
          className="mt-1 h-4 w-4 shrink-0 text-zinc-400 transition-transform duration-200 group-open:rotate-180"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </summary>
      <div className="border-t border-zinc-100 px-4 pb-5 pt-4">{children}</div>
    </details>
  );
}

/** Secondary accordion inside a step — keeps dense sub-tasks separate. */
export function JobNestedSubsection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details
      open={defaultOpen}
      className="group/sub mb-3 rounded-lg border border-zinc-200 bg-zinc-50/80 last:mb-0 [&_summary::-webkit-details-marker]:hidden"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-zinc-600 hover:bg-zinc-100/80">
        <span>{title}</span>
        <svg
          className="h-3.5 w-3.5 shrink-0 text-zinc-400 transition-transform duration-200 group-open/sub:rotate-180"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </summary>
      <div className="border-t border-zinc-200 bg-white px-3 pb-3 pt-3">{children}</div>
    </details>
  );
}
