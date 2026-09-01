/** Shared by server and client — must stay free of "use client" and server-only imports. */
export const DAYS = [
  "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
];

/** Monday–Saturday; centres do not run on Sunday. */
export const TEACHING_DAYS = DAYS.slice(0, 6);
