/**
 * Shown the instant a menu item is clicked, while the next page is built.
 * Without it the old page simply sat there until the new one was ready, and a
 * click looked as though it had not registered.
 */
export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite" className="animate-pulse">
      <span className="sr-only">Loading…</span>
      <div className="mb-2 h-7 w-56 rounded-md bg-[#ececf4]" />
      <div className="mb-6 h-4 w-80 max-w-full rounded bg-[#f1f1f7]" />
      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="card card-pad">
            <div className="mb-3 h-3 w-24 rounded bg-[#f1f1f7]" />
            <div className="h-7 w-16 rounded bg-[#ececf4]" />
          </div>
        ))}
      </div>
      <div className="card card-pad">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="mb-3 h-4 rounded bg-[#f4f4f9] last:mb-0" style={{ width: `${92 - i * 7}%` }} />
        ))}
      </div>
    </div>
  );
}
