import fs from "node:fs";
import path from "node:path";
import Image from "next/image";
import { requireUser } from "@/lib/auth";
import { Card, PageHeader } from "@/components/ui";
import { manualFor } from "@/lib/manual";
import { ROLE_LABEL } from "@/lib/roles";
import PrintButton from "@/app/(app)/students/[id]/report-card/PrintButton";

export const metadata = { title: "Training manual · FreePathshala CMS" };

/**
 * The handbook for whoever is signed in. Each role sees only their own, because
 * a teacher reading "this part does not apply to you" four times learns to skim.
 */
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

export default async function ManualPage() {
  const user = await requireUser();
  const m = manualFor(user.role);
  const shots = capturedShots();

  return (
    <>
      <PageHeader
        title="Training manual"
        subtitle={`${ROLE_LABEL[user.role]} · how to use the system, step by step`}
        right={<PrintButton />}
      />

      <Card className="mb-5">
        <div className="grid gap-6 md:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
          <div>
            <h2 className="mb-2 text-[19px] font-semibold tracking-[-0.01em]">{m.headline}</h2>
            {m.intro.map((p) => (
              <p key={p.slice(0, 24)} className="mb-2.5 text-[14px] text-[var(--muted)]">{p}</p>
            ))}
          </div>
          <div className="rounded-[10px] bg-[var(--brand-soft)] p-4">
            <div className="label-cap mb-2 text-[var(--brand)]">{m.routine.title}</div>
            <ol className="ml-4 list-decimal space-y-1 text-[13.5px]">
              {m.routine.items.map((i) => <li key={i}>{i}</li>)}
            </ol>
          </div>
        </div>
      </Card>

      <ol className="space-y-4">
        {m.tasks.map((t, i) => (
          <li key={t.title}>
            <Card>
              <div className="flex items-baseline gap-3">
                <span className="grid h-7 w-7 flex-none place-items-center rounded-full bg-[var(--brand)] text-[13px] font-bold text-white">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-[16px] font-semibold tracking-[-0.01em]">
                    {t.title}
                    {t.superAdminOnly && (
                      <span className="ml-2 rounded-full bg-[#f4f4f9] px-2 py-0.5 align-middle text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--muted)]">
                        Super Admin only
                      </span>
                    )}
                  </h3>
                  {t.why && (
                    <p className="mt-1 text-[13.5px] text-[var(--muted)]">{t.why}</p>
                  )}
                </div>
              </div>

              <div className="mt-3 sm:ml-10">
                {t.path && (
                  <div className="mb-3 inline-flex flex-wrap items-center gap-1.5 rounded-[7px] bg-[#f4f4f9] px-2.5 py-1.5 font-mono text-[12.5px]">
                    {t.path.map((seg, j) => (
                      <span key={seg} className="flex items-center gap-1.5">
                        {j > 0 && <span className="text-[var(--faint)]">›</span>}
                        <span className="font-semibold">{seg}</span>
                      </span>
                    ))}
                  </div>
                )}

                <ol className="space-y-2 text-[14px]">
                  {t.steps.map((s, j) => (
                    <li key={s.slice(0, 20)} className="flex gap-2.5">
                      <span className="flex-none font-semibold tabular-nums text-[var(--brand)]">
                        {j + 1}.
                      </span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ol>

                {t.shot && shots.has(t.shot) && (
                  <figure className="mt-3.5">
                    <Image
                      src={`/manual/${t.shot}.png`}
                      alt={`${t.title} — what the screen looks like`}
                      width={1280} height={720}
                      className="h-auto w-full rounded-[9px] border border-[var(--border)]"
                    />
                  </figure>
                )}

                {t.notes?.map((n) => (
                  <div key={n.title}
                    className={`mt-3 rounded-r-[8px] border-l-[3px] px-3.5 py-2.5 text-[13.5px] ${
                      n.kind === "stop"
                        ? "border-[var(--bad)] bg-[var(--bad-soft)]"
                        : "border-[var(--warn)] bg-[var(--warn-soft)]"}`}>
                    <b className="mb-0.5 block">{n.title}</b>
                    <span className="text-[var(--text)]">{n.body}</span>
                  </div>
                ))}
              </div>
            </Card>
          </li>
        ))}
      </ol>

      <Card className="mt-5">
        <h2 className="mb-3 text-[16px] font-semibold">Things that catch people out</h2>
        <dl className="divide-y divide-[#f1f1f6]">
          {m.pitfalls.map(([problem, meaning]) => (
            <div key={problem} className="grid gap-1 py-2.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] sm:gap-4">
              <dt className="text-[14px] font-semibold">{problem}</dt>
              <dd className="text-[13.5px] text-[var(--muted)]">{meaning}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </>
  );
}
