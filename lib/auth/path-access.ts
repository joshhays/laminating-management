/**
 * Route → module mapping for middleware (Edge-safe, no Prisma).
 * Values must match Prisma `AppModule` enum names.
 */
export type AppModuleKey =
  | "OVERVIEW"
  | "ESTIMATES"
  | "JOBS"
  | "SHOP_FLOOR"
  | "CRM"
  | "PURCHASING"
  | "INVENTORY"
  | "MODULE_SETUP"
  | "SCHEDULE"
  | "SHIPPING"
  | "ADMIN";

/** Any authenticated user (minimal bar when path is not mapped more narrowly). */
export type AuthOnly = "AUTH_ONLY";

function requiredModuleForApi(pathname: string): AppModuleKey | AuthOnly {
  if (pathname.startsWith("/api/companies")) return "CRM";
  if (pathname.startsWith("/api/crm")) return "CRM";
  if (pathname.startsWith("/api/estimates")) return "ESTIMATES";
  if (pathname.startsWith("/api/estimate")) return "ESTIMATES";
  if (pathname.startsWith("/api/job-tickets")) return "JOBS";
  if (pathname.startsWith("/api/film-inventory")) return "INVENTORY";
  if (pathname.startsWith("/api/film-material-types")) return "INVENTORY";
  if (pathname.startsWith("/api/inventory")) return "INVENTORY";
  if (pathname.startsWith("/api/purchase-orders")) return "PURCHASING";
  if (pathname.startsWith("/api/shop-floor")) return "SHOP_FLOOR";
  if (pathname.startsWith("/api/machines")) return "MODULE_SETUP";
  if (pathname.startsWith("/api/machine-types")) return "MODULE_SETUP";
  if (pathname.startsWith("/api/laminating-schedule")) return "SCHEDULE";
  if (pathname.startsWith("/api/skid-pack-settings")) return "SHIPPING";
  if (pathname.startsWith("/api/admin")) return "ADMIN";
  return "AUTH_ONLY";
}

/**
 * Returns null = no site session required (public).
 * AUTH_ONLY = any logged-in user.
 */
export function requiredModuleForPath(pathname: string): AppModuleKey | AuthOnly | null {
  if (pathname === "/forbidden" || pathname.startsWith("/forbidden/")) return null;
  if (pathname.startsWith("/api/auth/")) return null;
  if (pathname.startsWith("/api/print-scheduler/")) return null;

  if (pathname.startsWith("/api/")) {
    return requiredModuleForApi(pathname);
  }

  if (pathname === "/" || pathname === "") return "OVERVIEW";
  if (pathname.startsWith("/admin")) return "ADMIN";
  if (pathname.startsWith("/estimates") || pathname.startsWith("/estimate")) return "ESTIMATES";
  if (pathname.startsWith("/jobs")) return "JOBS";
  if (pathname.startsWith("/shop-floor")) return "SHOP_FLOOR";
  if (pathname.startsWith("/crm")) return "CRM";
  if (pathname.startsWith("/purchasing")) return "PURCHASING";
  if (pathname.startsWith("/inventory")) return "INVENTORY";
  if (pathname.startsWith("/module-setup/shipping")) return "SHIPPING";
  if (pathname.startsWith("/module-setup")) return "MODULE_SETUP";
  if (pathname.startsWith("/schedule")) return "SCHEDULE";
  if (pathname.startsWith("/machines")) return "MODULE_SETUP";
  if (pathname.startsWith("/skid-pack-settings")) return "SHIPPING";

  return "AUTH_ONLY";
}

export function canAccessModule(params: {
  isAdmin: boolean;
  modules: AppModuleKey[];
  required: AppModuleKey | AuthOnly;
}): boolean {
  if (params.isAdmin) return true;
  if (params.required === "AUTH_ONLY") return true;
  return params.modules.includes(params.required);
}
