import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { ALL_APP_MODULES } from "../lib/auth/module-keys";

const prisma = new PrismaClient();

async function main() {
  /** Override with INITIAL_ADMIN_PASSWORD or SEED_ADMIN_PASSWORD in production. */
  const password =
    process.env.INITIAL_ADMIN_PASSWORD ?? process.env.SEED_ADMIN_PASSWORD ?? "yorke";

  const username = "josh";
  const displayName = "Josh";

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.siteUser.upsert({
    where: { username },
    create: {
      username,
      displayName,
      passwordHash,
      isAdmin: true,
      moduleGrants: {
        create: ALL_APP_MODULES.map((m) => ({ module: m })),
      },
    },
    update: {
      displayName,
      passwordHash,
      isAdmin: true,
    },
  });

  console.log(`Seed: site user "${username}" (${displayName}) ensured (admin).`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    void prisma.$disconnect();
    process.exit(1);
  });
