/** Classify DATABASE_URL for operator-facing hints (never log full value). */

function normalizeUrl(raw: string | undefined): string {
  if (raw == null) return "";
  const t = raw.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1).trim();
  }
  return t;
}

/** Extra lines when Prisma reports access denied / “(not available)” (often P1010 wrapping). */
export function prismaAccessDeniedHelpLines(): readonly string[] {
  return [
    "PostgreSQL refused the session or Prisma could not select a database. Typical local fixes:",
    "• Run: npm run db:up — then: npx prisma db push (Docker must be running)",
    "• This repo’s Docker Postgres listens on host port 5433 (not 5432) so it does not collide with Postgres.app / Homebrew. DATABASE_URL must use :5433 locally (see .env.example).",
    "• If you still use :5432 you may be hitting another Postgres on your machine; postgres/postgres only works for the Docker DB on 5433.",
    "• If DATABASE_URL passwords contain @ # : % or $ encode them for URL (see Prisma Postgres connection URIs)",
    "• Hosted DB (Railway/Neon): use the Postgres service URL + sslmode if required by the provider",
    "• Diagnose quickly: npm run db:check",
  ];
}

const helpMarker = "── Database connection hints ──";

export function prismaMessageWithConnectionHints(originalMessage: string): string {
  if (originalMessage.includes(helpMarker)) return originalMessage;
  if (!/denied access|\(not available\)/i.test(originalMessage)) return originalMessage;

  const urlHints = databaseUrlOperatorHints();
  const extras = [...prismaAccessDeniedHelpLines(), ...(urlHints.length ? ["", ...urlHints] : [])];
  return `${originalMessage}\n\n${helpMarker}\n${extras.join("\n")}`;
}

export function databaseUrlOperatorHints(): readonly string[] {
  const raw = process.env.DATABASE_URL;
  const url = normalizeUrl(raw);

  if (!url) {
    return [
      "DATABASE_URL is missing. In Railway: open your Postgres service → Variables (or Connect) and copy the connection string. On your web service, add a variable DATABASE_URL and reference the Postgres service’s URL, or paste the same postgresql://… value.",
    ];
  }

  const lower = url.toLowerCase();
  if (lower.startsWith("file:")) {
    return [
      "DATABASE_URL uses a SQLite path (file:…). This app expects PostgreSQL. Replace it with Railway’s Postgres URL (postgresql://postgres:…).",
      "Railway: add Postgres to the project → on the Postgres service, copy DATABASE_URL → set that on your Next.js service Variables (do not reuse a local file: URL from .env).",
    ];
  }

  if (!lower.startsWith("postgresql:") && !lower.startsWith("postgres:")) {
    return [
      "DATABASE_URL must start with postgresql:// or postgres:// (Prisma + PostgreSQL). Fix the value in Railway Variables—often it’s a wrong variable name or a non-Postgres URL.",
    ];
  }

  return [];
}
