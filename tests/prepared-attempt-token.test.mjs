import assert from "node:assert/strict";
import test from "node:test";

import {
  createPreparedAttemptToken,
  matchesPreparedAttemptToken,
} from "../lib/server/payments/attempt-token.ts";

test("creates a high-entropy prepared-attempt token that cannot be guessed from its stored hash", () => {
  const prepared = createPreparedAttemptToken();

  assert.match(prepared.token, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(prepared.hash, prepared.token);
  assert.equal(matchesPreparedAttemptToken(prepared.token, prepared.hash), true);
  assert.equal(matchesPreparedAttemptToken("x".repeat(43), prepared.hash), false);
});
