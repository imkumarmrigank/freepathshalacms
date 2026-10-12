"use client";
import { useActionState, useEffect, useRef, useState, useCallback } from "react";
import { punch, punchByHand } from "./actions";
import { FormMessage, Submit } from "@/components/form";
import { Alert, Field } from "@/components/ui";
import { AWAY_REASONS } from "@/lib/away-meta";
import { BY_HAND_FROM_M, BY_HAND_UPTO_M, GPS_ACCURACY_THRESHOLD_M } from "@/lib/geo";
import { useT } from "@/components/LocaleProvider";

type Today = {
  check_in_at: string | null; check_out_at: string | null;
  check_in_distance_m: number | null; worked_minutes: number | null; status: string;
} | null;

type Spell = {
  id: number; check_in_at: string; check_out_at: string | null; worked_minutes: number | null;
};

type Fix = { lat: number; lng: number; acc: number };

function readable(m: number) {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`;
}

export default function PunchCard({
  today, spells, centerName, radius, hasCoords,
  centerLat, centerLng,
}: {
  today: Today; spells: Spell[]; centerName: string; radius: number; hasCoords: boolean;
  centerLat: number | null; centerLng: number | null;
}) {
  const t = useT();
  const [state, action] = useActionState(punch, null);
  const [byHandState, byHandAction] = useActionState(punchByHand, null);

  // Current GPS fix (good enough to submit)
  const [fix, setFix] = useState<Fix | null>(null);
  // Last fix used when a punch was refused — passed to the by-hand form
  const [lastFix, setLastFix] = useState<Fix | null>(null);
  // Live GPS state while watching
  const [watching, setWatching] = useState(false);
  const [liveAcc, setLiveAcc]   = useState<number | null>(null);
  const [liveDist, setLiveDist] = useState<number | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const watchId = useRef<number | null>(null);

  const [reason, setReason] = useState<string>(AWAY_REASONS[0]);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const lastError = useRef<string | undefined>(undefined);

  // Haversine in metres — mirrors server lib/geo.ts
  function haversine(lat1: number, lng1: number, lat2: number, lng2: number) {
    const R = 6_371_000;
    const r = (d: number) => (d * Math.PI) / 180;
    const dLat = r(lat2 - lat1), dLng = r(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2
      + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(dLng / 2) ** 2;
    return Math.round(2 * R * Math.asin(Math.sqrt(a)));
  }

  // Stop the GPS watcher when we have a good enough fix or on unmount
  const stopWatch = useCallback(() => {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    setWatching(false);
  }, []);

  useEffect(() => () => stopWatch(), [stopWatch]);

  // Drop the stored fix when a punch is refused so the next attempt is fresh
  useEffect(() => {
    if (state?.error && state.error !== lastError.current) {
      lastError.current = state.error;
      setFix(null);
      setLiveDist(null);
    }
    if (!state?.error) lastError.current = undefined;
  }, [state]);

  const startLocating = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setGeoError(t("This device cannot report its location."));
      return;
    }
    setGeoError(null);
    setFix(null);
    setLiveDist(null);
    setLiveAcc(null);
    setWatching(true);

    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const acc = Math.round(pos.coords.accuracy);
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setLiveAcc(acc);

        // Compute live distance to centre for the "move closer" indicator
        if (centerLat != null && centerLng != null) {
          setLiveDist(haversine(centerLat, centerLng, lat, lng));
        }

        // Only accept fix when accuracy is good enough
        if (acc <= GPS_ACCURACY_THRESHOLD_M) {
          setFix({ lat, lng, acc });
          stopWatch();
        }
      },
      (err) => {
        stopWatch();
        setGeoError(
          err.code === err.PERMISSION_DENIED
            ? t("Location permission is blocked — open your browser/app settings and allow location for this site, then try again.")
            : t("Could not read your location. Move to an open area or near a window and retry."),
        );
      },
      { enableHighAccuracy: true, timeout: 30_000, maximumAge: 0 },
    );
  }, [centerLat, centerLng, stopWatch, t]);

  const time = (v: string | null) =>
    v ? new Date(v).toLocaleTimeString("en-IN",
      { hour: "2-digit", minute: "2-digit", hour12: true }) : "—";

  const hours = (m: number | null | undefined) => {
    if (m == null) return "—";
    const h = Math.floor(m / 60);
    return h ? `${h}h ${m % 60}m` : `${m}m`;
  };

  const open = spells.find((s) => !s.check_out_at) ?? null;
  const kind = open ? "out" : "in";

  // Classify the refused distance
  const refusedAt   = state?.distance;
  const nearlyThere = refusedAt != null && refusedAt <= BY_HAND_FROM_M;
  const tooFar      = refusedAt != null && refusedAt > BY_HAND_UPTO_M;
  const outOfRange  = Boolean(state?.error
    && /from the centre|allowed area|location looks wrong/i.test(state.error));
  const showByHand  = outOfRange && !nearlyThere && !tooFar
    && dismissed !== state?.error && !byHandState?.ok;

  // Live distance zone colours
  const distZone = liveDist == null ? null
    : liveDist <= radius          ? "ok"
    : liveDist <= BY_HAND_FROM_M  ? "warn"
    : liveDist <= BY_HAND_UPTO_M  ? "bad"
    : "blocked";

  return (
    <div className="card card-pad">
      <FormMessage state={state} />

      {/* Centre has no pin */}
      {!hasCoords && (
        <div className="mb-4">
          <Alert kind="warn">
            {centerName} has no location pinned yet — check-in is disabled.
            Ask your administrator to set the centre&apos;s coordinates.
          </Alert>
        </div>
      )}

      {/* GPS blocked */}
      {geoError && (
        <div className="mb-4">
          <Alert kind="bad">{geoError}</Alert>
        </div>
      )}

      {/* Refused distance banner */}
      {refusedAt != null && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-[10px]
          border border-[var(--border)] bg-[#f7f7fb] px-3.5 py-2.5">
          <span className="text-[13px] text-[var(--muted)]">{t("You were")}</span>
          <span className="font-mono text-[17px] font-semibold text-[var(--bad)]">
            {readable(refusedAt)}
          </span>
          <span className="text-[13px] text-[var(--muted)]">
            {t("from {centre} when the punch was attempted", { centre: centerName })}
          </span>
        </div>
      )}

      {/* Today's summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <div className="label-cap">{t("Checked in")}</div>
          <div className="mt-1.5 text-[20px] font-semibold">{time(today?.check_in_at ?? null)}</div>
          {today?.check_in_distance_m != null && (
            <div className="text-[12px] text-[var(--muted)]">
              {t("{m} m from centre", { m: today.check_in_distance_m })}
            </div>
          )}
        </div>
        <div>
          <div className="label-cap">{t("Checked out")}</div>
          <div className="mt-1.5 text-[20px] font-semibold">{time(today?.check_out_at ?? null)}</div>
        </div>
        <div>
          <div className="label-cap">{t("Status")}</div>
          <div className="mt-1.5 text-[20px] font-semibold capitalize">
            {t(today?.status ?? "not marked")}
          </div>
          <div className="text-[12px] text-[var(--muted)]">
            {open
              ? t("Currently checked in")
              : t("{h} logged today", { h: hours(today?.worked_minutes) })}
          </div>
        </div>
      </div>

      {spells.length > 1 && (
        <div className="mt-4">
          <div className="label-cap mb-1.5">{t("Today's spells")}</div>
          <ul className="text-[13px] text-[var(--muted)]">
            {spells.map((s, i) => (
              <li key={s.id}>
                {i + 1}. {time(s.check_in_at)} → {s.check_out_at ? time(s.check_out_at) : t("still in")}
                {s.worked_minutes != null && ` · ${hours(s.worked_minutes)}`}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Main punch area ── */}
      {hasCoords && (
        <div className="mt-5">
          {/* Step 1: not yet locating */}
          {!watching && !fix && (
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" className="btn btn-primary" onClick={startLocating}>
                {kind === "in" ? t("Check in") : t("Check out")}
              </button>
              <span className="text-[13px] text-[var(--muted)]">
                {t("Must be within {r} m of {centre}. Your location will be verified.",
                  { r: radius, centre: centerName })}
              </span>
            </div>
          )}

          {/* Step 2: GPS is acquiring — show live distance */}
          {watching && (
            <div className="rounded-[12px] border border-[var(--border)] bg-[var(--surface-raised)] px-4 py-4">
              <div className="mb-2 flex items-center gap-2">
                {/* animated spinner */}
                <svg className="h-4 w-4 animate-spin text-[var(--brand)]" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                <span className="text-[13px] font-medium text-[var(--text)]">
                  {liveAcc == null
                    ? t("Reading your GPS…")
                    : liveAcc > GPS_ACCURACY_THRESHOLD_M
                      ? t("Improving accuracy… (±{a} m)", { a: liveAcc })
                      : t("GPS ready (±{a} m)", { a: liveAcc })}
                </span>
              </div>

              {/* Live distance bar */}
              {liveDist != null && (
                <div className="mt-2">
                  <div className="mb-1 flex items-baseline justify-between text-[12px]">
                    <span className="text-[var(--muted)]">{t("Distance to {centre}", { centre: centerName })}</span>
                    <span className={`font-semibold tabular-nums
                      ${distZone === "ok"      ? "text-[var(--ok)]"   :
                        distZone === "warn"    ? "text-[#b45309]"     :
                        distZone === "bad"     ? "text-[var(--bad)]"  :
                                                "text-[var(--bad)]"}`}>
                      {readable(liveDist)}
                    </span>
                  </div>
                  {/* Visual bar — capped at BY_HAND_UPTO_M for the scale */}
                  <div className="h-2 w-full rounded-full bg-[var(--surface)]">
                    <div
                      className={`h-2 rounded-full transition-all
                        ${distZone === "ok"   ? "bg-[var(--ok)]"  :
                          distZone === "warn" ? "bg-[#f59e0b]"    :
                                               "bg-[var(--bad)]"}`}
                      style={{ width: `${Math.min(100, (liveDist / BY_HAND_UPTO_M) * 100)}%` }}
                    />
                  </div>
                  <div className="mt-1 text-[11px] text-[var(--faint)]">
                    {distZone === "ok"
                      ? t("✓ Inside the {r} m zone — good to go", { r: radius })
                      : distZone === "warn"
                        ? t("Move closer — check-in works within {r} m", { r: radius })
                        : distZone === "bad"
                          ? t("Too far for self-check-in. Move within {r} m or use the form below.", { r: radius })
                          : t("You are too far ({d}). Ask your centre manager to mark your attendance.", { d: readable(liveDist) })}
                  </div>
                </div>
              )}

              <button type="button" className="mt-3 text-[12px] text-[var(--muted)] underline"
                onClick={stopWatch}>
                {t("Cancel")}
              </button>
            </div>
          )}

          {/* Step 3: good fix — confirm button */}
          {fix && !watching && (
            <form action={action} className="flex flex-wrap items-center gap-3"
              onSubmit={() => setLastFix(fix)}>
              <input type="hidden" name="kind"     value={kind} />
              <input type="hidden" name="lat"      value={fix.lat} />
              <input type="hidden" name="lng"      value={fix.lng} />
              <input type="hidden" name="accuracy" value={fix.acc} />
              <button type="submit" className="btn btn-primary">
                {kind === "in" ? t("Confirm check-in") : t("Confirm check-out")}
              </button>
              <span className="text-[13px] text-[var(--muted)]">
                {t("Location ready (±{a} m) · within {r} m of {centre}",
                  { a: fix.acc, r: radius, centre: centerName })}
              </span>
            </form>
          )}
        </div>
      )}

      {/* Nearly there — tell them to walk closer, no by-hand form */}
      {nearlyThere && (
        <div className="mt-5 rounded-[10px] border border-[var(--warn)] bg-[var(--warn-soft)]
          px-4 py-3 text-[13px] text-[#b45309]">
          {t("You are {d} from {centre} — almost there. Walk up and check in; the check-in zone is {r} m wide.",
            { d: readable(refusedAt!), centre: centerName, r: radius })}
        </div>
      )}

      {/* Too far — hard block */}
      {tooFar && (
        <div className="mt-5 rounded-[10px] border border-[var(--bad)] bg-[#fff1f1]
          px-4 py-3 text-[13px] text-[var(--bad)]">
          <strong>{t("Check-in not possible from here.")}</strong>{" "}
          {t("You are {d} away from {centre}. Only your centre manager can mark attendance for a day this far from the centre.",
            { d: readable(refusedAt!), centre: centerName })}
        </div>
      )}

      {/* ── By-hand form: 100–500 m only ── */}
      {showByHand && (
        <div className="mt-5 rounded-[10px] border border-[var(--warn)] bg-[var(--warn-soft)] px-4 py-4">
          <div className="text-[14px] font-semibold text-[#b45309]">
            {t("Away from {centre}? Mark it with a reason", { centre: centerName })}
          </div>
          <p className="mt-1 text-[13px] text-[#b45309]">
            {t(
              "You are {d} from {centre} — outside the {r} m check-in zone. "
              + "You can mark your attendance here but your administrator will see "
              + "the exact distance and your reason.",
              { d: readable(refusedAt!), centre: centerName, r: radius },
            )}
          </p>
          <form action={byHandAction} className="mt-3">
            <FormMessage state={byHandState} />
            <input type="hidden" name="kind"     value={kind} />
            <input type="hidden" name="lat"      value={lastFix?.lat ?? ""} />
            <input type="hidden" name="lng"      value={lastFix?.lng ?? ""} />
            <input type="hidden" name="accuracy" value={lastFix?.acc ?? ""} />
            <div className="grid gap-x-4 sm:grid-cols-2">
              <Field label={t("Why you are not at the centre *")}>
                <select className="select" name="reason" value={reason}
                  onChange={(e) => setReason(e.target.value)}>
                  {AWAY_REASONS.map((r) => <option key={r} value={r}>{t(r)}</option>)}
                </select>
              </Field>
              <Field label={reason.startsWith("Other")
                ? t("Where you are *") : t("Anything to add")}>
                <input className="input" name="note"
                  required={reason.startsWith("Other")}
                  placeholder={t("Home visits in Nathupur with the mentor")} />
              </Field>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Submit>
                {kind === "in" ? t("Check in with reason") : t("Check out with reason")}
              </Submit>
              <button type="button" className="btn btn-ghost btn-sm"
                onClick={() => setDismissed(state?.error ?? null)}>
                {t("I will try again at the centre")}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
