import Image from "next/image";

/**
 * The Pehchaan mark: the app icon beside the name.
 *
 * What used to sit here was the FreePathshala wordmark — the organisation's
 * logo, not this system's. The icon is the one already on the phone home
 * screen and in the manifest, so the app looks the same wherever it is opened.
 */
const SIZES = {
  sm: { box: "h-7 w-7 rounded-[8px]", name: "text-[16px]" },
  md: { box: "h-9 w-9 rounded-[10px]", name: "text-[19px]" },
  lg: { box: "h-12 w-12 rounded-[13px]", name: "text-[26px]" },
};

export default function Brand({ size = "md", className = "", onDark = false }:
  { size?: keyof typeof SIZES; className?: string; onDark?: boolean }) {
  const s = SIZES[size];
  return (
    <span className={`flex items-center gap-2.5 ${className}`}>
      <Image src="/icons/icon-192.png" alt="" width={192} height={192} priority
        className={`${s.box} flex-none object-cover shadow-[0_1px_3px_rgba(14,42,71,0.18)]`} />
      <span className={`font-semibold leading-none tracking-[-0.01em] ${s.name}
        ${onDark ? "text-white" : "text-[var(--brand)]"}`}
        style={{ fontFamily: "var(--font-literata), Georgia, serif" }}>
        Pehchaan
      </span>
    </span>
  );
}
