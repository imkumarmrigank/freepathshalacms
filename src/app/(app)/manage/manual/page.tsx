import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { Card, PageHeader } from "@/components/ui";
import {
  loadManual, isLang, isManualKey, LANGUAGES, MANUAL_KEYS, MANUAL_LABEL,
  MANUAL_AUDIENCE, langLabel,
} from "@/lib/manual";
import { IntroEditor, TaskEditor, PitfallEditor } from "./Editors";

export const metadata = { title: "Edit manuals · Pehchaan" };

export default async function ManageManualPage({
  searchParams,
}: { searchParams: Promise<{ book?: string; lang?: string }> }) {
  await requireRole("super_admin");
  const sp = await searchParams;
  const book = sp.book && isManualKey(sp.book) ? sp.book : "teacher";
  const lang = isLang(sp.lang) ? sp.lang : "en";
  const m = await loadManual(book, lang);
  // loadManual falls back to English when a language is empty; here we want the
  // empty copy itself, so it can be written
  const writing = lang;
  const started = m.lang === lang;

  return (
    <>
      <PageHeader
        title="Training manuals"
        subtitle="What each role reads. Changes appear the moment they are saved."
        back={{ href: "/manual", label: "Training manual" }}
      />

      <div className="mb-3 flex flex-wrap gap-2">
        {MANUAL_KEYS.map((k) => (
          <Link key={k} href={`/manage/manual?book=${k}&lang=${lang}`}
            className={`btn btn-sm ${k === book ? "btn-primary" : "btn-ghost"}`}>
            {MANUAL_LABEL[k]}
          </Link>
        ))}
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-1.5">
        <span className="label-cap mr-1">Language</span>
        {LANGUAGES.map((l) => (
          <Link key={l.code} href={`/manage/manual?book=${book}&lang=${l.code}`}
            lang={l.code}
            className={`btn btn-sm ${l.code === lang ? "btn-primary" : "btn-ghost"}`}>
            {l.native}
          </Link>
        ))}
      </div>

      <Card className="mb-5">
        <p className="text-[13px] text-[var(--muted)]">
          You are editing the <b className="text-[var(--text)]">{langLabel(lang)}</b> manual
          read by <b className="text-[var(--text)]">{MANUAL_AUDIENCE[book]}</b>.
          {started
            ? ` It has ${m.tasks.length} step${m.tasks.length === 1 ? "" : "s"} and `
              + `${m.pitfalls.length} common problem${m.pitfalls.length === 1 ? "" : "s"}.`
            : " Nothing has been written in this language yet — what is shown below is "
              + "the English copy, for you to translate. Saving a step writes it into "
              + "this language; the English one is left alone."}
        </p>
      </Card>

      <div className="space-y-4">
        <IntroEditor book={book} lang={writing} m={m} />

        <div className="label-cap pt-2">Steps</div>
        {m.tasks.map((t, i) => (
          <TaskEditor key={`${writing}-${t.id}`} book={book} lang={writing}
            task={started ? t : { ...t, id: 0 }} index={i} count={m.tasks.length} />
        ))}
        <TaskEditor book={book} lang={writing} />

        <div className="label-cap pt-2">Common problems</div>
        <PitfallEditor book={book} lang={writing}
          rows={started ? m.pitfalls : m.pitfalls.map((p) => ({ ...p, id: 0 }))} />
      </div>
    </>
  );
}
