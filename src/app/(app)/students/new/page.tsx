import { requireUser } from "@/lib/auth";
import { centersForUser, currentSession, listClasses } from "@/lib/queries";
import { Alert, PageHeader } from "@/components/ui";
import StudentForm from "./StudentForm";
import { isGlobalRole, isTeaching } from "@/lib/roles";

export default async function NewStudentPage() {
  const user = await requireUser();
  const [centers, classes, session] = await Promise.all([
    centersForUser(user), listClasses(), currentSession(),
  ]);

  if (isTeaching(user.role))
    return (
      <Alert kind="bad">
        Only the centre manager can admit a student. Pass the details to your manager.
      </Alert>
    );
  if (!session)
    return <Alert kind="warn">No academic session is open. An administrator must create one first.</Alert>;
  if (centers.length === 0)
    return <Alert kind="warn">You are not assigned to a centre yet. Ask your administrator.</Alert>;

  return (
    <>
      <PageHeader title="Add student" subtitle={`New admission in session ${session.name}`}
        back={{ href: "/students", label: "Students" }} />
      <StudentForm
        centers={centers}
        classes={classes}
        showCenter={isGlobalRole(user.role)}
        defaultCenterId={user.centerId}
        sessionName={session.name}
        sessionStart={session.start_date}
      />
    </>
  );
}
