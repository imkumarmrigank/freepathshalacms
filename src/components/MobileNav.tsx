"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Sidebar, { dockFor } from "./Sidebar";
import { IconLogout, IconMenu, IconClose } from "./icons";
import { ROLE_LABEL, type Role } from "@/lib/roles";

/**
 * The phone and the Android app.
 *
 * A row of destinations docked to the foot of the screen, and everything else
 * behind one button. The old shell put the whole menu in a strip that scrolled
 * sideways, which hid most of it, and kept the account panel — sign out
 * included — in a sidebar that only appears on a wide screen. In the app there
 * was no way to sign out at all.
 *
 * The dock and the drawer are sent to the body through a portal. The header
 * they are declared in carries a backdrop blur, and backdrop-filter makes an
 * element the containing block for anything fixed inside it — so "bottom: 0"
 * meant the bottom of the header, which is how the dock ended up along the top
 * of the screen and the drawer ended up an invisible sliver.
 */
export default function MobileNav({
  role, name, centerName, scopeLabel, logout,
}: {
  role: Role;
  name: string;
  centerName: string | null;
  scopeLabel: string;
  /** The sign-out server action, handed down so the drawer can post it. */
  logout: () => Promise<void>;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const path = usePathname();

  // a portal needs a document, which the first server render does not have
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // Going somewhere closes the drawer behind you. Adjusted during render
  // rather than in an effect, so the drawer is gone in the same paint as the
  // new page instead of flashing over it.
  const [wasAt, setWasAt] = useState(path);
  if (path !== wasAt) {
    setWasAt(path);
    if (open) setOpen(false);
  }

  // and so does Escape, with the page held still while it is open
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const dock = dockFor(role);
  const isOn = (href: string) => path === href || path.startsWith(href + "/");

  return (
    <>
      {/* ------------------------------------------------------- the hamburger */}
      <button type="button" onClick={() => setOpen(true)}
        aria-label="Open the menu" aria-expanded={open}
        className="dock-hamburger lg:hidden">
        <IconMenu className="h-[22px] w-[22px]" />
      </button>

      {mounted && createPortal(
        <>
      {/* ----------------------------------------------------------- the drawer */}
      {open && (
        <div className="drawer-scrim lg:hidden" onClick={() => setOpen(false)}>
          <nav className="drawer" onClick={(e) => e.stopPropagation()}
            aria-label="Menu">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
              <div className="min-w-0">
                <div className="truncate text-[15px] font-semibold">{name}</div>
                <div className="truncate text-[12px] text-[var(--muted)]">
                  {ROLE_LABEL[role]}{centerName ? ` · ${centerName}` : ` · ${scopeLabel}`}
                </div>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close the menu"
                className="rounded-lg p-1.5 text-[var(--faint)] hover:bg-[#f1f1f8]">
                <IconClose className="h-[20px] w-[20px]" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto py-2">
              <Sidebar role={role} />
            </div>

            <form action={logout}
              className="flex-none border-t border-[var(--border)] p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
              <button type="submit"
                className="flex w-full items-center justify-center gap-2 rounded-[10px] border border-[var(--border)] px-3 py-2.5 text-[14px] font-medium text-[var(--bad)] hover:bg-[var(--bad-soft)]">
                <IconLogout className="h-[17px] w-[17px]" /> Sign out
              </button>
            </form>
          </nav>
        </div>
      )}

      {/* ------------------------------------------------------------- the dock */}
      <nav className="dock lg:hidden" aria-label="Main">
        {dock.map((d) => {
          const Icon = d.icon;
          return (
            <Link key={d.href} href={d.href} className="dock-item" data-on={isOn(d.href)}>
              <Icon className="h-[21px] w-[21px]" />
              <span className="dock-label">{d.label}</span>
            </Link>
          );
        })}
        <button type="button" className="dock-item" onClick={() => setOpen(true)}
          data-on={open} aria-label="More">
          <IconMenu className="h-[21px] w-[21px]" />
          <span className="dock-label">More</span>
        </button>
      </nav>
        </>,
        document.body,
      )}
    </>
  );
}
