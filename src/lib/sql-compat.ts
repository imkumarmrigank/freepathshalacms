/**
 * Turns the PostgreSQL-flavoured SQL this app is written in into MariaDB SQL.
 *
 * The app's ~200 query sites are written against PostgreSQL. Rather than rewrite and
 * re-test every one by hand, db.ts runs each statement through this translator once
 * (results are cached by statement text). It covers the PostgreSQL features the code
 * really uses — see the numbered passes below. Anything it cannot express is a
 * deliberate omission: write that query in portable SQL instead.
 *
 * Self-contained on purpose (no imports) so scripts can load it directly.
 */

/* ------------------------------------------------------------------ tokenizer */

type Tok = { t: "ws" | "cmt" | "str" | "qid" | "num" | "word" | "param" | "op" | "p"; s: string; n?: number };

const OPS = ["::", "<>", "<=", ">=", "!=", "||", "->>", "->", "<=>"];

function tokenize(sql: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  const n = sql.length;
  while (i < n) {
    const c = sql[i];
    if (/\s/.test(c)) {
      let j = i + 1;
      while (j < n && /\s/.test(sql[j])) j++;
      out.push({ t: "ws", s: sql.slice(i, j) });
      i = j;
    } else if (c === "-" && sql[i + 1] === "-") {
      let j = i;
      while (j < n && sql[j] !== "\n") j++;
      out.push({ t: "cmt", s: sql.slice(i, j) });
      i = j;
    } else if (c === "/" && sql[i + 1] === "*") {
      const j = sql.indexOf("*/", i + 2);
      const end = j < 0 ? n : j + 2;
      out.push({ t: "cmt", s: sql.slice(i, end) });
      i = end;
    } else if (c === "'") {
      let j = i + 1;
      while (j < n) {
        if (sql[j] === "'" && sql[j + 1] === "'") j += 2;
        else if (sql[j] === "'") { j++; break; }
        else j++;
      }
      out.push({ t: "str", s: sql.slice(i, j) });
      i = j;
    } else if (c === '"') {
      let j = i + 1;
      while (j < n && sql[j] !== '"') j++;
      out.push({ t: "qid", s: sql.slice(i, j + 1) });
      i = j + 1;
    } else if (c === "$" && /\d/.test(sql[i + 1] ?? "")) {
      let j = i + 1;
      while (j < n && /\d/.test(sql[j])) j++;
      out.push({ t: "param", s: sql.slice(i, j) });
      i = j;
    } else if (/\d/.test(c) || (c === "." && /\d/.test(sql[i + 1] ?? ""))) {
      let j = i + 1;
      while (j < n && /[\d.]/.test(sql[j])) j++;
      out.push({ t: "num", s: sql.slice(i, j) });
      i = j;
    } else if (/[A-Za-z_]/.test(c)) {
      let j = i + 1;
      while (j < n && /[A-Za-z0-9_]/.test(sql[j])) j++;
      out.push({ t: "word", s: sql.slice(i, j) });
      i = j;
    } else {
      const op = OPS.find((o) => sql.startsWith(o, i));
      if (op) { out.push({ t: "op", s: op }); i += op.length; }
      else { out.push({ t: "p", s: c }); i++; }
    }
  }
  return out;
}

const join = (toks: Tok[]) => toks.map((t) => t.s).join("");
const W = (s: string): Tok => ({ t: "word", s });
const P = (s: string): Tok => ({ t: "p", s });
const SP: Tok = { t: "ws", s: " " };
const isWord = (t: Tok | undefined, w: string) => !!t && t.t === "word" && t.s.toUpperCase() === w;

function nextSig(toks: Tok[], i: number) {
  let j = i + 1;
  while (j < toks.length && (toks[j].t === "ws" || toks[j].t === "cmt")) j++;
  return j;
}
function prevSig(toks: Tok[], i: number) {
  let j = i - 1;
  while (j >= 0 && (toks[j].t === "ws" || toks[j].t === "cmt")) j--;
  return j;
}
/** index of the ")" that closes the "(" at toks[open] */
function matchParen(toks: Tok[], open: number) {
  let depth = 0;
  for (let j = open; j < toks.length; j++) {
    if (toks[j].t === "p" && toks[j].s === "(") depth++;
    else if (toks[j].t === "p" && toks[j].s === ")") { depth--; if (depth === 0) return j; }
  }
  return -1;
}
/** index of the "(" that matches the ")" at toks[close] */
function matchParenBack(toks: Tok[], close: number) {
  let depth = 0;
  for (let j = close; j >= 0; j--) {
    if (toks[j].t === "p" && toks[j].s === ")") depth++;
    else if (toks[j].t === "p" && toks[j].s === "(") { depth--; if (depth === 0) return j; }
  }
  return -1;
}
/** split toks[from..to) at top-level commas */
function splitTop(toks: Tok[], from: number, to: number): Tok[][] {
  const parts: Tok[][] = [];
  let cur: Tok[] = [];
  let depth = 0;
  for (let j = from; j < to; j++) {
    const t = toks[j];
    if (t.t === "p" && t.s === "(") depth++;
    if (t.t === "p" && t.s === ")") depth--;
    if (depth === 0 && t.t === "p" && t.s === ",") { parts.push(cur); cur = []; }
    else cur.push(t);
  }
  parts.push(cur);
  return parts;
}
const trimToks = (toks: Tok[]) => {
  let a = 0, b = toks.length;
  while (a < b && (toks[a].t === "ws" || toks[a].t === "cmt")) a++;
  while (b > a && (toks[b - 1].t === "ws" || toks[b - 1].t === "cmt")) b--;
  return toks.slice(a, b);
};

/* ----------------------------------------------------- pass 1: simple renames */

function passWords(toks: Tok[]): Tok[] {
  return toks.map((t, i) => {
    if (t.t !== "word") return t;
    const u = t.s.toUpperCase();
    if (u === "ILIKE") return W("LIKE");
    if (u === "BTRIM") return W("TRIM");
    // PostgreSQL length() counts characters; MariaDB length() counts bytes (Hindi text!)
    if (u === "LENGTH" && toks[nextSig(toks, i)]?.s === "(") return W("CHAR_LENGTH");
    if (u === "ARRAY_AGG" || u === "UNNEST" || u === "GENERATE_SERIES" || u === "LATERAL") {
      throw new Error(`sql-compat: ${t.s} has no portable translation; write this query without it`);
    }
    return t;
  });
}

/* --------------------------------- pass 2: $n placeholders and = ANY(array) */

function passParams(toks: Tok[]): Tok[] {
  const out: Tok[] = [];
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];

    // x = ANY ( $n[::type[]] )   ->   x IN ( <list> )
    if (isWord(t, "ANY")) {
      const o = nextSig(toks, i);
      if (toks[o]?.s === "(") {
        const c = matchParen(toks, o);
        const inner = trimToks(toks.slice(o + 1, c));
        // the "=" before ANY goes away
        let k = out.length - 1;
        while (k >= 0 && (out[k].t === "ws" || out[k].t === "cmt")) k--;
        if (out[k]?.s === "=") out.splice(k);
        else if (out[k]?.s === "<>" || out[k]?.s === "!=") { out.splice(k); out.push(W("NOT")); }
        out.push(SP, W("IN"), SP, P("("));
        if (inner[0]?.t === "param") {
          out.push({ t: "param", s: "\u0001", n: Number(inner[0].s.slice(1)) });
        } else if (isWord(inner[0], "ARRAY") && inner[1]?.s === "[") {
          out.push(...inner.slice(2, inner.length - 1)); // ARRAY[a, b, c]
        } else {
          throw new Error("sql-compat: ANY(...) must wrap a parameter or ARRAY[...]");
        }
        out.push(P(")"));
        i = c;
        continue;
      }
    }

    if (t.t === "param") {
      out.push({ t: "param", s: "?", n: Number(t.s.slice(1)) });
      continue;
    }
    out.push(t);
  }
  return out;
}

/* -------------------------------------------------------- pass 3: x::type casts */

function castTarget(words: string, prec: string): string | null {
  const w = words.toLowerCase().replace(/\s+/g, " ");
  if (/^(int|int2|int4|int8|integer|bigint|smallint)$/.test(w)) return "SIGNED";
  if (/^(text|varchar|character varying|char|bpchar|name)$/.test(w)) return "CHAR";
  if (w === "date") return "DATE";
  if (/^(timestamp|timestamptz|timestamp with time zone|timestamp without time zone)$/.test(w)) return "DATETIME(6)";
  if (w === "time") return "TIME";
  if (/^(numeric|decimal)$/.test(w)) return prec ? `DECIMAL${prec}` : "DECIMAL(30,10)";
  if (/^(float|float4|float8|real|double precision)$/.test(w)) return "DOUBLE";
  if (/^(boolean|bool|json|jsonb|interval|regclass)$/.test(w)) return null; // no-op
  throw new Error(`sql-compat: unsupported cast ::${words}`);
}

function passCasts(toksIn: Tok[]): Tok[] {
  let toks = toksIn;
  for (let guard = 0; guard < 2000; guard++) {
    const ci = toks.findIndex((t) => t.t === "op" && t.s === "::");
    if (ci < 0) return toks;

    // --- the type after "::"
    let typeEnd = nextSig(toks, ci);
    const typeWords: string[] = [toks[typeEnd].s];
    for (;;) {
      const nj = nextSig(toks, typeEnd);
      // two-word types: "double precision", "character varying", "timestamp with time zone"
      if (toks[nj]?.t === "word" && /^(precision|varying|with|without|time|zone)$/i.test(toks[nj].s)) {
        typeWords.push(toks[nj].s);
        typeEnd = nj;
      } else break;
    }
    let prec = "";
    let k = nextSig(toks, typeEnd);
    if (toks[k]?.s === "(") {
      const c = matchParen(toks, k);
      prec = join(toks.slice(k, c + 1)).replace(/\s+/g, "");
      typeEnd = c;
      k = nextSig(toks, typeEnd);
    }
    let isArray = false;
    if (toks[k]?.s === "[") {
      isArray = true;
      typeEnd = nextSig(toks, k); // the closing "]"
    }
    const target = isArray ? null : castTarget(typeWords.join(" "), prec);

    // --- the operand before "::"
    let e = prevSig(toks, ci);
    let s = e;
    if (toks[e]?.s === ")") {
      s = matchParenBack(toks, e);
      const before = s - 1;
      if (toks[before] && (toks[before].t === "word" || toks[before].t === "qid")) s = before;
    } else {
      while (s > 0 && toks[s - 1]?.s === "." && (toks[s - 2]?.t === "word" || toks[s - 2]?.t === "qid")) s -= 2;
    }
    const operand = toks.slice(s, e + 1);
    const replacement: Tok[] = target === null
      ? operand
      : [W("CAST"), P("("), ...operand, SP, W("AS"), SP, W(target), P(")")];
    toks = [...toks.slice(0, s), ...replacement, ...toks.slice(typeEnd + 1)];
  }
  throw new Error("sql-compat: too many casts");
}

/* ------------------------------------------ pass 4: agg(...) FILTER (WHERE ...) */

function passFilter(toksIn: Tok[]): Tok[] {
  let toks = toksIn;
  for (let guard = 0; guard < 1000; guard++) {
    const fi = toks.findIndex((t, i) => isWord(t, "FILTER") && toks[nextSig(toks, i)]?.s === "(");
    if (fi < 0) return toks;
    const fo = nextSig(toks, fi);
    const fc = matchParen(toks, fo);
    const condToks = trimToks(toks.slice(fo + 1, fc));
    if (!isWord(condToks[0], "WHERE")) throw new Error("sql-compat: FILTER without WHERE");
    const cond = condToks.slice(1);

    const ce = prevSig(toks, fi);
    if (toks[ce]?.s !== ")") throw new Error("sql-compat: FILTER must follow an aggregate call");
    const co = matchParenBack(toks, ce);
    let args = trimToks(toks.slice(co + 1, ce));
    let distinct = false;
    if (isWord(args[0], "DISTINCT")) { distinct = true; args = trimToks(args.slice(1)); }
    const arg = args.length === 1 && args[0].s === "*" ? [{ t: "num", s: "1" } as Tok] : args;
    const wrapped: Tok[] = [
      ...(distinct ? [W("DISTINCT"), SP] : []),
      W("CASE"), SP, W("WHEN"), SP, ...cond, SP, W("THEN"), SP, ...arg, SP, W("END"),
    ];
    toks = [...toks.slice(0, co + 1), ...wrapped, P(")"), ...toks.slice(fc + 1)];
  }
  throw new Error("sql-compat: too many FILTERs");
}

/* ----------------------------------------- pass 5: ORDER BY ... NULLS FIRST/LAST */

function passNulls(toksIn: Tok[]): Tok[] {
  let toks = toksIn;
  for (let guard = 0; guard < 1000; guard++) {
    const ni = toks.findIndex((t, i) => isWord(t, "NULLS") && /^(FIRST|LAST)$/i.test(toks[nextSig(toks, i)]?.s ?? ""));
    if (ni < 0) return toks;
    const which = toks[nextSig(toks, ni)].s.toUpperCase();
    const endNulls = nextSig(toks, ni);

    // walk back to the start of this ORDER BY item
    let depth = 0;
    let s = ni - 1;
    for (; s >= 0; s--) {
      const t = toks[s];
      if (t.t === "p" && t.s === ")") depth++;
      else if (t.t === "p" && t.s === "(") { if (depth === 0) break; depth--; }
      else if (depth === 0 && t.t === "p" && t.s === ",") break;
      else if (depth === 0 && isWord(t, "BY")) break;
    }
    let itemToks = trimToks(toks.slice(s + 1, ni));
    let dir: Tok[] = [];
    const last = itemToks[itemToks.length - 1];
    if (isWord(last, "ASC") || isWord(last, "DESC")) { dir = [SP, last]; itemToks = trimToks(itemToks.slice(0, -1)); }
    const isNull: Tok[] = [P("("), ...itemToks, P(")"), SP, W("IS"), ...(which === "FIRST" ? [SP, W("NOT")] : []), SP, W("NULL")];
    const repl: Tok[] = [SP, ...isNull, P(","), SP, ...itemToks, ...dir];
    toks = [...toks.slice(0, s + 1), ...repl, ...toks.slice(endNulls + 1)];
  }
  throw new Error("sql-compat: too many NULLS clauses");
}

/* --------------------------------------------- pass 6: functions and keywords */

const TO_CHAR: [RegExp, string][] = [
  [/HH24/g, "%H"], [/HH12/g, "%h"], [/HH/g, "%h"], [/MI/g, "%i"], [/SS/g, "%s"],
  [/YYYY/g, "%Y"], [/YY/g, "%y"], [/Month/g, "%M"], [/Mon/g, "%b"], [/MM/g, "%m"],
  [/Day/g, "%W"], [/Dy/g, "%a"], [/DD/g, "%d"], [/AM|PM/g, "%p"],
];
function pgFormatToMaria(fmt: string) {
  let f = fmt.slice(1, -1);
  for (const [re, to] of TO_CHAR) f = f.replace(re, to);
  return `'${f}'`;
}
const UNIT = (u: string) => u.replace(/s$/i, "").toUpperCase();

function passFunctions(toksIn: Tok[]): Tok[] {
  let toks = toksIn;
  for (let guard = 0; guard < 3000; guard++) {
    let changed = false;
    for (let i = 0; i < toks.length; i++) {
      const t = toks[i];
      if (t.t !== "word") continue;
      const u = t.s.toUpperCase();
      const o = nextSig(toks, i);

      // x AT TIME ZONE 'Asia/Kolkata'  ->  x   (sessions already run on IST)
      if (u === "AT" && isWord(toks[o], "TIME") && isWord(toks[nextSig(toks, o)], "ZONE")) {
        const z = nextSig(toks, nextSig(toks, o));
        if (toks[z]?.t !== "str" || !/Asia\/Kolkata/i.test(toks[z].s))
          throw new Error("sql-compat: only AT TIME ZONE 'Asia/Kolkata' is supported");
        toks = [...toks.slice(0, i), ...toks.slice(z + 1)];
        changed = true; break;
      }

      // interval '7 days'  ->  INTERVAL 7 DAY
      if (u === "INTERVAL" && toks[o]?.t === "str") {
        const m = toks[o].s.slice(1, -1).trim().match(/^(-?\d+)\s+([a-z]+)$/i);
        if (!m) throw new Error(`sql-compat: unsupported interval ${toks[o].s}`);
        toks = [...toks.slice(0, i), W("INTERVAL"), SP, { t: "num", s: m[1] }, SP, W(UNIT(m[2])), ...toks.slice(o + 1)];
        changed = true; break;
      }

      if (toks[o]?.s !== "(") continue;
      const c = matchParen(toks, o);

      if (u === "TO_CHAR") {
        const args = splitTop(toks, o + 1, c).map(trimToks);
        if (args.length !== 2 || args[1].length !== 1 || args[1][0].t !== "str")
          throw new Error("sql-compat: to_char needs a literal format");
        const fmt = pgFormatToMaria(args[1][0].s);
        toks = [...toks.slice(0, i), W("DATE_FORMAT"), P("("), ...args[0], P(","), SP, { t: "str", s: fmt }, P(")"), ...toks.slice(c + 1)];
        changed = true; break;
      }

      if (u === "DATE_TRUNC") {
        const args = splitTop(toks, o + 1, c).map(trimToks);
        const unit = args[0]?.[0]?.s?.slice(1, -1).toLowerCase();
        const x = args[1];
        let rep: Tok[];
        if (unit === "month") rep = [W("DATE_FORMAT"), P("("), ...x, P(","), SP, { t: "str", s: "'%Y-%m-01'" }, P(")")];
        else if (unit === "year") rep = [W("DATE_FORMAT"), P("("), ...x, P(","), SP, { t: "str", s: "'%Y-01-01'" }, P(")")];
        else if (unit === "day") rep = [W("DATE"), P("("), ...x, P(")")];
        else if (unit === "week") rep = [W("DATE_SUB"), P("("), W("DATE"), P("("), ...x, P(")"), P(","), SP, W("INTERVAL"), SP, W("WEEKDAY"), P("("), ...x, P(")"), SP, W("DAY"), P(")")];
        else throw new Error(`sql-compat: date_trunc('${unit}') unsupported`);
        toks = [...toks.slice(0, i), ...rep, ...toks.slice(c + 1)];
        changed = true; break;
      }

      if (u === "STRING_AGG") {
        let inner = trimToks(toks.slice(o + 1, c));
        let distinct = false;
        if (isWord(inner[0], "DISTINCT")) { distinct = true; inner = trimToks(inner.slice(1)); }
        // expr , sep [ORDER BY ...]
        let depth = 0, comma = -1;
        for (let j = 0; j < inner.length; j++) {
          if (inner[j].s === "(") depth++;
          else if (inner[j].s === ")") depth--;
          else if (depth === 0 && inner[j].s === "," && comma < 0) comma = j;
        }
        if (comma < 0) throw new Error("sql-compat: malformed string_agg");
        const expr = trimToks(inner.slice(0, comma));
        const rest = trimToks(inner.slice(comma + 1));
        const sep = rest[0];
        const order = trimToks(rest.slice(1));
        toks = [
          ...toks.slice(0, i), W("GROUP_CONCAT"), P("("),
          ...(distinct ? [W("DISTINCT"), SP] : []), ...expr,
          ...(order.length ? [SP, ...order] : []), SP, W("SEPARATOR"), SP, sep, P(")"),
          ...toks.slice(c + 1),
        ];
        changed = true; break;
      }
    }
    if (!changed) return toks;
  }
  throw new Error("sql-compat: too many rewrites");
}

/* --------------------------------------------------- pass 7: ON CONFLICT upserts */

function passUpsert(toksIn: Tok[]): Tok[] {
  let toks = toksIn;
  const oi = toks.findIndex((t, i) => isWord(t, "ON") && isWord(toks[nextSig(toks, i)], "CONFLICT"));
  if (oi < 0) return toks;
  const ci = nextSig(toks, oi);
  const po = nextSig(toks, ci);
  if (toks[po]?.s !== "(") throw new Error("sql-compat: ON CONFLICT needs a column list");
  const pc = matchParen(toks, po);
  const cols = splitTop(toks, po + 1, pc).map(trimToks);
  const doI = nextSig(toks, pc);
  if (!isWord(toks[doI], "DO")) throw new Error("sql-compat: malformed ON CONFLICT");
  const act = nextSig(toks, doI);
  let tail = toks.slice(act + 1);

  let repl: Tok[];
  if (isWord(toks[act], "NOTHING")) {
    // no-op update: affects 0 rows when the row already exists, like DO NOTHING
    repl = [W("ON"), SP, W("DUPLICATE"), SP, W("KEY"), SP, W("UPDATE"), SP, ...cols[0], SP, P("="), SP, ...cols[0]];
  } else if (isWord(toks[act], "UPDATE")) {
    const setI = nextSig(toks, act);
    if (!isWord(toks[setI], "SET")) throw new Error("sql-compat: expected DO UPDATE SET");
    // EXCLUDED.col -> VALUES(col)
    const body: Tok[] = [];
    const rest = toks.slice(setI + 1);
    for (let i = 0; i < rest.length; i++) {
      if (isWord(rest[i], "EXCLUDED") && rest[i + 1]?.s === "." && rest[i + 2]?.t === "word") {
        body.push(W("VALUES"), P("("), rest[i + 2], P(")"));
        i += 2;
      } else body.push(rest[i]);
    }
    repl = [W("ON"), SP, W("DUPLICATE"), SP, W("KEY"), SP, W("UPDATE"), ...body];
    tail = [];
  } else throw new Error("sql-compat: unsupported ON CONFLICT action");

  // RETURNING after DO NOTHING stays after the no-op update
  toks = [...toks.slice(0, oi), ...repl, ...tail];
  return toks;
}

/* -------------------------------------------------------------------- public API */

type Seg = { k: "text"; s: string } | { k: "scalar"; n: number } | { k: "list"; n: number };
export type Template = Seg[];

const cache = new Map<string, Template>();

export function compile(sql: string): Template {
  const hit = cache.get(sql);
  if (hit) return hit;

  let toks = tokenize(sql);
  toks = passWords(toks);
  toks = passParams(toks);
  toks = passFilter(toks); // before casts: `count(*) FILTER (...)::int` must not treat FILTER as a function
  toks = passCasts(toks);
  toks = passNulls(toks);
  toks = passFunctions(toks);
  toks = passUpsert(toks);

  const tpl: Template = [];
  let text = "";
  for (const t of toks) {
    if (t.t === "param" && t.n !== undefined) {
      if (text) { tpl.push({ k: "text", s: text }); text = ""; }
      tpl.push({ k: t.s === "\u0001" ? "list" : "scalar", n: t.n });
    } else text += t.s;
  }
  if (text) tpl.push({ k: "text", s: text });
  if (cache.size > 2000) cache.clear();
  cache.set(sql, tpl);
  return tpl;
}

const plain = (v: unknown) =>
  v === undefined ? null
    : Array.isArray(v) || (v && typeof v === "object" && !(v instanceof Date) && !Buffer.isBuffer(v))
      ? JSON.stringify(v) // array columns are held as JSON
      : v;

/**
 * Fill a compiled template. Scalars become "?"; lists (from = ANY($n)) become "?,?,?", or
 * NULL when empty, which is what `= ANY('{}')` evaluates to (never true).
 */
export function bind(tpl: Template, params: unknown[]): { sql: string; values: unknown[] } {
  let sql = "";
  const values: unknown[] = [];
  for (const seg of tpl) {
    if (seg.k === "text") sql += seg.s;
    else if (seg.k === "scalar") { sql += "?"; values.push(plain(params[seg.n - 1])); }
    else {
      const arr = params[seg.n - 1] ?? [];
      if (!Array.isArray(arr)) throw new Error("sql-compat: = ANY($n) needs an array");
      if (arr.length === 0) sql += "NULL";
      else { sql += arr.map(() => "?").join(","); values.push(...arr); }
    }
  }
  return { sql, values };
}

export function translate(sql: string, params: unknown[] = []) {
  return bind(compile(sql), params);
}
