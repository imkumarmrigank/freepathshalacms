"use client";
import { useActionState, useState } from "react";
import { openDirect, openCentreRoom } from "./actions";
import { FormMessage } from "@/components/form";

/** Opening a thread with somebody, or walking into a centre's room. */
export default function StartChat({ people, centres }: {
  people: { id: number; name: string; role: string; designation: string | null;
            center_name: string | null }[];
  centres: { id: number; code: string; name: string }[];
}) {
  const [dmState, openDm] = useActionState(openDirect, null);
  const [roomState, openRoom] = useActionState(openCentreRoom, null);
  const [q, setQ] = useState("");

  const matches = q.trim() === ""
    ? people.slice(0, 8)
    : people.filter((p) =>
        p.name.toLowerCase().includes(q.toLowerCase())
        || (p.center_name ?? "").toLowerCase().includes(q.toLowerCase())).slice(0, 12);

  return (
    <div className="border-t border-[var(--border)] p-3">
      <FormMessage state={dmState ?? roomState} />

      {centres.length > 0 && (
        <div className="mb-3">
          <div className="label-cap mb-1.5">Centre rooms</div>
          <div className="flex flex-wrap gap-1.5">
            {centres.map((c) => (
              <form key={c.id} action={openRoom}>
                <input type="hidden" name="center_id" value={c.id} />
                <button className="chip" type="submit">{c.name}</button>
              </form>
            ))}
          </div>
        </div>
      )}

      <div className="label-cap mb-1.5">Message someone</div>
      <input className="input mb-2" value={q} placeholder="Search by name or centre"
        onChange={(e) => setQ(e.target.value)} />
      <ul className="max-h-56 space-y-0.5 overflow-y-auto">
        {matches.map((p) => (
          <li key={p.id}>
            <form action={openDm}>
              <input type="hidden" name="user_id" value={p.id} />
              <button type="submit"
                className="flex w-full items-baseline gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-[#f1f1f8]">
                <span className="truncate text-[13.5px] font-medium">{p.name}</span>
                <span className="truncate text-[11.5px] text-[var(--muted)]">
                  {p.designation ?? p.role.replace(/_/g, " ")}
                  {p.center_name ? ` · ${p.center_name}` : ""}
                </span>
              </button>
            </form>
          </li>
        ))}
        {matches.length === 0 && (
          <li className="px-2 py-1.5 text-[13px] text-[var(--muted)]">Nobody by that name.</li>
        )}
      </ul>
    </div>
  );
}
