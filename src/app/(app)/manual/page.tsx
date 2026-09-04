import fs from "node:fs";
import path from "node:path";
import Image from "next/image";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import {
  isLang, languagesFor, loadManual, manualKeyFor, type Manual,
} from "@/lib/manual";
import { ROLE_LABEL, type Role } from "@/lib/roles";
import Link from "next/link";
import PrintButton from "@/app/(app)/students/[id]/report-card/PrintButton";
import LanguagePicker from "./LanguagePicker";

export const metadata = { title: "Training manual · Pehchaan" };

/**
 * Screenshots are added as they are captured, so the page shows the ones that
 * exist and reads perfectly well without the rest — rather than leaving a row
 * of broken images behind.
 */
function capturedShots(): Set<string> {
  try {
    return new Set(
      fs.readdirSync(path.join(process.cwd(), "public", "manual"))
        .filter((f) => f.endsWith(".png"))
        .map((f) => f.slice(0, -4)),
    );
  } catch {
    return new Set();
  }
}

const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export default async function ManualPage({
  searchParams,
}: { searchParams: Promise<{ lang?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const key = manualKeyFor(user.role);
  const wanted = isLang(sp.lang) ? sp.lang : "en";
  const [m, available] = await Promise.all([
    loadManual(key, wanted) as Promise<Manual>,
    languagesFor(key),
  ]);
  const shots = capturedShots();

  return (
    <div className="doc" data-role={key as Role} lang={m.lang}>
      <PageHeader
        title="Training manual"
        subtitle={`${ROLE_LABEL[user.role]} · how to use the system, step by step`}
        right={
          <>
            <LanguagePicker available={available} current={m.lang} />
            {user.role === "super_admin" && (
              <Link href={`/manage/manual?book=${key}`} className="btn btn-ghost no-print">
                Edit manuals
              </Link>
            )}
            <PrintButton />
          </>
        }
      />

      {/* --------------------------------------------------------- the opening */}
      <header className="mb-9 border-b border-[var(--border)] pb-8">
        <h2 className="mb-3 max-w-[36rem] text-[26px] font-semibold leading-[1.2] tracking-[-0.02em]">
          {m.headline}
        </h2>
        <div className="grid gap-7 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
          <div className="doc-lede">
            {m.intro.map((p) => <p key={p.slice(0, 24)} className="mb-3 last:mb-0">{p}</p>)}
          </div>
          <div className="rounded-[11px] bg-[var(--doc-soft)] px-4 py-3.5">
            <div className="label-cap mb-2 text-[var(--doc)]">{m.routine.title}</div>
            <ol className="space-y-1.5 text-[13.5px] leading-snug">
              {m.routine.items.map((i, n) => (
                <li key={i} className="flex gap-2">
                  <span className="font-semibold tabular-nums text-[var(--doc)]">{n + 1}</span>
                  <span>{i}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </header>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_13rem]">
        {/* ------------------------------------------------------------- tasks */}
        <div>
          {m.tasks.map((t, i) => (
            <section key={t.title} id={slug(t.title)} className="doc-task doc-grid">
              <span className="doc-n mt-0.5">{i + 1}</span>
              <div className="min-w-0">
                <h3 className="text-[19px] font-semibold leading-snug">
                  {t.title}
                  {t.superAdminOnly && (
                    <span className="ml-2 align-middle rounded-full bg-[#f4f4f9] px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.07em] text-[var(--muted)]">
                      Super Admin only
                    </span>
                  )}
                </h3>
                {t.why && (
                  <p className="mt-1 max-w-[36rem] text-[14px] text-[var(--muted)]">{t.why}</p>
                )}
                {t.path.length > 0 && (
                  <div className="doc-where mt-3">
                    <div className="doc-where-label">
                      Where to find it — click in this order
                    </div>
                    <div className="doc-where-trail">
                      {t.path.map((seg, j) => (
                        <span key={seg} className="doc-hop">
                          {j > 0 && <span className="doc-hop-arrow" aria-hidden="true">→</span>}
                          <span className="doc-hop-n">{j + 1}</span>
                          <span className="doc-hop-name">{seg}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="doc-measure mt-4">
                  <ol>
                    {t.steps.map((s, j) => (
                      <li key={s.slice(0, 20)} className="doc-step">
                        <b>{j + 1}.</b><span>{s}</span>
                      </li>
                    ))}
                  </ol>

                  {t.shot && shots.has(t.shot) && (
                    <figure className="mt-4">
                      <Image src={`/manual/${t.shot}.png`} width={1280} height={720}
                        alt={`${t.title} — what the screen looks like`}
                        className="h-auto w-full rounded-[9px] border border-[var(--border)]" />
                    </figure>
                  )}

                  {t.notes?.map((n) => (
                    <div key={n.title}
                      className={`doc-note ${n.kind === "stop" ? "doc-note-stop" : ""}`}>
                      <b>{n.title}</b>{n.body}
                    </div>
                  ))}
                </div>
              </div>
            </section>
          ))}

          {/* ---------------------------------------------------------- errors */}
          <section id="pitfalls" className="doc-task">
            <h3 className="mb-1 text-[19px] font-semibold">Things that catch people out</h3>
            <p className="doc-lede mb-4">
              The messages you are most likely to meet, and what each one actually means.
            </p>
            <dl className="doc-measure">
              {m.pitfalls.map((p) => (
                <div key={p.id}
                  className="grid gap-x-5 gap-y-0.5 border-t border-[#f1f1f6] py-3 first:border-t-0 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
                  <dt className="text-[14px] font-semibold">{p.problem}</dt>
                  <dd className="text-[13.5px] leading-relaxed text-[var(--muted)]">{p.meaning}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>

        {/* -------------------------------------------------------------- rail */}
        <nav className="doc-rail no-print hidden lg:block">
          <div className="sticky top-[5.5rem]">
            <div className="label-cap mb-2.5">On this page</div>
            {m.tasks.map((t, i) => (
              <a key={t.title} href={`#${slug(t.title)}`}>
                <span className="tabular-nums text-[var(--faint)]">{i + 1}.</span> {t.title}
              </a>
            ))}
            <a href="#pitfalls">Things that catch people out</a>
          </div>
        </nav>
      </div>
    </div>
  );
}
