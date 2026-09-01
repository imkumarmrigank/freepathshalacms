"use client";
import { useActionState } from "react";
import { saveSlot } from "./actions";
import { Card, Field } from "@/components/ui";
import { FormMessage, Submit } from "@/components/form";
import { DAYS } from "@/lib/timetable-meta";

export default function SlotForm({
  classes, teachers, centers, isAdmin, defaultClassId, defaultCenterId,
}: {
  classes: { id: number; name: string }[];
  teachers: { id: number; name: string }[];
  centers: { id: number; code: string; name: string }[];
  isAdmin: boolean;
  defaultClassId: number | null;
  defaultCenterId: number | null;
}) {
  const [state, action] = useActionState(saveSlot, null);
  return (
    <Card>
      <h2 className="mb-1 text-[15px] font-semibold">Add a period</h2>
      <p className="mb-4 text-[13px] text-[var(--muted)]">
        One subject per class per period. A teacher already booked elsewhere in the same
        period is rejected.
      </p>
      <form action={action}>
        <FormMessage state={state} />
        {isAdmin && (
          <Field label="Centre *">
            <select className="select" name="center_id" required defaultValue={defaultCenterId ?? ""}>
              <option value="">Select centre</option>
              {centers.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}
            </select>
          </Field>
        )}
        <Field label="Class *">
          <select className="select" name="class_level_id" required defaultValue={defaultClassId ?? ""}>
            <option value="">Select class</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-x-4">
          <Field label="Day *">
            <select className="select" name="day_of_week" required defaultValue="1">
              {DAYS.map((d, i) => <option key={d} value={i + 1}>{d}</option>)}
            </select>
          </Field>
          <Field label="Period *">
            <select className="select" name="period_no" required defaultValue="1">
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>Period {i + 1}</option>
              ))}
            </select>
          </Field>
          <Field label="From *"><input className="input" type="time" name="start_time" required /></Field>
          <Field label="To *"><input className="input" type="time" name="end_time" required /></Field>
        </div>
        <Field label="Subject *">
          <input className="input" name="subject" required placeholder="Mathematics" />
        </Field>
        <Field label="Teacher">
          <select className="select" name="teacher_id" defaultValue="">
            <option value="">Not assigned yet</option>
            {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </Field>
        <Field label="Room"><input className="input" name="room" /></Field>
        <Submit>Add period</Submit>
      </form>
    </Card>
  );
}
