"use client";
import { useActionState } from "react";
import { deleteEvent } from "@/app/(app)/calendar/actions";
import { useT } from "@/components/LocaleProvider";

/** Taking a holiday off the list. Everyone's register opens that day again. */
export default function DeleteHoliday({ id, title }: { id: number; title: string }) {
  const t = useT();
  const [state, action] = useActionState(deleteEvent, null);
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <button className="btn btn-ghost btn-sm" type="submit"
        title={state?.error ?? t("Remove {title} from the list", { title })}>
        {t("Remove")}
      </button>
    </form>
  );
}
