"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Moves on to `state.redirectTo` when a form action answers with goTo(). */
export function useFollowRedirect(state: unknown) {
  const router = useRouter();
  useEffect(() => {
    const to = (state as { redirectTo?: unknown } | null)?.redirectTo;
    if (typeof to === "string") router.push(to);
  }, [state, router]);
}
