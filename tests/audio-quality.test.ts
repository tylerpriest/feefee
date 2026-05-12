import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_AUDIO_QUALITY_MODE,
  formatAudioBitrate,
  formatAudioDiagnostics,
  getAudioQualityPreset,
} from "@/lib/audio-quality";

test("audio quality defaults to high quality stereo music", () => {
  const preset = getAudioQualityPreset(DEFAULT_AUDIO_QUALITY_MODE);

  assert.equal(preset.mode, "high");
  assert.equal(preset.targetBitrate, 128_000);
  assert.equal(preset.publishOptions.audioPreset?.maxBitrate, 128_000);
  assert.equal(preset.publishOptions.forceStereo, true);
  assert.equal(preset.publishOptions.dtx, false);
  assert.equal(preset.publishOptions.red, true);
});

test("ultra quality publishes stereo music at 192 kbps", () => {
  const preset = getAudioQualityPreset("ultra");

  assert.equal(preset.mode, "ultra");
  assert.equal(preset.targetBitrate, 192_000);
  assert.equal(preset.publishOptions.audioPreset?.maxBitrate, 192_000);
  assert.equal(preset.publishOptions.forceStereo, true);
  assert.equal(preset.publishOptions.dtx, false);
  assert.equal(preset.publishOptions.red, true);
});

test("audio bitrate labels round to whole kbps", () => {
  assert.equal(formatAudioBitrate(127_500), "128 kbps");
  assert.equal(formatAudioBitrate(192_499), "192 kbps");
  assert.equal(formatAudioBitrate(undefined), "Unknown");
  assert.equal(formatAudioBitrate(0, "Measuring"), "Measuring");
});

test("audio diagnostics format unknown values", () => {
  const diagnostics = formatAudioDiagnostics({
    mode: "high",
    targetBitrate: 128_000,
  });

  assert.equal(diagnostics.mode, "High");
  assert.equal(diagnostics.targetBitrate, "128 kbps");
  assert.equal(diagnostics.outboundBitrate, "Measuring");
  assert.equal(diagnostics.capture, "Unknown, channels unknown");
  assert.equal(diagnostics.processing, "Unknown");
  assert.equal(diagnostics.packetLoss, "Unknown");
  assert.equal(diagnostics.roundTripTime, "Unknown");
  assert.deepEqual(diagnostics.warnings, []);
});

test("audio diagnostics accept common music sample rates", () => {
  const diagnostics = formatAudioDiagnostics({
    mode: "ultra",
    targetBitrate: 192_000,
    outboundBitrate: 191_600,
    sampleRate: 44_100,
    channelCount: 2,
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
    packetsLost: 3,
    roundTripTime: 0.043,
  });

  assert.equal(diagnostics.mode, "Ultra");
  assert.equal(diagnostics.outboundBitrate, "192 kbps");
  assert.equal(diagnostics.capture, "44.1 kHz, stereo");
  assert.equal(diagnostics.processing, "Off");
  assert.equal(diagnostics.packetLoss, "3 packets");
  assert.equal(diagnostics.roundTripTime, "43 ms");
  assert.deepEqual(diagnostics.warnings, []);
});

test("audio diagnostics warn when capture constraints are degraded", () => {
  const diagnostics = formatAudioDiagnostics({
    mode: "ultra",
    targetBitrate: 192_000,
    sampleRate: 32_000,
    channelCount: 1,
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
  });

  assert.equal(diagnostics.capture, "32 kHz, mono");
  assert.deepEqual(diagnostics.warnings, [
    "Browser captured mono audio.",
    "Browser reported an unusual 32 kHz capture rate.",
  ]);
});

test("audio diagnostics warn when browser processing stays enabled", () => {
  const diagnostics = formatAudioDiagnostics({
    mode: "high",
    targetBitrate: 128_000,
    sampleRate: 48_000,
    channelCount: 2,
    echoCancellation: true,
    noiseSuppression: false,
    autoGainControl: true,
  });

  assert.equal(diagnostics.capture, "48 kHz, stereo");
  assert.equal(diagnostics.processing, "On: echo cancellation and auto gain");
  assert.deepEqual(diagnostics.warnings, [
    "Browser kept echo cancellation and auto gain on.",
  ]);
});
