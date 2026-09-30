"use client";
import { useActionState, useState } from "react";
import { saveDayNote } from "./actions";
import { Card, Field } from "@/components/ui";
import { FormMessage, Submit } from "@/components/form";
import HindiInput from "@/components/HindiInput";
import { useT } from "@/components/LocaleProvider";

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
  const t = useT();
  const [state, action] = useActionState(saveDayNote, null);
  const [classId, setClassId] = useState(String(note?.class_level_id ?? ""));

  return (
    <Card>
      <form action={async (fd) => { await action(fd); onDone?.(); }}>
        <FormMessage state={state} />
        <input type="hidden" name="on_date" value={date} />

        <div className="grid gap-x-4 sm:grid-cols-2">
          <Field label={t("Which class")} hint={t("leave blank for the day as a whole")}>
            <select className="select" name="class_level_id" value={classId}
              onChange={(e) => setClassId(e.target.value)}>
              <option value="">{t("The whole day")}</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{t(c.name)}</option>)}
            </select>
          </Field>
          <Field label={t("Subject")} hint={t("हिंदी या English")}>
            <HindiInput name="subject" defaultValue={note?.subject ?? ""}
              placeholder={t("Mathematics / गणित")} />
          </Field>
        </div>

        <Field label={t("What you taught today — the chapter or topic")}>
          <HindiInput name="chapter" defaultValue={note?.chapter ?? ""}
            placeholder={t("Chapter 4: Addition with carrying / पाठ 4: हासिल के साथ जोड़")} />
        </Field>
        <Field label={t("How it went, in detail")}
          hint={t("what the children understood, what they did not")}>
          <HindiInput name="chapter_detail" rows={3} defaultValue={note?.chapter_detail ?? ""}
            placeholder={t("Most followed the carrying step; six children still count on fingers…")} />
        </Field>

        <Field label={t("Homework given")}>
          <HindiInput name="homework" defaultValue={note?.homework ?? ""}
            placeholder={t("Sums 1–10 from page 23 / पेज 23 के सवाल 1–10")} />
        </Field>
        <Field label={t("Homework, in detail")} hint={t("what exactly, and by when")}>
          <HindiInput name="homework_detail" rows={2} defaultValue={note?.homework_detail ?? ""}
            placeholder={t("To be brought tomorrow; parents asked to sign the notebook")} />
        </Field>

        <div className="grid gap-x-4 sm:grid-cols-2">
          <Field label={t("Equipment or teaching aid used")}>
            <HindiInput name="equipment" defaultValue={note?.equipment ?? ""}
              placeholder={t("Counting beads, blackboard chart / गिनती की मालाएँ")} />
          </Field>
          <Field label={t("What it showed")} hint={t("did it help, and how you could tell")}>
            <HindiInput name="equipment_result" defaultValue={note?.equipment_result ?? ""}
              placeholder={t("Children who struggled with sums managed them with the beads")} />
          </Field>
        </div>

        <Field label={t("Anything else you did today")}
          hint={t("a home visit, a parent who came, a repair, a meeting")}>
          <HindiInput name="other_work" rows={2} defaultValue={note?.other_work ?? ""}
            placeholder={t("Went to Ramu's house; his mother will send him from Monday")} />
        </Field>
        <div className="mt-2 rounded-[10px] border border-[var(--border)] bg-[#fafafd] px-3.5 py-3">
          <div className="text-[13px] font-medium">{t("Anything beyond the usual class")}</div>
          <p className="mb-2 mt-0.5 text-[12.5px] text-[var(--muted)]">
            {t("A community meeting, a child taken to the clinic, a rehearsal, a survey, "
              + "a visitor at the centre — work that was not the lesson.")}
          </p>
          <Field label={t("What it was")}>
            <HindiInput name="extra_activity" defaultValue={note?.extra_activity ?? ""}
              placeholder={t("Took Sunita to the clinic / सुनीता को अस्पताल ले गए")} />
          </Field>
          <Field label={t("What came of it")} hint={t("how long it took, who was with you, what happened")}>
            <HindiInput name="extra_detail" rows={2} defaultValue={note?.extra_detail ?? ""}
              placeholder={t("Two hours; her mother came along; medicine given, back tomorrow")} />
          </Field>
        </div>

        <Field label={t("Help you need")} hint={t("what your centre manager should know")}>
          <HindiInput name="support_needed" rows={2} defaultValue={note?.support_needed ?? ""}
            placeholder={t("The blackboard is broken on one side / ब्लैकबोर्ड एक तरफ से टूटा है")} />
        </Field>

        <Submit>{note ? t("Save the day") : t("Write up the day")}</Submit>
      </form>
    </Card>
  );
}
