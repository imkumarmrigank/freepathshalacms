"use client";
import { useActionState } from "react";
import { setTransportMode } from "../actions";
import { TRANSPORT_MODES } from "@/lib/admission-meta";
import TransportMark from "@/components/TransportMark";
import { FormMessage } from "@/components/form";
import { useFormStatus } from "react-dom";

function SaveBtn() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary btn-sm" disabled={pending}>
      {pending ? "Saving…" : "Save"}
    </button>
  );
}

export default function TransportCard({
  studentId, mode, readOnly,
}: {
  studentId: number;
  mode: string | null | undefined;
  readOnly: boolean;
}) {
  const [state, action] = useActionState(setTransportMode, null);

  return (
    <div className="rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-4">
      <h2 className="mb-3 text-[14px] font-semibold">Mode of Transportation</h2>

      {readOnly ? (
        <div className="flex items-center gap-2 text-[13px]">
          {mode
            ? <>
                <TransportMark mode={mode} />
                <span className="text-[var(--muted)]">
                  {TRANSPORT_MODES.find((t) => t.value === mode)?.label ?? mode}
                </span>
              </>
            : <span className="text-[var(--faint)]">Not recorded</span>}
        </div>
      ) : (
        <form action={action}>
          <FormMessage state={state} />
          <input type="hidden" name="id" value={studentId} />
          <div className="flex items-center gap-2">
            <select className="select flex-1 text-[13px]" name="transport_mode"
              defaultValue={mode ?? ""} key={state?.ok}>
              <option value="">Not recorded</option>
              {TRANSPORT_MODES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <SaveBtn />
          </div>
        </form>
      )}
    </div>
  );
}
