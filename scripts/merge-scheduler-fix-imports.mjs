#!/usr/bin/env node
/**
 * One-off transforms after copying print-job-scheduler into the main app.
 * Run: node scripts/merge-scheduler-fix-imports.mjs
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.join(import.meta.dirname, "..");
const DIRS = [
  path.join(ROOT, "app/api/print-scheduler"),
  path.join(ROOT, "app/print-scheduler"),
  path.join(ROOT, "components/print-scheduler"),
  path.join(ROOT, "lib/print-scheduler"),
  path.join(ROOT, "hooks"),
];

function* walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) yield* walk(p);
    else if (/\.(tsx?|ts)$/.test(name)) yield p;
  }
}

const REPLACERS = [
  [/@\/generated\/prisma-scheduler/g, "@prisma/client"],
  [/@\/lib\/db/g, "@/lib/prisma"],
  [/@\/lib\/auth"/g, '@/lib/print-scheduler/auth"'],
  [/@\/lib\/auth'/g, "@/lib/print-scheduler/auth'"],
  [/@\/lib\/permissions"/g, '@/lib/print-scheduler/permissions"'],
  [/@\/lib\/permissions'/g, "@/lib/print-scheduler/permissions'"],
  [/@\/lib\/machine-scope"/g, '@/lib/print-scheduler/machine-scope"'],
  [/@\/lib\/machine-scope'/g, "@/lib/print-scheduler/machine-scope'"],
  [/@\/lib\/api-auth"/g, '@/lib/print-scheduler/api-auth"'],
  [/@\/lib\/api-auth'/g, "@/lib/print-scheduler/api-auth'"],
  [/@\/lib\/admin-guard"/g, '@/lib/print-scheduler/admin-guard"'],
  [/@\/lib\/admin-guard'/g, "@/lib/print-scheduler/admin-guard'"],
  [/@\/lib\/response-json"/g, '@/lib/print-scheduler/response-json"'],
  [/@\/lib\/response-json'/g, "@/lib/print-scheduler/response-json'"],
  [/@\/lib\/calendar-mapper"/g, '@/lib/print-scheduler/calendar-mapper"'],
  [/@\/lib\/calendar-mapper'/g, "@/lib/print-scheduler/calendar-mapper'"],
  [/@\/lib\/estimate-run"/g, '@/lib/print-scheduler/estimate-run"'],
  [/@\/lib\/estimate-run'/g, "@/lib/print-scheduler/estimate-run'"],
  [/@\/lib\/ticket-storage"/g, '@/lib/print-scheduler/ticket-storage"'],
  [/@\/lib\/ticket-storage'/g, "@/lib/print-scheduler/ticket-storage'"],
  [/@\/lib\/parse-pace-ticket"/g, '@/lib/print-scheduler/parse-pace-ticket"'],
  [/@\/lib\/parse-pace-ticket'/g, "@/lib/print-scheduler/parse-pace-ticket'"],
  [/@\/lib\/paper-from-stock"/g, '@/lib/print-scheduler/paper-from-stock"'],
  [/@\/lib\/paper-from-stock'/g, "@/lib/print-scheduler/paper-from-stock'"],
  [/@\/lib\/press-speed"/g, '@/lib/print-scheduler/press-speed"'],
  [/@\/lib\/press-speed'/g, "@/lib/print-scheduler/press-speed'"],
  [/@\/lib\/digital-press-speed-matrix"/g, '@/lib/print-scheduler/digital-press-speed-matrix"'],
  [/@\/lib\/digital-press-speed-matrix'/g, "@/lib/print-scheduler/digital-press-speed-matrix'"],
  [/@\/lib\/sheet-format"/g, '@/lib/print-scheduler/sheet-format"'],
  [/@\/lib\/sheet-format'/g, "@/lib/print-scheduler/sheet-format'"],
  [/@\/lib\/versant-4100-run-time"/g, '@/lib/print-scheduler/versant-4100-run-time"'],
  [/@\/lib\/versant-4100-run-time'/g, "@/lib/print-scheduler/versant-4100-run-time'"],
  [/@\/lib\/dates"/g, '@/lib/print-scheduler/dates"'],
  [/@\/lib\/dates'/g, "@/lib/print-scheduler/dates'"],
  [/@\/lib\/utils"/g, '@/lib/print-scheduler/utils"'],
  [/@\/lib\/utils'/g, "@/lib/print-scheduler/utils'"],
  [/@\/lib\/laminating-app-url"/g, '@/lib/print-scheduler/laminating-app-url"'],
  [/@\/lib\/laminating-app-url'/g, "@/lib/print-scheduler/laminating-app-url'"],
  [/@\/lib\/supabase-browser"/g, '@/lib/print-scheduler/supabase-browser"'],
  [/@\/lib\/supabase-browser'/g, "@/lib/print-scheduler/supabase-browser'"],
  [/@\/components\/ui\//g, "@/components/print-scheduler/ui/"],
  [/@\/components\/intake\//g, "@/components/print-scheduler/intake/"],
  [/@\/components\/jobs\//g, "@/components/print-scheduler/jobs/"],
  [/@\/components\/machines\//g, "@/components/print-scheduler/machines/"],
  [/@\/components\/schedule\//g, "@/components/print-scheduler/schedule/"],
  [/@\/components\/laminating-home-link"/g, '@/components/print-scheduler/laminating-home-link"'],
  [/@\/components\/laminating-home-link'/g, "@/components/print-scheduler/laminating-home-link'"],
  [/@\/hooks\//g, "@/hooks/"],
  [/@\/types\//g, "@/types/"],
  // Prisma delegates
  [/\bprisma\.user\./g, "prisma.schedulerUser."],
  [/\bprisma\.machine\./g, "prisma.printPressMachine."],
  [/\bprisma\.printJob\./g, "prisma.printScheduleJob."],
  // Prisma types
  [/\bPrisma\.PrintJobWhereInput/g, "Prisma.PrintScheduleJobWhereInput"],
  [/\bPrisma\.PrintJobUpdateInput/g, "Prisma.PrintScheduleJobUpdateInput"],
  [/\bPrisma\.UserUncheckedUpdateInput/g, "Prisma.SchedulerUserUncheckedUpdateInput"],
  [/\bPrisma\.UserCreateInput/g, "Prisma.SchedulerUserCreateInput"],
];

for (const dir of DIRS) {
  for (const file of walk(dir)) {
    let s = fs.readFileSync(file, "utf8");
    const orig = s;
    for (const [re, to] of REPLACERS) {
      s = s.replace(re, to);
    }
    // Type imports from @prisma/client
    s = s.replace(
      /import type \{ User \} from "@prisma\/client"/g,
      'import type { SchedulerUser as User } from "@prisma/client"',
    );
    s = s.replace(
      /import type \{ User \} from '@prisma\/client'/g,
      "import type { SchedulerUser as User } from '@prisma/client'",
    );
    s = s.replace(
      /import type \{ Machine, PrintJob \} from "@prisma\/client"/g,
      'import type { PrintPressMachine as Machine, PrintScheduleJob as PrintJob } from "@prisma/client"',
    );
    s = s.replace(
      /import type \{ PrintJob \} from "@prisma\/client"/g,
      'import type { PrintScheduleJob as PrintJob } from "@prisma/client"',
    );
    s = s.replace(
      /import type \{ Prisma, User \} from "@prisma\/client"/g,
      'import type { Prisma, SchedulerUser as User } from "@prisma/client"',
    );
    s = s.replace(
      /import type \{ User \} from "@prisma\/client"/g,
      'import type { SchedulerUser as User } from "@prisma/client"',
    );
    if (s !== orig) {
      fs.writeFileSync(file, s);
      console.log("updated", path.relative(ROOT, file));
    }
  }
}
