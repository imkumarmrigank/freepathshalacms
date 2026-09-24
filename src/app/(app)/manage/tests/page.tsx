import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { query } from "@/lib/db";
import { Card, Empty, PageHeader, StatCard } from "@/components/ui";
import Filters from "@/components/Filters";
import { testConfig } from "@/lib/staff-tests";
import { TESTED_ROLES } from "@/lib/staff-test-meta";
import { ROLE_LABEL, type Role } from "@/lib/roles";
import QuestionForm, { type Question } from "./QuestionForm";
import QuestionRow from "./QuestionRow";
import Settings from "./Settings";

export const metadata = { title: "Staff tests · Pehchaan" };

/**
 * The question bank and the rules of the test, one role at a time. Teachers
 * are the role in use; the picker is there because the bank is already keyed
 * by role and the next lot of questions can be written before anyone asks.
 */
export default async function ManageTestsPage({
  searchParams,
}: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireRole("super_admin", "admin");
  const sp = await searchParams;
  const role = (TESTED_ROLES as readonly string[]).includes(sp.role ?? "")
    ? (sp.role as string) : "teacher";

  const [cfg, questions] = await Promise.all([
    testConfig(role),
    query<Question & { used: number }>(
      `SELECT q.*, (SELECT count(*) FROM staff_test_answers a
                     WHERE a.question_id = q.id)::int AS used
         FROM staff_test_questions q
        WHERE q.for_role = $1
        ORDER BY q.is_active DESC, q.topic NULLS LAST, q.id DESC`, [role]),
  ]);

  const active = questions.filter((q) => q.is_active).length;
  // A paper cannot be drawn without repeats unless the bank holds the questions
  // for the paper plus everything held back from recent ones.
  const needed = cfg.question_count * (cfg.avoid_last_tests + 1);

  return (
    <>
      <PageHeader title="Staff tests"
        subtitle={`${ROLE_LABEL[role as Role] ?? role} · ${active} question${active === 1 ? "" : "s"} in use`}
        right={<Link href="/manage/tests/results" className="btn">Results</Link>} />

      <Filters current={sp} extra={[{ name: "role", label: "Teacher's test",
        options: TESTED_ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r as Role] ?? r })) }]} />

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <StatCard label="Questions in use" value={active}
          hint={`${questions.length - active} retired`} />
        <StatCard label="A paper needs" value={cfg.question_count}
          hint={`${cfg.duration_minutes} minutes · ${cfg.tests_per_month} a month`} />
        <StatCard label="Bank is enough for" value={active >= needed ? "Yes" : "Not yet"}
          hint={`${needed} keeps every paper fresh for ${cfg.avoid_last_tests + 1} tests`}
          tone={active >= needed ? "ok" : "warn"} />
      </div>

      <div className="label-cap mb-2.5 mt-6">How the test runs</div>
      <Settings config={cfg} />

      <div className="label-cap mb-2.5 mt-6">Add a question</div>
      <QuestionForm defaultRole={role} />

      <div className="label-cap mb-2.5 mt-6">The question bank</div>
      <Card pad={false}>
        {questions.length === 0 ? (
          <Empty title="No questions yet"
            hint="Write the first one above. A paper needs at least as many questions as it asks." />
        ) : (
          <ul>
            {questions.map((q) => (
              <QuestionRow key={q.id} question={q} used={q.used} />
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
