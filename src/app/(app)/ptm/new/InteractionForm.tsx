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
  return (
    <div className={`grid gap-x-4 gap-y-2 ${columns === 2 ? "sm:grid-cols-2" : ""}`}>
      {options.map((o) => (
        <label key={o} className="flex items-start gap-2 text-[13px]">
          <input type="checkbox" name={name} value={o} className="mt-0.5 h-4 w-4" />
          <span>{o}</span>
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
  const [state, action] = useActionState(recordInteraction, null);
  const [centerId, setCenterId] = useState<number | "">(
    () => students.find((s) => s.id === defaultStudentId)?.centerId ?? (centers.length === 1 ? centers[0].id : ""),
  );
  const [studentId, setStudentId] = useState<number | "">(defaultStudentId ?? "");
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
            <Field label="3. Learning Centre *">
              <select className="select" value={centerId}
                onChange={(e) => {
                  setCenterId(e.target.value === "" ? "" : Number(e.target.value));
                  setStudentId("");
                }}>
                <option value="">Select centre</option>
                {centers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>

            <Field label="2. Student Name *"
              hint={centerId === "" ? "Pick a centre first" : `${inCentre.length} students`}>
              <select className="select" value={studentId} required
                onChange={(e) => setStudentId(e.target.value === "" ? "" : Number(e.target.value))}>
                <option value="">Select student</option>
                {inCentre.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>

            <Field label="1. Admission Number">
              <input className="input" value={snap?.student.enrollmentNo ?? ""} readOnly
                placeholder="Fills automatically" />
            </Field>

            <Field label="4. Grade">
              <input className="input"
                value={snap?.student.className
                  ? snap.student.className + (snap.student.section ? ` · ${snap.student.section}` : "")
                  : ""}
                readOnly placeholder="Fills automatically" />
            </Field>
          </div>

          {snap && (
            <div className="mt-1 rounded-[9px] bg-[#fafaff] px-3.5 py-3 text-[13px]">
              <div className="flex flex-wrap gap-x-6 gap-y-1">
                <span><span className="text-[var(--muted)]">Father:</span> {snap.student.father ?? "—"}</span>
                <span><span className="text-[var(--muted)]">Mother:</span> {snap.student.mother ?? "—"}</span>
                <span><span className="text-[var(--muted)]">Phone:</span> {snap.student.phone ?? "—"}</span>
                <span>
                  <span className="text-[var(--muted)]">Attendance:</span>{" "}
                  {snap.attendance.pct === null
                    ? "not marked yet"
                    : `${snap.attendance.pct}% (${snap.attendance.present} of ${snap.attendance.marked} days)`}
                </span>
              </div>
            </div>
          )}
        </Card>

        {/* ------------------------------------------- the student's marks */}
        <Card>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[15px] font-semibold">Progress so far</h2>
            {studentId !== "" && (
              <Link href={`/students/${studentId}/report-card`} target="_blank"
                className="text-[13px] text-[var(--brand)] hover:underline">
                Open the full progress report →
              </Link>
            )}
          </div>

          {studentId === "" ? (
            <p className="text-[13px] text-[var(--muted)]">Choose a student to see their results.</p>
          ) : loading ? (
            <p className="text-[13px] text-[var(--muted)]">Loading…</p>
          ) : !snap || snap.tests.length === 0 ? (
            <p className="rounded-[9px] bg-[#fafaff] px-3.5 py-3 text-[13px] text-[var(--muted)]">
              No test marks recorded for this student yet.
            </p>
          ) : (
            <>
              {snap.tests.map((t) => (
                <div key={t.title + t.date} className="mb-3">
                  <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-[13px] font-semibold">{t.title}</span>
                    <span className="text-[12px] text-[var(--muted)]">
                      {t.obtained}/{t.max}{t.pct === null ? "" : ` · ${t.pct}%`}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {t.papers.map((p) => (
                      <span key={p.subject}
                        className="rounded-full border border-[var(--border)] px-2.5 py-1 text-[12px]">
                        {p.subject}{" "}
                        <strong className="tabular-nums">
                          {p.isAbsent ? "Absent" : p.obtained === null ? "—" : `${p.obtained}/${p.max}`}
                        </strong>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
              {snap.overall.pct !== null && (
                <div className="mt-2 flex items-center gap-2 border-t border-[var(--border)] pt-2.5">
                  <span className="text-[13px] font-medium">Overall</span>
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
          <h2 className="mb-4 text-[15px] font-semibold">PTM details</h2>
          <Field label="10. What were the key concerns discussed? (Select all that apply) *">
            <CheckGroup name="concern_tags" options={CONCERNS} />
          </Field>
          <Field label="If “Other”, what was it?">
            <input className="input" name="concerns" />
          </Field>
          <Field label="11. Brief Notes" hint="Summarise the discussion in 2–3 sentences.">
            <textarea className="textarea" name="discussion" rows={3} />
          </Field>
        </Card>

        {/* ------------------------------ 3: commitments and the follow-up */}
        <Card>
          <h2 className="mb-4 text-[15px] font-semibold">Commitments and follow-up</h2>
          <Field label="12. What commitments did the parent make? *">
            <CheckGroup name="commitment_tags" options={COMMITMENTS} />
          </Field>
          <Field label="13. Additional Commitment Notes">
            <textarea className="textarea" name="action_items" rows={2} />
          </Field>

          <div className="grid gap-x-4 sm:grid-cols-2">
            <Field label="15. Follow-up Priority *">
              <select className="select" name="follow_up_priority" required defaultValue="">
                <option value="">Select</option>
                {FOLLOW_UP_PRIORITY.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </Field>
            <Field label="16. Next Follow-up Date *">
              <input className="input" type="date" name="follow_up_date" required />
            </Field>
            <Field label="17. Follow-up Owner">
              <select className="select" name="follow_up_owner" defaultValue="Same Mentor">
                {FOLLOW_UP_OWNERS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </Field>
            <Field label="Assign the follow-up to" hint="Optional — leave blank to keep it yourself">
              <select className="select" name="follow_up_assignee_id" defaultValue="">
                <option value="">Keep with me</option>
                {mentors.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </Field>
          </div>

          <Field label="19. Any support needed from the Freepathshala team?">
            <textarea className="textarea" name="support_needed" rows={2} />
          </Field>
        </Card>
      </div>

      {/* ----------------------------------------------- the right column */}
      <div>
        <Card>
          <h2 className="mb-4 text-[15px] font-semibold">Interaction</h2>

          <Field label="5. Date of Interaction *">
            <input className="input" type="date" name="interaction_date" required
              max={today()} defaultValue={today()} />
          </Field>

          <Field label="6. PTM Mentor Name *">
            <select className="select" name="mentor_id" defaultValue="">
              <option value="">{mentorName} (me)</option>
              {mentors.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </Field>

          <Field label="7. Mode of Interaction *">
            <select className="select" name="mode" defaultValue="in_person">
              {PTM_MODES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>

          <Field label="8. Who attended? *">
            <select className="select" name="parent_present" required defaultValue="">
              <option value="">Select</option>
              {PARENT_PRESENT.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>

          <Field label="9. Parent Engagement Level *">
            <select className="select" name="engagement" required defaultValue="">
              <option value="">Select</option>
              {ENGAGEMENT.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>

          <Field label="18. How confident do you feel about this family’s progress? *"
            hint="1 = not confident, 5 = very confident">
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
            <Field label="Part of a scheduled PTM" hint="Optional">
              <select className="select" name="meeting_id" defaultValue="">
                <option value="">Ad-hoc interaction</option>
                {meetings.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </Field>
          )}

          <Submit>Save interaction</Submit>
        </Card>
      </div>
    </form>
  );
}
