import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { Card, PageHeader } from "@/components/ui";
import {
  loadManual, isManualKey, MANUAL_KEYS, MANUAL_LABEL, MANUAL_AUDIENCE,
} from "@/lib/manual";
import { IntroEditor, TaskEditor, PitfallEditor } from "./Editors";

export const metadata = { title: "Edit manuals · FreePathshala CMS" };

export default async function ManageManualPage({
  searchParams,
}: { searchParams: Promise<{ book?: string }> }) {
  await requireRole("super_admin");
  const sp = await searchParams;
  const book = sp.book && isManualKey(sp.book) ? sp.book : "teacher";
  const m = await loadManual(book);

  return (
    <>
      <PageHeader
        title="Training manuals"
        subtitle="What each role reads. Changes appear the moment they are saved."
        back={{ href: "/manual", label: "Training manual" }}
      />

      <div className="mb-5 flex flex-wrap gap-2">
        {MANUAL_KEYS.map((k) => (
          <Link key={k} href={`/manage/manual?book=${k}`}
            className={`btn btn-sm ${k === book ? "btn-primary" : "btn-ghost"}`}>
            {MANUAL_LABEL[k]}
          </Link>
        ))}
      </div>

      <Card className="mb-5">
        <p className="text-[13px] text-[var(--muted)]">
          You are editing the manual read by <b className="text-[var(--text)]">
          {MANUAL_AUDIENCE[book]}</b>. It has {m.tasks.length} step
          {m.tasks.length === 1 ? "" : "s"} and {m.pitfalls.length} common problem
          {m.pitfalls.length === 1 ? "" : "s"}.
        </p>
      </Card>

      <div className="space-y-4">
        <IntroEditor book={book} m={m} />

        <div className="label-cap pt-2">Steps</div>
        {m.tasks.map((t, i) => (
          <TaskEditor key={t.id} book={book} task={t} index={i} count={m.tasks.length} />
        ))}
        <TaskEditor book={book} />

        <div className="label-cap pt-2">Common problems</div>
        <PitfallEditor book={book} rows={m.pitfalls} />
      </div>
    </>
  );
}
