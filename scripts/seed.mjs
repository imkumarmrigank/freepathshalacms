/**
 * Base seed  : class levels, academic sessions, one super admin.
 * With --demo : also two sample centres, staff, students and PTM records.
 * Safe to re-run — everything is upsert-style.
 */
import bcrypt from "bcryptjs";
import { connect } from "./db-connect.mjs";

const demo = process.argv.includes("--demo");

const c = await connect();
/** Like the old PostgreSQL helper: returns { rows }; SELECTs give their rows, writes give []. */
const q = async (t, p = []) => { const [res] = await c.query(t, p); return { rows: Array.isArray(res) ? res : [], header: res }; };

const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@freepathshala.org";
const adminPass = process.env.SEED_ADMIN_PASSWORD || "ChangeMe@123";

try {
  // ---------------------------------------------------------------- classes
  const classes = [
    ...Array.from({ length: 12 }, (_, i) => ({ name: `Class ${i + 1}`, seq: i + 1 })),
  ];
  for (const cl of classes) {
    await q(
      `INSERT INTO class_levels (name, sequence, is_terminal)
       VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE name = name`,
      [cl.name, cl.seq, cl.seq === 12],
    );
  }

  // ---------------------------------------------------------------- sessions
  const year = new Date().getFullYear();
  const month = new Date().getMonth() + 1;
  const startYear = month >= 4 ? year : year - 1;   // Indian academic year: April -> March
  const sessions = [
    { name: `${startYear - 1}-${String((startYear) % 100).padStart(2, "0")}`, s: `${startYear - 1}-04-01`, e: `${startYear}-03-31`, seq: 1, cur: false },
    { name: `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`, s: `${startYear}-04-01`, e: `${startYear + 1}-03-31`, seq: 2, cur: true },
  ];
  for (const s of sessions) {
    await q(
      `INSERT INTO academic_sessions (name, start_date, end_date, sequence, is_current)
       VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE name = name`,
      [s.name, s.s, s.e, s.seq, s.cur],
    );
  }

  // ---------------------------------------------------------------- super admin
  const hash = await bcrypt.hash(adminPass, 10);
  await q(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES (?,?,?,'super_admin')
     ON DUPLICATE KEY UPDATE name = VALUES(name)`,
    ["System Administrator", adminEmail, hash],
  );
  const { rows: [admin] } = await q("SELECT id, email FROM users WHERE email = ?", [adminEmail]);
  console.log(`✓ classes, sessions, super admin (${admin.email})`);
  if (!process.env.SEED_ADMIN_PASSWORD)
    console.log(`  ⚠ default password "${adminPass}" — change it after first login.`);

  if (!demo) { console.log("Base seed complete. Re-run with --demo for sample data."); }
  else {
    // -------------------------------------------------------------- centres
    const centreDefs = [
      { code: "C01", name: "Centre 01", area: "Dharavi", city: "Mumbai", lat: 19.0400, lng: 72.8500 },
      { code: "C04", name: "Centre 04", area: "Andheri", city: "Mumbai", lat: 19.1197, lng: 72.8464 },
    ];
    const centres = [];
    for (const d of centreDefs) {
      await q(
        `INSERT INTO centers (code, name, area, city, state, latitude, longitude, geofence_radius_m)
         VALUES (?,?,?,?,'Maharashtra',?,?,50)
         ON DUPLICATE KEY UPDATE name = VALUES(name),
           latitude = VALUES(latitude), longitude = VALUES(longitude)`,
        [d.code, d.name, d.area, d.city, d.lat, d.lng],
      );
      const { rows: [row] } = await q("SELECT id, code, name FROM centers WHERE code = ?", [d.code]);
      centres.push(row);
    }

    // -------------------------------------------------------------- staff
    const staffDefs = [
      { name: "Anita Deshmukh", email: "manager.c01@freepathshala.org", role: "center_manager", centre: 0 },
      { name: "Priya Ramesh", email: "priya@freepathshala.org", role: "center_manager", centre: 1 },
      { name: "Anjali Mehta", email: "anjali@freepathshala.org", role: "teacher", centre: 1 },
      { name: "Sunil Patil", email: "sunil@freepathshala.org", role: "teacher", centre: 0 },
    ];
    const staff = [];
    for (const s of staffDefs) {
      await q(
        `INSERT INTO users (name, email, password_hash, role, center_id)
         VALUES (?,?,?,?,?)
         ON DUPLICATE KEY UPDATE name = VALUES(name), center_id = VALUES(center_id)`,
        [s.name, s.email, hash, s.role, centres[s.centre].id],
      );
      const { rows: [row] } = await q("SELECT id, name, role, center_id FROM users WHERE email = ?", [s.email]);
      staff.push(row);
    }
    for (const centre of centres) {
      const mgr = staff.find((s) => s.role === "center_manager" && s.center_id === centre.id);
      if (mgr) await q("UPDATE centers SET manager_id = ? WHERE id = ?", [mgr.id, centre.id]);
    }

    // -------------------------------------------------------------- students
    const { rows: [cur] } = await q("SELECT id FROM academic_sessions WHERE is_current = 1 LIMIT 1");
    const { rows: classRows } = await q("SELECT id, name, sequence FROM class_levels ORDER BY sequence");
    const byName = Object.fromEntries(classRows.map((r) => [r.name, r]));

    const names = [
      ["Rahul", "Kumar", "Class 7", 1], ["Ayesha", "Khan", "Class 6", 1],
      ["Rohit", "Singh", "Class 8", 1], ["Priya", "Verma", "Class 7", 1],
      ["Suresh", "Yadav", "Class 9", 1], ["Kavita", "Sharma", "Class 6", 1],
      ["Vikram", "Das", "Class 8", 1], ["Neha", "Gupta", "Class 5", 0],
      ["Arjun", "Pawar", "Class 6", 0], ["Meera", "Joshi", "Class 7", 0],
    ];
    const prefix = process.env.ENROLLMENT_PREFIX || "FP";
    let created = 0;
    for (const [first, last, cls, ci] of names) {
      const centre = centres[ci];
      const exists = await q(
        "SELECT id FROM students WHERE first_name=? AND last_name=? AND center_id=?",
        [first, last, centre.id],
      );
      if (exists.rows.length) continue;

      await q(`INSERT INTO enrollment_counters (center_id, next_seq) VALUES (?,1)
               ON DUPLICATE KEY UPDATE center_id = center_id`, [centre.id]);
      const { rows: [ctr] } = await q("SELECT next_seq AS seq FROM enrollment_counters WHERE center_id = ?", [centre.id]);
      await q("UPDATE enrollment_counters SET next_seq = next_seq + 1 WHERE center_id = ?", [centre.id]);
      const enrollNo = `${prefix}-${centre.code}-${String(ctr.seq).padStart(4, "0")}`;

      const { header: st } = await q(
        `INSERT INTO students (enrollment_no, center_id, first_name, last_name, gender,
           father_name, mother_name, primary_phone, admission_date)
         VALUES (?,?,?,?,?,?,?,?, DATE_SUB(CURDATE(), INTERVAL 60 DAY))`,
        [enrollNo, centre.id, first, last,
         ["Priya","Ayesha","Kavita","Neha","Meera"].includes(first) ? "female" : "male",
         `${last} Senior`, `Mrs. ${last}`, `98${Math.floor(10000000 + Math.random() * 89999999)}`],
      );
      await q(
        `INSERT INTO enrollments (student_id, session_id, class_level_id, center_id,
            enrolled_on, source)
         VALUES (?,?,?,?, DATE_SUB(CURDATE(), INTERVAL 60 DAY), 'new')`,
        [st.insertId, cur.id, byName[cls].id, centre.id],
      );
      created++;
    }
    console.log(`✓ demo: ${centres.length} centres, ${staff.length} staff, ${created} students`);
  }
} catch (err) {
  console.error(err);
  process.exit(1);
} finally {
  await c.end();
}
