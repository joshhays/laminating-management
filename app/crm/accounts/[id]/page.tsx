import Link from "next/link";
import { notFound } from "next/navigation";
import { AddCompanyFileForm } from "@/components/crm/add-company-file-form";
import { CustomFieldsEditor } from "@/components/crm/custom-fields-editor";
import { activityTypeShortLabel } from "@/lib/crm-activity-labels";
import { customFieldsToEntries } from "@/lib/crm-custom-fields";
import { prisma } from "@/lib/prisma";

type PageProps = { params: Promise<{ id: string }> };

function fmtUsd(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function typeLabel(t: string) {
  return t.charAt(0) + t.slice(1).toLowerCase();
}

function tierLabel(t: string | null) {
  if (!t) return "—";
  return t.charAt(0) + t.slice(1).toLowerCase();
}

function fileKindLabel(k: string) {
  switch (k) {
    case "LOGO":
      return "Logo";
    case "BRAND_GUIDELINES":
      return "Brand guidelines";
    default:
      return "Other";
  }
}

function jobStatusLabel(s: string) {
  switch (s) {
    case "QUEUED":
      return "Queued";
    case "IN_PROGRESS":
      return "In progress";
    case "DONE":
      return "Done";
    case "SHIPPED":
      return "Shipped";
    default:
      return s;
  }
}

export default async function CrmAccountDetailPage({ params }: PageProps) {
  const { id } = await params;

  const company = await prisma.company.findUnique({
    where: { id },
    include: {
      contacts: { orderBy: [{ isPrimary: "desc" }, { lastName: "asc" }] },
      files: { orderBy: { createdAt: "desc" } },
      estimates: {
        orderBy: { updatedAt: "desc" },
        take: 80,
        include: { jobTicket: true },
      },
      activities: { orderBy: { createdAt: "desc" }, take: 60 },
    },
  });

  if (!company) notFound();

  const totalSpend = company.estimates.reduce((sum, e) => sum + e.totalCost, 0);
  const activeJobs = company.estimates.filter(
    (e) =>
      e.jobTicket != null &&
      e.jobTicket.status !== "DONE" &&
      e.jobTicket.status !== "SHIPPED",
  );

  const customMap = Object.fromEntries(
    customFieldsToEntries(company.customFields).map((e) => [e.key, e.value]),
  );

  return (
    <div className="mx-auto min-h-screen max-w-5xl px-6 py-10">
      <header className="mb-8">
        <Link href="/crm/accounts" className="text-sm font-medium text-zinc-500 hover:text-zinc-800">
          ← Accounts
        </Link>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-zinc-900">{company.name}</h1>
        <p className="mt-1 text-sm text-zinc-600">
          {typeLabel(company.type)}
          {company.priceTier ? ` · ${tierLabel(company.priceTier)} tier` : ""}
        </p>
      </header>

      <div className="mb-8 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Total spend (deals)</p>
        <p className="mt-1 text-3xl font-semibold tabular-nums text-zinc-900">${fmtUsd(totalSpend)}</p>
        <p className="mt-1 text-xs text-zinc-500">Sum of saved estimate totals for this account.</p>
        {(company.creditLimit != null && company.creditLimit > 0) || company.outstandingBalance > 0 ? (
          <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
            {company.creditLimit != null && company.creditLimit > 0 ? (
              <div>
                <dt className="text-zinc-500">Credit limit</dt>
                <dd className="font-medium tabular-nums text-zinc-900">${fmtUsd(company.creditLimit)}</dd>
              </div>
            ) : null}
            <div>
              <dt className="text-zinc-500">Outstanding balance</dt>
              <dd className="font-medium tabular-nums text-zinc-900">
                ${fmtUsd(company.outstandingBalance)}
              </dd>
            </div>
          </dl>
        ) : null}
      </div>

      <div className="mb-8 space-y-8">
        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-medium text-zinc-900">Activity</h2>
          <p className="mt-1 text-xs text-zinc-600">
            Timeline for this account (new estimates, jobs, status changes, shipping). Events are recorded
            automatically from the MIS.
          </p>
          {company.activities.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-500">No activity yet.</p>
          ) : (
            <ul className="mt-4 space-y-4 border-l border-zinc-200 pl-4">
              {company.activities.map((a) => (
                <li key={a.id} className="relative text-sm">
                  <span className="absolute -left-[21px] top-1.5 size-2.5 rounded-full bg-zinc-300" />
                  <p className="text-xs text-zinc-500">
                    {new Date(a.createdAt).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}{" "}
                    ·{" "}
                    <span className="font-medium text-zinc-700">
                      {activityTypeShortLabel(a.type)}
                    </span>
                  </p>
                  <p className="mt-0.5 font-medium text-zinc-900">{a.title}</p>
                  {a.body ? <p className="mt-1 text-zinc-600">{a.body}</p> : null}
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-500">
                    {a.estimateId ? (
                      <Link href={`/estimates/${a.estimateId}`} className="underline hover:text-zinc-800">
                        Open estimate
                      </Link>
                    ) : null}
                    {a.jobTicketId ? (
                      <Link href={`/jobs/${a.jobTicketId}`} className="underline hover:text-zinc-800">
                        Open job
                      </Link>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <CustomFieldsEditor
          title="Account custom fields"
          initialMap={customMap}
          saveUrl={`/api/companies/${company.id}`}
        />
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-8">
          <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-medium text-zinc-900">Profile</h2>
            {company.website ? (
              <p className="mt-3 text-sm">
                <span className="text-zinc-500">Website </span>
                <a
                  href={company.website.startsWith("http") ? company.website : `https://${company.website}`}
                  className="text-sky-800 underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  {company.website}
                </a>
              </p>
            ) : null}
            {company.address ? (
              <p className="mt-3 text-sm text-zinc-800">
                <span className="block text-zinc-500">Address</span>
                <span className="mt-1 block whitespace-pre-wrap">{company.address}</span>
              </p>
            ) : null}
            {company.notes ? (
              <p className="mt-3 text-sm text-zinc-700">
                <span className="block text-zinc-500">Notes</span>
                <span className="mt-1 block whitespace-pre-wrap">{company.notes}</span>
              </p>
            ) : null}
          </section>

          <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-medium text-zinc-900">Contacts</h2>
            {company.contacts.length === 0 ? (
              <p className="mt-3 text-sm text-zinc-600">No contacts yet. Add one from CRM home.</p>
            ) : (
              <ul className="mt-4 space-y-4">
                {company.contacts.map((c) => (
                  <li key={c.id} className="border-b border-zinc-100 pb-4 last:border-0 last:pb-0">
                    <p className="font-medium text-zinc-900">
                      {c.firstName} {c.lastName}
                      {c.isPrimary ? (
                        <span className="ml-2 rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-normal text-zinc-600">
                          Primary
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-1 text-sm text-zinc-700">
                      {c.email?.trim() ? (
                        <a href={`mailto:${c.email}`} className="text-sky-800 underline">
                          {c.email}
                        </a>
                      ) : (
                        <span className="text-zinc-500">No email</span>
                      )}
                      {c.phone ? <span className="text-zinc-600"> · {c.phone}</span> : null}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-medium text-zinc-900">Files &amp; assets</h2>
            {company.files.length === 0 ? (
              <p className="mt-3 text-sm text-zinc-600">No links yet. Add logos or guideline URLs below.</p>
            ) : (
              <ul className="mt-4 space-y-2">
                {company.files.map((f) => (
                  <li key={f.id} className="text-sm">
                    <span className="text-zinc-500">{fileKindLabel(f.kind)} — </span>
                    <a
                      href={f.url.startsWith("http") ? f.url : `https://${f.url}`}
                      className="font-medium text-sky-800 underline"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {f.label?.trim() || f.url}
                    </a>
                  </li>
                ))}
              </ul>
            )}
            <AddCompanyFileForm companyId={company.id} />
          </section>
        </div>

        <div className="space-y-8">
          <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-medium text-zinc-900">Active jobs</h2>
            {activeJobs.length === 0 ? (
              <p className="mt-3 text-sm text-zinc-600">No open jobs (queued or in progress).</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {activeJobs.map((e) =>
                  e.jobTicket ? (
                    <li key={e.id} className="text-sm">
                      <Link href={`/jobs/${e.jobTicket.id}`} className="font-medium underline">
                        Job {e.jobTicket.id.slice(0, 8)}…
                      </Link>
                      <span className="text-zinc-600">
                        {" "}
                        · {jobStatusLabel(e.jobTicket.status)}
                        {e.estimateNumber != null ? ` · Est. #${e.estimateNumber}` : ""}
                      </span>
                    </li>
                  ) : null,
                )}
              </ul>
            )}
          </section>

          <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-medium text-zinc-900">Deals (estimates)</h2>
            {company.estimates.length === 0 ? (
              <p className="mt-3 text-sm text-zinc-600">No quotes yet for this account.</p>
            ) : (
              <ul className="mt-4 divide-y divide-zinc-100 rounded-lg border border-zinc-100">
                {company.estimates.map((e) => (
                  <li
                    key={e.id}
                    className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2 text-sm"
                  >
                    <Link href={`/estimates/${e.id}`} className="font-medium text-zinc-900 underline">
                      {e.estimateNumber != null ? `Estimate #${e.estimateNumber}` : e.id.slice(0, 8)}
                    </Link>
                    <span className="tabular-nums text-zinc-700">${fmtUsd(e.totalCost)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
