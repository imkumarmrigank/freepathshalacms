/**
 * Test logins.
 *
 * A test login is an ordinary account — same roles, same rules — that the
 * office uses to see the system as a teacher, a mentor, an auditor or a
 * sports teacher sees it. It is not staff, so it has no place in a staff
 * list, a headcount, a day book, a report or a dashboard: everywhere people
 * are listed or counted, these accounts are left out.
 *
 * Only a super admin can mark an account this way, and only a super admin
 * can see the marked accounts — on the staff screen, behind a toggle.
 */

/** SQL for "this is a real person", for the users row aliased `alias`. */
export function realStaff(alias = "u") {
  return `NOT ${alias}.is_test`;
}

/** The same, ready to append to a WHERE that already has a condition. */
export function andRealStaff(alias = "u") {
  return ` AND NOT ${alias}.is_test`;
}

/** SQL for "this row was not written by a test login", given a user-id column. */
export function notByTestLogin(col: string) {
  return `${col} NOT IN (SELECT id FROM users WHERE is_test)`;
}
