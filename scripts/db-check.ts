import {
  databaseUrlOperatorHints,
  prismaMessageWithConnectionHints,
} from "../lib/database-url-health";
import { prisma } from "../lib/prisma";

const urlHints = databaseUrlOperatorHints();
if (urlHints.length > 0) {
  console.error("[db:check]", urlHints.join("\n"));
  process.exit(1);
}

async function main(): Promise<void> {
  await prisma.$connect();
  await prisma.$queryRaw`SELECT 1`;
  console.log("db:check OK — connected and SELECT 1 succeeded.");
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(prismaMessageWithConnectionHints(msg));
  process.exit(1);
});
