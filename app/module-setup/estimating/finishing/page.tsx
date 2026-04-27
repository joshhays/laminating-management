import { EquipmentListPage } from "../_components/equipment-list-page";

export default function EstimatingFinishingPage() {
  return (
    <EquipmentListPage
      section="finishing"
      title="Finishing machines"
      description="Cutters integrate with lamination estimates when trim size differs from the parent sheet. Add folders, binders, and other finishing types for records and future rate models."
      breadcrumbs={[
        { href: "/module-setup", label: "Module setup" },
        { href: "/module-setup/estimating", label: "Estimating" },
        { href: "/module-setup/estimating/finishing", label: "Finishing" },
      ]}
    />
  );
}
