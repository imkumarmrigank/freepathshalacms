"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { punch, punchByHand } from "./actions";
import { FormMessage, Submit } from "@/components/form";
import { Alert, Field } from "@/components/ui";
import { AWAY_REASONS } from "@/lib/away-meta";
import { BY_HAND_FROM_M, BY_HAND_UPTO_M } from "@/lib/geo";
import { useT } from "@/components/LocaleProvider";

type Today = {
  check_in_at: string | null; check_out_at: string | null;
  check_in_distance_m: number | null; worked_minutes: number | null; status: string;
} | null;

type Spell = {
  id: number; check_in_at: string; check_out_at: string | null; worked_minutes: number | null;
};

export default function PunchCard({
  today, spells, centerName, radius, hasCoords,
}: {
  today: Today; spells: Spell[]; centerName: string; radius: number; hasCoords: boolean;
}) {
  const t = useT();
  const [state, action] = useActionState(punch, null);
  const [byHandState, byHandAction] = useActionState(punchByHand, null);
  const [coords, setCoords] = useState<{ lat: number; lng: number; acc: number } | null>(null);
  // the fix that was refused, kept so a by-hand punch can record how far away
  // the person actually was
  const [lastFix, setLastFix] = useState<{ lat: number; lng: number; acc: number } | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [reason, setReason] = useState<string>(AWAY_REASONS[0]);

  // Where the punch was refused from decides what is offered. A few steps
  // outside the fence, the answer is to walk them; genuinely elsewhere, the
  // by-hand form; a kilometre away, nothing at all — a day that far from the
  // centre is the office's to enter, not the phone's to assert. A blocked
  // location or an unpinned centre is a different problem again, and typing
  // past either would hide it rather than fix it.
  const refusedAt = state?.distance;
  const nearlyThere = refusedAt != null && refusedAt <= BY_HAND_FROM_M;
  const tooFar = refusedAt != null && refusedAt > BY_HAND_UPTO_M;
  const outOfRange = Boolean(state?.error
    && /from the centre|allowed area|location looks wrong/i.test(state.error));
  // Once the punch is in by hand, the panel has done its job and goes away.
  const byHand = outOfRange && !nearlyThere && !tooFar
    && dismissed !== state?.error && !byHandState?.ok;
  const readable = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const lastError = useRef<string | undefined>(undefined);

  // A refused punch must not be retried with the same reading — drop the stored
  // coordinates so the next attempt takes a fresh fix.
  useEffect(() => {
    if (state?.error && state.error !== lastError.current) {
      lastError.current = state.error;
      setCoords(null);
    }
    if (!state?.error) lastError.current = undefined;
  }, [state]);

  const locate = () =>
    new Promise<void>((resolve) => {
      if (!("geolocation" in navigator)) {
        setGeoError(t("This device cannot report its location."));
        return resolve();
      }
      setLocating(true);
      setGeoError(null);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCoords({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            acc: Math.round(pos.coords.accuracy),
          });
          setLocating(false);
          resolve();
        },
        (err) => {
          setGeoError(
            err.code === err.PERMISSION_DENIED
              ? t("Location permission is blocked. Enable it for this site and try again.")
              : t("Could not read your location. Move to an open area and retry."),
          );
          setLocating(false);
          resolve();
        },
        { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
      );
    });

  const time = (v: string | null) =>
    v ? new Date(v).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }) : "—";

  // The day is never "finished": a teacher who leaves and comes back checks in
  // again. Only an open spell decides whether the next punch is in or out.
  const open = spells.find((s) => !s.check_out_at) ?? null;
  const kind = open ? "out" : "in";
  const hours = (m: number | null | undefined) => {
    if (m == null) return "—";
    const h = Math.floor(m / 60);
    return h ? `${h}h ${m % 60}m` : `${m}m`;
  };

  return (
    <div className="card card-pad">
      <FormMessage state={state} />
      {!hasCoords && (
        <div className="mb-4">
          <Alert kind="warn">
            {centerName} has no location pinned yet, so check-in is disabled.
            Ask your administrator to set the centre’s coordinates.
          </Alert>
        </div>
      )}
      {geoError && <div className="mb-4"><Alert kind="bad">{geoError}</Alert></div>}

      {/* however it ends, say plainly how far away they were */}
      {refusedAt != null && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-[10px]
          border border-[var(--border)] bg-[#f7f7fb] px-3.5 py-2.5">
          <span className="text-[13px] text-[var(--muted)]">{t("You are")}</span>
          <span className="font-mono text-[17px] font-semibold text-[var(--bad)]">
            {readable(refusedAt)}
          </span>
          <span className="text-[13px] text-[var(--muted)]">
            {t("from {centre} · check-in works within {r} m",
              { centre: centerName, r: radius })}
          </span>
        </div>
      )}

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
          <div className="label-cap mb-1.5">{t("Today’s spells")}</div>
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

      <form action={action} className="mt-5 flex flex-wrap items-center gap-3"
        onSubmit={() => setLastFix(coords)}>
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="lat" value={coords?.lat ?? ""} />
        <input type="hidden" name="lng" value={coords?.lng ?? ""} />
        <input type="hidden" name="accuracy" value={coords?.acc ?? ""} />

        {hasCoords && (
          coords ? (
            <button type="submit" className="btn btn-primary">
              {kind === "in" ? t("Confirm check-in") : t("Confirm check-out")}
            </button>
          ) : (
            <button type="button" className="btn btn-primary" disabled={locating}
              onClick={() => { void locate(); }}>
              {locating ? t("Reading location…")
                : kind === "in" ? t("Check in") : t("Check out")}
            </button>
          )
        )}
        <span className="text-[13px] text-[var(--muted)]">
          {coords
            ? t("Location ready (±{a} m). This is only possible within {r} m of {centre}.",
                { a: coords.acc, r: radius, centre: centerName })
            : t("Both check-in and check-out must be done within {r} m of {centre}.",
                { r: radius, centre: centerName })}
        </span>
      </form>

      {nearlyThere && (
        <div className="mt-5 rounded-[10px] border border-[var(--warn)] bg-[var(--warn-soft)]
          px-4 py-3 text-[13px] text-[#b45309]">
          {t("You are {d} from {centre} — almost there. Walk up to the centre and check in; "
            + "the circle is {r} m wide.",
            { d: readable(refusedAt!), centre: centerName, r: radius })}
        </div>
      )}

      {tooFar && (
        <div className="mt-5 rounded-[10px] border border-[var(--border)] bg-[#f7f7fb]
          px-4 py-3 text-[13px] text-[var(--muted)]">
          {t("You are {d} from {centre}. A day this far from the centre is marked by your "
            + "centre manager, with the reason, not from here.",
            { d: readable(refusedAt!), centre: centerName })}
        </div>
      )}

      {/* ------------------------------------------------- away from the centre */}
      {byHand && (
        <div className="mt-5 rounded-[10px] border border-[var(--warn)] bg-[var(--warn-soft)] px-4 py-4">
          <div className="text-[14px] font-semibold text-[#b45309]">
            {t("Away from {centre}? Enter it by hand", { centre: centerName })}
          </div>
          <p className="mt-1 text-[13px] text-[#b45309]">
            {t("This only appears because you are outside the {r} m circle. Say where you "
              + "are; your administrator sees the reason and the distance beside the punch.",
              { r: radius })}
          </p>
          <form action={byHandAction} className="mt-3">
            <FormMessage state={byHandState} />
            <input type="hidden" name="kind" value={kind} />
            <input type="hidden" name="lat" value={lastFix?.lat ?? ""} />
            <input type="hidden" name="lng" value={lastFix?.lng ?? ""} />
            <input type="hidden" name="accuracy" value={lastFix?.acc ?? ""} />
            <div className="grid gap-x-4 sm:grid-cols-2">
              <Field label={t("Why you are not at the centre")}>
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
                {kind === "in" ? t("Check in by hand") : t("Check out by hand")}
              </Submit>
              <button type="button" className="btn btn-ghost btn-sm"
                onClick={() => setDismissed(state?.error ?? null)}>
                {t("Not now — I will try again at the centre")}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
