import { EquipmentListPage } from "../_components/equipment-list-page";

export default function EstimatingLaminatingPage() {
  return (
    <EquipmentListPage
      section="laminating"
      title="Laminating setup"
      description="Laminating lines used on film estimates: max web, m/min, make ready, side change, wash up, slowdown and spoilage rules."
      breadcrumbs={[
        { href: "/module-setup", label: "Module setup" },
        { href: "/module-setup/estimating", label: "Estimating" },
        { href: "/module-setup/estimating/laminating", label: "Laminating" },
      ]}
    />
  );
}
