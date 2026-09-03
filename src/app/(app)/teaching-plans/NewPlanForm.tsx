"use client";
import { useActionState, useState } from "react";
import { createPlan } from "./actions";
import { Card, Field } from "@/components/ui";
import { FormMessage, Submit } from "@/components/form";
import HindiInput from "@/components/HindiInput";

export default function NewPlanForm({
  classes, teachers, centers, isTeacher, isAdmin, leadDays,
}: {
  leadDays: number;
  classes: { id: number; name: string }[];
  teachers: { id: number; name: string }[];
  centers: { id: number; code: string; name: string }[];
  isTeacher: boolean;
  isAdmin: boolean;
}) {
  const [state, action] = useActionState(createPlan, null);
  // a Hindi plan is written in Hindi, so the fields start in Hindi
  const [subject, setSubject] = useState("");
  const hindiPlan = /hindi|हिंदी|हिन्दी/i.test(subject);
  const earliestDate = new Date();
  earliestDate.setDate(earliestDate.getDate() + leadDays);
  const earliest = earliestDate.toISOString().slice(0, 10);

  if (isTeacher && classes.length === 0) {
    return (
      <Card>
        <h2 className="mb-2 text-[15px] font-semibold">New plan</h2>
        <p className="text-[13px] text-[var(--muted)]">
          You are not allotted to any class this session, so there is nothing to plan yet.
          Your centre manager assigns classes under Administration → Class allocation.
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <h2 className="mb-4 text-[15px] font-semibold">New teaching plan</h2>
      <form action={action}>
        <FormMessage state={state} />
        <Field label="Title *">
          <HindiInput name="title" required startInHindi={hindiPlan}
            placeholder={hindiPlan ? "पाठ 1 — वर्णमाला" : "Term 1 — Mathematics"} />
        </Field>
        <Field label="Subject">
          <input className="input" name="subject" placeholder="Mathematics"
            value={subject} onChange={(e) => setSubject(e.target.value)} />
        </Field>
        <Field label="Class *" hint={isTeacher ? "Only classes you are allotted" : undefined}>
          <select className="select" name="class_level_id" required defaultValue="">
            <option value="">Select class</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        {!isTeacher && (
          <>
            {isAdmin && (
              <Field label="Centre">
                <select className="select" name="center_id" defaultValue="">
                  <option value="">Use the teacher’s centre</option>
                  {centers.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}
                </select>
              </Field>
            )}
            <Field label="Teacher" hint="Leave blank to keep it under your own name">
              <select className="select" name="teacher_id" defaultValue="">
                <option value="">Me</option>
                {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </Field>
          </>
        )}
        <div className="grid grid-cols-2 gap-x-4">
          <Field label="Starts *"><input className="input" type="date" name="starts_on"
            min={earliest} defaultValue={earliest} required /></Field>
          <Field label="Ends"><input className="input" type="date" name="ends_on" min={earliest} /></Field>
        </div>
        <p className="mb-4 text-[12px] text-[var(--faint)]">
          Plans go to your centre manager at least {leadDays} days before they start, so the
          earliest you can begin is {earliest}.
        </p>
        <Field label="Notes">
          <HindiInput name="description" rows={2} className="textarea" startInHindi={hindiPlan} />
        </Field>
        <Submit>Create plan</Submit>
      </form>
    </Card>
  );
}
