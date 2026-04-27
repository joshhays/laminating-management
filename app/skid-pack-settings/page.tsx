import { redirect } from "next/navigation";

/** @deprecated Use /module-setup/shipping */
export default function SkidPackSettingsRedirectPage() {
  redirect("/module-setup/shipping");
}
