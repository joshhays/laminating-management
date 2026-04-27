import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Digital print",
  description: "Yorke Flow — digital press week grid and Pace ticket intake",
};

export default function PrintSchedulerLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <div className="min-h-full flex flex-col">{children}</div>;
}
