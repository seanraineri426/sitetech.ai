import { describe, it, expect } from "vitest";
import { GET } from "../route";

describe("/api/health", () => {
  it("returns ok: true with 200 status", async () => {
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty("ok", true);
    expect(data).toHaveProperty("supabase");
    expect(data.supabase).toHaveProperty("configured");
    expect(typeof data.supabase.configured).toBe("boolean");
  });
});
