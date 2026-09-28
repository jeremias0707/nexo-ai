import { createFileRoute } from "@tanstack/react-router";
import { NexoApp } from "@/components/nexo/app";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return <NexoApp />;
}
