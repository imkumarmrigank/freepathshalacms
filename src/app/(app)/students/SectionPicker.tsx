"use client";
import { useActionState, useState } from "react";
import { changeSection } from "./actions";
import { SECTIONS } from "@/lib/sections";

/**
 * M or E, one tap each — for the office, moving children between the two
 * sections of their class. Saves as soon as a section is chosen.
 *
 * The highlighted section only moves once the server has saved the change.
 * Moving it on the tap itself disabled the button that had just been tapped
 * before the browser sent the form, so the change was never submitted.
 */
export default function SectionPicker({
  enrollmentId, section, compact = false,
}: { enrollmentId: number; section: string | null; compact?: boolean }) {
  const [current, setCurrent] = useState(section ?? "M");
  const [state, action, pending] = useActionState(
    async (prev: unknown, fd: FormData) => {
      const r = await changeSection(prev, fd);
      if (r.ok) setCurrent(String(fd.get("section")));
      return r;
    }, null);

  return (
    <form action={action} className="inline-flex items-center gap-1.5">
      <input type="hidden" name="enrollment_id" value={enrollmentId} />
      <span className="inline-flex overflow-hidden rounded-md border border-[var(--border-strong)]"
        role="group" aria-label="Section">
        {SECTIONS.map((s) => {
          const on = current === s.value;
          return (
            <button key={s.value} type="submit" name="section" value={s.value}
              disabled={pending}
              aria-pressed={on}
              title={on ? `In section ${s.value}` : `Move to section ${s.value}`}
              className={`${compact ? "px-2 py-0.5 text-[11.5px]" : "px-3 py-1 text-[12.5px]"} font-semibold transition disabled:opacity-60`}
              style={on
                ? { background: "var(--brand)", color: "#fff" }
                : { background: "#fff", color: "var(--muted)", cursor: "pointer" }}>
              {s.label}
            </button>
          );
        })}
      </span>
      {pending && <span className="text-[11.5px] text-[var(--muted)]">Saving…</span>}
      {!pending && state?.ok && state.ok.startsWith("Moved") && (
        <span className="text-[11.5px] text-[var(--ok)]">✓ {state.ok.replace("Moved to section", "Section")}</span>
      )}
      {state?.error && <span className="text-[11.5px] text-[var(--bad)]">{state.error}</span>}
    </form>
  );
}
