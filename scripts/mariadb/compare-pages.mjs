/**
 * Opens every page of two running copies of the app (the original on PostgreSQL and the new
 * one on MariaDB, both on identical data), signed in as the same test user, and compares what
 * a person would read. Reports are also compared row for row through their CSV export.
 *
 *   OLD=http://localhost:3301 NEW=http://localhost:3302 JWT_SECRET=... \
 *     node scripts/mariadb/compare-pages.mjs [--role=super_admin] [--uid=1] [--only=substr]
 */
import fs from "node:fs";
import { SignJWT } from "jose";

const OLD = process.env.OLD, NEW = process.env.NEW, SECRET = process.env.JWT_SECRET;
const arg = (n, d) => (process.argv.find((a) => a.startsWith(`--${n}=`)) ?? `--${n}=${d}`).split("=")[1];
const ROLE = arg("role", "super_admin"), UID = Number(arg("uid", "1")), ONLY = arg("only", "");
const CENTER = arg("center", "");
if (!OLD || !NEW || !SECRET) { console.error("Set OLD, NEW and JWT_SECRET."); process.exit(2); }

const ids = JSON.parse(process.env.SAMPLE_IDS ?? "{}");
const token = await new SignJWT({
  uid: UID, name: "Compare User", email: "compare@test.local", role: ROLE,
  centerId: CENTER ? Number(CENTER) : null, centerName: null, centerIds: [], coveringIds: [], isTest: false,
}).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("2h").sign(new TextEncoder().encode(SECRET));
const cookie = `fp_session=${token}`;

const reportKeys = fs.readFileSync("src/lib/report-meta.ts", "utf8").match(/key: "[a-z-]+"/g).map((s) => s.slice(6, -1));
const FROM = "2026-09-01", TO = "2026-11-04";

const pages = [
  "/dashboard", "/centre-today", "/students", "/students?q=a", "/students?page=2", "/students/new",
  `/students/${ids.student}`, `/students/${ids.student}/report-card`, `/students/${ids.student2}`,
  "/attendance", "/attendance/dashboard", "/exams", `/exams/${ids.exam}`,
  "/ptm", "/ptm/dashboard", "/ptm/daily", "/ptm/meetings", "/ptm/new", `/ptm/${ids.ptm}`,
  "/counselling", "/counselling/flagged", "/follow-ups", "/calendar", "/centre-feedback",
  "/audits", "/audits/board", "/audits/daily", "/audits/dashboard", "/audits/reports", "/audits/suggestions",
  `/audits/${ids.audit}`, `/audits/suggestions/${ids.suggestion}`,
  "/data", "/statistics", "/statistics/trends", "/leave", "/messages", "/manual",
  "/progress-reports", "/supplies", "/supplies/distribute", "/supplies/requests",
  "/syllabus", `/syllabus/${ids.syllabus}`, "/teaching-plans", `/teaching-plans/${ids.plan}`,
  "/teacher-remarks", "/timetable", "/my-attendance", "/my-day", "/my-test", `/my-test/${ids.stafftest}`,
  "/sports", "/sports/daily", "/sports/dashboard", "/sports/reports", `/sports/${ids.sport}`,
  "/manage/allocations", "/manage/audit-criteria", "/manage/centers", "/manage/classes", "/manage/coverage",
  "/manage/holidays", "/manage/leave", "/manage/manual", "/manage/menu-access", "/manage/passed-out",
  "/manage/promotions", "/manage/sessions", "/manage/staff-attendance", "/manage/staff", "/manage/suspended",
  "/manage/syllabus", "/manage/teacher-day", "/manage/tests", "/manage/tests/dashboard", "/manage/tests/results",
  "/manage/transfers", "/manage/working-days",
  `/api/students/${ids.student}/snapshot`,
  ...reportKeys.map((k) => `/reports?report=${k}&from=${FROM}&to=${TO}`),
  ...reportKeys.map((k) => `/api/reports/export?report=${k}&from=${FROM}&to=${TO}&format=csv`),
].filter((p) => !p.includes("undefined") && p.includes(ONLY));

/** the text a person reads: no markup, scripts, styles or comments */
function readable(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<\/(p|div|tr|li|h\d|table|section|td|th)>/gi, "\n").replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'")
    .split("\n").map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);
}

async function get(base, p) {
  const t0 = Date.now();
  try {
    const r = await fetch(base + p, { headers: { cookie }, redirect: "manual", signal: AbortSignal.timeout(120000) });
    const body = await r.text();
    return { status: r.status, loc: r.headers.get("location"), body, ms: Date.now() - t0 };
  } catch (e) { return { status: 0, body: String(e), ms: Date.now() - t0 }; }
}

const results = [];
let same = 0;
for (const p of pages) {
  const [a, b] = [await get(OLD, p), await get(NEW, p)];
  const isCsv = p.includes("format=csv"), isJson = p.startsWith("/api/");
  let diff = null;
  if (a.status !== b.status) diff = `status ${a.status} vs ${b.status}${b.status >= 500 || b.status === 0 ? ": " + b.body.slice(0, 160).replace(/\s+/g, " ") : ""}`;
  else if (a.loc !== b.loc) diff = `redirect ${a.loc} vs ${b.loc}`;
  else if (isCsv || isJson) { if (a.body !== b.body) diff = firstDiff(a.body.split("\n"), b.body.split("\n")); }
  else {
    const la = readable(a.body), lb = readable(b.body);
    if (la.join("\n") !== lb.join("\n")) diff = firstDiff(la, lb);
  }
  if (diff) results.push({ path: p, diff, ms: [a.ms, b.ms] }); else same++;
  process.stdout.write(diff ? "x" : ".");
}

function sameBag(la, lb) {
  if (la.length !== lb.length) return false;
  const c = new Map();
  for (const l of la) c.set(l, (c.get(l) ?? 0) + 1);
  for (const l of lb) { const n = c.get(l); if (!n) return false; c.set(l, n - 1); }
  return true;
}

function firstDiff(la, lb) {
  if (sameBag(la, lb)) return "ORDER ONLY: same rows, different order";
  const sa = new Set(la), sb = new Set(lb);
  const onlyOld = la.filter((l) => !sb.has(l)), onlyNew = lb.filter((l) => !sa.has(l));
  return `old-only ${onlyOld.length}, new-only ${onlyNew.length}\n      OLD: ${onlyOld.slice(0, 3).map((s) => s.slice(0, 150)).join(" | ")}\n      NEW: ${onlyNew.slice(0, 3).map((s) => s.slice(0, 150)).join(" | ")}`;
}

const orderOnly = results.filter((r) => r.diff.startsWith("ORDER ONLY"));
const content = results.filter((r) => !r.diff.startsWith("ORDER ONLY"));
console.log(`\n\n${pages.length} pages compared as ${ROLE}: ${same} identical, ${orderOnly.length} differ only in row order, ${content.length} differ in content.`);
if (orderOnly.length) console.log("\nOrder only: " + orderOnly.map((r) => r.path.replace("&from=2026-09-01&to=2026-11-04", "")).join("\n            "));
for (const r of content) console.log(`\n  ${r.path}   (${r.ms[0]}ms vs ${r.ms[1]}ms)\n      ${r.diff}`);
fs.writeFileSync(`/tmp/compare-${ROLE}.json`, JSON.stringify(results, null, 2));
