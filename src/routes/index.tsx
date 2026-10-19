import { createFileRoute } from "@tanstack/react-router";
import { NexoApp } from "@/components/nexo/app";

export const Route = createFileRoute("/")({
  component: Home,
});

/** 3.0.2: no access-code screen; the app opens directly. */
function Home() {
  return <NexoApp />;
}
