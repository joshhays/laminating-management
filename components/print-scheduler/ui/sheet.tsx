"use client";

import { cn } from "@/lib/print-scheduler/utils";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import * as React from "react";

const Sheet = Dialog.Root;
const SheetTrigger = Dialog.Trigger;
const SheetClose = Dialog.Close;

const SheetPortal = Dialog.Portal;

function SheetOverlay({
  className,
  ref,
  ...props
}: React.ComponentPropsWithoutRef<typeof Dialog.Overlay> & {
  ref?: React.Ref<React.ElementRef<typeof Dialog.Overlay>>;
}) {
  return (
    <Dialog.Overlay
      ref={ref}
      className={cn(
        "fixed inset-0 z-50 bg-zinc-950/40 backdrop-blur-[2px] data-[state=closed]:opacity-0 data-[state=open]:opacity-100 transition-opacity duration-200",
        className,
      )}
      {...props}
    />
  );
}

function SheetContent({
  side = "right",
  className,
  children,
  ref,
  ...props
}: React.ComponentPropsWithoutRef<typeof Dialog.Content> & {
  ref?: React.Ref<React.ElementRef<typeof Dialog.Content>>;
  side?: "right" | "left";
}) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <Dialog.Content
        ref={ref}
        className={cn(
          "fixed z-50 flex h-full max-h-dvh w-full max-w-md flex-col border-l border-zinc-200 bg-white shadow-2xl transition-transform duration-300 ease-out dark:border-zinc-800 dark:bg-zinc-950",
          side === "right"
            ? "right-0 top-0 data-[state=closed]:translate-x-full data-[state=open]:translate-x-0"
            : "left-0 top-0 data-[state=closed]:-translate-x-full data-[state=open]:translate-x-0",
          className,
        )}
        {...props}
      >
        {children}
        <Dialog.Close className="absolute right-4 top-4 rounded-md p-1 text-zinc-500 opacity-60 ring-offset-white transition hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:ring-offset-zinc-950">
          <X className="size-4" />
          <span className="sr-only">Close</span>
        </Dialog.Close>
      </Dialog.Content>
    </SheetPortal>
  );
}

function SheetHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex flex-col gap-1 border-b border-zinc-100 px-6 py-5 dark:border-zinc-900", className)} {...props} />
  );
}

function SheetTitle({
  className,
  ref,
  ...props
}: React.ComponentPropsWithoutRef<typeof Dialog.Title> & {
  ref?: React.Ref<React.ElementRef<typeof Dialog.Title>>;
}) {
  return (
    <Dialog.Title
      ref={ref}
      className={cn("text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50", className)}
      {...props}
    />
  );
}

function SheetDescription({
  className,
  ref,
  ...props
}: React.ComponentPropsWithoutRef<typeof Dialog.Description> & {
  ref?: React.Ref<React.ElementRef<typeof Dialog.Description>>;
}) {
  return (
    <Dialog.Description
      ref={ref}
      className={cn("text-sm text-zinc-500 dark:text-zinc-400", className)}
      {...props}
    />
  );
}

export { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetPortal, SheetTitle, SheetTrigger };
