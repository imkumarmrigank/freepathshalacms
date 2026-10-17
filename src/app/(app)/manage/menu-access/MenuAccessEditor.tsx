"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { saveMenuAccess } from "./actions";
import { flatMenuItems } from "@/lib/menu-tree";
import { ROLE_LABEL, type Role } from "@/lib/roles";

type FlatItem = { href: string; label: string; group: string };

const ALL_ITEMS: FlatItem[] = flatMenuItems();

const MANAGEABLE_ROLES: Role[] = [
  "admin", "mentor", "center_manager", "teacher", "backup_teacher",
  "auditor", "sports_teacher", "rider",
];

const init = { error: null as string | null, ok: false };

export default function MenuAccessEditor({
  selectedRole,
  defaultHrefs,   // hrefs the role can reach via its normal gates
  hiddenKeys,     // overrides: hide items the role normally has
  grantedKeys,    // overrides: grant items the role normally lacks
}: {
  selectedRole: Role | null;
  defaultHrefs: string[];
  hiddenKeys: string[];
  grantedKeys: string[];
}) {
  const router = useRouter();

  const defaultSet = new Set(defaultHrefs);
  const initialChecked = new Set([
    ...defaultHrefs.filter((k) => !hiddenKeys.includes(k)),
    ...grantedKeys,
  ]);

  const [checkedKeys, setCheckedKeys] = useState<Set<string>>(initialChecked);

  const [state, action, pending] = useActionState(
    async (_prev: typeof init, fd: FormData) => {
      const res = await saveMenuAccess(null, fd);
      if (res?.error) return { error: res.error, ok: false };
      return { error: null, ok: true };
    },
    init,
  );

  const toggle = (key: string) => {
    setCheckedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const groups = ALL_ITEMS.reduce<Record<string, FlatItem[]>>((acc, item) => {
    (acc[item.group] ??= []).push(item);
    return acc;
  }, {});

  const allHrefs = ALL_ITEMS.map((i) => i.href);
  const checkedCount = checkedKeys.size;

  return (
    <div className="space-y-6">
      {/* Role selector */}
      <div>
        <label className="label-cap mb-2 block">Select role</label>
        <div className="flex flex-wrap gap-2">
          {MANAGEABLE_ROLES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => router.push(`/manage/menu-access?role=${r}`)}
              className={`rounded-[8px] border px-3 py-1.5 text-[13px] transition-colors ${
                selectedRole === r
                  ? "border-[var(--brand)] bg-[var(--brand)] text-white"
                  : "border-[var(--border)] hover:bg-[#fafafd]"
              }`}
            >
              {ROLE_LABEL[r]}
            </button>
          ))}
        </div>
      </div>

      {selectedRole && (
        <form action={action} className="space-y-4">
          <input type="hidden" name="role" value={selectedRole} />
          {/* Send every key so action knows the full set */}
          {allHrefs.map((k) => (
            <input key={`all-${k}`} type="hidden" name="all_keys" value={k} />
          ))}
          {/* Send which keys the role has by default (so action can diff) */}
          {defaultHrefs.map((k) => (
            <input key={`def-${k}`} type="hidden" name="default_key" value={k} />
          ))}
          {/* Send which keys are currently checked */}
          {[...checkedKeys].map((k) => (
            <input key={`chk-${k}`} type="hidden" name="checked_key" value={k} />
          ))}

          <div className="flex flex-wrap items-center gap-4 text-[13px]">
            <span className="text-[var(--muted)]">
              <strong>{checkedCount}</strong> of {allHrefs.length} items visible for {ROLE_LABEL[selectedRole]}
            </span>
            <button type="button" className="underline text-[var(--muted)] hover:text-[var(--text)]"
              onClick={() => setCheckedKeys(new Set(allHrefs))}>
              Check all
            </button>
            <button type="button" className="underline text-[var(--muted)] hover:text-[var(--text)]"
              onClick={() => setCheckedKeys(new Set())}>
              Uncheck all
            </button>
            <button type="button" className="underline text-[var(--muted)] hover:text-[var(--text)]"
              onClick={() => setCheckedKeys(new Set(defaultHrefs))}>
              Reset to defaults
            </button>
          </div>

          <div className="flex gap-4 text-[12px]">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-[var(--ok)]" />
              Default access
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-[var(--brand)]" />
              Extra access granted
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#e5e5f0]" />
              Not in role (uncheck = hidden, check = granted)
            </span>
          </div>

          {Object.entries(groups).map(([group, items]) => (
            <div key={group}>
              <div className="label-cap mb-2 text-[var(--muted)]">{group}</div>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {items.map((item) => {
                  const isDefault = defaultSet.has(item.href);
                  const isChecked = checkedKeys.has(item.href);
                  const isGranted = !isDefault && isChecked;
                  const isHidden = isDefault && !isChecked;

                  let borderColor = "border-[var(--border)]";
                  let bg = "";
                  if (isGranted) { borderColor = "border-[var(--brand)]"; bg = "bg-[#f0f4ff]"; }
                  else if (isHidden) { borderColor = "border-[#ebebf5]"; bg = "bg-[#f8f8fc]"; }
                  else if (!isDefault) { borderColor = "border-[#ebebf5]"; bg = "bg-[#fafafa]"; }

                  return (
                    <label key={item.href}
                      className={`flex cursor-pointer items-center gap-2 rounded-[8px] border px-3 py-2 text-[13px] transition-colors hover:bg-[#f5f5fb] ${borderColor} ${bg}`}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggle(item.href)}
                        className="h-4 w-4 flex-none accent-[var(--brand)]"
                      />
                      <span className={isHidden ? "text-[var(--faint)] line-through" : isGranted ? "font-medium text-[var(--brand)]" : ""}>
                        {item.label}
                      </span>
                      {!isDefault && (
                        <span className="ml-auto text-[10px] text-[var(--faint)] font-medium">
                          {isGranted ? "GRANTED" : "NOT IN ROLE"}
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="flex items-center gap-3 pt-2 border-t border-[var(--border)]">
            <button type="submit" disabled={pending} className="btn btn-primary">
              {pending ? "Saving…" : `Save for ${ROLE_LABEL[selectedRole]}`}
            </button>
            {state.ok && <span className="text-[13px] text-[var(--ok)]">Saved.</span>}
            {state.error && <span className="text-[13px] text-[var(--bad)]">{state.error}</span>}
          </div>
        </form>
      )}
    </div>
  );
}
