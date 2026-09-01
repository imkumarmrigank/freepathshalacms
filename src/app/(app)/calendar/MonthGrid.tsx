import { EVENT_LABEL, type CalendarEvent } from "@/lib/calendar-meta";

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const DOT: Record<string, string> = {
  holiday: "var(--bad)", closure: "var(--bad)", ptm: "var(--brand)",
  exam: "var(--warn)", feast: "var(--ok)", activity: "var(--ok)",
  event: "var(--muted)", other: "var(--muted)",
};

export default function MonthGrid({
  month, events, today,
}: { month: string; events: CalendarEvent[]; today: string }) {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7;   // Monday-first grid

  const cells: (string | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) =>
      `${y}-${String(m).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const on = (iso: string) => events.filter((e) => iso >= e.start_date && iso <= e.end_date);

  return (
    <div className="overflow-hidden rounded-[10px] border border-[var(--border)]">
      <div className="grid grid-cols-7 border-b border-[var(--border)] bg-[#fafaff]">
        {DOW.map((d) => (
          <div key={d} className="px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--faint)]">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((iso, i) => {
          const list = iso ? on(iso) : [];
          const isToday = iso === today;
          const sunday = i % 7 === 6;
          return (
            <div key={i}
              className={`min-h-[86px] border-b border-r border-[#f1f1f6] p-1.5 ${
                sunday ? "bg-[#fcfcfe]" : ""} ${!iso ? "bg-[#fafafd]" : ""}`}>
              {iso && (
                <>
                  <div className={`mb-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[12px] ${
                    isToday ? "bg-[var(--brand)] font-semibold text-white" : "text-[var(--muted)]"}`}>
                    {Number(iso.slice(8))}
                  </div>
                  <div className="space-y-0.5">
                    {list.slice(0, 3).map((e) => (
                      <div key={`${e.source}-${e.id}`}
                        title={`${EVENT_LABEL[e.event_type] ?? e.event_type}: ${e.title}`}
                        className="flex items-center gap-1 truncate text-[11px] leading-tight text-[var(--text)]">
                        <span className="h-1.5 w-1.5 flex-none rounded-full"
                          style={{ background: DOT[e.event_type] ?? "var(--muted)" }} />
                        <span className="truncate">{e.title}</span>
                      </div>
                    ))}
                    {list.length > 3 && (
                      <div className="text-[11px] text-[var(--faint)]">+{list.length - 3} more</div>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
