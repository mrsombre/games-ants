import { describe, expect, it } from "vitest";
import { setupApp } from "./app";

describe("backend HTTP routing", () => {
  it("serves the public health endpoint without credentials", async () => {
    const response = await setupApp().request("/api/health");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(await response.json()).toEqual({ status: "ok", app: "games-ants" });
  });

  it("returns JSON 404 for unknown API routes, including document requests", async () => {
    const response = await setupApp().request("/api/missing", {
      headers: { Accept: "text/html", "Sec-Fetch-Mode": "navigate" },
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "not_found" });
  });

  it("does not accept writes to the health endpoint", async () => {
    const response = await setupApp().request("/api/health", { method: "POST" });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "not_found" });
  });
});
