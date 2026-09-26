import { Badge } from "@/components/ui";
import { NOTE_FIELDS, type StaffNote } from "@/lib/day-note-meta";
import { ROLE_LABEL, type Role } from "@/lib/roles";

/**
 * A day book entry, read back. The questions are shown in the order they were
 * asked and the empty ones are left out, so a short day reads short.
 */
export default function StaffNoteView({ note }: { note: StaffNote | null }) {
  if (!note) {
    return (
      <p className="text-[13px] text-[var(--muted)]">Nothing written up for this day.</p>
    );
  }
  const fields = (NOTE_FIELDS[note.role] ?? []).filter((f) => {
    const v = note[f.name];
    return v !== null && v !== undefined && v !== "";
  });

  return (
    <div className="rounded-[10px] border border-[var(--border)] px-3.5 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="info">{ROLE_LABEL[note.role as Role] ?? note.role}</Badge>
        <span className="ml-auto text-[12px] text-[var(--faint)]">saved {note.updated_at}</span>
      </div>
      {fields.length === 0 ? (
        <p className="mt-2 text-[13px] text-[var(--muted)]">Written up, but left empty.</p>
      ) : (
        <dl className="mt-2 space-y-1.5 text-[13.5px]">
          {fields.map((f) => (
            <div key={f.name}>
              <dt className="text-[12px] uppercase tracking-[0.06em] text-[var(--faint)]">
                {f.label}
              </dt>
              <dd className={f.name === "urgent_issues" || f.name === "support_needed"
                ? "text-[#b45309]" : ""}>
                {String(note[f.name])}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
