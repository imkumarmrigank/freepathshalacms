"use client";
import { useActionState } from "react";
import { scheduleMeeting } from "../actions";
import { Card, Field } from "@/components/ui";
import { FormMessage, Submit } from "@/components/form";

export default function ScheduleForm({
  centers, classes, showCenter,
}: {
  centers: { id: number; code: string; name: string }[];
  classes: { id: number; name: string }[];
  showCenter: boolean;
}) {
  const [state, action] = useActionState(scheduleMeeting, null);
  return (
    <Card>
      <h2 className="mb-4 text-[15px] font-semibold">Schedule a PTM</h2>
      <form action={action}>
        <FormMessage state={state} />
        <Field label="Title">
          <input className="input" name="title" defaultValue="Parent-Teacher Meeting" required />
        </Field>
        {showCenter && (
          <Field label="Centre">
            <select className="select" name="center_id" required defaultValue="">
              <option value="">Select centre</option>
              {centers.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}
            </select>
          </Field>
        )}
        <Field label="Class" hint="Leave blank for all classes">
          <select className="select" name="class_level_id" defaultValue="">
            <option value="">All classes</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Date"><input className="input" type="date" name="meeting_date" required /></Field>
        <div className="grid grid-cols-2 gap-x-4">
          <Field label="From"><input className="input" type="time" name="start_time" /></Field>
          <Field label="To"><input className="input" type="time" name="end_time" /></Field>
        </div>
        <Field label="Mode">
          <select className="select" name="mode" defaultValue="in_person">
            <option value="in_person">In person</option>
            <option value="phone">Phone</option>
            <option value="video">Video</option>
            <option value="home_visit">Home visit</option>
          </select>
        </Field>
        <Field label="Agenda"><textarea className="textarea" name="agenda" rows={2} /></Field>
        <Submit>Schedule</Submit>
      </form>
    </Card>
  );
}
