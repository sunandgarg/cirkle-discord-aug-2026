# Supabase production checklist

Before a production release:

1. Apply every file in `supabase/migrations` to staging, then production.
2. Confirm Row Level Security is enabled on every table exposed through the Data API.
3. Confirm the `anon` role cannot select `posts`, `profiles`, `verification_codes`, `verifications`, `user_roles`, `applications`, `consultations`, `chat_members`, or `messages`.
4. Confirm authenticated users read forum data through `forum_posts_public`; only moderators/admins may read anonymous authors from `posts`.
5. Confirm `create-consult-chat` and `seed-data` require a valid JWT. `seed-data` must return HTTP 403 for a non-admin.
6. Keep `seed-data` undeployed in production unless it is needed for a controlled operation; remove it immediately afterward.
7. Set allowed CORS origins to the production and staging domains before launch.
8. Enable point-in-time recovery, database backups, log drains, error alerts, and budget alerts.
9. Run the load test against staging with production-sized data and record p50/p95/p99 latency and database CPU/IO.
