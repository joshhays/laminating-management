import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isWorkflowLocked } from "@/lib/workflow/job-workflow";
import { JobWorkflowHeader } from "./job-workflow-header";

type Props = { children: React.ReactNode; params: Promise<{ id: string }> };

export default async function JobDetailLayout({ children, params }: Props) {
  const { id } = await params;
  const job = await prisma.jobTicket.findUnique({
    where: { id },
    select: {
      id: true,
      jobNumber: true,
      workflowStatus: true,
      workflowLockedAt: true,
    },
  });

  if (!job) {
    notFound();
  }

  const locked = isWorkflowLocked(job);

  return (
    <div className="min-h-screen">
      <JobWorkflowHeader
        jobId={job.id}
        jobNumber={job.jobNumber}
        workflowStatus={job.workflowStatus}
        locked={locked}
      />
      {children}
    </div>
  );
}
