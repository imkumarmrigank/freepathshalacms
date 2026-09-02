"use client";
import { useActionState, useState } from "react";
import { saveCenter } from "../actions";
import { Card, Field } from "@/components/ui";
import { FormMessage, Submit } from "@/components/form";
import type { Center } from "@/lib/queries";
import { GEOFENCE_DEFAULT_M, GEOFENCE_MAX_M, GEOFENCE_MIN_M } from "@/lib/geo";

export default function CenterForm({ center }: { center?: Center | null }) {
  const [state, action] = useActionState(saveCenter, null);
  const [coords, setCoords] = useState({
    lat: center?.latitude?.toString() ?? "",
    lng: center?.longitude?.toString() ?? "",
  });
  const [locating, setLocating] = useState(false);

  const useMyLocation = () => {
    if (!("geolocation" in navigator)) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setCoords({ lat: p.coords.latitude.toFixed(6), lng: p.coords.longitude.toFixed(6) });
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  };

  return (
    <Card>
      <h2 className="mb-4 text-[15px] font-semibold">{center ? "Edit centre" : "Add centre"}</h2>
      <form action={action}>
        {center && <input type="hidden" name="id" value={center.id} />}
        <FormMessage state={state} />
        <div className="grid gap-x-4 sm:grid-cols-2">
          <Field label="Centre code *" hint="Used in enrolment numbers, e.g. C04">
            <input className="input" name="code" defaultValue={center?.code ?? ""}
              required maxLength={10} style={{ textTransform: "uppercase" }} />
          </Field>
          <Field label="Centre name *">
            <input className="input" name="name" defaultValue={center?.name ?? ""} required />
          </Field>
          <Field label="Area / locality">
            <input className="input" name="area" defaultValue={center?.area ?? ""} />
          </Field>
          <Field label="Phone">
            <input className="input" name="phone" defaultValue={center?.phone ?? ""} />
          </Field>
          <Field label="Address" wide>
            <textarea className="textarea" name="address" rows={2} defaultValue={center?.address ?? ""} />
          </Field>
          <Field label="City">
            <input className="input" name="city" defaultValue={center?.city ?? ""} />
          </Field>
          <Field label="Pincode">
            <input className="input" name="pincode" defaultValue={(center as { pincode?: string })?.pincode ?? ""} />
          </Field>
        </div>

        <h3 className="mb-1 mt-4 text-[14px] font-semibold">Attendance geofence</h3>
        <p className="mb-3 text-[13px] text-[var(--muted)]">
          Staff can only check in from inside this circle. Stand at the centre and tap
          “Use my current location” for the most accurate pin — the pin matters more than
          the radius, because the circle is only {GEOFENCE_MAX_M} m wide.
        </p>
        <div className="grid gap-x-4 sm:grid-cols-3">
          <Field label="Latitude">
            <input className="input" name="latitude" value={coords.lat} inputMode="decimal"
              onChange={(e) => setCoords((c) => ({ ...c, lat: e.target.value }))} placeholder="19.119700" />
          </Field>
          <Field label="Longitude">
            <input className="input" name="longitude" value={coords.lng} inputMode="decimal"
              onChange={(e) => setCoords((c) => ({ ...c, lng: e.target.value }))} placeholder="72.846400" />
          </Field>
          <Field label="Radius (metres)" hint={`${GEOFENCE_MIN_M}–${GEOFENCE_MAX_M} m`}>
            <input className="input" type="number" name="geofence_radius_m"
              min={GEOFENCE_MIN_M} max={GEOFENCE_MAX_M} step={5}
              defaultValue={center?.geofence_radius_m ?? GEOFENCE_DEFAULT_M} />
          </Field>
        </div>
        <button type="button" className="btn btn-ghost btn-sm mb-4" onClick={useMyLocation} disabled={locating}>
          {locating ? "Reading location…" : "Use my current location"}
        </button>

        {center && (
          <label className="mb-4 flex items-center gap-2.5">
            <input type="checkbox" name="is_active" className="h-4 w-4" defaultChecked={center.is_active} />
            <span className="text-[13px]">Centre is active</span>
          </label>
        )}
        <Submit>{center ? "Save centre" : "Create centre"}</Submit>
      </form>
    </Card>
  );
}
