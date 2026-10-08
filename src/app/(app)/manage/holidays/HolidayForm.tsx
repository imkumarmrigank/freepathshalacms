"use client";
import { useActionState, useState } from "react";
import { saveEvent } from "@/app/(app)/calendar/actions";
import { Card, Field } from "@/components/ui";
import { FormMessage, Submit } from "@/components/form";
import { useT } from "@/components/LocaleProvider";

/**
 * Adding a holiday to the list.
 *
 * It posts to every centre unless one is named, because that is how a holiday
 * usually works — and a centre that turns out to be working is lifted off it
 * afterwards rather than being left out of it now.
 */
export default function HolidayForm({ centres, sessionLabel, defaultDate }: {
  centres: { id: number; code: string; name: string }[];
  sessionLabel: string | null;
  defaultDate: string;
}) {
  const t = useT();
  const [state, action] = useActionState(saveEvent, null);
  const [start, setStart] = useState(defaultDate);
  const [spans, setSpans] = useState(false);

  return (
    <Card>
      <h2 className="mb-1 text-[15px] font-semibold">{t("Add a holiday")}</h2>
      <p className="mb-4 text-[13px] text-[var(--muted)]">
        {sessionLabel
          ? t("It goes on the calendar for session {s} and closes the register that day.",
              { s: sessionLabel })
          : t("It goes on the calendar and closes the register that day.")}
      </p>
      <form action={action}>
        <FormMessage state={state} />
        <input type="hidden" name="is_all_day" value="on" />

        <Field label={t("What is it *")}>
          <input className="input" name="title" required
            placeholder={t("Independence Day")} />
        </Field>

        <Field label={t("Kind *")}>
          <select className="select" name="event_type" defaultValue="holiday">
            <option value="holiday">{t("Holiday")}</option>
            <option value="closure">{t("Centre closed")}</option>
          </select>
        </Field>

        <Field label={t("Applies to")}
          hint={t("Leave on every centre and lift it for one afterwards")}>
          <select className="select" name="center_id" defaultValue="">
            <option value="">{t("Every centre")}</option>
            {centres.map((c) => (
              <option key={c.id} value={c.id}>{c.code} · {c.name}</option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-x-4">
          <Field label={t("Date *")}>
            <input className="input" type="date" name="start_date" required
              value={start} onChange={(e) => setStart(e.target.value)} />
          </Field>
          {spans ? (
            <Field label={t("Last day")} hint={t("For a run of days")}>
              <input className="input" type="date" name="end_date" min={start} />
            </Field>
          ) : <div />}
        </div>

        {!spans && (
          <button type="button" onClick={() => setSpans(true)}
            className="mb-4 text-[12.5px] text-[var(--brand)] hover:underline">
            {t("It runs for more than a day")}
          </button>
        )}

        <Field label={t("Note")} hint={t("Optional")}>
          <input className="input" name="description"
            placeholder={t("Declared by the district administration")} />
        </Field>

        {/* A holiday or a closure always shuts the register — that is what
            makes it one — so there is nothing here to tick. */}
        <p className="mb-4 rounded-[9px] bg-[var(--brand-soft)] px-3.5 py-2.5
          text-[12.5px] text-[var(--brand)]">
          {t("Nobody is marked absent on the day, and the nightly close-out skips it.")}
        </p>

        <Submit>{t("Add the holiday")}</Submit>
      </form>
    </Card>
  );
}
