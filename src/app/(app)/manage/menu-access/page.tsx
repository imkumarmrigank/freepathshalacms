import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { PageHeader, Card } from "@/components/ui";
import { ROLE_LABEL, type Role } from "@/lib/roles";
import { ensureMenuOverridesTable, hiddenKeysForUser } from "@/lib/menu-overrides";
import MenuAccessEditor from "./MenuAccessEditor";

export const metadata = { title: "Menu access · FreePathshala" };

export default async function MenuAccessPage({
  searchParams,
}: { searchParams: Promise<{ user?: string }> }) {
  const user = await requireUser();
  if (user.role !== "super_admin") redirect("/dashboard");

  const sp = await searchParams;
  const selectedUserId = sp.user ? Number(sp.user) : null;

  await ensureMenuOverridesTable();

  const users = await query<{
    id: number; name: string; role: Role; center_name: string | null;
  }>(
    `SELECT u.id, u.name, u.role, ce.name AS center_name
       FROM users u
       LEFT JOIN centers ce ON ce.id = u.center_id
      WHERE u.is_active = TRUE AND u.is_test = FALSE
        AND u.role != 'super_admin'
      ORDER BY u.role, u.name`,
  );

  const initialHiddenKeys = selectedUserId
    ? [...(await hiddenKeysForUser(selectedUserId))]
    : [];

  return (
    <>
      <PageHeader
        title="Menu access"
        subtitle="Control which pages each user can see in the navigation."
      />
      <Card className="mt-6">
        <p className="mb-5 text-[13.5px] text-[var(--muted)]">
          Checked items are visible to the user. Uncheck any item to hide it from their menu.
          Role-based gates still apply — this only hides items the role would otherwise see.
        </p>
        <MenuAccessEditor
          users={users}
          initialUserId={selectedUserId}
          initialHiddenKeys={initialHiddenKeys}
        />
      </Card>
    </>
  );
}
