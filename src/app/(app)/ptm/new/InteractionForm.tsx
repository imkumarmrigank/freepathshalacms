"use client";
import { useActionState, useEffect, useState } from "react";
import { fmtDate } from "@/lib/format";
import Link from "next/link";
import { recordInteraction } from "../actions";
import { Avatar, Badge, Card, Field } from "@/components/ui";
import { FormMessage, Submit } from "@/components/form";
import {
  COMMITMENTS, CONCERN_OPTIONS, CONFIDENCE, ENGAGEMENT, FOLLOW_UP_OWNER_OPTIONS,
  NO_COMMITMENT, PARENT_PRESENT, PTM_MODES, followUpDateFor,
} from "@/lib/ptm-meta";
import { useT } from "@/components/LocaleProvider";

export type StudentOption = {
  id: number; name: string; enrollmentNo: string;
  centerId: number; className: string | null;
};

type Snapshot = {
  student: { enrollmentNo: string; name: string; className: string | null;
             section: string | null; centerName: string; father: string | null;
             mother: string | null; phone: string | null;
             photo: string | null; fatherPhoto: string | null; motherPhoto: string | null };
  attendance: { present: number; marked: number; pct: number | null };
  tests: { title: string; type: string; date: string; pct: number | null;
           obtained: number; max: number;
           papers: { subject: string; max: number; obtained: number | null; isAbsent: boolean }[] }[];
  overall: { obtained: number; max: number; pct: number | null };
};

/**
 * Checkbox group that mirrors a "select all that apply" question. With
 * `exclusive`, ticking that option clears the others and ticking any other
 * option clears it again.
 */
function CheckGroup({
  name, options, columns = 2, exclusive,
}: { name: string; options: readonly string[]; columns?: number; exclusive?: string }) {
  const t = useT();
  return (
    <div className={`grid gap-x-4 gap-y-2 ${columns === 2 ? "sm:grid-cols-2" : ""}`}
      onChange={exclusive ? (e) => {
        const box = e.target as HTMLInputElement;
        if (!box.checked) return;
        e.currentTarget.querySelectorAll<HTMLInputElement>("input[type=checkbox]").forEach((other) => {
          if (other !== box && (box.value === exclusive || other.value === exclusive)) other.checked = false;
        });
      } : undefined}>
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
  students, centers, defaultStudentId, mentors, lockedMeeting, meetings,
}: {
  students: StudentOption[];
  centers: { id: number; code: string; name: string }[];
  defaultStudentId: number | null;
  mentors: { id: number; name: string }[];
  lockedMeeting: { id: number; centerId: number; centerName: string; label: string } | null;
  meetings: { id: number; label: string }[];
}) {

  const t = useT();  const [state, action] = useActionState(recordInteraction, null);
  const [centerId, setCenterId] = useState<number | "">(
    () => lockedMeeting?.centerId ?? students.find((s) => s.id === defaultStudentId)?.centerId ?? (centers.length === 1 ? centers[0].id : ""),
  );
  const [studentId, setStudentId] = useState<number | "">(defaultStudentId ?? "");
  // Most PTMs leave something owing, so a follow-up is the starting point — but
  // a conversation that settled everything should not have to invent a date.
  const [followUp, setFollowUp] = useState(true);
  // who owns the follow-up decides its date (teacher/principal: a week, mentor: a month)
  const [owner, setOwner] = useState<string>("Mentor");
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(false);

  // every subject that appears in any test becomes a column of the grid
  const subjects = [...new Set((snap?.tests ?? []).flatMap((e) => e.papers.map((p) => p.subject)))];

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
            {lockedMeeting ? lockedMeeting.label + " — " : ""}Choose the student. Everything already on record fills itself in.
          </p>

          <div className="grid gap-x-4 sm:grid-cols-2">
            {lockedMeeting ? (
              <Field label={t("Learning Centre")}>
                <input className="input" value={lockedMeeting.centerName} readOnly />
              </Field>
            ) : (
              <Field label={t("Learning Centre *")}>
                <select className="select" value={centerId}
                  onChange={(e) => {
                    setCenterId(e.target.value === "" ? "" : Number(e.target.value));
                    setStudentId("");
                  }}>
                  <option value="">{t("Select centre")}</option>
                  {centers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
            )}

            <Field label={t("Student Name *")}
              hint={centerId === ""
                ? t("Pick a centre first")
                : t("{n} students", { n: inCentre.length })}>
              <select className="select" value={studentId} required
                onChange={(e) => setStudentId(e.target.value === "" ? "" : Number(e.target.value))}>
                <option value="">{t("Select student")}</option>
                {inCentre.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>

            <Field label={t("Admission Number")}>
              <input className="input" value={snap?.student.enrollmentNo ?? ""} readOnly
                placeholder={t("Fills automatically")} />
            </Field>

            <Field label={t("Grade")}>
              <input className="input"
                value={snap?.student.className
                  ? snap.student.className + (snap.student.section ? ` · ${snap.student.section}` : "")
                  : ""}
                readOnly placeholder={t("Fills automatically")} />
            </Field>
          </div>

          {snap && (
            <div className="mt-1 rounded-[9px] bg-[#fafaff] px-3.5 py-3 text-[13px]">
              <div className="mb-3 flex flex-wrap gap-5">
                {[
                  { label: t("Student"), name: snap.student.name, src: snap.student.photo },
                  { label: t("Father"), name: snap.student.father ?? t("Father"), src: snap.student.fatherPhoto },
                  { label: t("Mother"), name: snap.student.mother ?? t("Mother"), src: snap.student.motherPhoto },
                ].map((p) => (
                  <div key={p.label} className="flex flex-col items-center gap-1 text-center">
                    <Avatar name={p.name} size={72} src={p.src} />
                    <span className="text-[12px] text-[var(--muted)]">{p.label}</span>
                    <span className="max-w-[110px] text-[12px]">{p.name}</span>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-1">
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
            <h2 className="text-[15px]">{t("Progress so far")}</h2>
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
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead>
                  <tr>
                    <th className="font-normal">{t("Test")}</th>
                    {subjects.map((sub) => <th key={sub} className="font-normal">{sub}</th>)}
                    <th className="font-normal">{t("Total")}</th>
                  </tr>
                </thead>
                <tbody>
                  {snap.tests.map((exam) => (
                    <tr key={exam.title + exam.date}>
                      <td>{exam.title}</td>
                      {subjects.map((sub) => {
                        const p = exam.papers.find((x) => x.subject === sub);
                        return (
                          <td key={sub} className="tabular-nums">
                            {!p ? "—" : p.isAbsent ? t("Absent")
                              : p.obtained === null ? "—" : `${p.obtained}/${p.max}`}
                          </td>
                        );
                      })}
                      <td className="tabular-nums">
                        {exam.obtained}/{exam.max}{exam.pct === null ? "" : ` · ${exam.pct}%`}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {snap.overall.pct !== null && (
                  <tfoot>
                    <tr>
                      <td>{t("Overall")}</td>
                      <td colSpan={subjects.length} />
                      <td>
                        <Badge tone={snap.overall.pct >= 60 ? "ok" : snap.overall.pct >= 40 ? "warn" : "bad"}>
                          {snap.overall.obtained}/{snap.overall.max} · {snap.overall.pct}%
                        </Badge>
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </Card>

        {/* --------------------------------------------- 2: the discussion */}
        <Card>
          <h2 className="mb-4 text-[15px] font-semibold">{t("Problems expressed by Parent")}</h2>
          <Field label={t("Concern category (select all that apply) *")}>
            <div className="grid gap-y-2">
              <div className="hidden grid-cols-[2rem_1fr_1fr] gap-x-3 text-[12px] text-[var(--muted)] sm:grid">
                <span>{t("No.")}</span><span>{t("Concern Category in Form")}</span>
                <span>{t("Select When Parent Talks About…")}</span>
              </div>
              {CONCERN_OPTIONS.map((c, i) => (
                <label key={c.name}
                  className="grid items-start gap-x-3 gap-y-0.5 border-t border-[var(--border)] pt-2 text-[13px] sm:grid-cols-[2rem_1fr_1fr]">
                  <span className="text-[var(--muted)]">{i + 1}</span>
                  <span className="flex items-start gap-2">
                    <input type="checkbox" name="concern_tags" value={c.name} className="mt-0.5 h-4 w-4" />
                    <span>{t(c.name)}</span>
                  </span>
                  <span className="text-[var(--muted)]">{c.hint ? t(c.hint) : ""}</span>
                </label>
              ))}
            </div>
          </Field>
          <Field label={t("If “Other”, what was it?")}>
            <input className="input" name="concerns" />
          </Field>
          <Field label={t("Brief Notes")} hint={t("Summarise the discussion in 2–3 sentences.")}>
            <textarea className="textarea" name="discussion" rows={3} />
          </Field>
        </Card>

        {/* ------------------------------ 3: commitments and the follow-up */}
        <Card>
          <h2 className="mb-4 text-[15px] font-semibold">{t("Commitments")}</h2>
          <Field label={t("What commitments did the parent make? *")}>
            <CheckGroup name="commitment_tags" options={COMMITMENTS} exclusive={NO_COMMITMENT} />
          </Field>
          <Field label={t("Additional Commitment Notes")}>
            <textarea className="textarea" name="action_items" rows={2} />
          </Field>

          <Field label={t("Is a follow-up needed? *")}>
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

          <div className={followUp ? "" : "hidden"}>
            <Field label={t("Follow-up with *")}>
              <div className="grid gap-2 sm:grid-cols-3">
                {FOLLOW_UP_OWNER_OPTIONS.map((o) => (
                  <label key={o.value}
                    className={`flex cursor-pointer flex-col gap-0.5 rounded-[9px] border px-3 py-2 text-[13px] ${
                      owner === o.value ? "border-[var(--brand)]" : "border-[var(--border-strong)]"}`}>
                    <span className="flex items-center gap-2">
                      <input type="radio" name="follow_up_owner" value={o.value} className="h-4 w-4"
                        checked={owner === o.value} onChange={() => setOwner(o.value)} />
                      {t(o.value)}
                    </span>
                    <span className="pl-6 text-[12px] text-[var(--muted)]">
                      {fmtDate(followUpDateFor(o.value))}
                      {" · "}{o.value === "Mentor" ? t("next month") : t("next week")}
                    </span>
                  </label>
                ))}
              </div>
            </Field>
            <Field label={t("Write text description")}>
              <textarea className="textarea" name="follow_up_description" rows={3} />
            </Field>
            <Field label={t("Assign the follow-up to")} hint={t("Optional — leave blank to keep it yourself")}>
              <select className="select" name="follow_up_assignee_id" defaultValue="">
                <option value="">{t("Keep with me")}</option>
                {mentors.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </Field>
          </div>

          <Field label={t("Centre Feedback")}>
            <textarea className="textarea" name="centre_feedback" rows={3} />
          </Field>

          <Field label={t("Any support needed from the Freepathshala team?")}>
            <textarea className="textarea" name="support_needed" rows={2} />
          </Field>
        </Card>
      </div>

      {/* ----------------------------------------------- the right column */}
      <div>
        <Card>
          <h2 className="mb-4 text-[15px] font-semibold">{t("Interaction")}</h2>

          <Field label={t("Mode of Interaction *")}>
            <select className="select" name="mode" defaultValue="in_person">
              {PTM_MODES.map((o) => <option key={o.value} value={o.value}>{t(o.label)}</option>)}
            </select>
          </Field>

          <Field label={t("Who attended? *")}>
            <select className="select" name="parent_present" required defaultValue="">
              <option value="">{t("Select")}</option>
              {PARENT_PRESENT.map((o) => <option key={o.value} value={o.value}>{t(o.label)}</option>)}
            </select>
          </Field>

          <Field label={t("Parent Engagement Level *")}>
            <select className="select" name="engagement" required defaultValue="">
              <option value="">{t("Select")}</option>
              {ENGAGEMENT.map((o) => <option key={o.value} value={o.value}>{t(o.label)}</option>)}
            </select>
          </Field>

          <Field label={t("How confident do you feel about this family’s progress? *")}
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

          {lockedMeeting ? (
            <input type="hidden" name="meeting_id" value={lockedMeeting.id} />
          ) : meetings.length > 0 && (
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
