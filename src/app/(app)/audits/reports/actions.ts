"use server";
import { requireUser } from "@/lib/auth";
import { can, readsAllAuditReports } from "@/lib/roles";
import { filedReport } from "@/lib/audits";

/** One filed report, for the panel that opens on a row. */
export async function loadReport(visitId: number) {
  const user = await requireUser();
  if (!readsAllAuditReports(user.role) && !can(user.role, "auditReports"))
    return { error: "That report is not yours to read." };
  const found = await filedReport(user, visitId);
  if (!found) return { error: "That report is not yours to read, or is not filed yet." };
  return found;
}
