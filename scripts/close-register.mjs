/**
 * Nightly job: asks the running app to close out any past day that was never
 * marked. The logic itself lives in src/lib/attendance.ts so there is one
 * implementation of the rule.
 */
const base = process.env.APP_URL;
if (!base) { console.error("APP_URL is not set"); process.exit(1); }

const res = await fetch(new URL("/api/cron/close-register", base), {
  headers: process.env.CRON_SECRET
    ? { authorization: `Bearer ${process.env.CRON_SECRET}` }
    : {},
});
const body = await res.text();
console.log(res.status, body);
if (!res.ok) process.exit(1);
