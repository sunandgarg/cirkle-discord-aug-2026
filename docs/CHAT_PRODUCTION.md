# Chat production notes

The chat client keeps the latest 200 messages per room in IndexedDB, reads only 50 messages at a time, uses cursor pagination, and receives new messages through Realtime. Room summaries and unread counts are maintained once in `chat_room_state`, avoiding the former per-room query fan-out.

Images are resized in the browser, encoded as WebP, and stored in the private `chat-media` bucket with immutable object caching. The database stores only the media path. Access uses short-lived signed URLs.

Direct and group room creation is transactional and connection-gated in database functions. Message writes are membership-checked, idempotent through `client_message_id`, rate-limited, and indexed for room cursor reads. Read receipts are normalized instead of rewriting an array on every message.

## Capacity verification

One million daily visits is about 11.6 visits/second on average, but chat must be sized for peak concurrent connections and messages/second. Do not promise a concurrency number from code review alone. Apply the migration to a staging clone, configure Supabase Realtime/database capacity, and run the included k6 workload while monitoring database CPU, connections, locks, WAL, Realtime lag, storage egress, p95/p99 latency, and error rate.

```sh
SUPABASE_URL=... SUPABASE_ANON_KEY=... CHAT_USERS_JSON='[{"jwt":"...","userId":"...","roomId":"..."}]' \
CHAT_RATE=200 CHAT_DURATION=5m k6 run load/k6-chat.js
```

Supply enough dedicated users to stay below the per-user rate limit (120 messages/minute), then increase the arrival rate in stages. The supplied thresholds require under 1% failures, p95 below 500 ms, and p99 below 1 second. Delete load-test data after the run.
