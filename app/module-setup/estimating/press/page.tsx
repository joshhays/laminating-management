import { EquipmentListPage } from "../_components/equipment-list-page";

export default function EstimatingPressPage() {
  return (
    <EquipmentListPage
      section="press"
      title="Press setup"
      description="Sheetfed or web presses by technology: offset, toner, or inkjet. Create a machine type with the right technology, then add machines. Use technical specs JSON for plate size, max sheet, UV, coating, etc."
      breadcrumbs={[
        { href: "/module-setup", label: "Module setup" },
        { href: "/module-setup/estimating", label: "Estimating" },
        { href: "/module-setup/estimating/press", label: "Press" },
      ]}
    />
  );
}
