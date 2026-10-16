"use client";
import { useEffect, useState } from "react";

type BirthdayKid = {
  name: string;
  center_name: string;
  class_name: string | null;
};

export default function BirthdayToast({ kids }: { kids: BirthdayKid[] }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (kids.length > 0) setVisible(true);
  }, [kids.length]);

  if (!visible || kids.length === 0) return null;

  return (
    <div
      role="status"
      className="fixed bottom-[5.5rem] right-4 z-50 w-[min(340px,calc(100vw-2rem))] rounded-[12px] border border-[#fde68a] bg-[#fffbeb] shadow-lg lg:bottom-4"
    >
      <div className="flex items-start gap-3 px-4 py-3">
        <span className="mt-0.5 text-[22px] leading-none select-none">🎂</span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-[#92400e]">
            {kids.length === 1
              ? "Birthday today!"
              : `${kids.length} birthdays today!`}
          </p>
          <ul className="mt-1 space-y-0.5">
            {kids.map((k, i) => (
              <li key={i} className="text-[12px] text-[#78350f] leading-snug">
                <span className="font-medium">{k.name}</span>
                <span className="text-[#a16207]">
                  {" · "}{k.center_name}
                  {k.class_name ? ` · ${k.class_name}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <button
          onClick={() => setVisible(false)}
          className="mt-0.5 flex-none rounded-md p-1 text-[#92400e] hover:bg-[#fde68a] transition-colors"
          aria-label="Dismiss"
        >
          <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </div>
    </div>
  );
}
