/**
 * Optional env ADMIN_PIN: when set, admin-only actions require the same value (form field or JSON `pin`).
 * When unset, admin actions are allowed (suitable for trusted local use only).
 */
export function assertAdminPin(pin: string | undefined): void {
  const required = process.env.ADMIN_PIN?.trim();
  if (!required) return;
  if (pin !== required) {
    throw new Error("ADMIN_PIN_UNAUTHORIZED");
  }
}
