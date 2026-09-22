"use client";
import { useActionState, useState } from "react";
import { changeSection } from "./actions";
import { SECTIONS } from "@/lib/sections";

/**
 * M or E, one tap each — for the office, moving children between the two
 * sections of their class. Saves as soon as a section is chosen.
 */
export default function SectionPicker({
  enrollmentId, section, compact = false,
}: { enrollmentId: number; section: string | null; compact?: boolean }) {
  const [state, action, pending] = useActionState(changeSection, null);
  const [current, setCurrent] = useState(section ?? "M");

  return (
    <form action={action} className="inline-flex items-center gap-1.5">
      <input type="hidden" name="enrollment_id" value={enrollmentId} />
      <span className="inline-flex overflow-hidden rounded-md border border-[var(--border-strong)]"
        role="group" aria-label="Section">
        {SECTIONS.map((s) => {
          const on = current === s.value;
          return (
            <button key={s.value} type="submit" name="section" value={s.value}
              disabled={pending || on}
              onClick={() => setCurrent(s.value)}
              title={on ? `In section ${s.value}` : `Move to section ${s.value}`}
              className={`${compact ? "px-1.5 py-0 text-[11px]" : "px-2.5 py-0.5 text-[12.5px]"} font-semibold transition`}
              style={on
                ? { background: "var(--brand)", color: "#fff" }
                : { background: "#fff", color: "var(--muted)" }}>
              {s.label}
            </button>
          );
        })}
      </span>
      {state?.error && <span className="text-[11.5px] text-[var(--bad)]">{state.error}</span>}
    </form>
  );
}
