"use client";
import { useActionState, useState } from "react";
import { saveEvent } from "./actions";
import { Card, Field } from "@/components/ui";
import { FormMessage, Submit } from "@/components/form";
import { EVENT_LABEL } from "@/lib/calendar-meta";

export default function EventForm({
  centers, isAdmin, centerName, defaultDate,
}: {
  centers: { id: number; code: string; name: string }[];
  isAdmin: boolean;
  centerName: string | null;
  defaultDate: string;
}) {
  const [state, action] = useActionState(saveEvent, null);
  const [allDay, setAllDay] = useState(true);
  const [type, setType] = useState("holiday");
  const [start, setStart] = useState(defaultDate);

  return (
    <Card>
      <h2 className="mb-1 text-[15px] font-semibold">Add to the calendar</h2>
      <p className="mb-4 text-[13px] text-[var(--muted)]">
        Everyone at {isAdmin ? "the selected centre" : centerName ?? "your centre"} sees this.
        Holidays and closures also stop that day being auto-marked absent.
      </p>
      <form action={action}>
        <FormMessage state={state} />
        <Field label="Title *">
          <input className="input" name="title" required placeholder="Independence Day" />
        </Field>
        <Field label="Type *">
          <select className="select" name="event_type" value={type}
            onChange={(e) => setType(e.target.value)}>
            {Object.entries(EVENT_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Field>
        {isAdmin && (
          <Field label="Applies to">
            <select className="select" name="center_id" defaultValue="">
              <option value="">All centres</option>
              {centers.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}
            </select>
          </Field>
        )}
        <div className="grid grid-cols-2 gap-x-4">
          <Field label="From *">
            <input className="input" type="date" name="start_date" required
              value={start} onChange={(e) => setStart(e.target.value)} />
          </Field>
          <Field label="To" hint="Same day if blank">
            <input className="input" type="date" name="end_date" min={start} defaultValue={defaultDate} />
          </Field>
        </div>
        <label className="mb-3 flex items-center gap-2.5">
          <input type="checkbox" name="is_all_day" className="h-4 w-4"
            checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
          <span className="text-[13px]">All day</span>
        </label>
        {!allDay && (
          <div className="grid grid-cols-2 gap-x-4">
            <Field label="From"><input className="input" type="time" name="start_time" /></Field>
            <Field label="To"><input className="input" type="time" name="end_time" /></Field>
          </div>
        )}
        <Field label="Details"><textarea className="textarea" name="description" rows={2} /></Field>
        {(type === "holiday" || type === "closure") && (
          <p className="mb-4 rounded-[9px] bg-[var(--warn-soft)] px-3.5 py-2.5 text-[13px] text-[#b45309]">
            Attendance will not be taken on these days, and they are skipped by the nightly
            auto-absent close-out.
          </p>
        )}
        <Submit>Add event</Submit>
      </form>
    </Card>
  );
}
