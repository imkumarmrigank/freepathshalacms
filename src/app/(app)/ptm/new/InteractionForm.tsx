"use client";
import { useActionState, useEffect, useState } from "react";
import { today } from "@/lib/format";
import Link from "next/link";
import { recordInteraction } from "../actions";
import { Badge, Card, Field } from "@/components/ui";
import { FormMessage, Submit } from "@/components/form";
import {
  COMMITMENTS, CONCERNS, CONFIDENCE, ENGAGEMENT, FOLLOW_UP_OWNERS,
  FOLLOW_UP_PRIORITY, PARENT_PRESENT, PTM_MODES,
} from "@/lib/ptm-meta";
import { useT } from "@/components/LocaleProvider";

export type StudentOption = {
  id: number; name: string; enrollmentNo: string;
  centerId: number; className: string | null;
};

type Snapshot = {
  student: { enrollmentNo: string; name: string; className: string | null;
             section: string | null; centerName: string; father: string | null;
             mother: string | null; phone: string | null };
  attendance: { present: number; marked: number; pct: number | null };
  tests: { title: string; type: string; date: string; pct: number | null;
           obtained: number; max: number;
           papers: { subject: string; max: number; obtained: number | null; isAbsent: boolean }[] }[];
  overall: { obtained: number; max: number; pct: number | null };
};

/** Checkbox group that mirrors a "select all that apply" question. */
function CheckGroup({
  name, options, columns = 2,
}: { name: string; options: readonly string[]; columns?: number }) {
  const t = useT();
  return (
    <div className={`grid gap-x-4 gap-y-2 ${columns === 2 ? "sm:grid-cols-2" : ""}`}>
      {options.map((o) => (
        <label key={o} className="flex items-start gap-2 text-[13px]">
          {/* the value saved stays English; only the words shown change */}
          <input type="checkbox" name={name} value={o} className="mt-0.5 h-4 w-4" />
          <span>{t(o)}</span>
        </label>
      ))}
    </div>
  );
}

export default function InteractionForm({
  students, centers, defaultStudentId, mentors, mentorName, meetings,
}: {
  students: StudentOption[];
  centers: { id: number; code: string; name: string }[];
  defaultStudentId: number | null;
  mentors: { id: number; name: string }[];
  mentorName: string;
  meetings: { id: number; label: string }[];
}) {

  const t = useT();  const [state, action] = useActionState(recordInteraction, null);
  const [centerId, setCenterId] = useState<number | "">(
    () => students.find((s) => s.id === defaultStudentId)?.centerId ?? (centers.length === 1 ? centers[0].id : ""),
  );
  const [studentId, setStudentId] = useState<number | "">(defaultStudentId ?? "");
  // Most PTMs leave something owing, so a follow-up is the starting point — but
  // a conversation that settled everything should not have to invent a date.
  const [followUp, setFollowUp] = useState(true);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(false);

  const inCentre = centerId === "" ? students : students.filter((s) => s.centerId === centerId);

  // picking a student pulls everything already known about them
  useEffect(() => {
    if (studentId === "") { setSnap(null); return; }
    let cancelled = false;
    setLoading(true);
    fetch(`/api/students/${studentId}/snapshot`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled) { setSnap(d); setLoading(false); } })
      .catch(() => { if (!cancelled) { setSnap(null); setLoading(false); } });
    return () => { cancelled = true; };
  }, [studentId]);

  return (
    <form action={action} className="grid gap-5 lg:grid-cols-3">
      <input type="hidden" name="student_id" value={studentId} />

      <div className="space-y-5 lg:col-span-2">
        {/* ------------------------------------------------ 1: the student */}
        <Card>
          <FormMessage state={state} />
          <h2 className="mb-1 text-[15px] font-semibold">Student</h2>
          <p className="mb-4 text-[13px] text-[var(--muted)]">
            Choose the centre, then the student. Everything already on record fills itself in.
          </p>

          <div className="grid gap-x-4 sm:grid-cols-2">
            <Field label={t("3. Learning Centre *")}>
              <select className="select" value={centerId}
                onChange={(e) => {
                  setCenterId(e.target.value === "" ? "" : Number(e.target.value));
                  setStudentId("");
                }}>
                <option value="">{t("Select centre")}</option>
                {centers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>

            <Field label={t("2. Student Name *")}
              hint={centerId === ""
                ? t("Pick a centre first")
                : t("{n} students", { n: inCentre.length })}>
              <select className="select" value={studentId} required
                onChange={(e) => setStudentId(e.target.value === "" ? "" : Number(e.target.value))}>
                <option value="">{t("Select student")}</option>
                {inCentre.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>

            <Field label={t("1. Admission Number")}>
              <input className="input" value={snap?.student.enrollmentNo ?? ""} readOnly
                placeholder={t("Fills automatically")} />
            </Field>

            <Field label={t("4. Grade")}>
              <input className="input"
                value={snap?.student.className
                  ? snap.student.className + (snap.student.section ? ` · ${snap.student.section}` : "")
                  : ""}
                readOnly placeholder={t("Fills automatically")} />
            </Field>
          </div>

          {snap && (
            <div className="mt-1 rounded-[9px] bg-[#fafaff] px-3.5 py-3 text-[13px]">
              <div className="flex flex-wrap gap-x-6 gap-y-1">
                <span><span className="text-[var(--muted)]">{t("Father")}:</span> {snap.student.father ?? "—"}</span>
                <span><span className="text-[var(--muted)]">{t("Mother")}:</span> {snap.student.mother ?? "—"}</span>
                <span><span className="text-[var(--muted)]">{t("Phone")}:</span> {snap.student.phone ?? "—"}</span>
                <span>
                  <span className="text-[var(--muted)]">{t("Attendance")}:</span>{" "}
                  {snap.attendance.pct === null
                    ? t("not marked yet")
                    : t("{pct}% ({present} of {marked} days)", {
                        pct: snap.attendance.pct, present: snap.attendance.present,
                        marked: snap.attendance.marked })}
                </span>
              </div>
            </div>
          )}
        </Card>

        {/* ------------------------------------------- the student's marks */}
        <Card>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[15px] font-semibold">{t("Progress so far")}</h2>
            {studentId !== "" && (
              <Link href={`/students/${studentId}/report-card`} target="_blank"
                className="text-[13px] text-[var(--brand)] hover:underline">
                {t("Open the full progress report →")}
              </Link>
            )}
          </div>

          {studentId === "" ? (
            <p className="text-[13px] text-[var(--muted)]">{t("Choose a student to see their results.")}</p>
          ) : loading ? (
            <p className="text-[13px] text-[var(--muted)]">{t("Loading…")}</p>
          ) : !snap || snap.tests.length === 0 ? (
            <p className="rounded-[9px] bg-[#fafaff] px-3.5 py-3 text-[13px] text-[var(--muted)]">
              {t("No test marks recorded for this student yet.")}
            </p>
          ) : (
            <>
              {snap.tests.map((exam) => (
                <div key={exam.title + exam.date} className="mb-3">
                  <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-[13px] font-semibold">{exam.title}</span>
                    <span className="text-[12px] text-[var(--muted)]">
                      {exam.obtained}/{exam.max}{exam.pct === null ? "" : ` · ${exam.pct}%`}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {exam.papers.map((p) => (
                      <span key={p.subject}
                        className="rounded-full border border-[var(--border)] px-2.5 py-1 text-[12px]">
                        {p.subject}{" "}
                        <strong className="tabular-nums">
                          {p.isAbsent ? t("Absent")
                            : p.obtained === null ? "—" : `${p.obtained}/${p.max}`}
                        </strong>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
              {snap.overall.pct !== null && (
                <div className="mt-2 flex items-center gap-2 border-t border-[var(--border)] pt-2.5">
                  <span className="text-[13px] font-medium">{t("Overall")}</span>
                  <Badge tone={snap.overall.pct >= 60 ? "ok" : snap.overall.pct >= 40 ? "warn" : "bad"}>
                    {snap.overall.obtained}/{snap.overall.max} · {snap.overall.pct}%
                  </Badge>
                </div>
              )}
            </>
          )}
        </Card>

        {/* --------------------------------------------- 2: the discussion */}
        <Card>
          <h2 className="mb-4 text-[15px] font-semibold">{t("PTM details")}</h2>
          <Field label={t("10. What were the key concerns discussed? (Select all that apply) *")}>
            <CheckGroup name="concern_tags" options={CONCERNS} />
          </Field>
          <Field label={t("If “Other”, what was it?")}>
            <input className="input" name="concerns" />
          </Field>
          <Field label={t("11. Brief Notes")} hint={t("Summarise the discussion in 2–3 sentences.")}>
            <textarea className="textarea" name="discussion" rows={3} />
          </Field>
        </Card>

        {/* ------------------------------ 3: commitments and the follow-up */}
        <Card>
          <h2 className="mb-4 text-[15px] font-semibold">{t("Commitments and follow-up")}</h2>
          <Field label={t("12. What commitments did the parent make? *")}>
            <CheckGroup name="commitment_tags" options={COMMITMENTS} />
          </Field>
          <Field label={t("13. Additional Commitment Notes")}>
            <textarea className="textarea" name="action_items" rows={2} />
          </Field>

          <Field label={t("14. Is a follow-up needed? *")}>
            <div className="flex flex-wrap gap-4 text-[13px]">
              <label className="flex items-center gap-2">
                <input type="radio" name="follow_up_required" value="yes" className="h-4 w-4"
                  checked={followUp} onChange={() => setFollowUp(true)} />
                <span>{t("Yes — something was promised")}</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="follow_up_required" value="no" className="h-4 w-4"
                  checked={!followUp} onChange={() => setFollowUp(false)} />
                <span>{t("No follow-up required")}</span>
              </label>
            </div>
          </Field>

          {!followUp && (
            <p className="mb-4 text-[13px] text-[var(--muted)]">
              {t("The interaction is recorded on its own — nothing will appear on the follow-ups list.")}
            </p>
          )}

          <div className={`grid gap-x-4 sm:grid-cols-2 ${followUp ? "" : "hidden"}`}>
            <Field label={t("15. Follow-up Priority *")}>
              <select className="select" name="follow_up_priority" required={followUp} defaultValue="">
                <option value="">{t("Select")}</option>
                {FOLLOW_UP_PRIORITY.map((o) => (
                  <option key={o.value} value={o.value}>{t(o.label)}</option>
                ))}
              </select>
            </Field>
            <Field label={t("16. Next Follow-up Date *")}>
              <input className="input" type="date" name="follow_up_date" required={followUp} />
            </Field>
            <Field label={t("17. Follow-up Owner")}>
              <select className="select" name="follow_up_owner" defaultValue="Same Mentor">
                {FOLLOW_UP_OWNERS.map((o) => <option key={o} value={o}>{t(o)}</option>)}
              </select>
            </Field>
            <Field label={t("Assign the follow-up to")} hint={t("Optional — leave blank to keep it yourself")}>
              <select className="select" name="follow_up_assignee_id" defaultValue="">
                <option value="">{t("Keep with me")}</option>
                {mentors.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </Field>
          </div>

          <Field label={t("19. Any support needed from the Freepathshala team?")}>
            <textarea className="textarea" name="support_needed" rows={2} />
          </Field>
        </Card>
      </div>

      {/* ----------------------------------------------- the right column */}
      <div>
        <Card>
          <h2 className="mb-4 text-[15px] font-semibold">{t("Interaction")}</h2>

          <Field label={t("5. Date of Interaction *")}>
            <input className="input" type="date" name="interaction_date" required
              max={today()} defaultValue={today()} />
          </Field>

          <Field label={t("6. PTM Mentor Name *")}>
            <select className="select" name="mentor_id" defaultValue="">
              <option value="">{t("{who} (me)", { who: mentorName })}</option>
              {mentors.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </Field>

          <Field label={t("7. Mode of Interaction *")}>
            <select className="select" name="mode" defaultValue="in_person">
              {PTM_MODES.map((o) => <option key={o.value} value={o.value}>{t(o.label)}</option>)}
            </select>
          </Field>

          <Field label={t("8. Who attended? *")}>
            <select className="select" name="parent_present" required defaultValue="">
              <option value="">{t("Select")}</option>
              {PARENT_PRESENT.map((o) => <option key={o.value} value={o.value}>{t(o.label)}</option>)}
            </select>
          </Field>

          <Field label={t("9. Parent Engagement Level *")}>
            <select className="select" name="engagement" required defaultValue="">
              <option value="">{t("Select")}</option>
              {ENGAGEMENT.map((o) => <option key={o.value} value={o.value}>{t(o.label)}</option>)}
            </select>
          </Field>

          <Field label={t("18. How confident do you feel about this family’s progress? *")}
            hint={t("1 = not confident, 5 = very confident")}>
            <div className="flex gap-2">
              {CONFIDENCE.map((n) => (
                <label key={n}
                  className="flex flex-1 cursor-pointer flex-col items-center gap-1 rounded-[9px] border border-[var(--border-strong)] py-2 text-[13px] hover:border-[var(--brand)]">
                  <input type="radio" name="confidence" value={n} required className="h-4 w-4" />
                  {n}
                </label>
              ))}
            </div>
          </Field>

          {meetings.length > 0 && (
            <Field label={t("Part of a scheduled PTM")} hint={t("Optional")}>
              <select className="select" name="meeting_id" defaultValue="">
                <option value="">{t("Ad-hoc interaction")}</option>
                {meetings.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </Field>
          )}

          <Submit>{t("Save interaction")}</Submit>
        </Card>
      </div>
    </form>
  );
}
