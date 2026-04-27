import type { Company, Contact, PriceTier } from "@prisma/client";

export type CrmEstimateContext = {
  companyId: string;
  contactId: string;
  companyName: string;
  companyAddress: string | null;
  creditLimit: number | null;
  outstandingBalance: number;
  priceTier: PriceTier | null;
  contactFirstName: string;
  contactLastName: string;
  contactEmail: string | null;
  contactPhone: string | null;
};

export function crmContextFromRows(company: Company, contact: Contact): CrmEstimateContext {
  return {
    companyId: company.id,
    contactId: contact.id,
    companyName: company.name,
    companyAddress: company.address,
    creditLimit: company.creditLimit,
    outstandingBalance: company.outstandingBalance,
    priceTier: company.priceTier,
    contactFirstName: contact.firstName,
    contactLastName: contact.lastName,
    contactEmail: contact.email,
    contactPhone: contact.phone,
  };
}
