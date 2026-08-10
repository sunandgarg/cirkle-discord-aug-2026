# Daily.co Calls — Browser E2E Test Plan

Manual test plan. Each step has explicit pass/fail criteria. Run in two browsers (or one browser + one private window) with two different test accounts to cover 1:1 and group cases.

## Setup
- Account A: phone `9999999999`, OTP `123456`, email `test@iitb.ac.in`, code `123456`
- Account B: any second IIT account in test mode
- Both accounts must be **connected** (Network → Add Friend) so a 1:1 chat room exists.

---

## Test 1 — Permission prompt UI
1. Open chat → tap 📞 (audio).
   - **Pass:** Modal shows "Allow microphone access" with mic icon, Cancel + Continue buttons.
   - **Fail:** Goes straight to Daily iframe without prompt.
2. Click Cancel → modal closes, no call started.
3. Tap 🎥 (video) → header reads "Allow camera & microphone access" with video icon. **Pass** if both icons referenced.

## Test 2 — Permission denied path
1. In browser settings, block mic/camera for the preview origin.
2. Click 🎥 → Continue.
   - **Pass:** Red "Permission required" screen with reason "You denied microphone/camera access…", Try again + Close.
   - **Fail:** Generic crash or blank iframe.

## Test 3 — No devices
1. Disable all audio/video inputs in OS settings.
2. Click 📞 → Continue.
   - **Pass:** "No microphone or camera found" screen.

## Test 4 — Token fetch failure
1. Temporarily revoke `DAILY_API_KEY` (or block edge function in DevTools network).
2. Continue past permission.
   - **Pass:** "Call failed" screen with the upstream message; Retry button visible.
   - **DB check:** `SELECT failure_reason FROM call_sessions ORDER BY started_at DESC LIMIT 1` shows the reason.

## Test 5 — 1:1 happy path
1. Account A starts video call. Allow permissions.
2. Account B opens the same chat → also taps 🎥 → joins.
   - **Pass:** Both see each other's video tiles, audio works both ways, screen-share button present.
3. Account A clicks Daily's Leave button.
   - **Pass:** Modal closes for A; B remains in call.
4. B leaves.
   - **DB check:** `SELECT participant_count, duration_seconds, ended_at FROM call_sessions ORDER BY started_at DESC LIMIT 1` → participant_count ≥ 2, duration_seconds > 0, ended_at not null.

## Test 6 — Group call (3+ participants)
1. Open a group chat with 3+ members.
2. Each member taps 🎥 within ~30s.
   - **Pass:** All tiles visible; Daily auto-arranges grid.
3. **DB check:** `SELECT * FROM call_participants WHERE session_id = '<id>'` shows one row per member with `joined_at` set.
4. Members leave one by one. Last leave finalizes the session row.

## Test 7 — Reconnection
1. While in a call, throttle network to "Offline" in DevTools for ~5s, then back to "Online".
   - **Pass:** Yellow "Reconnecting…" pill appears, then disappears; call resumes.

## Test 8 — Mobile safe-area
1. Open preview at iPhone 14 Pro viewport (393×852, devicePixelRatio 3).
2. Start a video call.
   - **Pass:** Modal respects notch/home-indicator (no Daily controls clipped); `env(safe-area-inset-*)` applied.

## Test 9 — RLS enforcement (security)
1. As Account C (not a member of room R), call the edge function manually:
   ```bash
   curl -X POST "$VITE_SUPABASE_URL/functions/v1/daily-create-room" \
     -H "Authorization: Bearer $C_JWT" \
     -H "Content-Type: application/json" \
     -d '{"roomId":"<R>","mode":"video"}'
   ```
   - **Pass:** HTTP 403 `{"error":"Forbidden: not a room member"}`.
   - **Pass:** No row inserted into `call_sessions` for C.

## Test 10 — Invalid input
1. Same curl with `roomId:"not-a-uuid"` → **Pass:** 400 "Invalid roomId".
2. With `mode:"text"` → **Pass:** 400 "mode must be audio|video".

---

## Observability dashboard query

```sql
SELECT
  r.name AS room,
  s.mode,
  s.started_at,
  s.duration_seconds,
  s.participant_count,
  s.failure_reason
FROM call_sessions s
JOIN chat_rooms r ON r.id = s.room_id
ORDER BY s.started_at DESC
LIMIT 50;
```
