import type { ApiError } from "@app/common/api/health";
import { Hono } from "hono";
import { healthRoutes } from "./health/routes";

export function setupApp() {
  const app = new Hono<{ Bindings: Env }>();

  app.route("/api/health", healthRoutes);
  app.notFound((context) => context.json({ error: "not_found" } satisfies ApiError, 404));

  return app;
}
