import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import { AppChrome } from "@/components/app-chrome/app-chrome";
import { getSiteSession, type SiteSession } from "@/lib/auth/session";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Yorke Flow",
  description: "Production, film inventory, and scheduling",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let session: SiteSession | null = null;
  try {
    session = await getSiteSession();
  } catch {
    session = null;
  }
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${geistMono.variable} bg-[var(--dashboard-bg)] font-sans text-zinc-900 antialiased`}
      >
        <AppChrome session={session}>{children}</AppChrome>
      </body>
    </html>
  );
}
