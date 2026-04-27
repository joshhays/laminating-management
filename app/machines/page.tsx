import { redirect } from "next/navigation";

/** Equipment setup lives under Module setup → Estimating (press, laminating, finishing, mailing). */
export default function MachinesPage() {
  redirect("/module-setup/estimating");
}
