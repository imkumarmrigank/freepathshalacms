"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { saveMenuAccess } from "./actions";
import { MENU, isGroup, type Node } from "@/components/Sidebar";
import { ROLE_LABEL, type Role } from "@/lib/roles";

type FlatItem = { key: string; label: string; group: string };

function flatItems(): FlatItem[] {
  const out: FlatItem[] = [];
  function walk(nodes: Node[], groupLabel: string) {
    for (const n of nodes) {
      if (isGroup(n)) {
        const childGroup = groupLabel ? `${groupLabel} › ${n.label}` : n.label;
        walk(n.children, childGroup);
      } else {
        out.push({ key: n.href, label: n.label, group: groupLabel || "Top level" });
      }
    }
  }
  walk(MENU, "");
  return out;
}

const ALL_ITEMS_MAP = Object.fromEntries(flatItems().map((i) => [i.key, i]));

const MANAGEABLE_ROLES: Role[] = [
  "admin", "mentor", "center_manager", "teacher", "backup_teacher",
  "auditor", "sports_teacher", "rider",
];

const init = { error: null as string | null, ok: false };

export default function MenuAccessEditor({
  selectedRole,
  roleHrefs,
  initialHiddenKeys,
}: {
  selectedRole: Role | null;
  roleHrefs: string[];
  initialHiddenKeys: string[];
}) {
  const router = useRouter();
  // hiddenKeys = items the role can access but are turned off
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(new Set(initialHiddenKeys));

  const [state, action, pending] = useActionState(
    async (_prev: typeof init, fd: FormData) => {
      const res = await saveMenuAccess(null, fd);
      if (res?.error) return { error: res.error, ok: false };
      return { error: null, ok: true };
    },
    init,
  );

  const toggle = (key: string) => {
    setHiddenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  // Build groups from only the hrefs this role can actually reach
  const items = roleHrefs.map((href) => ALL_ITEMS_MAP[href]).filter(Boolean);
  const groups = items.reduce<Record<string, FlatItem[]>>((acc, item) => {
    (acc[item.group] ??= []).push(item);
    return acc;
  }, {});

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

      {selectedRole && items.length > 0 && (
        <form action={action} className="space-y-4">
          <input type="hidden" name="role" value={selectedRole} />
          {/* Send every accessible key so the action knows the full set */}
          {roleHrefs.map((k) => (
            <input key={k} type="hidden" name="all_keys" value={k} />
          ))}
          {/* Visible (checked) keys */}
          {roleHrefs.filter((k) => !hiddenKeys.has(k)).map((k) => (
            <input key={k} type="hidden" name="visible_key" value={k} />
          ))}

          <div className="flex items-center gap-4 text-[13px]">
            <span className="text-[var(--muted)]">
              {roleHrefs.length - hiddenKeys.size} of {roleHrefs.length} items visible
            </span>
            <button type="button" className="underline text-[var(--muted)] hover:text-[var(--text)]"
              onClick={() => setHiddenKeys(new Set())}>
              Show all
            </button>
            <button type="button" className="underline text-[var(--muted)] hover:text-[var(--text)]"
              onClick={() => setHiddenKeys(new Set(roleHrefs))}>
              Hide all
            </button>
          </div>

          {Object.entries(groups).map(([group, grpItems]) => (
            <div key={group}>
              <div className="label-cap mb-2 text-[var(--muted)]">{group}</div>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {grpItems.map((item) => {
                  const visible = !hiddenKeys.has(item.key);
                  return (
                    <label key={item.key}
                      className={`flex cursor-pointer items-center gap-2 rounded-[8px] border px-3 py-2 text-[13px] transition-colors hover:bg-[#fafafd] ${
                        visible ? "border-[var(--border)]" : "border-[#ebebf5] bg-[#f8f8fc]"
                      }`}>
                      <input
                        type="checkbox"
                        checked={visible}
                        onChange={() => toggle(item.key)}
                        className="h-4 w-4 accent-[var(--brand)] flex-none"
                      />
                      <span className={visible ? "font-medium" : "text-[var(--faint)] line-through"}>
                        {item.label}
                      </span>
                      <span className="ml-auto text-[11px] text-[var(--faint)] font-mono truncate max-w-[120px]">
                        {item.key}
                      </span>
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
