import { CompanyType } from "@prisma/client";

export function parseCompanyType(raw: unknown): CompanyType {
  const t = String(raw ?? "PROSPECT").trim().toUpperCase();
  if (t === "CUSTOMER") return CompanyType.CUSTOMER;
  if (t === "VENDOR") return CompanyType.VENDOR;
  if (t === "ARCHIVED") return CompanyType.ARCHIVED;
  return CompanyType.PROSPECT;
}
