import { EquipmentListPage } from "../_components/equipment-list-page";

export default function EstimatingMailingPage() {
  return (
    <EquipmentListPage
      section="mailing"
      title="Mailing setup"
      description="Mailing and inserting equipment for your estimating module. Store hourly rates, notes, and technical specs until mailing is wired into quotes."
      breadcrumbs={[
        { href: "/module-setup", label: "Module setup" },
        { href: "/module-setup/estimating", label: "Estimating" },
        { href: "/module-setup/estimating/mailing", label: "Mailing" },
      ]}
    />
  );
}
