"use client";
import { useRouter } from "next/navigation";

/** The day the whole page is about. Changing it reloads the day. */
export default function DatePick({ on, max }: { on: string; max: string }) {
  const router = useRouter();
  return (
    <label className="flex items-center gap-2 text-[13px] text-[var(--muted)]">
      Day
      <input type="date" className="input !mb-0 !w-auto" value={on} max={max}
        onChange={(e) => {
          const v = e.target.value;
          router.push(v ? `/centre-today?on=${v}` : "/centre-today");
        }} />
    </label>
  );
}
