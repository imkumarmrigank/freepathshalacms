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
    if (t.t === "p" && (t.s === "(" || t.s === "[")) depth++;
    if (t.t === "p" && (t.s === ")" || t.s === "]")) depth--;
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

const RENAME: Record<string, string> = {
  BTRIM: "TRIM", JSON_AGG: "JSON_ARRAYAGG", JSONB_AGG: "JSON_ARRAYAGG",
  JSON_BUILD_OBJECT: "JSON_OBJECT", JSONB_BUILD_OBJECT: "JSON_OBJECT", ARRAY_AGG: "JSON_ARRAYAGG",
  BOOL_OR: "MAX", BOOL_AND: "MIN", RANDOM: "RAND",
};
/** reserved in MariaDB but fine as an output alias in PostgreSQL: `count(*) AS both` */
const RESERVED_ALIASES = new Set([
  "BOTH", "RIGHT", "LEFT", "LEAVE", "RANGE", "ROW", "ROWS", "READ", "WRITE", "REPEAT", "RELEASE", "OPTION",
  "MATCH", "CONDITION", "USAGE", "LOOP", "ITERATE", "EXIT", "KEYS", "INDEX", "GENERAL", "LOAD", "LOCK",
  "PURGE", "KILL", "SHOW", "USE", "OUT", "INOUT", "OVER", "WINDOW", "RETURN", "CALL", "FETCH", "FORCE",
  "IGNORE", "ANALYZE", "CHANGE", "COLUMN", "MOD", "DIV", "XOR", "SQL", "TRAILING", "LEADING", "RANK",
  "SCHEMA", "DATABASE", "TABLE", "GROUP", "ORDER", "CHECK", "DESC", "ASC", "LIMIT", "INTERVAL", "REGEXP",
]);

/** words that are reserved in MariaDB but are plain column names here */
const RESERVED_COLUMNS = new Set(["KEY"]);

function passWords(toks: Tok[]): Tok[] {
  const out: Tok[] = [];
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    // PostgreSQL's special dates: "older than any date" / "later than any date"
    if (t.t === "str" && /^'-infinity'$/i.test(t.s)) { out.push({ t: "str", s: "'0001-01-01'" }); continue; }
    if (t.t === "str" && /^'infinity'$/i.test(t.s)) { out.push({ t: "str", s: "'9999-12-31'" }); continue; }
    if (t.t === "str" && t.s === "'{}'") { out.push({ t: "str", s: "'[]'" }); continue; } // empty array literal
    if (t.t !== "word") { out.push(t); continue; }
    const u = t.s.toUpperCase();
    const nx = toks[nextSig(toks, i)];
    if (u === "ILIKE") {
      // columns compare exactly (like PostgreSQL), so ILIKE asks for a case-insensitive collation
      let e = out.length - 1;
      while (e >= 0 && (out[e].t === "ws" || out[e].t === "cmt")) e--;
      let notTok: Tok | null = null;
      if (isWord(out[e], "NOT")) { notTok = out[e]; e--; while (e >= 0 && (out[e].t === "ws" || out[e].t === "cmt")) e--; }
      const s0 = operandBefore(out, e);
      const operand = out.slice(s0, e + 1);
      out.length = s0;
      out.push(...operand, SP, W("COLLATE"), SP, W("utf8mb4_unicode_ci"), SP, ...(notTok ? [notTok, SP] : []), W("LIKE"));
      continue;
    }
    if (RENAME[u] && nx?.s === "(") { out.push(W(RENAME[u])); continue; }
    // PostgreSQL length() counts characters; MariaDB length() counts bytes (Hindi text!)
    if (u === "LENGTH" && nx?.s === "(") { out.push(W("CHAR_LENGTH")); continue; }
    if (RESERVED_ALIASES.has(u) && isWord(toks[prevSig(toks, i)], "AS")) { out.push({ t: "qid", s: "`" + t.s + "`" }); continue; }
    if (u === "POSITION" && nx?.s !== "(") { out.push({ t: "qid", s: "`" + t.s + "`" }); continue; }
    if (RESERVED_COLUMNS.has(u)) {
      const pv = toks[prevSig(toks, i)];
      // "ON DUPLICATE KEY", "PRIMARY KEY" etc. are keywords; a bare column named key is not
      if (!(pv && pv.t === "word" && /^(DUPLICATE|PRIMARY|FOREIGN|UNIQUE)$/i.test(pv.s))) {
        out.push({ t: "qid", s: "`" + t.s + "`" });
        continue;
      }
    }
    // INITCAP(x): first letter up, rest down (the app only ever applies it to single words)
    if (u === "INITCAP" && nx?.s === "(") {
      const o = nextSig(toks, i), c = matchParen(toks, o);
      const x = trimToks(toks.slice(o + 1, c));
      out.push(W("CONCAT"), P("("), W("UPPER"), P("("), W("LEFT"), P("("), ...x, P(","), SP, { t: "num", s: "1" }, P(")"), P(")"), P(","), SP,
        W("LOWER"), P("("), W("SUBSTRING"), P("("), ...x, P(","), SP, { t: "num", s: "2" }, P(")"), P(")"), P(")"));
      i = c;
      continue;
    }
    if (u === "LATERAL" && !isWord(nx, "UNNEST")) {
      throw new Error("sql-compat: LATERAL subqueries have no portable translation; use a window-function join or a correlated subquery");
    }
    out.push(t);
  }
  return out;
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

/* ------------------------------ pass 2b: unnest(...) and generate_series(...) */

function arrayArg(argToks: Tok[]): { expr: Tok[]; type: string } {
  const a = trimToks(argToks);
  // $n::bigint[]  ->  expr, BIGINT
  const ci = a.findIndex((t, i) => t.t === "op" && t.s === "::" && a.slice(i).some((x) => x.s === "["));
  if (ci < 0) return { expr: a, type: "TEXT" };
  const typeWord = a[nextSig(a, ci)].s.toLowerCase();
  const type = /^(bigint|int8|int|int4|integer|smallint)$/.test(typeWord) ? "BIGINT"
    : typeWord === "date" ? "DATE" : /^(numeric|decimal)$/.test(typeWord) ? "DECIMAL(30,10)" : "TEXT";
  return { expr: trimToks(a.slice(0, ci)), type };
}

function passSets(toksIn: Tok[]): Tok[] {
  let toks = toksIn;
  for (let guard = 0; guard < 500; guard++) {
    const ui = toks.findIndex((t, i) => (isWord(t, "UNNEST") || isWord(t, "GENERATE_SERIES")) && toks[nextSig(toks, i)]?.s === "(");
    if (ui < 0) return toks;
    const isUnnest = isWord(toks[ui], "UNNEST");
    const o = nextSig(toks, ui);
    const c = matchParen(toks, o);
    const args = splitTop(toks, o + 1, c).map(trimToks);

    // what follows: [WITH ORDINALITY] [AS] alias [(col, col)]
    let k = nextSig(toks, c);
    let ordinality = false;
    if (isWord(toks[k], "WITH") && isWord(toks[nextSig(toks, k)], "ORDINALITY")) { ordinality = true; k = nextSig(toks, nextSig(toks, k)); }
    if (isWord(toks[k], "AS")) k = nextSig(toks, k);
    let alias = "";
    let cols: string[] = [];
    let end = c;
    if (toks[k]?.t === "word" && !/^(ON|JOIN|WHERE|GROUP|ORDER|LEFT|RIGHT|INNER|CROSS|LIMIT|UNION|SET|FROM|AND|OR)$/i.test(toks[k].s)) {
      alias = toks[k].s; end = k;
      const k2 = nextSig(toks, k);
      if (toks[k2]?.s === "(") {
        const c2 = matchParen(toks, k2);
        cols = splitTop(toks, k2 + 1, c2).map((x) => join(trimToks(x)));
        end = c2;
      }
    }

    let rep: Tok[];
    if (isUnnest) {
      const arrays = args.map(arrayArg);
      const colName = (i: number) => cols[i] ?? (arrays.length === 1 ? (alias || "unnest") : `c${i}`);
      const mk = (a: { expr: Tok[]; type: string }, name: string, ord: string | null) =>
        tokenize(`JSON_TABLE(`).slice(0, 2).concat(a.expr, tokenize(`, '$[*]' COLUMNS (${ord ? `${ord} FOR ORDINALITY, ` : ""}${name} ${a.type} PATH '$'))`));
      if (arrays.length === 1) {
        // with ORDINALITY the last listed column is the position
        const ordName = ordinality ? (cols[1] ?? "ordinality") : null;
        rep = [...mk(arrays[0], colName(0), ordName), SP, W("AS"), SP, W(alias || "unnest")];
        // the column name equals the alias in PostgreSQL's `unnest(x) AS name`; keep the table alias distinct
      } else {
        const sel = arrays.map((_, i) => `a${i}.${colName(i)} AS ${colName(i)}`).join(", ");
        const parts = arrays.map((a, i) => join(mk(a, colName(i), "n")) + ` AS a${i}`);
        const joins = parts.map((p, i) => (i === 0 ? p : `JOIN ${p} ON a${i}.n = a0.n`)).join(" ");
        rep = tokenize(`(SELECT ${sel} FROM `).concat(
          // keep the original expression tokens (they may hold ? markers) by rebuilding with tokens
          arrays.flatMap((a, i) => [
            ...(i === 0 ? [] : [SP, W("JOIN"), SP]),
            ...mk(a, colName(i), "n"), SP, W("AS"), SP, W(`a${i}`),
            ...(i === 0 ? [] : [SP, W("ON"), SP, W(`a${i}`), P("."), W("n"), SP, P("="), SP, W("a0"), P("."), W("n")]),
          ]),
          [P(")"), SP, W("AS"), SP, W(alias || "__u")],
        );
        void joins;
      }
    } else {
      // generate_series(A, B, interval 'N unit') alias
      const step = args[2] ?? [];
      const sm = join(step).match(/interval\s+'(-?\d+)\s+([a-z]+)'/i);
      if (!sm) throw new Error("sql-compat: generate_series needs a literal interval step");
      const n = sm[1], unit = UNIT(sm[2]);
      const name = alias || "g";
      rep = [
        P("("), W("WITH"), SP, W("RECURSIVE"), SP, W("__g"), P("("), W(name), P(")"), SP, W("AS"), SP, P("("),
        W("SELECT"), SP, ...args[0], SP, W("UNION"), SP, W("ALL"), SP,
        W("SELECT"), SP, W(name), SP, P("+"), SP, W("INTERVAL"), SP, { t: "num", s: n }, SP, W(unit), SP,
        W("FROM"), SP, W("__g"), SP, W("WHERE"), SP, W(name), SP, P("+"), SP, W("INTERVAL"), SP, { t: "num", s: n }, SP, W(unit), SP, P("<="), SP, ...args[1],
        P(")"), SP, W("SELECT"), SP, W(name), SP, W("FROM"), SP, W("__g"), P(")"), SP, W("AS"), SP, W(name),
      ];
    }
    // drop a LATERAL keyword that came right before
    let start = ui;
    const pv = prevSig(toks, ui);
    if (isWord(toks[pv], "LATERAL")) start = pv;
    toks = [...toks.slice(0, start), ...rep, ...toks.slice(end + 1)];
  }
  throw new Error("sql-compat: too many set-returning functions");
}

/* ----------------------------------------- pass 2c: column[index] on array columns */

function matchBracket(toks: Tok[], open: number) {
  let depth = 0;
  for (let j = open; j < toks.length; j++) {
    if (toks[j].t === "p" && toks[j].s === "[") depth++;
    else if (toks[j].t === "p" && toks[j].s === "]") { depth--; if (depth === 0) return j; }
  }
  return -1;
}

/** col[n] is 1-based in PostgreSQL; array columns are JSON here, indexed from 0. */
function passSubscripts(toksIn: Tok[]): Tok[] {
  let toks = toksIn;
  for (let guard = 0; guard < 200; guard++) {
    const bi = toks.findIndex((t, i) =>
      t.t === "p" && t.s === "[" && i > 0 &&
      (toks[i - 1].t === "word" || toks[i - 1].t === "qid") && !isWord(toks[i - 1], "ARRAY") &&
      toks[nextSig(toks, i)]?.s !== "]");
    if (bi < 0) return toks;
    const close = matchBracket(toks, bi);
    let s = bi - 1;
    while (s > 1 && toks[s - 1]?.s === "." && (toks[s - 2]?.t === "word" || toks[s - 2]?.t === "qid")) s -= 2;
    const operand = toks.slice(s, bi);
    const idx = trimToks(toks.slice(bi + 1, close));
    const rep: Tok[] = [W("JSON_UNQUOTE"), P("("), W("JSON_EXTRACT"), P("("), ...operand, P(","), SP, W("CONCAT"), P("("),
      { t: "str", s: "'$['" }, P(","), SP, P("("), ...idx, P(")"), SP, P("-"), SP, { t: "num", s: "1" }, P(","), SP, { t: "str", s: "']'" }, P(")"), P(")"), P(")")];
    toks = [...toks.slice(0, s), ...rep, ...toks.slice(close + 1)];
  }
  throw new Error("sql-compat: too many subscripts");
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
    if (isWord(toks[e], "END")) {
      // (CASE ... END)::type without the parentheses: walk back to the matching CASE
      let depth = 0;
      for (let j = e; j >= 0; j--) {
        if (isWord(toks[j], "END")) depth++;
        else if (isWord(toks[j], "CASE")) { depth--; if (depth === 0) { s = j; break; } }
      }
    } else if (toks[e]?.s === ")") {
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
    const arg = args.length >= 1 && args[args.length - 1].s === "*" ? [{ t: "num", s: "1" } as Tok] : args; // count(*) and count(a.*)
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

/* --------------- pass 5b: PostgreSQL's default NULL order for ORDER BY items */

const ORDER_END = /^(LIMIT|OFFSET|FETCH|UNION|INTERSECT|EXCEPT|FOR|ROWS|RANGE|SEPARATOR|RETURNING)$/i;

/**
 * PostgreSQL sorts NULL as larger than everything: last when ascending, first when
 * descending. MariaDB is the opposite. Every ORDER BY item that is a column reference or
 * expression gets an explicit "IS [NOT] NULL" key in front, so lists keep their order.
 * Bare words (usually an output alias) and ordinals are left alone.
 */
function passOrderDefaults(toksIn: Tok[]): Tok[] {
  const toks = [...toksIn];
  const out: Tok[] = [];
  let i = 0;
  while (i < toks.length) {
    const t = toks[i];
    out.push(t);
    if (isWord(t, "BY") && isWord(toks[prevSig(toks, i)], "ORDER")) {
      // collect the clause up to its end at this nesting level
      let j = i + 1, depth = 0;
      const clause: Tok[] = [];
      for (; j < toks.length; j++) {
        const x = toks[j];
        if (x.t === "p" && x.s === "(") depth++;
        if (x.t === "p" && x.s === ")") { if (depth === 0) break; depth--; }
        if (depth === 0 && x.t === "p" && x.s === ";") break;
        if (depth === 0 && x.t === "word" && ORDER_END.test(x.s)) break;
        clause.push(x);
      }
      const items = splitTop(clause, 0, clause.length);
      const rebuilt = items.map((item) => {
        const body = trimToks(item);
        if (!body.length) return item;
        if (body.some((x, k) => isWord(x, "NULLS") && /^(FIRST|LAST)$/i.test(body[nextSig(body, k)]?.s ?? ""))) return item; // explicit
        let dir = "ASC";
        let core = body;
        const lastTok = body[body.length - 1];
        if (isWord(lastTok, "ASC") || isWord(lastTok, "DESC")) { dir = lastTok.s.toUpperCase(); core = trimToks(body.slice(0, -1)); }
        if (!core.length) return item;
        if (core.length === 1 && (core[0].t === "num" || core[0].t === "word")) return item; // ordinal or alias
        if (isWord(core[0], "CASE") || core[0].s === "(" ) return item;
        const nullKey: Tok[] = dir === "ASC"
          ? [...core, SP, W("IS"), SP, W("NULL")]
          : [...core, SP, W("IS"), SP, W("NOT"), SP, W("NULL")];
        return [SP, ...nullKey, P(","), SP, ...core, ...(dir === "DESC" ? [SP, W("DESC")] : [])];
      });
      rebuilt.forEach((it, k) => { if (k) out.push(P(",")); out.push(...it); });
      if (clause.length && clause[clause.length - 1].t === "ws") out.push(SP); // keep the gap before LIMIT etc.
      i = j; // the terminator (or ")") is handled by the main loop
      continue;
    }
    i++;
  }
  return out;
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
        else if (unit === "quarter") rep = [W("CAST"), P("("), W("DATE_ADD"), P("("), W("MAKEDATE"), P("("), W("YEAR"), P("("), ...x, P(")"), P(","), SP, { t: "num", s: "1" }, P(")"), P(","), SP, W("INTERVAL"), SP, P("("), W("QUARTER"), P("("), ...x, P(")"), SP, P("-"), SP, { t: "num", s: "1" }, P(")"), SP, W("QUARTER"), P(")"), SP, W("AS"), SP, W("DATE"), P(")")];
        else if (unit === "day") rep = [W("DATE"), P("("), ...x, P(")")];
        else if (unit === "week") rep = [W("DATE_SUB"), P("("), W("DATE"), P("("), ...x, P(")"), P(","), SP, W("INTERVAL"), SP, W("WEEKDAY"), P("("), ...x, P(")"), SP, W("DAY"), P(")")];
        else throw new Error(`sql-compat: date_trunc('${unit}') unsupported`);
        toks = [...toks.slice(0, i), ...rep, ...toks.slice(c + 1)];
        changed = true; break;
      }

      if (u === "EXTRACT") {
        const inner = trimToks(toks.slice(o + 1, c));
        const fromAt = inner.findIndex((x) => isWord(x, "FROM"));
        if (fromAt > 0 && isWord(inner[0], "EPOCH")) {
          let body = trimToks(inner.slice(fromAt + 1));
          if (body[0]?.s === "(" && matchParen(body, 0) === body.length - 1) body = trimToks(body.slice(1, -1));
          // epoch of a difference: (a - b) in seconds
          let depth = 0, minus = -1;
          body.forEach((x, k) => { if (x.s === "(") depth++; else if (x.s === ")") depth--; else if (depth === 0 && x.t === "p" && x.s === "-") minus = k; });
          const ts = (x: Tok[]) => [W("UNIX_TIMESTAMP"), P("("), ...trimToks(x), P(")")];
          const rep = minus > 0 ? [P("("), ...ts(body.slice(0, minus)), SP, P("-"), SP, ...ts(body.slice(minus + 1)), P(")")] : ts(body);
          toks = [...toks.slice(0, i), ...rep, ...toks.slice(c + 1)];
          changed = true; break;
        }
      }

      // substring(x FROM 'regex')  ->  REGEXP_SUBSTR(x, 'regex')   (MariaDB's FROM form is numeric)
      if (u === "SUBSTRING") {
        const inner = trimToks(toks.slice(o + 1, c));
        const fromAt = inner.findIndex((x) => isWord(x, "FROM"));
        const after = fromAt > 0 ? trimToks(inner.slice(fromAt + 1)) : [];
        if (after.length === 1 && after[0].t === "str" && !isWord(inner[fromAt + 3], "FOR")) {
          toks = [...toks.slice(0, i), W("REGEXP_SUBSTR"), P("("), ...trimToks(inner.slice(0, fromAt)), P(","), SP, after[0], P(")"), ...toks.slice(c + 1)];
          changed = true; break;
        }
      }

      // GREATEST / LEAST: PostgreSQL skips NULL arguments, MariaDB returns NULL if any is NULL
      if ((u === "GREATEST" || u === "LEAST") && !(toks[i - 1]?.s === "_")) {
        const args = splitTop(toks, o + 1, c).map(trimToks);
        const already = args.every((a) => a[0] && isWord(a[0], "COALESCE"));
        if (args.length > 1 && !already) {
          const wrapped: Tok[] = [];
          args.forEach((a, k) => {
            if (k) wrapped.push(P(","), SP);
            const others = args.filter((_, j) => j !== k);
            wrapped.push(W("COALESCE"), P("("), ...a, ...others.flatMap((x) => [P(","), SP, ...x]), P(")"));
          });
          toks = [...toks.slice(0, i), W(u), P("("), ...wrapped, P(")"), ...toks.slice(c + 1)];
          changed = true; break;
        }
      }

      // make_interval(months => n)  ->  INTERVAL (n) MONTH
      if (u === "MAKE_INTERVAL") {
        const inner = trimToks(toks.slice(o + 1, c));
        const arrow = inner.findIndex((x, k) => x.s === "=" && inner[k + 1]?.s === ">");
        if (arrow > 0) {
          const unit = inner[0].s.toLowerCase();
          const MAP: Record<string, string> = { years: "YEAR", months: "MONTH", weeks: "WEEK", days: "DAY", hours: "HOUR", mins: "MINUTE", secs: "SECOND" };
          if (!MAP[unit]) throw new Error(`sql-compat: make_interval(${unit} => ...) unsupported`);
          toks = [...toks.slice(0, i), W("INTERVAL"), SP, P("("), ...trimToks(inner.slice(arrow + 2)), P(")"), SP, W(MAP[unit]), ...toks.slice(c + 1)];
          changed = true; break;
        }
      }

      // array_position(ARRAY['a','b'], x)  ->  COALESCE(NULLIF(FIELD(x, 'a', 'b'), 0), 999)
      if (u === "ARRAY_POSITION") {
        const args = splitTop(toks, o + 1, c).map(trimToks);
        if (isWord(args[0][0], "ARRAY") && args[0][1]?.s === "[") {
          const items = args[0].slice(2, args[0].length - 1);
          toks = [...toks.slice(0, i), W("COALESCE"), P("("), W("NULLIF"), P("("), W("FIELD"), P("("), ...args[1], P(","), SP, ...items, P(")"), P(","), SP, { t: "num", s: "0" }, P(")"), P(","), SP, { t: "num", s: "999" }, P(")"), ...toks.slice(c + 1)];
          changed = true; break;
        }
      }

      // array_position(json_array_column, x)  ->  1-based position via JSON_SEARCH
      if (u === "ARRAY_POSITION") {
        const args = splitTop(toks, o + 1, c).map(trimToks);
        if (!(isWord(args[0][0], "ARRAY") && args[0][1]?.s === "[")) {
          toks = [...toks.slice(0, i), P("("), W("CAST"), P("("), W("REPLACE"), P("("), W("REPLACE"), P("("), W("JSON_UNQUOTE"), P("("), W("JSON_SEARCH"), P("("), ...args[0], P(","), SP, { t: "str", s: "'one'" }, P(","), SP, ...args[1], P(")"), P(")"), P(","), SP, { t: "str", s: "'$['" }, P(","), SP, { t: "str", s: "''" }, P(")"), P(","), SP, { t: "str", s: "']'" }, P(","), SP, { t: "str", s: "''" }, P(")"), SP, W("AS"), SP, W("SIGNED"), P(")"), SP, P("+"), SP, { t: "num", s: "1" }, P(")"), ...toks.slice(c + 1)];
          changed = true; break;
        }
      }

      // array_length(x, 1)  ->  JSON_LENGTH(x)
      if (u === "ARRAY_LENGTH") {
        const args = splitTop(toks, o + 1, c).map(trimToks);
        toks = [...toks.slice(0, i), W("JSON_LENGTH"), P("("), ...args[0], P(")"), ...toks.slice(c + 1)];
        changed = true; break;
      }

      // array_to_string(json_array_column, sep)  ->  scalar subquery over JSON_TABLE
      if (u === "ARRAY_TO_STRING") {
        const args = splitTop(toks, o + 1, c).map(trimToks);
        toks = [...toks.slice(0, i),
          P("("), W("SELECT"), SP, W("GROUP_CONCAT"), P("("), W("jt"), P("."), W("v"), SP, W("ORDER"), SP, W("BY"), SP, W("jt"), P("."), W("n"), SP, W("SEPARATOR"), SP, ...args[1], P(")"), SP,
          W("FROM"), SP, W("JSON_TABLE"), P("("), ...args[0], P(","), SP, { t: "str", s: "'$[*]'" }, SP, W("COLUMNS"), SP, P("("), W("n"), SP, W("FOR"), SP, W("ORDINALITY"), P(","), SP, W("v"), SP, W("TEXT"), SP, W("PATH"), SP, { t: "str", s: "'$'" }, P(")"), P(")"), SP, W("AS"), SP, W("jt"), P(")"),
          ...toks.slice(c + 1)];
        changed = true; break;
      }

      // date_part('year', age(a[, b]))  ->  TIMESTAMPDIFF(YEAR, b, a)
      if (u === "DATE_PART") {
        const args = splitTop(toks, o + 1, c).map(trimToks);
        const unit = args[0]?.[0]?.s?.slice(1, -1).toLowerCase();
        const ag = args[1] ?? [];
        if (unit === "year" && isWord(ag[0], "AGE") && ag[1]?.s === "(") {
          const ac = matchParen(ag, 1);
          const aargs = splitTop(ag, 2, ac).map(trimToks);
          const [later, earlier] = aargs.length === 2 ? [aargs[0], aargs[1]] : [[W("CURRENT_DATE")], aargs[0]];
          toks = [...toks.slice(0, i), W("TIMESTAMPDIFF"), P("("), W("YEAR"), P(","), SP, ...earlier, P(","), SP, ...later, P(")"), ...toks.slice(c + 1)];
          changed = true; break;
        }
        throw new Error("sql-compat: only date_part('year', age(...)) is supported");
      }

      // count(DISTINCT (a, b))  ->  COUNT(DISTINCT a, b)
      if (u === "COUNT") {
        const inner = trimToks(toks.slice(o + 1, c));
        if (isWord(inner[0], "DISTINCT") && trimToks(inner.slice(1))[0]?.s === "(") {
          const rest = trimToks(inner.slice(1));
          if (matchParen(rest, 0) === rest.length - 1 && splitTop(rest, 1, rest.length - 1).length > 1) {
            toks = [...toks.slice(0, o + 1), W("DISTINCT"), SP, ...rest.slice(1, rest.length - 1), ...toks.slice(c)];
            changed = true; break;
          }
        }
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
  let nx = nextSig(toks, ci);

  // the conflict target is only ever the table's unique key, which MariaDB checks anyway
  let firstCol: Tok[] = [];
  if (toks[nx]?.s === "(") {
    const pc = matchParen(toks, nx);
    firstCol = splitTop(toks, nx + 1, pc).map(trimToks)[0];
    nx = nextSig(toks, pc);
    if (isWord(toks[nx], "WHERE")) {
      // target of a partial unique index: the hidden unique key built from the predicate does the work
      while (nx < toks.length && !isWord(toks[nx], "DO")) nx = nextSig(toks, nx);
    }
  }
  if (!isWord(toks[nx], "DO")) throw new Error("sql-compat: malformed ON CONFLICT");
  const act = nextSig(toks, nx);

  let repl: Tok[];
  let tail = toks.slice(act + 1);
  if (isWord(toks[act], "NOTHING")) {
    // no-op update: affects 0 rows when the row already exists, like DO NOTHING
    if (!firstCol.length || firstCol.some((t) => t.s === "(")) {
      // no usable target: take the first column of the INSERT's own column list
      const ins = toks.findIndex((t, i) => isWord(t, "INSERT") && isWord(toks[nextSig(toks, i)], "INTO"));
      const colsOpen = toks.findIndex((t, i) => i > ins && t.s === "(");
      const colsClose = matchParen(toks, colsOpen);
      firstCol = splitTop(toks, colsOpen + 1, colsClose).map(trimToks)[0];
    }
    repl = [W("ON"), SP, W("DUPLICATE"), SP, W("KEY"), SP, W("UPDATE"), SP, ...firstCol, SP, P("="), SP, ...firstCol];
  } else if (isWord(toks[act], "UPDATE")) {
    const setI = nextSig(toks, act);
    if (!isWord(toks[setI], "SET")) throw new Error("sql-compat: expected DO UPDATE SET");
    const body: Tok[] = [];
    const rest = toks.slice(setI + 1);
    for (let i = 0; i < rest.length; i++) {
      // EXCLUDED.col -> VALUES(col)
      if (isWord(rest[i], "EXCLUDED") && rest[i + 1]?.s === "." && rest[i + 2]?.t === "word") {
        body.push(W("VALUES"), P("("), rest[i + 2], P(")"));
        i += 2;
      } else body.push(rest[i]);
    }
    if (body.some((t) => isWord(t, "WHERE") )) {
      // a top-level WHERE would be the conditional-update form; sub-selects keep theirs inside parens
      let depth = 0;
      for (const t of body) {
        if (t.s === "(") depth++; else if (t.s === ")") depth--;
        else if (depth === 0 && isWord(t, "WHERE")) throw new Error("sql-compat: DO UPDATE ... WHERE is not supported");
      }
    }
    repl = [W("ON"), SP, W("DUPLICATE"), SP, W("KEY"), SP, W("UPDATE"), ...body];
    tail = [];
  } else throw new Error("sql-compat: unsupported ON CONFLICT action");

  return [...toks.slice(0, oi), ...repl, ...tail];
}

/* ----------------------------------------------- pass 8: date arithmetic */

let DATE_COLS: Set<string> = new Set();
let STAMP_COLS: Set<string> = new Set();
/** Wire in the column-name sets generated from the live schema (see gen-schema.mjs). */
export function configure(opts: { dateColumns: Set<string>; timestampColumns: Set<string> }) {
  DATE_COLS = opts.dateColumns;
  STAMP_COLS = opts.timestampColumns;
  cache.clear();
}
/** Things the translator saw but could not safely rewrite; read by the SQL checker. */
export const warnings: string[] = [];

function operandBefore(toks: Tok[], e: number): number {
  let s = e;
  if (isWord(toks[e], "END")) {
    let depth = 0;
    for (let j = e; j >= 0; j--) {
      if (isWord(toks[j], "END")) depth++;
      else if (isWord(toks[j], "CASE")) { depth--; if (depth === 0) return j; }
    }
  }
  if (toks[e]?.s === ")") {
    s = matchParenBack(toks, e);
    const before = s - 1;
    if (toks[before] && (toks[before].t === "word" || toks[before].t === "qid")) s = before;
  } else {
    while (s > 1 && toks[s - 1]?.s === "." && (toks[s - 2]?.t === "word" || toks[s - 2]?.t === "qid")) s -= 2;
  }
  return s;
}

function operandAfter(toks: Tok[], s: number): number {
  const t = toks[s];
  if (!t) return s;
  if (t.s === "(") return matchParen(toks, s);
  let e = s;
  const nx = nextSig(toks, e);
  if (t.t === "word" && toks[nx]?.s === "(" && nx === s + 1) return matchParen(toks, nx); // func(...)
  while (toks[e + 1]?.s === "." && (toks[e + 2]?.t === "word" || toks[e + 2]?.t === "qid")) e += 2;
  return e;
}

const lastIdent = (toks: Tok[]) => {
  const w = toks.filter((t) => t.t === "word" || t.t === "qid");
  return (w[w.length - 1]?.s ?? "").replace(/`/g, "").toLowerCase();
};

function isDateOperand(op: Tok[]): boolean {
  const t = trimToks(op);
  if (!t.length) return false;
  const txt = join(t).replace(/\s+/g, " ").trim().toUpperCase();
  if (txt === "CURRENT_DATE" || txt === "CURDATE()") return true;
  if (/^CAST\(.* AS DATE\)$/.test(txt) || /^DATE\(/.test(txt)) return true;
  if (/^(COALESCE|GREATEST|LEAST)\(/.test(txt)) return t.some((x) => (x.t === "word" && (x.s.toUpperCase() === "CURRENT_DATE" || DATE_COLS.has(x.s.toLowerCase()))));
  if (t.length <= 3 && t.every((x, i) => (i % 2 === 0 ? x.t === "word" || x.t === "qid" : x.s === "."))) return DATE_COLS.has(lastIdent(t));
  return false;
}
const isNumber = (op: Tok[]) => { const t = trimToks(op); return t.length === 1 && t[0].t === "num"; };

function passDates(toksIn: Tok[]): Tok[] {
  let toks = toksIn;
  for (let guard = 0; guard < 500; guard++) {
    let changed = false;
    for (let i = 1; i < toks.length - 1 && !changed; i++) {
      const t = toks[i];
      if (!(t.t === "p" && (t.s === "-" || t.s === "+"))) continue;
      const pe = prevSig(toks, i);
      if (pe < 0) continue;
      const pt = toks[pe];
      // must be a binary operator: something operand-like ends just before it
      if (!(pt.t === "word" || pt.t === "num" || pt.t === "qid" || pt.t === "str" || pt.t === "param" || pt.s === ")")) continue;
      if (pt.t === "word" && /^(SELECT|WHERE|AND|OR|THEN|ELSE|WHEN|ON|BY|IN|AS|FROM|SET|AT|THEN|NOT|LIKE|BETWEEN|VALUES)$/i.test(pt.s)) continue;
      const rs = nextSig(toks, i);
      if (isWord(toks[rs], "INTERVAL") || isWord(toks[rs], "MAKE_INTERVAL")) continue;
      const ls = operandBefore(toks, pe);
      const re = operandAfter(toks, rs);
      const left = toks.slice(ls, pe + 1), right = toks.slice(rs, re + 1);
      if (!isDateOperand(left)) continue;
      let rep: Tok[] | null = null;
      if (t.s === "-" && isDateOperand(right)) rep = [W("DATEDIFF"), P("("), ...left, P(","), SP, ...right, P(")")];
      else if (isNumber(right)) rep = [W(t.s === "-" ? "DATE_SUB" : "DATE_ADD"), P("("), ...left, P(","), SP, W("INTERVAL"), SP, ...right, SP, W("DAY"), P(")")];
      if (rep) { toks = [...toks.slice(0, ls), ...rep, ...toks.slice(re + 1)]; changed = true; }
    }
    if (!changed) break;
  }
  // anything date-looking still being added or subtracted is a mistake waiting to happen
  for (let i = 1; i < toks.length - 1; i++) {
    const t = toks[i];
    if (t.t === "p" && (t.s === "-" || t.s === "+")) {
      const pe = prevSig(toks, i);
      if (toks[pe]?.t !== "word" && toks[pe]?.t !== "qid") continue; // a function result is not a bare column
      const l = lastIdent(toks.slice(Math.max(0, pe - 2), pe + 1));
      if (DATE_COLS.has(l) || STAMP_COLS.has(l)) warnings.push(`date-looking operand next to "${t.s}": ${join(toks.slice(Math.max(0, i - 6), i + 6)).replace(/\s+/g, " ")}`);
    }
  }
  return toks;
}

/* -------------------------------------------------------------------- public API */

type Seg = { k: "text"; s: string } | { k: "scalar"; n: number } | { k: "list"; n: number };
export type Template = { segs: Seg[]; booleans: string[]; jsons: string[] };

const cache = new Map<string, Template>();

/**
 * PostgreSQL gives real booleans for comparisons and EXISTS(); MariaDB gives 0 or 1. Looking at the
 * statement's own select list, return the output names that are boolean expressions, so only
 * those results are turned back into true/false (a count named "present" must stay a number).
 */
/** output names whose value is built by an array/JSON aggregate (or an empty-array literal) */
function jsonAliases(toks: Tok[]): string[] {
  let depth = 0, sel = -1;
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (t.t === "p" && t.s === "(") depth++;
    else if (t.t === "p" && t.s === ")") depth--;
    else if (depth === 0 && isWord(t, "SELECT")) { sel = i; break; }
  }
  if (sel < 0) return [];
  depth = 0;
  let end = toks.length;
  for (let i = sel + 1; i < toks.length; i++) {
    const t = toks[i];
    if (t.t === "p" && t.s === "(") depth++;
    else if (t.t === "p" && t.s === ")") depth--;
    else if (depth === 0 && isWord(t, "FROM")) { end = i; break; }
  }
  const out: string[] = [];
  for (const raw of splitTop(toks, sel + 1, end)) {
    const item = trimToks(raw);
    let d = 0, asAt = -1;
    item.forEach((t, k) => { if (t.s === "(") d++; else if (t.s === ")") d--; else if (d === 0 && isWord(t, "AS")) asAt = k; });
    if (asAt < 0) continue;
    const alias = item[nextSig(item, asAt)];
    const expr = item.slice(0, asAt);
    if (alias && expr.some((t) => (t.t === "word" && /^(array_agg|json_agg|jsonb_agg|json_build_object|jsonb_build_object)$/i.test(t.s)) || (t.t === "str" && t.s === "'{}'"))) {
      out.push(alias.s.replace(/["`]/g, ""));
    }
  }
  return out;
}

/** PostgreSQL names `col::text` after the column; MariaDB would name it `CAST(col AS CHAR)`. Keep the name. */
function passCastAlias(toks: Tok[]): Tok[] {
  const inserts: { at: number; name: string }[] = [];
  for (let s = 0; s < toks.length; s++) {
    if (!isWord(toks[s], "SELECT")) continue;
    let depth = 0, itemStart = s + 1;
    const flush = (end: number) => {
      let a = itemStart, b = end;
      while (a < b && (toks[a].t === "ws" || toks[a].t === "cmt")) a++;
      while (b > a && (toks[b - 1].t === "ws" || toks[b - 1].t === "cmt")) b--;
      const it = toks.slice(a, b);
      if (it.length < 3 || it.some((t) => isWord(t, "AS") || isWord(t, "DISTINCT"))) return;
      const ci = it.findIndex((t) => t.t === "op" && t.s === "::");
      if (ci < 1) return;
      const lhs = it.slice(0, ci);
      const ok = lhs.length === 1 ? lhs[0].t === "word" : lhs.length === 3 && lhs[0].t === "word" && lhs[1].s === "." && lhs[2].t === "word";
      const rest = it.slice(ci + 1);
      if (/^(NULL|TRUE|FALSE|CURRENT_DATE|CURRENT_TIMESTAMP|NOW)$/i.test(lhs[lhs.length - 1].s)) return;
      if (!ok || !rest.length || rest.some((t) => t.t === "op" || t.s === ",")) return;
      inserts.push({ at: b, name: lhs[lhs.length - 1].s });
    };
    let j = s + 1;
    for (; j < toks.length; j++) {
      const t = toks[j];
      if (t.t === "p" && (t.s === "(" || t.s === "[")) depth++;
      else if (t.t === "p" && (t.s === ")" || t.s === "]")) { if (depth === 0) break; depth--; }
      else if (depth === 0 && t.t === "p" && t.s === ",") { flush(j); itemStart = j + 1; }
      else if (depth === 0 && isWord(t, "FROM")) break;
    }
    if (j < toks.length && isWord(toks[j], "FROM")) flush(j);
  }
  for (const { at, name } of inserts.sort((x, y) => y.at - x.at)) toks.splice(at, 0, SP, W("AS"), SP, W(name));
  return toks;
}

function booleanAliases(toks: Tok[]): string[] {
  let depth = 0, sel = -1;
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (t.t === "p" && t.s === "(") depth++;
    else if (t.t === "p" && t.s === ")") depth--;
    else if (depth === 0 && isWord(t, "SELECT")) { sel = i; break; }
  }
  if (sel < 0) return [];
  depth = 0;
  let end = toks.length;
  for (let i = sel + 1; i < toks.length; i++) {
    const t = toks[i];
    if (t.t === "p" && t.s === "(") depth++;
    else if (t.t === "p" && t.s === ")") depth--;
    else if (depth === 0 && isWord(t, "FROM")) { end = i; break; }
  }
  const out: string[] = [];
  for (const raw of splitTop(toks, sel + 1, end)) {
    let item = trimToks(raw);
    if (isWord(item[0], "DISTINCT")) item = trimToks(item.slice(1));
    // alias = the word after the last depth-0 AS
    let d = 0, asAt = -1;
    item.forEach((t, k) => { if (t.s === "(") d++; else if (t.s === ")") d--; else if (d === 0 && isWord(t, "AS")) asAt = k; });
    if (asAt < 0) continue;
    const aliasTok = item[nextSig(item, asAt)];
    if (!aliasTok) continue;
    let expr = trimToks(item.slice(0, asAt));
    // unwrap one level of redundant parentheses: (a = b)
    let wrappedSubquery = false;
    while (expr[0]?.s === "(" && matchParen(expr, 0) === expr.length - 1) {
      expr = trimToks(expr.slice(1, -1));
      if (isWord(expr[0], "SELECT") || isWord(expr[0], "WITH")) { wrappedSubquery = true; break; } // a scalar subquery, not a comparison
    }
    if (wrappedSubquery) continue;
    // COALESCE(flag, FALSE), CASE ... THEN TRUE, bool_or(...)
    if (expr.some((t) => t.t === "word" && /^(TRUE|FALSE|BOOL_OR|BOOL_AND)$/i.test(t.s))) { out.push(aliasTok.s.replace(/["`]/g, "")); continue; }
    if (isWord(expr[0], "EXISTS") || isWord(expr[0], "NOT")) { out.push(aliasTok.s.replace(/["`]/g, "")); continue; }
    // a comparison / IS / BETWEEN / IN / LIKE / AND / OR at the top level, and no CASE or arithmetic wrapper
    d = 0;
    let boolish = false, hasCase = false;
    for (let k = 0; k < expr.length; k++) {
      const t = expr[k];
      if (t.s === "(") d++; else if (t.s === ")") d--;
      else if (d === 0) {
        if (t.t === "word" && /^CASE$/i.test(t.s)) hasCase = true;
        if ((t.t === "op" && /^(<>|<=|>=|!=)$/.test(t.s)) || (t.t === "p" && /^[=<>]$/.test(t.s))) boolish = true;
        if (t.t === "word" && /^(IS|BETWEEN|LIKE|ILIKE|AND|OR)$/i.test(t.s)) boolish = true;
        if (t.t === "word" && /^IN$/i.test(t.s) && k > 0) boolish = true;
      }
    }
    if (boolish && !hasCase) out.push(aliasTok.s.replace(/["`]/g, ""));
  }
  return out;
}

export function compile(sql: string): Template {
  const hit = cache.get(sql);
  if (hit) return hit;

  let toks = tokenize(sql);
  const booleans = booleanAliases(toks);
  const jsons = jsonAliases(toks);
  toks = passWords(toks);
  toks = passParams(toks);
  toks = passSets(toks);
  toks = passSubscripts(toks);
  toks = passFilter(toks); // before casts: `count(*) FILTER (...)::int` must not treat FILTER as a function
  toks = passCastAlias(toks);
  toks = passCasts(toks);
  toks = passOrderDefaults(toks);
  toks = passNulls(toks);
  toks = passFunctions(toks);
  toks = passDates(toks);
  toks = passUpsert(toks);

  const tpl: Seg[] = [];
  let text = "";
  for (const t of toks) {
    if (t.t === "param" && t.n !== undefined) {
      if (text) { tpl.push({ k: "text", s: text }); text = ""; }
      tpl.push({ k: t.s === "\u0001" ? "list" : "scalar", n: t.n });
    } else text += t.s;
  }
  if (text) tpl.push({ k: "text", s: text });
  const compiled: Template = { segs: tpl, booleans, jsons };
  if (cache.size > 2000) cache.clear();
  cache.set(sql, compiled);
  return compiled;
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
export function bind(tpl: Template, params: unknown[]): { sql: string; values: unknown[]; booleans: string[]; jsons: string[] } {
  let sql = "";
  const values: unknown[] = [];
  for (const seg of tpl.segs) {
    if (seg.k === "text") sql += seg.s;
    else if (seg.k === "scalar") { sql += "?"; values.push(plain(params[seg.n - 1])); }
    else {
      const arr = params[seg.n - 1] ?? [];
      if (!Array.isArray(arr)) throw new Error("sql-compat: = ANY($n) needs an array");
      if (arr.length === 0) sql += "NULL";
      else { sql += arr.map(() => "?").join(","); values.push(...arr); }
    }
  }
  return { sql, values, booleans: tpl.booleans, jsons: tpl.jsons };
}

export function translate(sql: string, params: unknown[] = []) {
  return bind(compile(sql), params);
}
