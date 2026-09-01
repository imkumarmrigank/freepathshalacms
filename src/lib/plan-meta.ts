/**
 * A teaching plan must reach the centre manager this many days before it starts.
 * Kept out of the "use server" module, which may only export async functions.
 */
export const PLAN_LEAD_DAYS = 7;

/** The earliest start date a plan created today may carry. */
export function earliestPlanStart(from = new Date()) {
  const d = new Date(from);
  d.setDate(d.getDate() + PLAN_LEAD_DAYS);
  return d.toISOString().slice(0, 10);
}
