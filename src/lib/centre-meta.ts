/** Shared by the form, the list and anything else that shows a centre's kind. */

export const CENTRE_TYPES = [
  { value: "park",   label: "Open in a park",
    hint: "Runs outdoors. Stops for rain; no building to pin a check-in to." },
  { value: "school", label: "Inside a school",
    hint: "Uses a school's rooms after the school's own timings have finished." },
] as const;

export type CentreType = (typeof CENTRE_TYPES)[number]["value"];

export const CENTRE_TYPE_LABEL: Record<string, string> =
  Object.fromEntries(CENTRE_TYPES.map((t) => [t.value, t.label]));

export function isCentreType(v: string | null | undefined): v is CentreType {
  return CENTRE_TYPES.some((t) => t.value === v);
}
