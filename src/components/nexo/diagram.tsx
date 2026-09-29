import { Download, Maximize2, Minus, Plus, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChartView } from "@/components/nexo/chart";
import { parseGrafico } from "@/lib/grafico";

/**
 * Renders ```mermaid and ```grafico blocks. Mermaid is lazy-loaded the first
 * time a diagram shows up, so it never weighs on the first page load.
 */

export type DiagramKind = "mermaid" | "grafico";

const FONT = '"Chakra Petch", "IBM Plex Mono", ui-monospace, sans-serif';
const DARK_SCALE = ["#0f3a3d", "#123427", "#1a2747", "#3a1d19", "#3a3014", "#2a1d42"];

type MermaidApi = typeof import("mermaid").default;
let mermaidPromise: Promise<MermaidApi> | null = null;
let renderCount = 0;

function loadMermaid() {
  mermaidPromise ??= import("mermaid").then(({ default: mermaid }) => {
    const scale: Record<string, string> = {};
    for (let i = 0; i < 12; i += 1) {
      scale[`cScale${i}`] = DARK_SCALE[i % DARK_SCALE.length];
      scale[`cScaleLabel${i}`] = "#f4f4f2";
      scale[`cScalePeer${i}`] = "#3ee6f0";
    }
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme: "base",
      htmlLabels: false,
      suppressErrorRendering: true,
      fontFamily: FONT,
      flowchart: { curve: "basis", padding: 12 },
      themeVariables: {
        darkMode: true,
        fontFamily: FONT,
        fontSize: "15px",
        background: "#0e0e0e",
        primaryColor: "#0b1f21",
        primaryTextColor: "#f4f4f2",
        primaryBorderColor: "#3ee6f0",
        secondaryColor: "#10161f",
        secondaryTextColor: "#f4f4f2",
        secondaryBorderColor: "#ffffff3d",
        tertiaryColor: "#161616",
        tertiaryTextColor: "#f4f4f2",
        tertiaryBorderColor: "#ffffff3d",
        mainBkg: "#0b1f21",
        nodeBorder: "#3ee6f0",
        nodeTextColor: "#f4f4f2",
        textColor: "#f4f4f2",
        titleColor: "#f4f4f2",
        lineColor: "#3ee6f0",
        clusterBkg: "#0e0e0e",
        clusterBorder: "#ffffff3d",
        edgeLabelBackground: "#0e0e0e",
        actorBkg: "#0b1f21",
        actorBorder: "#3ee6f0",
        actorTextColor: "#f4f4f2",
        actorLineColor: "#ffffff3d",
        signalColor: "#3ee6f0",
        signalTextColor: "#f4f4f2",
        labelBoxBkgColor: "#0b1f21",
        labelBoxBorderColor: "#3ee6f0",
        labelTextColor: "#f4f4f2",
        loopTextColor: "#f4f4f2",
        noteBkgColor: "#161616",
        noteTextColor: "#f4f4f2",
        noteBorderColor: "#ffffff3d",
        activationBkgColor: "#123427",
        activationBorderColor: "#3ecf8e",
        sequenceNumberColor: "#050505",
        git0: "#3ee6f0",
        gitBranchLabel0: "#050505",
        ...scale,
      },
    });
    return mermaid;
  });
  return mermaidPromise;
}

async function renderMermaid(code: string): Promise<string> {
  const mermaid = await loadMermaid();
  await mermaid.parse(code);
  renderCount += 1;
  const { svg } = await mermaid.render(`nexo-mmd-${renderCount}`, code);
  return fixCircleLabels(svg);
}

/** Mermaid (SVG labels) leaves text in circle nodes left-aligned; center it. */
function fixCircleLabels(svg: string) {
  if (!svg.includes("<circle") || typeof DOMParser === "undefined") return svg;
  const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
  let changed = false;
  doc.querySelectorAll("g.node").forEach((node) => {
    const shape = Array.from(node.children).find((child) => child.tagName !== "g");
    const label = node.querySelector(":scope > g.label");
    if (shape?.tagName !== "circle" || !label) return;
    if (!/translate\(0[ ,]/.test(label.getAttribute("transform") ?? "")) return;
    label.querySelectorAll("text").forEach((text) => text.setAttribute("text-anchor", "middle"));
    changed = true;
  });
  return changed ? new XMLSerializer().serializeToString(doc.documentElement) : svg;
}

function mermaidError(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  const line = /line (\d+)/i.exec(raw)?.[1];
  return line
    ? `No pude dibujar este diagrama (hay un error cerca de la línea ${line}). Te dejo el código.`
    : "No pude dibujar este diagrama. Te dejo el código.";
}

function CodeFallback({ code, error }: { code: string; error: string }) {
  return (
    <div className="diagram-card mt-3">
      <p className="px-4 pt-3 font-mono text-xs text-accent-r" role="alert">
        {error}
      </p>
      <pre className="overflow-x-auto p-4 pt-2 font-mono text-sm text-muted">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function svgToPng(svg: SVGSVGElement): Promise<Blob | null> {
  const box = svg.viewBox.baseVal;
  const rect = svg.getBoundingClientRect();
  const width = box && box.width ? box.width : rect.width;
  const height = box && box.height ? box.height : rect.height;
  const scale = Math.max(2, Math.min(4, 2000 / Math.max(width, 1)));
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.style.maxWidth = "none";
  const source = new XMLSerializer().serializeToString(clone);
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`;
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(width * scale);
        canvas.height = Math.round(height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(null);
        ctx.fillStyle = "#0e0e0e";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => resolve(blob), "image/png");
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

async function downloadSvg(svg: SVGSVGElement, base: string) {
  const png = await svgToPng(svg);
  if (png) return saveBlob(png, `${base}.png`);
  // Canvas refused (tainted or unsupported): save the vector file instead.
  const source = new XMLSerializer().serializeToString(svg);
  saveBlob(new Blob([source], { type: "image/svg+xml" }), `${base}.svg`);
}

function ZoomModal({ markup, title, onClose }: { markup: string; title: string; onClose: () => void }) {
  const [zoom, setZoom] = useState(1);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);
  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col bg-bg" role="dialog" aria-modal="true" aria-label={title}>
      <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
        <span className="truncate font-display text-xs tracking-widest text-neon uppercase">{title}</span>
        <span className="flex items-center gap-1">
          <button type="button" className="tap hud-btn flex size-11 items-center justify-center" aria-label="Alejar" onClick={() => setZoom((z) => Math.max(0.5, z - 0.5))}>
            <Minus className="size-4" strokeWidth={1.75} />
          </button>
          <span className="w-12 text-center font-mono text-xs text-muted">{Math.round(zoom * 100)}%</span>
          <button type="button" className="tap hud-btn flex size-11 items-center justify-center" aria-label="Acercar" onClick={() => setZoom((z) => Math.min(4, z + 0.5))}>
            <Plus className="size-4" strokeWidth={1.75} />
          </button>
          <button type="button" className="tap hud-btn flex size-11 items-center justify-center" aria-label="Cerrar" onClick={onClose}>
            <X className="size-4" strokeWidth={1.75} />
          </button>
        </span>
      </div>
      <div className="flex-1 overflow-auto p-4">
        <div
          className="diagram-svg mx-auto"
          style={{ width: `${zoom * 100}%`, minWidth: `${zoom * 100}%` }}
          // Mermaid output is sanitized by mermaid (securityLevel strict); charts are our own SVG.
          dangerouslySetInnerHTML={{ __html: markup }}
        />
      </div>
    </div>,
    document.body,
  );
}

function DiagramFrame({
  label,
  title,
  children,
  fileBase,
}: {
  label: string;
  title?: string;
  children: React.ReactNode;
  fileBase: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [zoomed, setZoomed] = useState<string | null>(null);
  const svg = () => ref.current?.querySelector("svg") ?? null;
  return (
    <figure className="diagram-card mt-3">
      <figcaption className="flex items-center justify-between gap-2 border-b border-line py-1 pr-1 pl-3">
        <span className="min-w-0 truncate font-display text-xs tracking-widest text-neon uppercase">
          {label}
        </span>
        <span className="flex shrink-0 items-center">
          <button
            type="button"
            className="tap hud-btn flex h-11 items-center gap-1.5 px-2 text-xs text-faint"
            onClick={() => {
              const node = svg();
              if (node) setZoomed(node.outerHTML);
            }}
          >
            <Maximize2 className="size-3.5" strokeWidth={1.75} />
            Ampliar
          </button>
          <button
            type="button"
            className="tap hud-btn flex h-11 items-center gap-1.5 px-2 text-xs text-faint"
            onClick={() => {
              const node = svg();
              if (node) void downloadSvg(node, fileBase);
            }}
          >
            <Download className="size-3.5" strokeWidth={1.75} />
            Descargar
          </button>
        </span>
      </figcaption>
      {title ? <p className="px-3 pt-3 text-sm leading-snug font-medium text-fg">{title}</p> : null}
      <div ref={ref} className="diagram-svg overflow-x-auto p-3">
        {children}
      </div>
      {zoomed ? <ZoomModal markup={zoomed} title={title ?? label} onClose={() => setZoomed(null)} /> : null}
    </figure>
  );
}

function naturalWidth(svg: string) {
  const box = /viewBox="[-\d.]+ [-\d.]+ ([\d.]+) [\d.]+"/.exec(svg);
  return box ? Number(box[1]) : 0;
}

export function MermaidDiagram({ code }: { code: string }) {
  const [state, setState] = useState<{ svg?: string; error?: string }>({});
  useEffect(() => {
    let alive = true;
    setState({});
    renderMermaid(code).then(
      (svg) => alive && setState({ svg }),
      (error) => alive && setState({ error: mermaidError(error) }),
    );
    return () => {
      alive = false;
    };
  }, [code]);
  if (state.error) return <CodeFallback code={code} error={state.error} />;
  if (!state.svg) return <DiagramPending label="Dibujando diagrama" />;
  return (
    <DiagramFrame label="Diagrama" fileBase="nexo-diagrama">
      {/* Sanitized by mermaid (securityLevel: strict, DOMPurify). Wide diagrams keep
          a readable size and scroll sideways instead of shrinking to unreadable text. */}
      <div
        className="mermaid-out"
        style={{ minWidth: Math.min(naturalWidth(state.svg) * 0.72, 1600) || undefined }}
        dangerouslySetInnerHTML={{ __html: state.svg }}
      />
    </DiagramFrame>
  );
}

export function GraficoBlock({ code }: { code: string }) {
  const parsed = useMemo(() => parseGrafico(code), [code]);
  if (!parsed.ok) return <CodeFallback code={code} error={`No pude armar este gráfico: ${parsed.error}`} />;
  return (
    <DiagramFrame label="Gráfico" title={parsed.spec.title} fileBase="nexo-grafico">
      <ChartView spec={parsed.spec} />
    </DiagramFrame>
  );
}

export function DiagramPending({ label }: { label: string }) {
  return (
    <div className="diagram-card mt-3 flex h-24 items-center justify-center gap-2.5 font-mono text-xs tracking-widest text-muted uppercase">
      <span className="scan-bar" aria-hidden="true" />
      {label}
    </div>
  );
}

export function DiagramBlock({ kind, code, pending }: { kind: DiagramKind; code: string; pending?: boolean }) {
  if (pending) return <DiagramPending label={kind === "mermaid" ? "Preparando diagrama" : "Preparando gráfico"} />;
  return kind === "mermaid" ? <MermaidDiagram code={code.trim()} /> : <GraficoBlock code={code.trim()} />;
}
