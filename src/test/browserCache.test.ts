import { describe, expect, it } from "vitest";
import { mergeById } from "@/lib/browserCache";

describe("browser cache merging", () => {
  it("deduplicates realtime and optimistic messages while preserving order", () => {
    const result = mergeById(
      [{ id: "2", created_at: "2026-01-02", status: "sending" }],
      [
        { id: "1", created_at: "2026-01-01", status: "sent" },
        { id: "2", created_at: "2026-01-02", status: "sent" },
      ],
    );
    expect(result.map((message) => message.id)).toEqual(["1", "2"]);
    expect(result[1].status).toBe("sent");
  });
});
