"use client";
import { useActionState } from "react";
import { applyForLeave, withdrawLeave } from "./actions";
import { Card, Field } from "@/components/ui";
import { FormMessage, Submit } from "@/components/form";
import { LEAVE_TYPES } from "@/lib/leave-meta";
import { today } from "@/lib/format";
import { useT } from "@/components/LocaleProvider";

export function LeaveForm() {
  const t = useT();
  const [state, action] = useActionState(applyForLeave, null);

  return (
    <Card>
      <h2 className="mb-1 text-[15px] font-semibold">{t("Apply for leave")}</h2>
      <p className="mb-4 text-[13px] text-[var(--muted)]">
        {t("The office approves or refuses it. Until then your register is untouched.")}
      </p>
      <form action={action}>
        <FormMessage state={state} />
        <Field label={t("Kind of leave *")}>
          <select className="select" name="leave_type" required defaultValue="">
            <option value="">{t("Select")}</option>
            {LEAVE_TYPES.map((k) => (
              <option key={k.value} value={k.value}>{t(k.label)}</option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-x-4">
          <Field label={t("From *")}>
            <input className="input" type="date" name="starts_on" defaultValue={today()} required />
          </Field>
          <Field label={t("Until")} hint={t("Leave blank for a single day")}>
            <input className="input" type="date" name="ends_on" />
          </Field>
        </div>
        <label className="mb-4 flex items-center gap-2 text-[13px]">
          <input type="checkbox" name="half_day" className="h-4 w-4" />
          {t("Half day only")}
        </label>
        <Field label={t("Reason *")} hint={t("Seen by the administrator who answers it")}>
          <textarea className="input" name="reason" rows={3} required
            placeholder={t("Fever since yesterday, seeing the doctor in the morning.")} />
        </Field>
        <Submit>{t("Send request")}</Submit>
      </form>
    </Card>
  );
}

export function WithdrawLeave({ id }: { id: number }) {
  const t = useT();
  const [state, action] = useActionState(withdrawLeave, null);
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <button className="btn btn-ghost btn-sm" type="submit" title={state?.error ?? t("Withdraw")}>
        {t("Withdraw")}
      </button>
    </form>
  );
}
