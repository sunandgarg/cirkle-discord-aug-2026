import { describe, expect, it } from "vitest";
import { buildReadReceiptRows, visibleAuthorIds } from "@/lib/forumPrivacy";

describe("forum privacy", () => {
  it("never resolves anonymous authors to profiles", () => {
    expect(visibleAuthorIds([
      { author_id: "public-user", is_anonymous: false },
      { author_id: "secret-user", is_anonymous: true },
      { author_id: "public-user", is_anonymous: false },
      { author_id: null, is_anonymous: true },
    ])).toEqual(["public-user"]);
  });

  it("builds deduplicated normalized read receipts", () => {
    expect(buildReadReceiptRows(["post-1", "post-1", "post-2"], "user-1")).toEqual([
      { post_id: "post-1", user_id: "user-1" },
      { post_id: "post-2", user_id: "user-1" },
    ]);
  });
});
