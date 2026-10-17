"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { saveMenuAccess } from "./actions";
import { MENU, isGroup, type Node } from "@/components/Sidebar";
import { type Role } from "@/lib/roles";

type FlatItem = { key: string; label: string; group: string };

/** Flatten the menu tree into (key=href, label, group) for a given role. */
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

const ALL_ITEMS = flatItems();

type User = { id: number; name: string; role: Role; center_name: string | null };

const init = { error: null as string | null, ok: false };

export default function MenuAccessEditor({
  users,
  initialUserId,
  initialHiddenKeys,
}: {
  users: User[];
  initialUserId: number | null;
  initialHiddenKeys: string[];
}) {
  const router = useRouter();
  const [selectedId] = useState<number | null>(initialUserId);
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(new Set(initialHiddenKeys));

  const [state, action, pending] = useActionState(
    async (_prev: typeof init, fd: FormData) => {
      const res = await saveMenuAccess(null, fd);
      if (res?.error) return { error: res.error, ok: false };
      return { error: null, ok: true };
    },
    init,
  );

  // Group items by their group label
  const groups = ALL_ITEMS.reduce<Record<string, FlatItem[]>>((acc, item) => {
    (acc[item.group] ??= []).push(item);
    return acc;
  }, {});

  const toggle = (key: string) => {
    setHiddenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const allKeys = ALL_ITEMS.map((i) => i.key);

  return (
    <div className="space-y-6">
      {/* User selector */}
      <div>
        <label className="label-cap mb-1 block">Select user</label>
        <select
          className="rounded-[9px] border border-[var(--border)] px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-[var(--brand)] w-full max-w-sm"
          value={selectedId ?? ""}
          onChange={(e) => {
            const uid = Number(e.target.value) || null;
            router.push(uid ? `/manage/menu-access?user=${uid}` : "/manage/menu-access");
          }}
        >
          <option value="">— choose a user —</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name} · {u.role.replace(/_/g, " ")}
              {u.center_name ? ` · ${u.center_name}` : ""}
            </option>
          ))}
        </select>
      </div>

      {selectedId && (
        <form action={action} className="space-y-4">
          <input type="hidden" name="user_id" value={selectedId} />
          {allKeys.map((k) => (
            <input key={k} type="hidden" name="all_keys" value={k} />
          ))}
          {/* Visible keys are sent as checkboxes */}
          {allKeys.filter((k) => !hiddenKeys.has(k)).map((k) => (
            <input key={k} type="hidden" name="visible_key" value={k} />
          ))}

          <div className="flex items-center gap-3 text-[13px] text-[var(--muted)]">
            <button type="button" className="underline hover:text-[var(--text)]"
              onClick={() => setHiddenKeys(new Set())}>
              Show all
            </button>
            <button type="button" className="underline hover:text-[var(--text)]"
              onClick={() => setHiddenKeys(new Set(allKeys))}>
              Hide all
            </button>
          </div>

          {Object.entries(groups).map(([group, items]) => (
            <div key={group}>
              <div className="label-cap mb-2 text-[var(--muted)]">{group}</div>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {items.map((item) => {
                  const visible = !hiddenKeys.has(item.key);
                  return (
                    <label key={item.key}
                      className="flex cursor-pointer items-center gap-2 rounded-[8px] border border-[var(--border)] px-3 py-2 text-[13px] hover:bg-[#fafafd]">
                      <input
                        type="checkbox"
                        checked={visible}
                        onChange={() => toggle(item.key)}
                        className="h-4 w-4 accent-[var(--brand)]"
                      />
                      <span className={visible ? "" : "text-[var(--faint)] line-through"}>
                        {item.label}
                      </span>
                      <span className="ml-auto text-[11px] text-[var(--faint)] font-mono">
                        {item.key}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="flex items-center gap-3 pt-2">
            <button type="submit" disabled={pending}
              className="btn btn-primary">
              {pending ? "Saving…" : "Save access settings"}
            </button>
            {state.ok && <span className="text-[13px] text-[var(--ok)]">Saved.</span>}
            {state.error && <span className="text-[13px] text-[var(--bad)]">{state.error}</span>}
          </div>
        </form>
      )}
    </div>
  );
}
