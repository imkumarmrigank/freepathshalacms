import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { Avatar } from "@/components/ui";
import { IconLogout } from "@/components/icons";
import { destroySession, getSession } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/roles";
import { fmtDate } from "@/lib/format";

async function logout() {
  "use server";
  await destroySession();
  redirect("/login");
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSession();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-[236px] flex-none flex-col border-r border-[var(--border)] bg-white lg:flex">
        <Link href="/dashboard" className="block px-5 py-5">
          <Image src="/logo.png" alt="FreePathshala" width={500} height={153}
            className="h-auto w-[168px]" priority />
          <span className="mt-1.5 block text-[11px] text-[var(--muted)]">Centre Management</span>
        </Link>

        <div className="flex-1 overflow-y-auto">
          <Sidebar role={user.role} />
        </div>

        <div className="border-t border-[var(--border)] p-3">
          <div className="flex items-center gap-2.5">
            <Avatar name={user.name} size={32} />
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-[13px] font-medium">{user.name}</div>
              <div className="truncate text-[11px] text-[var(--muted)]">
                {ROLE_LABEL[user.role]}{user.centerName ? ` · ${user.centerName}` : ""}
              </div>
            </div>
            <form action={logout}>
              <button className="rounded-md p-1.5 text-[var(--faint)] hover:bg-[#f1f1f8] hover:text-[var(--bad)]"
                title="Sign out" type="submit">
                <IconLogout className="h-[17px] w-[17px]" />
              </button>
            </form>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-[var(--border)] bg-white/85 px-5 py-3 backdrop-blur lg:px-8">
          <Link href="/dashboard" className="lg:hidden">
            <Image src="/logo.png" alt="FreePathshala" width={500} height={153}
              className="h-auto w-[132px]" priority />
          </Link>
          <div className="hidden text-[13px] text-[var(--muted)] lg:block">
            {user.centerName ? `${user.centerName}` : "All centres"}
          </div>
          <div className="text-[13px] text-[var(--muted)]">{fmtDate(new Date())}</div>
        </header>

        <div className="border-b border-[var(--border)] bg-white lg:hidden">
          <div className="overflow-x-auto"><Sidebar role={user.role} horizontal /></div>
        </div>

        <main className="mx-auto w-full max-w-[1180px] flex-1 px-5 py-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
