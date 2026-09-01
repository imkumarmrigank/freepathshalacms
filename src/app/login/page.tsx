import Image from "next/image";
import { redirect } from "next/navigation";
import { createSession, getSession, verifyLogin } from "@/lib/auth";

export const metadata = { title: "Sign in · FreePathshala CMS" };

async function login(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const user = await verifyLogin(email, password);
  if (!user) redirect("/login?error=1");
  await createSession(user);
  redirect("/dashboard");
}

export default async function LoginPage({
  searchParams,
}: { searchParams: Promise<{ error?: string }> }) {
  if (await getSession()) redirect("/dashboard");
  const { error } = await searchParams;

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-[var(--brand)] p-12 text-white lg:flex">
        <div className="inline-flex rounded-[12px] bg-white px-4 py-3">
          <Image src="/logo.png" alt="FreePathshala" width={500} height={153}
            className="h-auto w-[184px]" priority />
        </div>
        <div>
          <h2 className="max-w-md text-[30px] font-semibold leading-[1.2] tracking-[-0.02em]">
            One place for every centre, every student, every session.
          </h2>
          <ul className="mt-7 space-y-2.5 text-[14px] text-white/75">
            <li>· Session-wise enrolment with automatic promotion</li>
            <li>· Daily student attendance marked by teachers</li>
            <li>· Geofenced staff check-in at the centre</li>
            <li>· Parent-teacher meetings and follow-ups</li>
          </ul>
        </div>
        <p className="text-[12px] text-white/50">© {new Date().getFullYear()} FreePathshala</p>
      </div>

      <div className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-[352px]">
          <div className="mb-8 lg:hidden">
            <Image src="/logo.png" alt="FreePathshala" width={500} height={153}
              className="h-auto w-[168px]" priority />
          </div>
          <h1 className="text-[22px] font-semibold tracking-[-0.01em]">Sign in</h1>
          <p className="mt-1 text-[13px] text-[var(--muted)]">Use the credentials issued by your administrator.</p>

          {error && (
            <div className="mt-5 rounded-[9px] bg-[var(--bad-soft)] px-3.5 py-2.5 text-[13px] text-[#b91c1c]">
              Incorrect email or password, or the account is inactive.
            </div>
          )}

          <form action={login} className="mt-6">
            <label className="field">
              <span>Email</span>
              <input className="input" type="email" name="email" required autoComplete="email" autoFocus />
            </label>
            <label className="field">
              <span>Password</span>
              <input className="input" type="password" name="password" required autoComplete="current-password" />
            </label>
            <button className="btn btn-primary mt-2 w-full" type="submit">Sign in</button>
          </form>
        </div>
      </div>
    </div>
  );
}
