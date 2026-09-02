/**
 * Chart colours, validated with the data-viz palette validator
 * (light surface #ffffff, categorical, adjacent pairs):
 *   lightness band PASS · chroma floor PASS
 *   CVD separation PASS  worst adjacent ΔE 9.1
 *   normal-vision   PASS  worst adjacent ΔE 22.9
 *   contrast WARN → relief shipped as visible value labels + a table view
 * Do not re-pick these by eye; re-run the validator if they change.
 */

/** Categorical slots, assigned in fixed order and never cycled. */
export const SERIES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4"] as const;

/** One hue, light → dark, for magnitude. */
export const SEQ_BLUE = "#2a78d6";

/**
 * Attendance is a state, not an identity, so it wears the reserved status
 * palette. Every segment is labelled — status colour never carries meaning alone.
 */
export const ATTENDANCE_COLORS: Record<string, string> = {
  present: "#0ca30c",   // good
  late: "#fab219",      // warning
  half_day: "#ec835a",  // serious
  leave: "#8b8b9e",     // neutral — an approved absence is not a failure state
  absent: "#d03b3b",    // critical
};

export const INK = {
  primary: "#16162a",
  secondary: "#6b6b85",
  muted: "#9a9ab0",
  grid: "#ececf3",
  axis: "#d7d7e3",
};
