import Brand from "@/components/Brand";
import { redirect } from "next/navigation";
import { createSession, getSession, verifyLogin } from "@/lib/auth";
import { dictFor, getLocale, getT } from "@/lib/i18n";
import { LocaleProvider } from "@/components/LocaleProvider";
import LanguageToggle from "@/components/LanguageToggle";

export const metadata = { title: "Sign in · Pehchaan" };

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
  const locale = await getLocale();
  const t = await getT();

  return (
    <LocaleProvider locale={locale} dict={dictFor(locale)}>
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-[var(--brand)] p-12 text-white lg:flex">
        <Brand size="lg" onDark className="self-start" />
        <div>
          <h2 className="max-w-md text-[30px] font-semibold leading-[1.2] tracking-[-0.02em]">
            {t("One place for every centre, every student, every session.")}
          </h2>
          <ul className="mt-7 space-y-2.5 text-[14px] text-white/75">
            <li>· {t("Session-wise enrolment with automatic promotion")}</li>
            <li>· {t("Daily student attendance marked by teachers")}</li>
            <li>· {t("Geofenced staff check-in at the centre")}</li>
            <li>· {t("Parent-teacher meetings and follow-ups")}</li>
          </ul>
        </div>
        <p className="text-[12px] text-white/50">© {new Date().getFullYear()} Pehchaan</p>
      </div>

      <div className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-[352px]">
          <div className="mb-6 flex items-center justify-between gap-3">
            <div className="lg:hidden"><Brand size="md" /></div>
            <div className="ml-auto"><LanguageToggle /></div>
          </div>
          <h1 className="text-[22px] font-semibold tracking-[-0.01em]">{t("Sign in")}</h1>
          <p className="mt-1 text-[13px] text-[var(--muted)]">
            {t("Use the credentials issued by your administrator.")}
          </p>

          {error && (
            <div className="mt-5 rounded-[9px] bg-[var(--bad-soft)] px-3.5 py-2.5 text-[13px] text-[#b91c1c]">
              {t("Incorrect email or password, or the account is inactive.")}
            </div>
          )}

          <form action={login} className="mt-6">
            <label className="field">
              <span>{t("Email")}</span>
              <input className="input" type="email" name="email" required autoComplete="email" autoFocus />
            </label>
            <label className="field">
              <span>{t("Password")}</span>
              <input className="input" type="password" name="password" required autoComplete="current-password" />
            </label>
            <button className="btn btn-primary mt-2 w-full" type="submit">{t("Sign in")}</button>
          </form>

          <p className="mt-6 text-center text-[13px] text-[var(--muted)]">
            {t("On a phone?")}{" "}
            <a href="/get-app" className="font-medium text-[var(--brand)] hover:underline">
              {t("Get the Android app")}
            </a>
          </p>
        </div>
      </div>
    </div>
    </LocaleProvider>
  );
}
