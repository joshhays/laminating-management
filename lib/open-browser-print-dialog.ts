/**
 * Opens the browser/system print dialog (`window.print()`).
 * From there the user can send to a physical printer or choose “Save as PDF”
 * (or “Microsoft Print to PDF”, etc.) as the destination.
 */
export function openBrowserPrintDialog(): void {
  window.print();
}
