import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_LISTENER_STABILITY_MODE,
  formatListenerAudioDiagnostics,
  formatPlayoutDelay,
  hasRecentReceiverTrouble,
  listenerPlayoutDelaySeconds,
} from "@/lib/audio-reliability";

test("listener stability defaults to auto-balanced playout delay", () => {
  assert.equal(DEFAULT_LISTENER_STABILITY_MODE, "auto");
  assert.equal(listenerPlayoutDelaySeconds("auto"), 0.35);
  assert.equal(listenerPlayoutDelaySeconds("auto", true), 0.75);
});

test("listener stability modes expose fixed playout delays", () => {
  assert.equal(listenerPlayoutDelaySeconds("live"), 0.12);
  assert.equal(listenerPlayoutDelaySeconds("balanced"), 0.35);
  assert.equal(listenerPlayoutDelaySeconds("stable"), 0.75);
  assert.equal(formatPlayoutDelay(0.35), "350 ms");
});

test("receiver trouble is based on new loss or concealment", () => {
  assert.equal(
    hasRecentReceiverTrouble(
      {
        packetsLost: 2,
        concealmentEvents: 1,
      },
      null,
    ),
    false,
  );
  assert.equal(
    hasRecentReceiverTrouble(
      {
        packetsLost: 3,
        concealmentEvents: 1,
      },
      {
        packetsLost: 2,
        concealmentEvents: 1,
      },
    ),
    true,
  );
  assert.equal(
    hasRecentReceiverTrouble(
      {
        packetsLost: 3,
        concealmentEvents: 1,
      },
      {
        packetsLost: 3,
        concealmentEvents: 1,
      },
    ),
    false,
  );
});

test("receiver diagnostics format unknown and measured values", () => {
  assert.deepEqual(formatListenerAudioDiagnostics(null), {
    packetLoss: "Unknown",
    packetsReceived: "Unknown",
    jitter: "Unknown",
    jitterBuffer: "Unknown",
    concealedSamples: "Unknown",
    concealmentEvents: "Unknown",
  });
  assert.deepEqual(
    formatListenerAudioDiagnostics({
      packetsLost: 1,
      packetsReceived: 1234,
      jitter: 0.016,
      jitterBufferDelay: 0.128,
      concealedSamples: 960,
      concealmentEvents: 2,
    }),
    {
      packetLoss: "1",
      packetsReceived: "1234",
      jitter: "16 ms",
      jitterBuffer: "128 ms",
      concealedSamples: "960",
      concealmentEvents: "2",
    },
  );
});
