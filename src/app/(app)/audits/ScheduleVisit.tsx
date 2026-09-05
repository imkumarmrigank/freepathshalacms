import { auditors } from "@/lib/audits";
import { listCenters } from "@/lib/queries";
import ScheduleVisitForm from "./ScheduleVisitForm";

/** Loads the two lists the form needs, so the client half stays dumb. */
export default async function ScheduleVisit() {
  const [centres, people] = await Promise.all([listCenters(), auditors()]);
  return <ScheduleVisitForm centres={centres} auditors={people} />;
}
