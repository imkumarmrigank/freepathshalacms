import Image from "next/image";
import Link from "next/link";

export const metadata = {
  title: "Get the app · FreePathshala CMS",
  description: "Install the FreePathshala CMS app on your Android phone.",
};

const STEPS = [
  {
    n: 1,
    title: "Download the app",
    body: "Tap the button above on your Android phone. The file is about 1–2 MB.",
  },
  {
    n: 2,
    title: "Allow the install",
    body: "Android will warn that the file came from outside the Play Store. Choose “Settings”, turn on “Allow from this source”, then go back and tap Install.",
  },
  {
    n: 3,
    title: "Sign in",
    body: "Open FreePathshala and sign in with the email and password your administrator gave you.",
  },
  {
    n: 4,
    title: "Allow location — teachers and managers only",
    body: "The first time you check in, Android asks for location. Choose “While using the app”. Check-in is verified against your centre’s coordinates, so it will not work without this.",
  },
];

export default function GetAppPage() {
  return (
    <div className="mx-auto max-w-[720px] px-6 py-14">
      <Link href="/login" className="text-[13px] text-[var(--muted)] hover:text-[var(--brand)]">
        ← Back to sign in
      </Link>

      <div className="mt-5 flex items-center gap-4">
        <Image src="/icons/icon-192.png" alt="" width={64} height={64}
          className="rounded-[14px] border border-[var(--border)]" />
        <div>
          <h1 className="text-[24px] font-semibold tracking-[-0.02em]">FreePathshala for Android</h1>
          <p className="mt-0.5 text-[14px] text-[var(--muted)]">
            The same system as the website, in an app on your phone.
          </p>
        </div>
      </div>

      <a href="/downloads/freepathshala.apk" download
         className="btn btn-primary mt-7 w-full py-3.5 text-[15px]">
        Download the app (.apk)
      </a>
      <p className="mt-2 text-center text-[12px] text-[var(--faint)]">
        Android 8.0 or newer · open this page on the phone you want to install it on
      </p>

      <ol className="mt-9 space-y-5">
        {STEPS.map((s) => (
          <li key={s.n} className="flex gap-4">
            <span className="grid h-7 w-7 flex-none place-items-center rounded-full bg-[var(--brand)] text-[13px] font-semibold text-white">
              {s.n}
            </span>
            <div>
              <h2 className="text-[15px] font-medium">{s.title}</h2>
              <p className="mt-0.5 text-[14px] leading-relaxed text-[var(--muted)]">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="card card-pad mt-9">
        <h2 className="text-[15px] font-semibold">Would rather not install anything?</h2>
        <p className="mt-1 text-[14px] leading-relaxed text-[var(--muted)]">
          The website works the same on a phone browser. In Chrome, open the site, tap the
          three-dot menu and choose <strong>Add to Home screen</strong> — you get the same icon
          and full-screen app without downloading a file.
        </p>
      </div>

      <p className="mt-8 text-center text-[12px] text-[var(--faint)]">
        The app is signed by FreePathshala and is not distributed through the Play Store, which is
        why Android asks you to confirm the install.
      </p>
    </div>
  );
}
