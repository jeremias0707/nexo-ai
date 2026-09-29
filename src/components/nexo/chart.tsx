import type { ChartSpec, FunctionSpec, PieSpec, SeriesSpec } from "@/lib/grafico";
import { CHART_COLORS, autoRange, compileExpr, formatTick, niceTicks, sampleFunction } from "@/lib/grafico";

/** Pure SVG charts for ```grafico blocks (no chart library, nothing to download). */

const W = 520;
const H = 330;
const PAD = { l: 50, r: 14, t: 16, b: 36 };
const TEXT = "#8d8d8a";
const GRID = "#ffffff14";
const AXIS = "#ffffff52";
const FONT = '"IBM Plex Mono", ui-monospace, monospace';

const color = (index: number) => CHART_COLORS[index % CHART_COLORS.length];

function Frame({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={label}
      xmlns="http://www.w3.org/2000/svg"
      className="block h-auto w-full"
      style={{ fontFamily: FONT }}
    >
      <rect width={W} height={H} fill="#0e0e0e" />
      {children}
    </svg>
  );
}

function Legend({ items, y }: { items: { name: string; color: string }[]; y: number }) {
  let x = PAD.l;
  return (
    <g fontSize={14} fill="#f4f4f2">
      {items.map((item) => {
        const at = x;
        x += Math.min(200, 30 + item.name.length * 8.5);
        return (
          <g key={item.name + at} transform={`translate(${at} ${y})`}>
            <rect width={14} height={4} y={-5} rx={2} fill={item.color} />
            <text x={20}>{item.name}</text>
          </g>
        );
      })}
    </g>
  );
}

function FunctionChart({ spec }: { spec: FunctionSpec }) {
  const curves = spec.exprs.map((item) => sampleFunction(compileExpr(item.expr), spec.xmin, spec.xmax));
  const auto = autoRange(curves.flat(2).map((point) => point.y));
  const ymin = spec.ymin ?? auto[0];
  const ymax = spec.ymax ?? auto[1];
  const legendRows = spec.exprs.length > 0 ? 22 : 0;
  const plot = { x0: PAD.l, x1: W - PAD.r, y0: PAD.t, y1: H - PAD.b - legendRows };
  const sx = (x: number) => plot.x0 + ((x - spec.xmin) / (spec.xmax - spec.xmin)) * (plot.x1 - plot.x0);
  const sy = (y: number) => plot.y1 - ((y - ymin) / (ymax - ymin)) * (plot.y1 - plot.y0);
  const xticks = niceTicks(spec.xmin, spec.xmax, 7);
  const yticks = niceTicks(ymin, ymax, 6);
  const clipId = `clip-${Math.abs(hash(JSON.stringify(spec)))}`;
  return (
    <Frame label={spec.title ?? "Gráfico de función"}>
      <defs>
        <clipPath id={clipId}>
          <rect x={plot.x0} y={plot.y0} width={plot.x1 - plot.x0} height={plot.y1 - plot.y0} />
        </clipPath>
      </defs>
      {xticks.map((t) => (
        <g key={`x${t}`}>
          <line x1={sx(t)} x2={sx(t)} y1={plot.y0} y2={plot.y1} stroke={GRID} />
          <text x={sx(t)} y={plot.y1 + 20} fontSize={14} fill={TEXT} textAnchor="middle">
            {formatTick(t)}
          </text>
        </g>
      ))}
      {yticks.map((t) => (
        <g key={`y${t}`}>
          <line x1={plot.x0} x2={plot.x1} y1={sy(t)} y2={sy(t)} stroke={GRID} />
          <text x={plot.x0 - 8} y={sy(t) + 4} fontSize={14} fill={TEXT} textAnchor="end">
            {formatTick(t)}
          </text>
        </g>
      ))}
      {ymin <= 0 && ymax >= 0 ? <line x1={plot.x0} x2={plot.x1} y1={sy(0)} y2={sy(0)} stroke={AXIS} /> : null}
      {spec.xmin <= 0 && spec.xmax >= 0 ? (
        <line x1={sx(0)} x2={sx(0)} y1={plot.y0} y2={plot.y1} stroke={AXIS} />
      ) : null}
      <g clipPath={`url(#${clipId})`} fill="none" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round">
        {curves.map((segments, index) =>
          segments.map((segment, part) => (
            <polyline
              key={`${index}-${part}`}
              stroke={color(index)}
              points={segment
                .map((point) => `${sx(point.x).toFixed(1)},${sy(Math.max(ymin - (ymax - ymin), Math.min(ymax + (ymax - ymin), point.y))).toFixed(1)}`)
                .join(" ")}
            />
          )),
        )}
      </g>
      <Legend items={spec.exprs.map((item, index) => ({ name: item.name, color: color(index) }))} y={H - 10} />
    </Frame>
  );
}

function SeriesChart({ spec }: { spec: SeriesSpec }) {
  const values = spec.series.flatMap((s) => s.values);
  let min = Math.min(0, ...values);
  let max = Math.max(0, ...values);
  if (spec.type === "lineas" && values.length > 0) {
    [min, max] = autoRange(values);
    if (Math.min(...values) >= 0 && min < 0) min = 0;
  }
  if (max === min) max = min + 1;
  const ticks = niceTicks(min, max, 5);
  min = Math.min(min, ticks[0] ?? min);
  max = Math.max(max, ticks[ticks.length - 1] ?? max);
  const legend = spec.series.length > 1 || spec.source ? 22 : 0;
  const many = spec.labels.length > 6;
  const plot = { x0: PAD.l, x1: W - PAD.r, y0: PAD.t, y1: H - PAD.b - legend - (many ? 20 : 0) };
  const sy = (v: number) => plot.y1 - ((v - min) / (max - min)) * (plot.y1 - plot.y0);
  const band = (plot.x1 - plot.x0) / spec.labels.length;
  const cx = (i: number) => plot.x0 + band * (i + 0.5);
  const groupWidth = band * 0.72;
  const barWidth = groupWidth / spec.series.length;
  const unit = spec.unit ? ` ${spec.unit}` : "";
  return (
    <Frame label={spec.title ?? "Gráfico"}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={plot.x0} x2={plot.x1} y1={sy(t)} y2={sy(t)} stroke={t === 0 ? AXIS : GRID} />
          <text x={plot.x0 - 8} y={sy(t) + 4} fontSize={14} fill={TEXT} textAnchor="end">
            {formatTick(t)}
          </text>
        </g>
      ))}
      {spec.labels.map((label, i) => (
        <text
          key={label + i}
          fontSize={14}
          fill={TEXT}
          textAnchor={many ? "end" : "middle"}
          transform={
            many ? `translate(${cx(i)} ${plot.y1 + 14}) rotate(-35)` : `translate(${cx(i)} ${plot.y1 + 18})`
          }
        >
          {label.length > 12 ? `${label.slice(0, 11)}…` : label}
        </text>
      ))}
      {spec.type === "barras"
        ? spec.series.map((s, si) =>
            s.values.map((v, i) => {
              const x = cx(i) - groupWidth / 2 + barWidth * si;
              const top = sy(Math.max(v, 0));
              return (
                <g key={`${si}-${i}`}>
                  <rect
                    x={x + 1}
                    y={top}
                    width={Math.max(2, barWidth - 2)}
                    height={Math.max(1, Math.abs(sy(v) - sy(0)))}
                    fill={color(si)}
                    fillOpacity={0.85}
                    rx={2}
                  >
                    <title>{`${s.name} · ${spec.labels[i]}: ${formatTick(v)}${unit}`}</title>
                  </rect>
                  {spec.series.length === 1 && spec.labels.length <= 10 ? (
                    <text x={x + barWidth / 2} y={top - 6} fontSize={14} fill="#f4f4f2" textAnchor="middle">
                      {formatTick(v)}
                    </text>
                  ) : null}
                </g>
              );
            }),
          )
        : spec.series.map((s, si) => (
            <g key={si}>
              <polyline
                fill="none"
                stroke={color(si)}
                strokeWidth={2.5}
                strokeLinejoin="round"
                points={s.values.map((v, i) => `${cx(i).toFixed(1)},${sy(v).toFixed(1)}`).join(" ")}
              />
              {s.values.map((v, i) => (
                <circle key={i} cx={cx(i)} cy={sy(v)} r={3.5} fill="#0e0e0e" stroke={color(si)} strokeWidth={2}>
                  <title>{`${s.name} · ${spec.labels[i]}: ${formatTick(v)}${unit}`}</title>
                </circle>
              ))}
            </g>
          ))}
      {legend ? (
        <>
          <Legend items={spec.series.length > 1 ? spec.series.map((s, i) => ({ name: s.name, color: color(i) })) : []} y={H - 10} />
          {spec.source ? (
            <text x={W - PAD.r} y={H - 10} fontSize={12} fill={TEXT} textAnchor="end">
              Fuente: {spec.source}
            </text>
          ) : null}
        </>
      ) : null}
    </Frame>
  );
}

function PieChart({ spec }: { spec: PieSpec }) {
  const total = spec.values.reduce((a, b) => a + b, 0);
  const r = 108;
  const c = { x: 128, y: H / 2 - (spec.source ? 8 : 0) };
  let angle = -Math.PI / 2;
  const slices = spec.values.map((v, i) => {
    const start = angle;
    const sweep = (v / total) * Math.PI * 2;
    angle += sweep;
    return { v, i, start, end: angle, sweep };
  });
  const pt = (a: number, radius = r) => `${(c.x + Math.cos(a) * radius).toFixed(2)},${(c.y + Math.sin(a) * radius).toFixed(2)}`;
  const unit = spec.unit ? ` ${spec.unit}` : "";
  return (
    <Frame label={spec.title ?? "Gráfico de torta"}>
      {slices.map((s) =>
        s.sweep >= Math.PI * 2 - 1e-6 ? (
          <circle key={s.i} cx={c.x} cy={c.y} r={r} fill={color(s.i)} fillOpacity={0.85} />
        ) : (
          <path
            key={s.i}
            d={`M${c.x},${c.y} L${pt(s.start)} A${r},${r} 0 ${s.sweep > Math.PI ? 1 : 0} 1 ${pt(s.end)} Z`}
            fill={color(s.i)}
            fillOpacity={0.85}
            stroke="#0e0e0e"
            strokeWidth={2}
          >
            <title>{`${spec.labels[s.i]}: ${formatTick(s.v)}${unit}`}</title>
          </path>
        ),
      )}
      <circle cx={c.x} cy={c.y} r={r * 0.45} fill="#0e0e0e" />
      <g fontSize={14}>
        {slices.map((s, row) => {
          const y = 40 + row * Math.min(30, (H - 70) / slices.length);
          return (
            <g key={s.i} transform={`translate(262 ${y})`}>
              <rect width={12} height={12} y={-10} rx={2} fill={color(s.i)} />
              <text x={20} fill="#f4f4f2">
                {spec.labels[s.i].length > 16 ? `${spec.labels[s.i].slice(0, 15)}…` : spec.labels[s.i]}
              </text>
              <text x={244} fill={TEXT} textAnchor="end">
                {`${((s.v / total) * 100).toLocaleString("es-AR", { maximumFractionDigits: 1 })}%`}
              </text>
            </g>
          );
        })}
      </g>
      {spec.source ? (
        <text x={W - PAD.r} y={H - 10} fontSize={12} fill={TEXT} textAnchor="end">
          Fuente: {spec.source}
        </text>
      ) : null}
    </Frame>
  );
}

function hash(text: string) {
  let h = 0;
  for (let i = 0; i < text.length; i += 1) h = (h * 31 + text.charCodeAt(i)) | 0;
  return h;
}

export function ChartView({ spec }: { spec: ChartSpec }) {
  if (spec.type === "funcion") return <FunctionChart spec={spec} />;
  if (spec.type === "torta") return <PieChart spec={spec} />;
  return <SeriesChart spec={spec} />;
}
