import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { DiagramBlock } from "@/components/nexo/diagram";

type HastNode = { type: string; value?: string; tagName?: string; properties?: Record<string, unknown>; children?: HastNode[] };

function hastText(node: HastNode | undefined): string {
  if (!node) return "";
  if (node.type === "text") return node.value ?? "";
  return (node.children ?? []).map(hastText).join("");
}

/** Returns the diagram kind of a fenced block (```mermaid / ```grafico), if any. */
function diagramOf(node: HastNode | undefined) {
  const code = node?.children?.find((child) => child.tagName === "code");
  const classes = code?.properties?.className;
  const list = Array.isArray(classes) ? classes.map(String) : [];
  if (list.includes("language-mermaid")) return { kind: "mermaid" as const, code: hastText(code) };
  if (list.some((c) => ["language-grafico", "language-gráfico", "language-chart"].includes(c))) {
    return { kind: "grafico" as const, code: hastText(code) };
  }
  return null;
}

function makeComponents(streaming: boolean): Components {
  return {
    ...components,
    pre: ({ node, children }) => {
      const diagram = diagramOf(node as HastNode | undefined);
      if (diagram) return <DiagramBlock kind={diagram.kind} code={diagram.code} pending={streaming} />;
      return <pre className="mt-3 overflow-x-auto rounded-md border border-line bg-bg-soft p-4">{children}</pre>;
    },
  };
}

const components: Components = {
  h1: ({ children }) => (
    <h2 className="mt-6 font-serif text-2xl leading-tight text-fg first:mt-0">{children}</h2>
  ),
  h2: ({ children }) => (
    <h2 className="mt-6 font-serif text-2xl leading-tight text-fg first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-5 text-base font-semibold text-fg first:mt-0">{children}</h3>
  ),
  p: ({ children }) => <p className="mt-3 leading-relaxed text-fg first:mt-0">{children}</p>,
  ul: ({ children }) => <ul className="mt-3 list-disc space-y-1 pl-5 text-fg">{children}</ul>,
  ol: ({ children }) => <ol className="mt-3 list-decimal space-y-1 pl-5 text-fg">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="mt-3 border-l border-line-strong pl-4 text-muted">{children}</blockquote>
  ),
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noreferrer" className="underline decoration-line-strong underline-offset-4">
      {children}
    </a>
  ),
  strong: ({ children }) => <strong className="font-semibold text-paper">{children}</strong>,
  code: ({ className, children }) => {
    const text = String(children);
    const fenced = Boolean(className) || text.includes("\n");
    if (!fenced) {
      return <code className="rounded-sm bg-bg-soft px-1.5 py-0.5 font-mono text-sm text-paper">{children}</code>;
    }
    return <code className={`font-mono text-sm text-fg ${className ?? ""}`}>{children}</code>;
  },
  pre: ({ children }) => (
    <pre className="mt-3 overflow-x-auto rounded-md border border-line bg-bg-soft p-4">{children}</pre>
  ),
  hr: () => <hr className="my-6 border-line" />,
  table: ({ children }) => (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border-b border-line px-2 py-2 font-medium text-fg">{children}</th>,
  td: ({ children }) => <td className="border-b border-line px-2 py-2 text-muted">{children}</td>,
};

const doneComponents = makeComponents(false);
const streamingComponents = makeComponents(true);

export function Lesson({ content, streaming = false }: { content: string; streaming?: boolean }) {
  return (
    <div className="lesson text-base">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: "ignore" }]]}
        components={streaming ? streamingComponents : doneComponents}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
