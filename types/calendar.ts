/**
 * Shape the calendar UI uses for a scheduled block (matches FullCalendar event input).
 */
export type CalendarEventBlock = {
  id: string;
  resourceId: string;
  title: string;
  start: string;
  end: string;
  color: string;
  extendedProps: {
    status: string;
    pdfSource: string | null;
    jobNumber?: string;
    /** Laminating: second line on the card (sheet size, paper, est. minutes). */
    subtitle?: string | null;
    estimateNumber?: number | null;
  };
};
