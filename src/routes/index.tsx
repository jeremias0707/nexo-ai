import { createFileRoute } from "@tanstack/react-router";
import { AccessGate } from "@/components/nexo/access-gate";
import { NexoApp } from "@/components/nexo/app";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return (
    <AccessGate>
      <NexoApp />
    </AccessGate>
  );
}
