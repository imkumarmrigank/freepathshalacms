import { IconFlag } from "./icons";
import { FLAG_STATUS_LABEL } from "@/lib/counselling-meta";
import { fmtDate } from "@/lib/format";

/**
 * A small flag beside a child's name: this one has been referred to the mentor
 * and the referral is still open.
 *
 * It rides next to the name wherever children are listed — the register, the
 * student list, the PTM tables — because the teacher reading that list is the
 * person who needs to know, and they should not have to open the profile to
 * find out.
 */
export default function FlagMark({ status, urgency, raisedOn }:
  { status?: string | null; urgency?: string | null; raisedOn?: string | null }) {
  if (!status || status === "closed") return null;
  const urgent = urgency === "high";
  // when it was raised matters as much as that it was: a referral from
  // yesterday reads differently from one that has sat open for a month
  const when = raisedOn ? ` · flagged ${fmtDate(raisedOn)}` : "";
  return (
    <span
      title={`Flagged for counselling${when} · ${FLAG_STATUS_LABEL[status] ?? status}${
        urgent ? " · urgent" : ""}`}
      aria-label={`Flagged for counselling${urgent ? ", urgent" : ""}`}
      className={`ml-1.5 inline-flex h-[20px] w-[20px] flex-none items-center justify-center
        rounded-[6px] align-middle ${urgent
          ? "bg-[var(--bad-soft)] text-[var(--bad)]"
          : "bg-[var(--warn-soft)] text-[#b45309]"}`}>
      <IconFlag className="h-[13px] w-[13px]" />
    </span>
  );
}
