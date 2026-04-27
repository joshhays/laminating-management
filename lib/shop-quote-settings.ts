/**
 * Shop identity and boilerplate for customer-facing quote letters.
 * Configure via environment variables (see .env.example).
 */

function linesFromEnv(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

export type ShopQuoteLetterhead = {
  companyName: string;
  addressLines: string[];
  phone: string | null;
  fax: string | null;
  website: string | null;
};

export type ShopQuoteBoilerplate = {
  letterhead: ShopQuoteLetterhead;
  salespersonName: string;
  estimatorName: string;
  quotedByName: string;
  signOffFirstName: string;
  termsLines: string[];
  confidentialityLine: string;
  introLine: string;
  closingLine: string;
  disclaimer: string;
};

export function getShopQuoteBoilerplate(): ShopQuoteBoilerplate {
  const companyName = process.env.SHOP_NAME?.trim() || "Your company name";
  const addressLines = linesFromEnv(process.env.SHOP_ADDRESS);
  const phone = process.env.SHOP_PHONE?.trim() || null;
  const fax = process.env.SHOP_FAX?.trim() || null;
  const website = process.env.SHOP_WEBSITE?.trim() || null;

  const termsRaw = process.env.SHOP_QUOTE_TERMS;
  const termsLines = linesFromEnv(termsRaw).length
    ? linesFromEnv(termsRaw)
    : [
        "Please note a 3% processing fee will be added to all credit card payments.",
        "Postage due at the time of mailing.",
      ];

  return {
    letterhead: {
      companyName,
      addressLines,
      phone,
      fax,
      website,
    },
    salespersonName: process.env.SHOP_QUOTE_SALESPERSON_NAME?.trim() || "—",
    estimatorName: process.env.SHOP_QUOTE_ESTIMATOR_NAME?.trim() || "—",
    quotedByName: process.env.SHOP_QUOTE_QUOTED_BY_NAME?.trim() || "—",
    signOffFirstName: process.env.SHOP_QUOTE_SIGN_OFF_FIRST_NAME?.trim() || "Team",
    termsLines,
    confidentialityLine:
      process.env.SHOP_QUOTE_CONFIDENTIALITY?.trim() ||
      "This quotation is confidential and is intended solely for the use of the addressee(s) named above.",
    introLine:
      process.env.SHOP_QUOTE_INTRO?.trim() ||
      "Here is our estimate for your printing needs. Please notify us immediately if the specifications are different than listed below.",
    closingLine:
      process.env.SHOP_QUOTE_CLOSING?.trim() ||
      "Thank you for giving us the opportunity to submit this quote.",
    disclaimer:
      process.env.SHOP_QUOTE_DISCLAIMER?.trim() ||
      "Due to supply chain issues all quotations are subject to paper availability and market price at time of order. We reserve the right to re-quote any project where the art has not been reviewed prior to quotation.",
  };
}
