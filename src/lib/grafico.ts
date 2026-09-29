/**
 * ```grafico blocks: a small, safe JSON chart format the model can write.
 *
 *   {"type":"funcion","title":"f(x) = x² − 4","expr":"x^2-4","xmin":-5,"xmax":5}
 *   {"type":"funcion","exprs":["sin(x)","cos(x)"],"xmin":-6.3,"xmax":6.3,"ymin":-1.5,"ymax":1.5}
 *   {"type":"barras","title":"...","labels":["A","B"],"series":[{"name":"2024","values":[3,5]}],"source":"..."}
 *   {"type":"lineas", ...same as barras}
 *   {"type":"torta","title":"...","labels":["A","B"],"values":[60,40],"source":"..."}
 *
 * Expressions are parsed by a tiny recursive-descent parser (no eval): numbers,
 * x, pi, e, + - * / ^, parentheses, implicit multiplication and a fixed list of
 * math functions. Shared by the web renderer and ported 1:1 to Flutter.
 */

export const GRAFICO_MAX_SERIES = 6;
export const GRAFICO_MAX_POINTS = 24;
export const GRAFICO_MAX_FUNCTIONS = 4;
export const EXPR_MAX_LENGTH = 160;
export const SAMPLES = 400;

export type FunctionSpec = {
  type: "funcion";
  title?: string;
  exprs: { expr: string; name: string }[];
  xmin: number;
  xmax: number;
  ymin?: number;
  ymax?: number;
};
export type SeriesSpec = {
  type: "barras" | "lineas";
  title?: string;
  labels: string[];
  series: { name: string; values: number[] }[];
  unit?: string;
  source?: string;
};
export type PieSpec = {
  type: "torta";
  title?: string;
  labels: string[];
  values: number[];
  unit?: string;
  source?: string;
};
export type ChartSpec = FunctionSpec | SeriesSpec | PieSpec;
export type ChartParse = { ok: true; spec: ChartSpec } | { ok: false; error: string };

// ---- Expression parser -----------------------------------------------------

type Node =
  | { k: "num"; v: number }
  | { k: "x" }
  | { k: "neg"; a: Node }
  | { k: "bin"; op: "+" | "-" | "*" | "/" | "^"; a: Node; b: Node }
  | { k: "fn"; f: string; a: Node };

const FUNCS: Record<string, (v: number) => number> = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
  arcsin: Math.asin,
  arccos: Math.acos,
  arctan: Math.atan,
  sen: Math.sin,
  tg: Math.tan,
  sinh: Math.sinh,
  cosh: Math.cosh,
  tanh: Math.tanh,
  sqrt: Math.sqrt,
  raiz: Math.sqrt,
  cbrt: Math.cbrt,
  abs: Math.abs,
  ln: Math.log,
  log: Math.log10,
  log10: Math.log10,
  log2: Math.log2,
  exp: Math.exp,
  floor: Math.floor,
  ceil: Math.ceil,
  round: Math.round,
  sign: Math.sign,
};
const CONSTS: Record<string, number> = { pi: Math.PI, e: Math.E };
const own = (obj: object, key: string) => Object.prototype.hasOwnProperty.call(obj, key);

export class ExprError extends Error {}

type Token = { t: "num"; v: number } | { t: "id"; v: string } | { t: "op"; v: string };

function tokenize(src: string): Token[] {
  const out: Token[] = [];
  const s = src.replace(/\*\*/g, "^").replace(/π/g, "pi").replace(/[·×]/g, "*").replace(/−/g, "-").replace(/÷/g, "/");
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) {
      i += 1;
    } else if (/[0-9.]/.test(c)) {
      const m = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i.exec(s.slice(i));
      if (!m) throw new ExprError(`Número inválido cerca de "${s.slice(i, i + 6)}"`);
      out.push({ t: "num", v: Number(m[0]) });
      i += m[0].length;
    } else if (/[a-zA-Z]/.test(c)) {
      const m = /^[a-zA-Z][a-zA-Z0-9]*/.exec(s.slice(i))!;
      out.push({ t: "id", v: m[0].toLowerCase() });
      i += m[0].length;
    } else if ("+-*/^(),".includes(c)) {
      out.push({ t: "op", v: c });
      i += 1;
    } else {
      throw new ExprError(`Símbolo no permitido: "${c}"`);
    }
  }
  return out;
}

/** Splits identifiers like "xsin" or "2pix" the way people write them. */
function splitIdentifier(id: string): string[] {
  if (own(FUNCS, id) || own(CONSTS, id) || id === "x") return [id];
  const names = [...Object.keys(FUNCS), ...Object.keys(CONSTS), "x"].sort((a, b) => b.length - a.length);
  const parts: string[] = [];
  let rest = id;
  while (rest) {
    const hit = names.find((name) => rest.startsWith(name));
    if (!hit) throw new ExprError(`No conozco "${id}". Usá x, pi, e o funciones como sin, cos, sqrt, ln.`);
    parts.push(hit);
    rest = rest.slice(hit.length);
  }
  return parts;
}

export function parseExpr(src: string): Node {
  if (typeof src !== "string" || !src.trim()) throw new ExprError("La expresión está vacía.");
  if (src.length > EXPR_MAX_LENGTH) throw new ExprError("La expresión es demasiado larga.");
  const tokens: Token[] = [];
  for (const token of tokenize(src)) {
    if (token.t === "id") for (const part of splitIdentifier(token.v)) tokens.push({ t: "id", v: part });
    else tokens.push(token);
  }
  let pos = 0;
  let depth = 0;
  const peek = () => tokens[pos];
  const isOp = (v: string) => peek()?.t === "op" && peek()!.v === v;
  const startsFactor = () => {
    const t = peek();
    return Boolean(t && (t.t === "num" || t.t === "id" || (t.t === "op" && t.v === "(")));
  };

  function expr(): Node {
    let node = term();
    while (isOp("+") || isOp("-")) {
      const op = (tokens[pos++] as { v: "+" | "-" }).v;
      node = { k: "bin", op, a: node, b: term() };
    }
    return node;
  }
  function term(): Node {
    let node = unary();
    for (;;) {
      if (isOp("*") || isOp("/")) {
        const op = (tokens[pos++] as { v: "*" | "/" }).v;
        node = { k: "bin", op, a: node, b: unary() };
      } else if (startsFactor()) {
        node = { k: "bin", op: "*", a: node, b: power() }; // implicit: 2x, 3(x+1), x sin(x)
      } else return node;
    }
  }
  function unary(): Node {
    if (isOp("-")) {
      pos += 1;
      return { k: "neg", a: unary() };
    }
    if (isOp("+")) {
      pos += 1;
      return unary();
    }
    return power();
  }
  function power(): Node {
    const base = atom();
    if (isOp("^")) {
      pos += 1;
      return { k: "bin", op: "^", a: base, b: unary() }; // right-assoc, -x^2 = -(x^2)
    }
    return base;
  }
  function atom(): Node {
    if (++depth > 60) throw new ExprError("La expresión está demasiado anidada.");
    try {
      const t = tokens[pos++];
      if (!t) throw new ExprError("La expresión termina de golpe.");
      if (t.t === "num") return { k: "num", v: t.v };
      if (t.t === "op" && t.v === "(") {
        const inner = expr();
        if (!isOp(")")) throw new ExprError("Falta cerrar un paréntesis.");
        pos += 1;
        return inner;
      }
      if (t.t === "id") {
        if (t.v === "x") return { k: "x" };
        if (own(CONSTS, t.v)) return { k: "num", v: CONSTS[t.v] };
        if (own(FUNCS, t.v)) {
          // sin(x) or sin x / sin 2x
          if (isOp("(")) {
            pos += 1;
            const arg = expr();
            if (!isOp(")")) throw new ExprError("Falta cerrar un paréntesis.");
            pos += 1;
            return { k: "fn", f: t.v, a: arg };
          }
          return { k: "fn", f: t.v, a: power() };
        }
      }
      throw new ExprError(`No esperaba "${t.v}".`);
    } finally {
      depth -= 1;
    }
  }

  const tree = expr();
  if (pos < tokens.length) throw new ExprError(`Sobra "${String(tokens[pos].v)}" en la expresión.`);
  return tree;
}

function evaluate(node: Node, x: number): number {
  switch (node.k) {
    case "num":
      return node.v;
    case "x":
      return x;
    case "neg":
      return -evaluate(node.a, x);
    case "fn":
      return FUNCS[node.f](evaluate(node.a, x));
    case "bin": {
      const a = evaluate(node.a, x);
      const b = evaluate(node.b, x);
      if (node.op === "+") return a + b;
      if (node.op === "-") return a - b;
      if (node.op === "*") return a * b;
      if (node.op === "/") return a / b;
      return Math.pow(a, b);
    }
  }
}

/** Compiles an expression in x into a safe function (throws ExprError). */
export function compileExpr(src: string): (x: number) => number {
  const tree = parseExpr(src);
  return (x) => evaluate(tree, x);
}

// ---- Spec validation ---------------------------------------------------------

const TYPES: Record<string, ChartSpec["type"]> = {
  funcion: "funcion",
  función: "funcion",
  function: "funcion",
  barras: "barras",
  bar: "barras",
  bars: "barras",
  lineas: "lineas",
  líneas: "lineas",
  line: "lineas",
  torta: "torta",
  pie: "torta",
};

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const str = (v: unknown, max = 80) =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined;

function numbers(v: unknown, n: number): number[] | null {
  if (!Array.isArray(v) || v.length !== n) return null;
  const out = v.map((item) => (typeof item === "string" ? Number(item) : item));
  return out.every((item) => typeof item === "number" && Number.isFinite(item)) ? (out as number[]) : null;
}

/** Parses and validates the text of a ```grafico block. Errors are Spanish. */
export function parseGrafico(text: string): ChartParse {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "El gráfico no tiene un JSON válido." };
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "El gráfico no tiene un formato válido." };
  }
  const r = raw as Record<string, unknown>;
  const typeKey = String(r.type ?? r.tipo ?? "").toLowerCase();
  const type = own(TYPES, typeKey) ? TYPES[typeKey] : undefined;
  if (!type) return { ok: false, error: "Tipo de gráfico desconocido (usá funcion, barras, lineas o torta)." };
  const title = str(r.title ?? r.titulo, 100);
  const source = str(r.source ?? r.fuente, 120);
  const unit = str(r.unit ?? r.unidad, 12);

  if (type === "funcion") {
    const list: unknown[] = Array.isArray(r.exprs)
      ? r.exprs
      : Array.isArray(r.funciones)
        ? r.funciones
        : [r.expr];
    const exprs: FunctionSpec["exprs"] = [];
    for (const item of list.slice(0, GRAFICO_MAX_FUNCTIONS)) {
      const rawExpr = typeof item === "string" ? item : str((item as Record<string, unknown>)?.expr, EXPR_MAX_LENGTH);
      const expr = rawExpr?.replace(/^\s*(y|[fgh]\s*\(\s*x\s*\))\s*=/i, "").trim();
      const name =
        (typeof item === "object" && item ? str((item as Record<string, unknown>).name ?? (item as Record<string, unknown>).nombre, 40) : undefined) ??
        `y = ${String(expr ?? "")}`;
      if (!expr) return { ok: false, error: "Falta la expresión de la función." };
      try {
        parseExpr(expr);
      } catch (err) {
        return { ok: false, error: `No pude leer "${expr}": ${(err as Error).message}` };
      }
      exprs.push({ expr, name });
    }
    if (exprs.length === 0) return { ok: false, error: "Falta la expresión de la función." };
    let xmin = num(r.xmin) ?? -10;
    let xmax = num(r.xmax) ?? 10;
    if (xmax <= xmin) [xmin, xmax] = xmax < xmin ? [xmax, xmin] : [xmin - 1, xmax + 1];
    if (xmax - xmin > 1e6) return { ok: false, error: "El rango de x es demasiado grande." };
    let ymin = num(r.ymin);
    let ymax = num(r.ymax);
    if (ymin !== undefined && ymax !== undefined && ymax <= ymin) ymin = ymax = undefined;
    return { ok: true, spec: { type, title, exprs, xmin, xmax, ymin, ymax } };
  }

  const labels = Array.isArray(r.labels ?? r.etiquetas)
    ? ((r.labels ?? r.etiquetas) as unknown[]).map((label) => String(label).slice(0, 40))
    : null;
  if (!labels || labels.length === 0) return { ok: false, error: "Faltan las etiquetas del gráfico." };
  if (labels.length > GRAFICO_MAX_POINTS) return { ok: false, error: "El gráfico tiene demasiados datos." };

  if (type === "torta") {
    const firstSeries = Array.isArray(r.series) ? (r.series[0] as Record<string, unknown> | undefined) : undefined;
    const values = numbers(r.values ?? r.valores ?? firstSeries?.values ?? firstSeries?.valores, labels.length);
    if (!values) return { ok: false, error: "Los valores no coinciden con las etiquetas." };
    if (values.some((value) => value < 0) || values.every((value) => value === 0)) {
      return { ok: false, error: "Una torta necesita valores positivos." };
    }
    return { ok: true, spec: { type, title, labels, values, unit, source } };
  }

  const rawSeries = Array.isArray(r.series)
    ? r.series
    : r.values ?? r.valores
      ? [{ name: title ?? "Serie", values: r.values ?? r.valores }]
      : [];
  const series: SeriesSpec["series"] = [];
  for (const [index, item] of rawSeries.slice(0, GRAFICO_MAX_SERIES).entries()) {
    const s = (item ?? {}) as Record<string, unknown>;
    const values = numbers(s.values ?? s.valores, labels.length);
    if (!values) return { ok: false, error: "Los valores no coinciden con las etiquetas." };
    series.push({ name: str(s.name ?? s.nombre, 40) ?? `Serie ${index + 1}`, values });
  }
  if (series.length === 0) return { ok: false, error: "Faltan los valores del gráfico." };
  return { ok: true, spec: { type, title, labels, series, unit, source } };
}

// ---- Geometry helpers --------------------------------------------------------

/** Samples a function; NaN/∞ and asymptote jumps split the curve into segments. */
export function sampleFunction(
  fn: (x: number) => number,
  xmin: number,
  xmax: number,
  samples = SAMPLES,
): { x: number; y: number }[][] {
  const segments: { x: number; y: number }[][] = [];
  let current: { x: number; y: number }[] = [];
  for (let i = 0; i <= samples; i += 1) {
    const x = xmin + ((xmax - xmin) * i) / samples;
    let y: number;
    try {
      y = fn(x);
    } catch {
      y = NaN;
    }
    if (!Number.isFinite(y) || Math.abs(y) > 1e9) {
      if (current.length > 1) segments.push(current);
      current = [];
      continue;
    }
    current.push({ x, y });
  }
  if (current.length > 1) segments.push(current);
  return segments;
}

/** Y range from sampled points, ignoring asymptote spikes (2%–98% quantiles). */
export function autoRange(values: number[]): [number, number] {
  const finite = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (finite.length === 0) return [-1, 1];
  const lo = finite[Math.floor(finite.length * 0.02)];
  const hi = finite[Math.min(finite.length - 1, Math.ceil(finite.length * 0.98) - 1)];
  let min = Math.min(lo, 0 < lo && lo < (hi - lo) * 0.25 ? 0 : lo);
  let max = Math.max(hi, hi < 0 && -hi < (hi - lo) * 0.25 ? 0 : hi);
  if (max - min < 1e-9) {
    min -= 1;
    max += 1;
  }
  const pad = (max - min) * 0.08;
  return [min - pad, max + pad];
}

/** Round tick values ("nice numbers") for an axis. */
export function niceTicks(min: number, max: number, target = 6): number[] {
  const span = max - min;
  if (!(span > 0)) return [min];
  const raw = span / target;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= target) ?? 10 * mag;
  const ticks: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-9; v += step) {
    ticks.push(Math.abs(v) < step * 1e-9 ? 0 : Number(v.toPrecision(12)));
  }
  return ticks;
}

export function formatTick(v: number) {
  if (v === 0) return "0";
  const abs = Math.abs(v);
  if (abs >= 1e5 || abs < 1e-3) return v.toExponential(1).replace("e+", "e");
  return Number(v.toPrecision(4)).toLocaleString("es-AR");
}

export const CHART_COLORS = ["#3ee6f0", "#3ecf8e", "#f0b43e", "#e85d4c", "#5b8def", "#b07cf0"];
