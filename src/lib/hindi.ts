/**
 * Hinglish → Devanagari, the way teachers actually type.
 *
 * Not a scholarly scheme. ITRANS and Harvard-Kyoto want "kavitaa" and "svara";
 * a teacher types "kavita" and "swar" and expects कविता and स्वर. So the rules
 * here follow ordinary Roman-Hindi spelling:
 *
 *   · a consonant carries its inherent अ, so "kamal" → कमल
 *   · a vowel after it becomes a मात्रा, so "ki" → कि
 *   · a consonant straight after another takes a हलन्त, so "namaste" → नमस्ते
 *   · a trailing "a" is the long आ people mean by it, so "kavita" → कविता
 *
 * Nothing is guessed silently: the field shows the Devanagari as it is typed,
 * and the character palette is there for whatever the rules get wrong.
 *
 * Shared by server and client — nothing server-only in here.
 */

import { WORDS } from "./hindi-words";

/** Independent vowels, used at the start of a syllable. */
const VOWELS: Record<string, string> = {
  a: "अ", aa: "आ", A: "आ", i: "इ", ii: "ई", ee: "ई", I: "ई",
  u: "उ", uu: "ऊ", oo: "ऊ", U: "ऊ",
  Ri: "ऋ", e: "ए", ai: "ऐ", o: "ओ", au: "औ", ou: "औ",
};

/** The same vowels as मात्रा, hung off the preceding consonant. */
const MATRA: Record<string, string> = {
  a: "", aa: "ा", A: "ा", i: "ि", ii: "ी", ee: "ी", I: "ी",
  u: "ु", uu: "ू", oo: "ू", U: "ू",
  Ri: "ृ", e: "े", ai: "ै", o: "ो", au: "ौ", ou: "ौ",
};

const CONSONANTS: Record<string, string> = {
  // aspirated pairs first — longest match wins, so "kh" never reads as "k"+"h"
  kh: "ख", gh: "घ", ch: "च", chh: "छ", jh: "झ", Th: "ठ", Dh: "ढ",
  th: "थ", dh: "ध", ph: "फ", bh: "भ", sh: "श", Sh: "ष", ss: "ष",
  gy: "ज्ञ", tr: "त्र", ksh: "क्ष", shr: "श्र",
  k: "क", q: "क़", g: "ग", G: "ग़", ng: "ङ",
  c: "च", j: "ज", z: "ज़", J: "ज़", ny: "ञ",
  T: "ट", D: "ड", N: "ण", R: "ड़", Rh: "ढ़",
  t: "त", d: "द", n: "न",
  p: "प", f: "फ़", b: "ब", m: "म",
  y: "य", r: "र", l: "ल", L: "ळ", v: "व", w: "व",
  s: "स", h: "ह",
};

/** Stops that pull a preceding "n" into an anusvara. */
const STOPS = new Set(["k", "kh", "g", "gh", "ch", "chh", "j", "jh",
  "T", "Th", "D", "Dh", "t", "th", "d", "dh", "s", "sh", "Sh", "gy", "ksh"]);
/** Labials that do the same for a preceding "m". */
const LABIALS = new Set(["p", "ph", "f", "b", "bh"]);

const HALANT = "्";
const ANUSVARA = "ं";   // ं
const CHANDRA = "ँ";    // ँ
const VISARGA = "ः";    // ः
/** Longest keys first, so "chh" is tried before "ch" before "c". */
const CONSONANT_KEYS = Object.keys(CONSONANTS).sort((a, b) => b.length - a.length);
const VOWEL_KEYS = Object.keys(VOWELS).sort((a, b) => b.length - a.length);

const isLatinLetter = (c: string) => /[A-Za-z]/.test(c);

function matchAt(word: string, i: number, keys: string[]) {
  for (const k of keys) {
    if (word.startsWith(k, i)) return k;
  }
  return null;
}

/**
 * One whitespace-free run of Latin letters. Anything that is not a letter is
 * passed through by the caller, so punctuation and digits survive untouched.
 */
function word(w: string): string {
  let out = "";
  let i = 0;
  let lastWasConsonant = false;

  while (i < w.length) {
    const rest = w.length - i;

    // ---------------------------------------------------- nasals and visarga
    // A nasal before a stop of its own class is the dot, not a letter of its
    // own: "hindi" → हिंदी, "sambandh" → संबंध. Before anything else it stays a
    // full letter, which is why "hamne" is हमने and not हंने.
    if ((w[i] === "n" || w[i] === "m" || w[i] === "M") && !lastWasConsonant && out !== "") {
      const after = matchAt(w, i + 1, CONSONANT_KEYS);
      const takesDot = after !== null && (
        w[i] === "m" || w[i] === "M"
          ? LABIALS.has(after)          // म before प, ब, भ …
          : STOPS.has(after));          // न before क, ग, ज, द …
      if (takesDot) {
        out += w[i] === "M" ? CHANDRA : ANUSVARA;
        i += 1;
        continue;
      }
    }
    if (w[i] === "H" && out !== "") { out += VISARGA; i += 1; continue; }

    // ------------------------------------------------------------ consonants
    const c = matchAt(w, i, CONSONANT_KEYS);
    if (c) {
      out += CONSONANTS[c];
      i += c.length;

      // a vowel right after becomes a मात्रा
      const v = matchAt(w, i, VOWEL_KEYS);
      if (v) {
        // trailing vowels: the "a" of kavita is आ, the "i" of kahani is ई
        const trailing = i + v.length === w.length;
        if (trailing && v === "a") out += MATRA.aa;
        else if (trailing && v === "i") out += MATRA.ii;
        else out += MATRA[v];
        i += v.length;
        lastWasConsonant = false;
        continue;
      }

      // another consonant follows, so this one is half
      if (i < w.length && matchAt(w, i, CONSONANT_KEYS)) {
        out += HALANT;
        lastWasConsonant = true;
        continue;
      }

      // nothing follows: the inherent अ stands, which is what Hindi writes
      lastWasConsonant = false;
      continue;
    }

    // --------------------------------------------------------------- vowels
    const v = matchAt(w, i, VOWEL_KEYS);
    if (v) {
      out += VOWELS[v];
      i += v.length;
      lastWasConsonant = false;
      continue;
    }

    // anything unmapped goes through as it is
    out += w[i];
    i += 1;
    lastWasConsonant = false;
    void rest;
  }

  return out;
}

/**
 * Transliterate a whole string. Latin runs are converted; spaces, punctuation
 * and anything already in Devanagari are left exactly as they are.
 */
export function toDevanagari(text: string): string {
  let out = "";
  let buf = "";
  const flush = () => {
    if (!buf) return;
    out += WORDS[buf.toLowerCase()] ?? word(buf);
    buf = "";
  };

  for (const ch of text) {
    if (isLatinLetter(ch)) buf += ch;
    else {
      flush();
      out += ch;   // digits, dates and punctuation are left as typed
    }
  }
  flush();
  return out;
}

/**
 * The spellings a Latin word could reasonably stand for.
 *
 * Roman Hindi does not write vowel length or retroflexion, so "matra" is मात्रा
 * as easily as मत्रा. Rather than pick one and be wrong half the time, offer
 * the handful of readings and let the teacher take the one they meant. The
 * dictionary answer, where there is one, always leads.
 */
export function candidates(latin: string, limit = 6): string[] {
  const key = latin.toLowerCase();
  const out: string[] = [];
  const add = (s: string) => {
    if (s && !out.includes(s)) out.push(s);
  };

  if (WORDS[key]) add(WORDS[key]);
  add(word(latin));

  // each switch flips one thing Roman Hindi leaves unsaid
  const swaps: [RegExp, string][] = [
    [/a(?=[a-z])/, "aa"],        // the long आ inside a word: matra → मात्रा
    [/th/, "Th"],                // पाठ rather than पाथ
    [/sh/, "Sh"],                // विशेषण rather than विशेशन
    [/n(?![aeiou])/, "N"],       // वर्णमाला rather than वर्नमाला
    [/d(?=[^aeiouh])/, "D"],
    [/t(?=[^aeiouhr])/, "T"],
  ];
  for (const [re, to] of swaps) {
    if (re.test(latin)) add(word(latin.replace(re, to)));
    if (out.length >= limit) break;
  }

  // and the trailing आ that "kavita" might or might not mean
  const plain = word(latin);
  if (plain.endsWith("ा")) add(plain.slice(0, -1));
  else add(plain + "ा");

  return out.slice(0, limit);
}

/** The palette: what a teacher reaches for when the rules get a word wrong. */
export const PALETTE: { label: string; chars: string[] }[] = [
  { label: "स्वर", chars: ["अ", "आ", "इ", "ई", "उ", "ऊ", "ऋ", "ए", "ऐ", "ओ", "औ", "अं", "अः"] },
  { label: "मात्रा", chars: ["ा", "ि", "ी", "ु", "ू", "ृ", "े", "ै", "ो", "ौ", "ं", "ँ", "ः", "्"] },
  { label: "व्यंजन", chars: [
    "क", "ख", "ग", "घ", "ङ", "च", "छ", "ज", "झ", "ञ",
    "ट", "ठ", "ड", "ढ", "ण", "त", "थ", "द", "ध", "न",
    "प", "फ", "ब", "भ", "म", "य", "र", "ल", "व",
    "श", "ष", "स", "ह", "क्ष", "त्र", "ज्ञ", "ड़", "ढ़", "़"] },
  { label: "अंक", chars: ["०", "१", "२", "३", "४", "५", "६", "७", "८", "९", "।"] },
];
