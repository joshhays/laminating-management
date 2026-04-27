import type { AppModuleKey } from "./path-access";

/** UI labels for module checkboxes (order matches sidebar areas). */
export const MODULE_OPTIONS: { value: AppModuleKey; label: string }[] = [
  { value: "OVERVIEW", label: "Overview (home)" },
  { value: "ESTIMATES", label: "Estimates & quotes" },
  { value: "JOBS", label: "Jobs" },
  { value: "SHOP_FLOOR", label: "Shop floor" },
  { value: "CRM", label: "CRM" },
  { value: "PURCHASING", label: "Purchasing" },
  { value: "INVENTORY", label: "Inventory" },
  { value: "MODULE_SETUP", label: "Setup (equipment)" },
  { value: "SCHEDULE", label: "Schedule" },
  { value: "SHIPPING", label: "Shipping & skid pack" },
  { value: "ADMIN", label: "Admin (user accounts)" },
];
