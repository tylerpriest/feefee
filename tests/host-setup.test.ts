import assert from "node:assert/strict";
import test from "node:test";
import { hostSetupError, missingHostSetupVariables } from "@/lib/host-setup";

test("host setup passes when LiveKit env is configured", () => {
  assert.deepEqual(
    missingHostSetupVariables({
      LIVEKIT_API_KEY: "key",
      LIVEKIT_API_SECRET: "secret",
      NEXT_PUBLIC_LIVEKIT_URL: "wss://example.livekit.cloud",
    }),
    [],
  );
  assert.equal(
    hostSetupError({
      LIVEKIT_API_KEY: "key",
      LIVEKIT_API_SECRET: "secret",
      NEXT_PUBLIC_LIVEKIT_URL: "wss://example.livekit.cloud",
    }),
    "",
  );
});

test("host setup returns a friendly missing-env message", () => {
  assert.deepEqual(missingHostSetupVariables({}), [
    "LIVEKIT_API_KEY",
    "LIVEKIT_API_SECRET",
    "NEXT_PUBLIC_LIVEKIT_URL",
  ]);
  assert.equal(
    hostSetupError({}),
    "Cannot start a room yet. Add LIVEKIT_API_KEY, LIVEKIT_API_SECRET, NEXT_PUBLIC_LIVEKIT_URL to your environment variables and restart the app.",
  );
});
