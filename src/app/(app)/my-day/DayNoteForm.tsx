"use client";
import { useActionState, useState } from "react";
import { saveDayNote } from "./actions";
import { Card, Field } from "@/components/ui";
import { FormMessage, Submit } from "@/components/form";
import HindiInput from "@/components/HindiInput";

export type Note = {
  id: number; class_name: string | null; subject: string | null;
  chapter: string | null; chapter_detail: string | null;
  homework: string | null; homework_detail: string | null;
  equipment: string | null; equipment_result: string | null;
  other_work: string | null; support_needed: string | null;
  extra_activity: string | null; extra_detail: string | null;
};

/**
 * The teacher's write-up of a day.
 *
 * Every box takes Hindi or English: the toggle on each field types Devanagari
 * phonetically, so a teacher without a Hindi keyboard writes in the language
 * the lesson was taught in rather than the one the form was written in.
 */
export default function DayNoteForm({ date, classes, note, onDone }: {
  date: string;
  classes: { id: number; name: string }[];
  note?: Note & { class_level_id?: number | null };
  onDone?: () => void;
}) {
  const [state, action] = useActionState(saveDayNote, null);
  const [classId, setClassId] = useState(String(note?.class_level_id ?? ""));

  return (
    <Card>
      <form action={async (fd) => { await action(fd); onDone?.(); }}>
        <FormMessage state={state} />
        <input type="hidden" name="on_date" value={date} />

        <div className="grid gap-x-4 sm:grid-cols-2">
          <Field label="Which class" hint="leave blank for the day as a whole">
            <select className="select" name="class_level_id" value={classId}
              onChange={(e) => setClassId(e.target.value)}>
              <option value="">The whole day</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Subject" hint="हिंदी या English">
            <HindiInput name="subject" defaultValue={note?.subject ?? ""}
              placeholder="Mathematics / गणित" />
          </Field>
        </div>

        <Field label="What you taught today — the chapter or topic">
          <HindiInput name="chapter" defaultValue={note?.chapter ?? ""}
            placeholder="Chapter 4: Addition with carrying / पाठ 4: हासिल के साथ जोड़" />
        </Field>
        <Field label="How it went, in detail"
          hint="what the children understood, what they did not">
          <HindiInput name="chapter_detail" rows={3} defaultValue={note?.chapter_detail ?? ""}
            placeholder="Most followed the carrying step; six children still count on fingers…" />
        </Field>

        <Field label="Homework given">
          <HindiInput name="homework" defaultValue={note?.homework ?? ""}
            placeholder="Sums 1–10 from page 23 / पेज 23 के सवाल 1–10" />
        </Field>
        <Field label="Homework, in detail" hint="what exactly, and by when">
          <HindiInput name="homework_detail" rows={2} defaultValue={note?.homework_detail ?? ""}
            placeholder="To be brought tomorrow; parents asked to sign the notebook" />
        </Field>

        <div className="grid gap-x-4 sm:grid-cols-2">
          <Field label="Equipment or teaching aid used">
            <HindiInput name="equipment" defaultValue={note?.equipment ?? ""}
              placeholder="Counting beads, blackboard chart / गिनती की मालाएँ" />
          </Field>
          <Field label="What it showed" hint="did it help, and how you could tell">
            <HindiInput name="equipment_result" defaultValue={note?.equipment_result ?? ""}
              placeholder="Children who struggled with sums managed them with the beads" />
          </Field>
        </div>

        <Field label="Anything else you did today"
          hint="a home visit, a parent who came, a repair, a meeting">
          <HindiInput name="other_work" rows={2} defaultValue={note?.other_work ?? ""}
            placeholder="Went to Ramu's house; his mother will send him from Monday" />
        </Field>
        <div className="mt-2 rounded-[10px] border border-[var(--border)] bg-[#fafafd] px-3.5 py-3">
          <div className="text-[13px] font-medium">Anything beyond the usual class</div>
          <p className="mb-2 mt-0.5 text-[12.5px] text-[var(--muted)]">
            A community meeting, a child taken to the clinic, a rehearsal, a survey,
            a visitor at the centre — work that was not the lesson.
          </p>
          <Field label="What it was">
            <HindiInput name="extra_activity" defaultValue={note?.extra_activity ?? ""}
              placeholder="Took Sunita to the clinic / सुनीता को अस्पताल ले गए" />
          </Field>
          <Field label="What came of it" hint="how long it took, who was with you, what happened">
            <HindiInput name="extra_detail" rows={2} defaultValue={note?.extra_detail ?? ""}
              placeholder="Two hours; her mother came along; medicine given, back tomorrow" />
          </Field>
        </div>

        <Field label="Help you need" hint="what your centre manager should know">
          <HindiInput name="support_needed" rows={2} defaultValue={note?.support_needed ?? ""}
            placeholder="The blackboard is broken on one side / ब्लैकबोर्ड एक तरफ से टूटा है" />
        </Field>

        <Submit>{note ? "Save the day" : "Write up the day"}</Submit>
      </form>
    </Card>
  );
}
