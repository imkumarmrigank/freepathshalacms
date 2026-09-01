"use client";
import { useActionState, useState } from "react";
import { recordInteraction } from "../actions";
import { Card, Field } from "@/components/ui";
import { FormMessage, Submit } from "@/components/form";

type Student = { id: number; label: string; class_name: string | null };

export default function InteractionForm({
  students, defaultStudentId, meetings,
}: {
  students: Student[];
  defaultStudentId: number | null;
  meetings: { id: number; label: string }[];
}) {
  const [state, action] = useActionState(recordInteraction, null);
  const [followUp, setFollowUp] = useState(false);
  const [q, setQ] = useState("");
  const [studentId, setStudentId] = useState<number | null>(defaultStudentId);

  const filtered = q.trim()
    ? students.filter((s) => s.label.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 40)
    : students.slice(0, 40);
  const selected = students.find((s) => s.id === studentId);

  return (
    <form action={action} className="grid gap-5 lg:grid-cols-3">
      <input type="hidden" name="student_id" value={studentId ?? ""} />

      <div className="space-y-5 lg:col-span-2">
        <Card>
          <FormMessage state={state} />
          <h2 className="mb-4 text-[15px] font-semibold">Student</h2>
          {selected ? (
            <div className="flex items-center justify-between gap-3 rounded-[9px] bg-[var(--brand-soft)] px-3.5 py-3">
              <div>
                <div className="text-[14px] font-medium">{selected.label}</div>
                {selected.class_name && (
                  <div className="text-[12px] text-[var(--muted)]">{selected.class_name}</div>
                )}
              </div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setStudentId(null)}>
                Change
              </button>
            </div>
          ) : (
            <>
              <input className="input" placeholder="Search student by name or enrolment no."
                value={q} onChange={(e) => setQ(e.target.value)} />
              <div className="mt-2 max-h-56 overflow-y-auto rounded-[9px] border border-[var(--border)]">
                {filtered.length === 0 ? (
                  <p className="px-3.5 py-3 text-[13px] text-[var(--muted)]">No students match.</p>
                ) : filtered.map((s) => (
                  <button key={s.id} type="button" onClick={() => setStudentId(s.id)}
                    className="flex w-full items-center justify-between gap-3 border-b border-[#f1f1f6] px-3.5 py-2.5 text-left text-[13px] last:border-0 hover:bg-[#fafaff]">
                    <span>{s.label}</span>
                    <span className="text-[var(--muted)]">{s.class_name ?? ""}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          <h2 className="mb-4 mt-6 text-[15px] font-semibold">What was discussed</h2>
          <Field label="Discussion">
            <textarea className="textarea" name="discussion" rows={4}
              placeholder="Progress, behaviour, homework, what the parent said…" />
          </Field>
          <Field label="Concerns raised">
            <textarea className="textarea" name="concerns" rows={2} />
          </Field>
          <Field label="Agreed action items">
            <textarea className="textarea" name="action_items" rows={2} />
          </Field>
        </Card>

        <Card>
          <label className="flex items-center gap-2.5">
            <input type="checkbox" name="follow_up_required" className="h-4 w-4"
              checked={followUp} onChange={(e) => setFollowUp(e.target.checked)} />
            <span className="text-[14px] font-medium">This needs a follow-up</span>
          </label>
          {followUp && (
            <div className="mt-4 grid gap-x-4 sm:grid-cols-2">
              <Field label="Follow-up date">
                <input className="input" type="date" name="follow_up_date" required={followUp} />
              </Field>
              <Field label="How">
                <select className="select" name="follow_up_mode" defaultValue="phone">
                  <option value="phone">Phone call</option>
                  <option value="home_visit">Home visit</option>
                  <option value="center_visit">Centre visit</option>
                  <option value="video">Video call</option>
                </select>
              </Field>
            </div>
          )}
        </Card>
      </div>

      <div>
        <Card>
          <h2 className="mb-4 text-[15px] font-semibold">Details</h2>
          <Field label="Date">
            <input className="input" type="date" name="interaction_date"
              defaultValue={new Date().toISOString().slice(0, 10)} />
          </Field>
          <Field label="Mode">
            <select className="select" name="mode" defaultValue="in_person">
              <option value="in_person">In person</option>
              <option value="phone">Phone</option>
              <option value="video">Video</option>
              <option value="home_visit">Home visit</option>
            </select>
          </Field>
          <Field label="Who attended">
            <select className="select" name="parent_present" defaultValue="mother">
              <option value="mother">Mother</option>
              <option value="father">Father</option>
              <option value="both">Both parents</option>
              <option value="guardian">Guardian</option>
              <option value="none">Nobody attended</option>
            </select>
          </Field>
          <Field label="Parent engagement">
            <select className="select" name="engagement" defaultValue="neutral">
              <option value="attentive">Attentive</option>
              <option value="neutral">Neutral</option>
              <option value="resistant">Resistant</option>
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-x-4">
            <Field label="Attendance %">
              <input className="input" type="number" name="attendance_pct" min={0} max={100} step="0.01" />
            </Field>
            <Field label="Marks %">
              <input className="input" type="number" name="marks_pct" min={0} max={100} step="0.01" />
            </Field>
          </div>
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
