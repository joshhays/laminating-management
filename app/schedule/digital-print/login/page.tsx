import { redirect } from "next/navigation";
import { isSchedulerAuthEnabled } from "@/lib/print-scheduler/auth";
import { SCHEDULER_BASE_PATH } from "@/lib/print-scheduler/paths";
import LoginClient from "./login-client";

export default function LoginPage() {
  if (!isSchedulerAuthEnabled()) {
    redirect(SCHEDULER_BASE_PATH);
  }
  return <LoginClient />;
}
