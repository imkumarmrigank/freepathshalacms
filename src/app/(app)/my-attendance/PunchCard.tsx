"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { punch } from "./actions";
import { FormMessage } from "@/components/form";
import { Alert } from "@/components/ui";

type Today = {
  check_in_at: string | null; check_out_at: string | null;
  check_in_distance_m: number | null; status: string;
} | null;

export default function PunchCard({
  today, centerName, radius, hasCoords,
}: { today: Today; centerName: string; radius: number; hasCoords: boolean }) {
  const [state, action] = useActionState(punch, null);
  const [coords, setCoords] = useState<{ lat: number; lng: number; acc: number } | null>(null);
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
        setGeoError("This device cannot report its location.");
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
              ? "Location permission is blocked. Enable it for this site and try again."
              : "Could not read your location. Move to an open area and retry.",
          );
          setLocating(false);
          resolve();
        },
        { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
      );
    });

  const time = (v: string | null) =>
    v ? new Date(v).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }) : "—";

  const checkedIn = Boolean(today?.check_in_at);
  const checkedOut = Boolean(today?.check_out_at);
  const kind = checkedIn ? "out" : "in";
  const done = checkedIn && checkedOut;

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

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <div className="label-cap">Checked in</div>
          <div className="mt-1.5 text-[20px] font-semibold">{time(today?.check_in_at ?? null)}</div>
          {today?.check_in_distance_m != null && (
            <div className="text-[12px] text-[var(--muted)]">{today.check_in_distance_m} m from centre</div>
          )}
        </div>
        <div>
          <div className="label-cap">Checked out</div>
          <div className="mt-1.5 text-[20px] font-semibold">{time(today?.check_out_at ?? null)}</div>
        </div>
        <div>
          <div className="label-cap">Status</div>
          <div className="mt-1.5 text-[20px] font-semibold capitalize">
            {today?.status ?? "not marked"}
          </div>
        </div>
      </div>

      <form action={action} className="mt-5 flex flex-wrap items-center gap-3">
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="lat" value={coords?.lat ?? ""} />
        <input type="hidden" name="lng" value={coords?.lng ?? ""} />
        <input type="hidden" name="accuracy" value={coords?.acc ?? ""} />

        {!done && hasCoords && (
          coords ? (
            <button type="submit" className="btn btn-primary">
              {kind === "in" ? "Confirm check-in" : "Confirm check-out"}
            </button>
          ) : (
            <button type="button" className="btn btn-primary" disabled={locating}
              onClick={() => { void locate(); }}>
              {locating ? "Reading location…" : kind === "in" ? "Check in" : "Check out"}
            </button>
          )
        )}
        {done && <span className="text-[13px] text-[var(--muted)]">Today is complete. See you tomorrow.</span>}

        <span className="text-[13px] text-[var(--muted)]">
          {coords
            ? `Location ready (±${coords.acc} m). Checking ${kind === "in" ? "in" : "out"} is only ` +
              `possible within ${radius} m of ${centerName}.`
            : `Both check-in and check-out must be done within ${radius} m of ${centerName}.`}
        </span>
      </form>
    </div>
  );
}
