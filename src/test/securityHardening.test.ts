import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("privileged edge-function guards", () => {
  it.each([
    "supabase/functions/create-consult-chat/index.ts",
    "supabase/functions/seed-data/index.ts",
  ])("authenticates callers in %s", (path) => {
    const code = source(path);
    expect(code).toContain('req.headers.get("Authorization")');
    expect(code).toContain("auth.getUser()");
    expect(code).toContain('status: 401');
  });

  it("requires consultation membership before service-role writes", () => {
    const code = source("supabase/functions/create-consult-chat/index.ts");
    expect(code).toContain("consult.client_id !== user.id");
    expect(code).toContain("consult.consultant_id !== user.id");
    expect(code).toContain('status: 403');
  });

  it("requires an admin role before seeding", () => {
    const code = source("supabase/functions/seed-data/index.ts");
    expect(code).toContain('.eq("role", "admin")');
    expect(code).toContain('status: 403');
  });

  it("ships a database-level anonymous-author mask and normalized reads", () => {
    const sql = source("supabase/migrations/202608120001_production_hardening.sql");
    expect(sql).toContain("create or replace view public.forum_posts_public");
    expect(sql).toContain("when p.is_anonymous and p.author_id <> auth.uid() then null");
    expect(sql).toContain("create table if not exists public.message_reads");
    expect(sql).toContain("primary key (post_id, user_id)");
    expect(sql).toContain("create trigger enforce_forum_post_rate_limit");
  });

  it("keeps room creation server-managed and cohort-assigned", () => {
    const sql = source("supabase/migrations/202608120003_managed_chat_rooms.sql");
    expect(sql).toContain("revoke insert, update, delete on public.chat_rooms from anon, authenticated");
    expect(sql).toContain("revoke insert, update, delete on public.chat_members from anon, authenticated");
    expect(sql).toContain("revoke execute on function public.create_group_room(text, uuid[]) from authenticated");
    expect(sql).toContain("create or replace function public.sync_user_assigned_chat_rooms");
    expect(sql).toContain("after insert or update of institution, degree, branch_area, passing_year or delete on public.education");
  });
});
