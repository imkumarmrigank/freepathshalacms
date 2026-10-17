import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { PageHeader, Card } from "@/components/ui";
import { type Role } from "@/lib/roles";
import { ensureMenuOverridesTable, overrideArraysForRole } from "@/lib/menu-overrides";
import { accessibleHrefs } from "@/lib/menu-tree";
import MenuAccessEditor from "./MenuAccessEditor";

export const metadata = { title: "Menu access · FreePathshala" };

const VALID_ROLES: Role[] = [
  "admin", "mentor", "center_manager", "teacher", "backup_teacher",
  "auditor", "sports_teacher", "rider",
];

export default async function MenuAccessPage({
  searchParams,
}: { searchParams: Promise<{ role?: string }> }) {
  const user = await requireUser();
  if (user.role !== "super_admin") redirect("/dashboard");

  const sp = await searchParams;
  const selectedRole = (VALID_ROLES.includes(sp.role as Role) ? sp.role as Role : null);

  await ensureMenuOverridesTable();

  const [overrides, defaultHrefs] = selectedRole
    ? await Promise.all([
        overrideArraysForRole(selectedRole),
        Promise.resolve(accessibleHrefs(selectedRole)),
      ])
    : [{ hiddenKeys: [], grantedKeys: [] }, [] as string[]];

  return (
    <>
      <PageHeader
        title="Menu access"
        subtitle="Control which pages each role can see in the navigation."
      />
      <Card className="mt-6">
        <MenuAccessEditor
          key={selectedRole ?? "none"}
          selectedRole={selectedRole}
          defaultHrefs={defaultHrefs}
          hiddenKeys={overrides.hiddenKeys}
          grantedKeys={overrides.grantedKeys}
        />
      </Card>
    </>
  );
}
