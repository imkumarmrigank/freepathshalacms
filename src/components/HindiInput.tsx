"use client";
import { useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { candidates, toDevanagari, PALETTE } from "@/lib/hindi";

/**
 * A text field a teacher can type Hindi into without a Hindi keyboard.
 *
 * Typing is phonetic — "swar aur vyanjan" becomes स्वर और व्यंजन as the space
 * bar is pressed. Roman Hindi cannot say whether "matra" is मात्रा or मत्रा, so
 * the readings are offered and the teacher picks; 1–6 or a click takes one.
 * The character palette handles whatever is left.
 *
 * The field posts its Devanagari through a hidden input under the real `name`,
 * so server actions read it exactly as they read any other field.
 */
export default function HindiInput({
  name, defaultValue = "", rows, placeholder, required, className = "input", startInHindi = false,
}: {
  name: string;
  defaultValue?: string;
  /** given, renders a textarea instead of a single line */
  rows?: number;
  placeholder?: string;
  required?: boolean;
  className?: string;
  startInHindi?: boolean;
}) {
  const [hindi, setHindi] = useState(startInHindi);
  const [value, setValue] = useState(defaultValue);
  const [buf, setBuf] = useState("");          // the Latin word being typed
  const [picks, setPicks] = useState<string[]>([]);
  const [showPalette, setShowPalette] = useState(false);
  const ref = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  const commit = (word: string) => {
    setValue((v) => v + word);
    setBuf("");
    setPicks([]);
  };

  const onChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const next = e.target.value;
    if (!hindi) { setValue(next); return; }

    // The field shows `value` (already Devanagari) followed by `buf` (the Latin
    // word still being typed), so whatever sits past `value` is the whole of
    // the word in progress — not just the keystroke that arrived.
    if (!next.startsWith(value)) {
      // a backspace reached into text that was already converted
      setValue(next);
      setBuf("");
      setPicks([]);
      return;
    }

    const tail = next.slice(value.length);
    if (/[^A-Za-z]/.test(tail)) {
      // a space or a mark closed the word — convert the lot and keep going
      setValue(value + toDevanagari(tail));
      setBuf("");
      setPicks([]);
      return;
    }

    setBuf(tail);
    setPicks(tail ? candidates(tail) : []);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (!hindi || picks.length === 0) return;
    if (e.key >= "1" && e.key <= String(Math.min(9, picks.length)) && e.altKey) {
      e.preventDefault();
      commit(picks[Number(e.key) - 1]);
    }
    if (e.key === "Escape") { e.preventDefault(); commit(buf); }
  };

  const insert = (ch: string) => {
    setValue((v) => v + buf + ch);
    setBuf("");
    setPicks([]);
    ref.current?.focus();
  };

  const shown = value + (hindi ? buf : "");
  const Tag = rows ? "textarea" : "input";

  return (
    <div>
      <input type="hidden" name={name} value={value + (buf ? toDevanagari(buf) : "")} />
      <div className="relative">
        <Tag
          ref={ref as never}
          className={`${className} ${hindi ? "pr-[4.5rem]" : "pr-[3.25rem]"}`}
          rows={rows}
          value={shown}
          placeholder={placeholder}
          required={required}
          onChange={onChange}
          onKeyDown={onKeyDown}
          lang={hindi ? "hi" : "en"}
        />
        <div className="absolute right-1.5 top-1.5 flex gap-1">
          {hindi && (
            <button type="button" title="Devanagari characters"
              className="hindi-chip" onClick={() => setShowPalette((s) => !s)}>
              ⌨
            </button>
          )}
          <button type="button" onClick={() => { setHindi((h) => !h); setBuf(""); setPicks([]); }}
            title={hindi ? "Switch to English" : "हिंदी में लिखें"}
            className={`hindi-chip ${hindi ? "hindi-chip-on" : ""}`}>
            {hindi ? "अ" : "A"}
          </button>
        </div>
      </div>

      {hindi && buf && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] uppercase tracking-[0.06em] text-[var(--faint)]">
            {buf}
          </span>
          {picks.map((p, i) => (
            <button key={p} type="button" onClick={() => commit(p)}
              className={`hindi-pick ${i === 0 ? "hindi-pick-on" : ""}`}>
              {p}<span className="ml-1 text-[10px] opacity-60">{i + 1}</span>
            </button>
          ))}
          <span className="text-[11px] text-[var(--faint)]">space to accept · alt+number to pick</span>
        </div>
      )}

      {hindi && showPalette && (
        <div className="mt-2 rounded-[9px] border border-[var(--border)] bg-white p-2.5">
          {PALETTE.map((g) => (
            <div key={g.label} className="mb-2 last:mb-0">
              <div className="mb-1 text-[11px] uppercase tracking-[0.06em] text-[var(--faint)]">
                {g.label}
              </div>
              <div className="flex flex-wrap gap-1">
                {g.chars.map((c) => (
                  <button key={c} type="button" className="hindi-key" onClick={() => insert(c)}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
