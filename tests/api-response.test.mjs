import assert from "node:assert/strict";
import test from "node:test";

import { ApiClientError, parseApiEnvelope } from "../lib/client/api-response.ts";

test("returns typed API data from a success envelope", () => {
  assert.deepEqual(
    parseApiEnvelope(201, { data: { id: "pay_1" }, requestId: "req_1" }, "header-request"),
    { id: "pay_1" },
  );
});

test("keeps a failed request id while mapping the client message safely", () => {
  assert.throws(
    () => parseApiEnvelope(409, { error: { code: "PAYMENT_STATE_CONFLICT", message: "internal state details" }, requestId: "req_2" }, "header-request"),
    (error) => error instanceof ApiClientError && error.requestId === "req_2" && error.message === "This payment is no longer available for that action.",
  );
});
