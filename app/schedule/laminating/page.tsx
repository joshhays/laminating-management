import { LaminatingScheduleClient } from "./laminating-schedule-client";

export const metadata = {
  title: "Laminating schedule — Yorke Flow",
  description: "Laminating week grid for job tickets from estimates",
};

export default function LaminatingSchedulePage() {
  return <LaminatingScheduleClient />;
}
