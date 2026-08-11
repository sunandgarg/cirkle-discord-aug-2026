import http from "k6/http";
import { check } from "k6";

const rate = Number(__ENV.CHAT_RATE || 200);
const users = JSON.parse(__ENV.CHAT_USERS_JSON || "[]");

export const options = {
  scenarios: {
    chat_messages: {
      executor: "constant-arrival-rate",
      rate,
      timeUnit: "1s",
      duration: __ENV.CHAT_DURATION || "2m",
      preAllocatedVUs: Number(__ENV.CHAT_VUS || 100),
      maxVUs: Number(__ENV.CHAT_MAX_VUS || 1000),
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<500", "p(99)<1000"],
  },
};

function uuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    return (character === "x" ? random : (random & 3) | 8).toString(16);
  });
}

export default function () {
  const user = users[(__VU - 1) % users.length];
  if (!user) throw new Error("CHAT_USERS_JSON must contain authenticated test users");
  const response = http.post(
    `${__ENV.SUPABASE_URL}/rest/v1/messages`,
    JSON.stringify({
      room_id: user.roomId,
      sender_id: user.userId,
      client_message_id: uuid(),
      content: `load-test-${__VU}-${__ITER}`,
      status: "sent",
      read_by: [user.userId],
    }),
    {
      headers: {
        apikey: __ENV.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${user.jwt}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
    },
  );
  check(response, { "message accepted": (result) => result.status === 201 });
}
