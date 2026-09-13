import assert from "node:assert/strict";
import test from "node:test";

import { previewRecipientAllocations } from "../lib/client/payment-form.ts";

test("previews split recipient amounts using deterministic base-unit rounding", () => {
  assert.deepEqual(
    previewRecipientAllocations("0.000000005", "SOL", [3333, 3333, 3334]),
    ["0.000000002", "0.000000001", "0.000000002"],
  );
});
