import { requireRole } from "@/lib/auth";
import { Card, PageHeader } from "@/components/ui";
import { auditSettings, listCriteria } from "@/lib/audits";
import { CriterionEditor, NewCriterion, ScoringEditor } from "./Editors";

export const metadata = { title: "What auditors check · Pehchaan" };

export default async function AuditCriteriaPage() {
  await requireRole("super_admin");
  const [criteria, scoring] = await Promise.all([listCriteria(true), auditSettings()]);

  const sections = new Map<string, typeof criteria>();
  for (const c of criteria) sections.set(c.section, [...(sections.get(c.section) ?? []), c]);

  return (
    <>
      <PageHeader
        title="What auditors check"
        subtitle="The checklist every centre is rated against, and how the award is scored."
        back={{ href: "/audits", label: "Centre audits" }}
      />

      <Card className="mt-4">
        <p className="text-[13.5px] leading-relaxed text-[var(--muted)]">
          Changes take effect at the next visit. Reports already filed keep the wording
          they were scored against, so editing a criterion never rewrites history.
          Retire a criterion rather than deleting it — that is why there is no delete.
        </p>
      </Card>

      <ScoringEditor settings={scoring} />

      {[...sections.entries()].map(([name, list]) => (
        <Card key={name} className="mt-5" pad={false}>
          <div className="border-b border-[var(--border)] px-5 py-3">
            <h2 className="text-[14px] font-semibold">{name}</h2>
          </div>
          <ul>
            {list.map((c) => (
              <li key={c.id} className="border-t border-[#f1f1f6] px-5 py-4 first:border-0">
                <CriterionEditor c={c} />
              </li>
            ))}
          </ul>
        </Card>
      ))}

      <NewCriterion sections={[...sections.keys()]} />
    </>
  );
}
