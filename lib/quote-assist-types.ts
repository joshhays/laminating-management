/** Fields the assistant can suggest for the new estimate form. */
export type QuoteAssistPatch = {
  filmId?: string;
  quantity?: string;
  materialWidthInches?: string;
  sheetLengthInches?: string;
  finalSheetWidthInches?: string;
  finalSheetLengthInches?: string;
  paperDescription?: string;
  stockType?: string;
  customStockType?: string;
  printProcess?: "Offset" | "Digital";
  secondPassEnabled?: boolean;
};

export type QuoteAssistResponse = {
  ok: true;
  patch: QuoteAssistPatch;
  explanation: string;
  filmMatchNote?: string;
  /** Cross-web vs feed decision (short-edge / long-edge / inventory). */
  orientationSummary?: string;
  warnings?: string[];
};

export type QuoteAssistErrorResponse = {
  ok: false;
  error: string;
  hints?: string[];
};
