"use client";
import { useActionState } from "react";
import { saveStaff } from "../actions";
import { Card, Field } from "@/components/ui";
import { FormMessage, Submit } from "@/components/form";

export type Staff = {
  id: number; name: string; email: string; phone: string | null; role: string;
  center_id: number | null; designation: string | null; is_active: boolean;
};

export default function StaffForm({
  staff, centers, isAdmin, ownCenterId,
}: {
  staff?: Staff | null;
  centers: { id: number; code: string; name: string }[];
  isAdmin: boolean;
  ownCenterId: number | null;
}) {
  const [state, action] = useActionState(saveStaff, null);

  return (
    <Card>
      <h2 className="mb-4 text-[15px] font-semibold">{staff ? "Edit staff member" : "Add staff member"}</h2>
      <form action={action}>
        {staff && <input type="hidden" name="id" value={staff.id} />}
        <FormMessage state={state} />
        <Field label="Full name *"><input className="input" name="name" defaultValue={staff?.name ?? ""} required /></Field>
        <Field label="Email *" hint="This is their login id">
          <input className="input" type="email" name="email" defaultValue={staff?.email ?? ""} required />
        </Field>
        <Field label="Phone"><input className="input" name="phone" defaultValue={staff?.phone ?? ""} /></Field>

        {isAdmin ? (
          <>
            <Field label="Role *">
              <select className="select" name="role" defaultValue={staff?.role ?? "teacher"}>
                <option value="teacher">Teacher</option>
                <option value="center_manager">Centre manager</option>
                <option value="super_admin">Super admin</option>
              </select>
            </Field>
            <Field label="Centre" hint="Leave blank only for super admins">
              <select className="select" name="center_id" defaultValue={staff?.center_id ?? ""}>
                <option value="">No centre</option>
                {centers.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}
              </select>
            </Field>
          </>
        ) : (
          <>
            <input type="hidden" name="role" value="teacher" />
            <input type="hidden" name="center_id" value={ownCenterId ?? ""} />
            <p className="mb-4 rounded-[9px] bg-[var(--brand-soft)] px-3.5 py-2.5 text-[13px] text-[var(--brand)]">
              Teachers you add join your centre.
            </p>
          </>
        )}

        <Field label="Designation"><input className="input" name="designation" defaultValue={staff?.designation ?? ""} /></Field>
        <Field label={staff ? "New password" : "Initial password *"}
          hint={staff ? "Leave blank to keep the current password" : "At least 8 characters"}>
          <input className="input" type="password" name="password" autoComplete="new-password"
            required={!staff} minLength={8} />
        </Field>
        {staff && (
          <label className="mb-4 flex items-center gap-2.5">
            <input type="checkbox" name="is_active" className="h-4 w-4" defaultChecked={staff.is_active} />
            <span className="text-[13px]">Account is active</span>
          </label>
        )}
        <Submit>{staff ? "Save changes" : "Add staff member"}</Submit>
      </form>
    </Card>
  );
}
