import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MermaidDiagram } from "@/components/nexo/diagram";
import { decodeDiagram } from "@/lib/diagram-link";

export const Route = createFileRoute("/diagrama")({
  head: () => ({ meta: [{ title: "Diagrama · NEXO AI" }, { name: "robots", content: "noindex" }] }),
  component: DiagramPage,
});

/** Full-screen diagram viewer used by the Android app (code comes in the URL hash). */
function DiagramPage() {
  const [code, setCode] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    const read = () => setCode(decodeDiagram(window.location.hash));
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);
  return (
    <main className="mx-auto min-h-dvh max-w-4xl px-4 py-5">
      <header className="flex items-center justify-between border-b border-line pb-3">
        <a href="/" className="font-display text-sm tracking-widest text-neon uppercase">
          NEXO AI
        </a>
        <span className="font-mono text-xs text-muted">Diagrama</span>
      </header>
      {code === undefined ? null : code ? (
        <>
          <MermaidDiagram code={code} />
          <p className="mt-4 font-mono text-xs text-faint">
            Tocá «Ampliar» para hacer zoom o «Descargar» para guardarlo como imagen.
          </p>
        </>
      ) : (
        <p className="mt-6 text-muted">No encontré ningún diagrama en este enlace. Volvé a la app y tocá «Ver diagrama».</p>
      )}
    </main>
  );
}
