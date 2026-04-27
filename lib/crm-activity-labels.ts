import type { ActivityType } from "@prisma/client";

export function activityTypeShortLabel(t: ActivityType): string {
  switch (t) {
    case "ESTIMATE_CREATED":
      return "Estimate";
    case "JOB_CREATED":
      return "Job created";
    case "JOB_STATUS_CHANGED":
      return "Job status";
    case "JOB_SHIPPED":
      return "Shipped";
    case "SHIPPING_LABEL_PRINTED":
      return "Shipping";
    case "NOTE":
      return "Note";
    default:
      return t;
  }
}
