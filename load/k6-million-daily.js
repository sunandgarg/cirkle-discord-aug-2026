import http from "k6/http";
import { check } from "k6";

const baseUrl = __ENV.BASE_URL;
if (!baseUrl) throw new Error("BASE_URL is required");

export const options = {
  scenarios: {
    public_traffic: {
      executor: "constant-arrival-rate",
      rate: Number(__ENV.REQUESTS_PER_SECOND || 100),
      timeUnit: "1s",
      duration: __ENV.DURATION || "10m",
      preAllocatedVUs: 100,
      maxVUs: 500,
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<500", "p(99)<1000"],
  },
};

export default function () {
  const response = http.get(`${baseUrl}/`, {
    tags: { route: "landing" },
    headers: { Accept: "text/html" },
  });
  check(response, {
    "landing returns 200": (result) => result.status === 200,
    "landing has content": (result) => result.body.length > 500,
  });
}
