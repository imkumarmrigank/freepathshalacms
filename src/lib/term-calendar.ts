/**
 * Academic year: April → March.
 * Three teaching terms of 3 months each, each followed by 15 days of revision/exams.
 *
 *   Term 1:     Apr 1  – Jun 30   (months 1–3 within term)
 *   Revision 1: Jul 1  – Jul 15
 *   Term 2:     Jul 16 – Oct 15   (months 1–3 within term)
 *   Revision 2: Oct 16 – Oct 31
 *   Term 3:     Nov 1  – Jan 31   (months 1–3 within term)
 *   Revision 3: Feb 1  – Feb 15
 *   Year end:   Feb 16 – Mar 31
 */

export const TERM_LABELS: Record<number, string> = {
  1: "Term 1 (Apr–Jun)",
  2: "Term 2 (Jul–Oct)",
  3: "Term 3 (Nov–Jan)",
};

export const MONTH_LABELS: Record<number, Record<number, string>> = {
  1: { 1: "April", 2: "May", 3: "June" },
  2: { 1: "August", 2: "September", 3: "October" },
  3: { 1: "November", 2: "December", 3: "January" },
};

export function unitLabel(termNo: number, monthNo: number): string {
  return `Term ${termNo} · Month ${monthNo} (${MONTH_LABELS[termNo]?.[monthNo] ?? ""})`;
}

export type TeachingPosition = {
  phase: "teaching";
  term: number;
  monthNo: number;
  weekNo: number;
};
export type RevisionPosition = { phase: "revision"; termJustFinished: number; label: string };
export type YearEndPosition  = { phase: "year_end" };
export type CurrentPosition  = TeachingPosition | RevisionPosition | YearEndPosition;

/**
 * Given the session's start year (e.g. 2025 for the 2025–26 session), return
 * the calendar boundaries for the three terms and their revision windows.
 */
export function termCalendar(startYear: number) {
  const y = startYear;
  return {
    terms: [
      {
        term: 1,
        start: new Date(`${y}-04-01`),
        end:   new Date(`${y}-06-30`),
      },
      {
        term: 2,
        start: new Date(`${y}-07-16`),
        end:   new Date(`${y}-10-15`),
      },
      {
        term: 3,
        start: new Date(`${y}-11-01`),
        end:   new Date(`${y + 1}-01-31`),
      },
    ],
    revisions: [
      { termJustFinished: 1, label: "Revision & Exams — Jul 1–15",
        start: new Date(`${y}-07-01`),     end: new Date(`${y}-07-15`) },
      { termJustFinished: 2, label: "Revision & Exams — Oct 16–31",
        start: new Date(`${y}-10-16`),     end: new Date(`${y}-10-31`) },
      { termJustFinished: 3, label: "Revision & Exams — Feb 1–15",
        start: new Date(`${y + 1}-02-01`), end: new Date(`${y + 1}-02-15`) },
    ],
    yearEnd: {
      start: new Date(`${y + 1}-02-16`),
      end:   new Date(`${y + 1}-03-31`),
    },
  };
}

/**
 * Return where in the academic calendar today falls.
 * `sessionStartDate` is the ISO date of the first day of the session
 * (typically "YYYY-04-01").
 */
export function currentPosition(sessionStartDate: string): CurrentPosition {
  const startYear = new Date(sessionStartDate).getFullYear();
  const cal = termCalendar(startYear);
  const now = new Date();

  for (const rev of cal.revisions) {
    if (now >= rev.start && now <= rev.end)
      return { phase: "revision", termJustFinished: rev.termJustFinished, label: rev.label };
  }

  if (now >= cal.yearEnd.start && now <= cal.yearEnd.end)
    return { phase: "year_end" };

  for (const t of cal.terms) {
    if (now >= t.start && now <= t.end) {
      const daysIn    = Math.floor((now.getTime() - t.start.getTime()) / 86_400_000);
      const weekInTerm = Math.floor(daysIn / 7);
      const monthNo   = Math.min(3, Math.floor(weekInTerm / 4) + 1);
      const weekNo    = Math.min(4, (weekInTerm % 4) + 1);
      return { phase: "teaching", term: t.term, monthNo, weekNo };
    }
  }

  // Outside every range — either before April or very end of March: default.
  return { phase: "teaching", term: 1, monthNo: 1, weekNo: 1 };
}
