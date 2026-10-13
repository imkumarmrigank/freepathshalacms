import { IconRickshaw, IconCycle, IconWalk } from "./icons";
import type { TransportMode } from "@/lib/admission-meta";

const META: Record<TransportMode, { Icon: (p: { className?: string }) => React.ReactElement; label: string; color: string }> = {
  rickshaw: { Icon: IconRickshaw, label: "By Rickshaw", color: "bg-amber-100 text-amber-700" },
  cycle:    { Icon: IconCycle,    label: "By Cycle",    color: "bg-green-100 text-green-700" },
  walk:     { Icon: IconWalk,     label: "By Walk",     color: "bg-sky-100 text-sky-700" },
};

export default function TransportMark({ mode }: { mode: string | null | undefined }) {
  if (!mode) return null;
  const m = META[mode as TransportMode];
  if (!m) return null;
  return (
    <span
      title={m.label}
      aria-label={m.label}
      className={`ml-1.5 inline-flex h-[20px] items-center rounded-[6px] px-1.5 align-middle ${m.color}`}>
      <m.Icon className="h-[13px] w-[13px]" />
    </span>
  );
}
