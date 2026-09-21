"use client";
import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { finishVisit, startVisit } from "./visit-actions";
import { Alert, Card, Field } from "@/components/ui";
import { FormMessage } from "@/components/form";
import type { Visit } from "@/lib/sports";

type Coords = { lat: number; lng: number; acc: number };

const time = (v: string | null) =>
  v ? new Date(v).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }) : "—";

/** Reads the phone's position on demand; a refused attempt drops the reading. */
function useLocation(error: string | undefined) {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const last = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (error && error !== last.current) { last.current = error; setCoords(null); }
    if (!error) last.current = undefined;
  }, [error]);

  const locate = () => {
    if (!("geolocation" in navigator)) { setGeoError("This device cannot report its location."); return; }
    setLocating(true); setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setCoords({ lat: p.coords.latitude, lng: p.coords.longitude, acc: Math.round(p.coords.accuracy) });
        setLocating(false);
      },
      (e) => {
        setGeoError(e.code === e.PERMISSION_DENIED
          ? "Location permission is blocked. Enable it for this site and try again."
          : "Could not read your location. Move to an open area and retry.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  };
  return { coords, geoError, locating, locate };
}

function Hidden({ coords }: { coords: Coords | null }) {
  return (
    <>
      <input type="hidden" name="lat" value={coords?.lat ?? ""} />
      <input type="hidden" name="lng" value={coords?.lng ?? ""} />
      <input type="hidden" name="accuracy" value={coords?.acc ?? ""} />
    </>
  );
}

export default function VisitCard({
  centerId, centreName, hasCoords, open, today, sports, visitsToday,
}: {
  centerId: number; centreName: string; hasCoords: boolean;
  open: Visit | null; today: string; sports: string[]; visitsToday: Visit[];
}) {
  const [inState, inAction] = useActionState(startVisit, null);
  const [outState, outAction] = useActionState(finishVisit, null);
  const checkIn = useLocation(inState?.error);
  const checkOut = useLocation(outState?.error);

  const hereOpen = open && open.center_id === centerId;
  const elsewhere = open && open.center_id !== centerId;
  const stale = open && open.visit_date < today;

  return (
    <Card className="mb-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-[15px] font-semibold">Your visit to {centreName}</h2>
          <p className="text-[13px] text-[var(--muted)]">
            Check in when you arrive and submit a report before you leave — for every centre you go to.
          </p>
        </div>
        {visitsToday.length > 0 && (
          <div className="text-right text-[12px] text-[var(--muted)]">
            Today: {visitsToday.map((v) => v.center_code).join(" → ")}
          </div>
        )}
      </div>

      <div className="mt-3">
        <FormMessage state={inState} />
        <FormMessage state={outState} />
      </div>

      {/* somewhere else is still open: that one comes first */}
      {elsewhere && (
        <Alert kind="warn">
          You are still checked in at <strong>{open.center_name}</strong>
          {stale ? ` from ${open.visit_date}` : ` since ${time(open.check_in_at)}`}.{" "}
          <Link className="font-medium underline" href={`/sports?center=${open.center_id}`}>
            Submit that visit&rsquo;s report
          </Link>{" "}before checking in here.
        </Alert>
      )}

      {/* nothing open: arrive here */}
      {!open && (
        !hasCoords ? (
          <Alert kind="warn">
            {centreName} has no location pinned yet, so check-in is disabled. Ask the office to
            set the centre&rsquo;s coordinates.
          </Alert>
        ) : (
          <form action={inAction} className="flex flex-wrap items-center gap-3">
            <input type="hidden" name="center_id" value={centerId} />
            <Hidden coords={checkIn.coords} />
            {checkIn.coords ? (
              <button className="btn btn-primary" type="submit">Confirm check-in</button>
            ) : (
              <button className="btn btn-primary" type="button" disabled={checkIn.locating}
                onClick={checkIn.locate}>
                {checkIn.locating ? "Reading location…" : `Check in at ${centreName}`}
              </button>
            )}
            <span className="text-[13px] text-[var(--muted)]">
              {checkIn.coords ? `Location ready (±${checkIn.coords.acc} m).` : "You must be at the centre."}
            </span>
            {checkIn.geoError && <div className="w-full"><Alert kind="bad">{checkIn.geoError}</Alert></div>}
          </form>
        )
      )}

      {/* here and open: the report, and leaving */}
      {hereOpen && (
        <form action={outAction}>
          <input type="hidden" name="visit_id" value={open.id} />
          <Hidden coords={checkOut.coords} />
          <p className="mb-4 text-[13px]">
            {stale
              ? <>This visit from <strong>{open.visit_date}</strong> was never closed. Submit its report — no check-out time will be recorded.</>
              : <>Checked in at <strong>{time(open.check_in_at)}</strong>
                  {open.check_in_distance_m != null && `, ${open.check_in_distance_m} m from the centre`}.</>}
          </p>

          {sports.length > 0 && (
            <Field label="Sports played today">
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {sports.map((s) => (
                  <label key={s} className="flex items-center gap-2 text-[13px]">
                    <input type="checkbox" name="sports_covered" value={s} className="h-4 w-4" />
                    {s}
                  </label>
                ))}
              </div>
            </Field>
          )}
          <Field label="How many children took part?">
            <input className="input w-[140px]" type="number" name="children_count" min={0} max={1000} />
          </Field>
          <Field label="What did you do at the centre today? *">
            <textarea className="textarea" name="activities" rows={3} required minLength={10}
              placeholder="Warm-up and relay practice with Classes 3–5, then a kho-kho match." />
          </Field>
          <Field label="Highlights" hint="A child who stood out, a good result">
            <textarea className="textarea" name="highlights" rows={2} />
          </Field>
          <Field label="Problems" hint="Ground, equipment, time, attendance">
            <textarea className="textarea" name="issues" rows={2} />
          </Field>

          <div className="flex flex-wrap items-center gap-3">
            {stale || checkOut.coords ? (
              <button className="btn btn-primary" type="submit">
                {stale ? "Submit the report" : "Submit report and check out"}
              </button>
            ) : (
              <button className="btn btn-primary" type="button" disabled={checkOut.locating}
                onClick={checkOut.locate}>
                {checkOut.locating ? "Reading location…" : "Read location to check out"}
              </button>
            )}
            {!stale && (
              <span className="text-[13px] text-[var(--muted)]">
                {checkOut.coords ? `Location ready (±${checkOut.coords.acc} m).` : "Check out from the centre itself."}
              </span>
            )}
          </div>
          {checkOut.geoError && <div className="mt-3"><Alert kind="bad">{checkOut.geoError}</Alert></div>}
        </form>
      )}
    </Card>
  );
}
