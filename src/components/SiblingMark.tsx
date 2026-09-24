import { IconUsers } from "./icons";

/**
 * A small mark after a child's name: this one has a brother or sister on the
 * roll.
 *
 * Families here are followed as families — a message home, a fee decision or a
 * home visit touches all of them — so the connection belongs next to the name
 * rather than three clicks away on the profile.
 */
export default function SiblingMark({ count, names }:
  { count?: number | null; names?: string | null }) {
  if (!count) return null;
  // the names carry their class, so hovering answers "who, and where are they?"
  const who = names ? `: ${names}` : "";
  return (
    <span
      title={`${count === 1 ? "Brother or sister on the roll" : `${count} brothers and sisters on the roll`}${who}`}
      aria-label={`${count} sibling${count === 1 ? "" : "s"} on the roll`}
      className="ml-1.5 inline-flex h-[20px] items-center gap-0.5 rounded-[6px]
        bg-[var(--brand-soft)] px-1.5 align-middle text-[var(--brand)]">
      <IconUsers className="h-[13px] w-[13px]" />
      {count > 1 && <span className="text-[10px] font-semibold leading-none">{count}</span>}
    </span>
  );
}
