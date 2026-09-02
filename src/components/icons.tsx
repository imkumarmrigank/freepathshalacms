type P = { className?: string };
const base = "h-[18px] w-[18px]";
const s = (d: string) => (p: P) => (
  <svg className={p.className ?? base} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

export const IconGrid = s("M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z");
export const IconUsers = s("M16 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M21 20v-1a4 4 0 0 0-3-3.87M16.5 4.13a4 4 0 0 1 0 7.75");
export const IconChat = s("M21 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2z");
export const IconCal = s("M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z");
export const IconChart = s("M4 20V10M10 20V4M16 20v-7M22 20H2");
export const IconPin = s("M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1 1 16 0M12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5");
export const IconCheck = s("M20 6 9 17l-5-5");
export const IconBuilding = s("M3 21h18M5 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M15 9h2a2 2 0 0 1 2 2v10M9 7h2M9 11h2M9 15h2");
export const IconLayers = s("m12 2 9 5-9 5-9-5zM3 12l9 5 9-5M3 17l9 5 9-5");
export const IconArrowUp = s("M12 19V5M5 12l7-7 7 7");
export const IconClock = s("M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20M12 6v6l4 2");
/** The design draws the plus a little heavier than the nav icons. */
export const IconPlus = (p: P) => (
  <svg className={p.className ?? base} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
);
export const IconSearch = s("M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16M21 21l-4.35-4.35");
export const IconLogout = s("M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9");
export const IconBack = s("M19 12H5M12 19l-7-7 7-7");
export const IconDownload = s("M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3");
export const IconBook = s("M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2");
export const IconBox = s("M21 8v8a2 2 0 0 1-1 1.73l-7 4a2 2 0 0 1-2 0l-7-4A2 2 0 0 1 3 16V8a2 2 0 0 1 1-1.73l7-4a2 2 0 0 1 2 0l7 4A2 2 0 0 1 21 8M3.3 7 12 12l8.7-5M12 22V12");
export const IconAward = s("M12 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12M8.2 13.9 7 22l5-3 5 3-1.2-8.1");
