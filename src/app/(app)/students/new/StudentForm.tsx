"use client";
import { useActionState } from "react";
import { createStudent } from "../actions";
import { Card, Field } from "@/components/ui";
import { FormMessage, Submit } from "@/components/form";

export default function StudentForm({
  centers, classes, showCenter, defaultCenterId, sessionName, sessionStart,
}: {
  centers: { id: number; code: string; name: string }[];
  classes: { id: number; name: string }[];
  showCenter: boolean;
  defaultCenterId: number | null;
  sessionName: string;
  sessionStart: string;
}) {
  const [state, action] = useActionState(createStudent, null);
  const today = new Date().toISOString().slice(0, 10);
  const midSession = today > sessionStart.slice(0, 10);

  return (
    <form action={action} className="grid gap-5 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <Card>
          <FormMessage state={state} />
          <h2 className="mb-4 text-[15px] font-semibold">Student details</h2>
          <div className="grid gap-x-4 sm:grid-cols-2">
            <Field label="First name *"><input className="input" name="first_name" required /></Field>
            <Field label="Last name"><input className="input" name="last_name" /></Field>
            <Field label="Gender">
              <select className="select" name="gender" defaultValue="">
                <option value="">Select</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </Field>
            <Field label="Date of birth"><input className="input" type="date" name="dob" /></Field>
          </div>

          <h2 className="mb-4 mt-6 text-[15px] font-semibold">Parent / guardian</h2>
          <div className="grid gap-x-4 sm:grid-cols-2">
            <Field label="Father's name"><input className="input" name="father_name" /></Field>
            <Field label="Mother's name"><input className="input" name="mother_name" /></Field>
            <Field label="Guardian's name"><input className="input" name="guardian_name" /></Field>
            <Field label="Primary phone"><input className="input" name="primary_phone" inputMode="tel" /></Field>
            <Field label="Alternate phone"><input className="input" name="alt_phone" inputMode="tel" /></Field>
            <Field label="Email"><input className="input" type="email" name="email" /></Field>
            <Field label="Address" wide><textarea className="textarea" name="address" rows={2} /></Field>
          </div>
        </Card>
      </div>

      <div>
        <Card>
          <h2 className="mb-4 text-[15px] font-semibold">Enrolment</h2>
          <div className="mb-4 rounded-[9px] bg-[var(--brand-soft)] px-3.5 py-2.5 text-[13px] text-[var(--brand)]">
            Enrolment number is generated automatically once you save.
          </div>

          {showCenter ? (
            <Field label="Centre *">
              <select className="select" name="center_id" required defaultValue={defaultCenterId ?? ""}>
                <option value="">Select centre</option>
                {centers.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}
              </select>
            </Field>
          ) : (
            <Field label="Centre">
              <input className="input" value={centers[0]?.name ?? ""} disabled readOnly />
            </Field>
          )}

          <Field label="Class *">
            <select className="select" name="class_level_id" required defaultValue="">
              <option value="">Select class</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-x-4">
            <Field label="Section"><input className="input" name="section" placeholder="A" /></Field>
            <Field label="Roll no."><input className="input" type="number" name="roll_no" min={1} /></Field>
          </div>

          <Field label="Joining date"
            hint={midSession
              ? `Session ${sessionName} is already running — this will be recorded as a mid-session admission.`
              : `Session ${sessionName}`}>
            <input className="input" type="date" name="enrolled_on" defaultValue={today} />
          </Field>

          <Field label="Notes"><textarea className="textarea" name="notes" rows={2} /></Field>

          <Submit>Save student</Submit>
        </Card>
      </div>
    </form>
  );
}
