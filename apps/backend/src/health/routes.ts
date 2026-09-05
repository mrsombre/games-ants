import type { HealthResponse } from "@app/common/api/health";
import { Hono } from "hono";

export const healthRoutes = new Hono<{ Bindings: Env }>().get("/", (context) =>
  context.json({ status: "ok", app: "games-ants" } satisfies HealthResponse),
);
