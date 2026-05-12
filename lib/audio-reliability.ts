export type ListenerStabilityMode = "auto" | "live" | "balanced" | "stable";

export type ListenerAudioDiagnostics = {
  packetsLost?: number;
  packetsReceived?: number;
  jitter?: number;
  jitterBufferDelay?: number;
  concealedSamples?: number;
  concealmentEvents?: number;
};

type ListenerStabilityPreset = {
  mode: ListenerStabilityMode;
  label: string;
  playoutDelaySeconds: number;
};

export const LISTENER_STABILITY_MODE_ORDER = [
  "auto",
  "live",
  "balanced",
  "stable",
] as const;
export const DEFAULT_LISTENER_STABILITY_MODE: ListenerStabilityMode = "auto";

export const LISTENER_STABILITY_PRESETS = {
  auto: {
    mode: "auto",
    label: "Auto",
    playoutDelaySeconds: 0.35,
  },
  live: {
    mode: "live",
    label: "Live",
    playoutDelaySeconds: 0.12,
  },
  balanced: {
    mode: "balanced",
    label: "Balanced",
    playoutDelaySeconds: 0.35,
  },
  stable: {
    mode: "stable",
    label: "Stable",
    playoutDelaySeconds: 0.75,
  },
} satisfies Record<ListenerStabilityMode, ListenerStabilityPreset>;

export const STABLE_AUDIO_PLAYOUT_DELAY_SECONDS =
  LISTENER_STABILITY_PRESETS.balanced.playoutDelaySeconds;
export const STABLE_AUDIO_MIN_PLAYOUT_DELAY_MS = 100;
export const STABLE_AUDIO_MAX_PLAYOUT_DELAY_MS = 1000;

function isPositiveFiniteNumber(value: number | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function positiveDelta(current?: number, previous?: number) {
  if (
    typeof current !== "number" ||
    typeof previous !== "number" ||
    !Number.isFinite(current) ||
    !Number.isFinite(previous)
  ) {
    return 0;
  }

  return Math.max(0, current - previous);
}

export function getListenerStabilityPreset(mode: ListenerStabilityMode) {
  return LISTENER_STABILITY_PRESETS[mode];
}

export function listenerPlayoutDelaySeconds(
  mode: ListenerStabilityMode,
  hasRecentTrouble = false,
) {
  if (mode === "auto") {
    return hasRecentTrouble
      ? LISTENER_STABILITY_PRESETS.stable.playoutDelaySeconds
      : LISTENER_STABILITY_PRESETS.balanced.playoutDelaySeconds;
  }

  return getListenerStabilityPreset(mode).playoutDelaySeconds;
}

export function hasRecentReceiverTrouble(
  current: ListenerAudioDiagnostics,
  previous: ListenerAudioDiagnostics | null,
) {
  if (!previous) {
    return false;
  }

  return (
    positiveDelta(current.packetsLost, previous.packetsLost) > 0 ||
    positiveDelta(current.concealmentEvents, previous.concealmentEvents) > 0
  );
}

export function formatPlayoutDelay(seconds: number) {
  return `${Math.round(seconds * 1000)} ms`;
}

function formatSecondsAsMs(seconds?: number) {
  if (!isPositiveFiniteNumber(seconds)) {
    return "Unknown";
  }

  return `${Math.round(seconds * 1000)} ms`;
}

function formatCount(value?: number) {
  if (value === undefined || !Number.isFinite(value)) {
    return "Unknown";
  }

  return `${Math.max(0, Math.round(value))}`;
}

export function formatListenerAudioDiagnostics(
  diagnostics: ListenerAudioDiagnostics | null,
) {
  return {
    packetLoss: formatCount(diagnostics?.packetsLost),
    packetsReceived: formatCount(diagnostics?.packetsReceived),
    jitter: formatSecondsAsMs(diagnostics?.jitter),
    jitterBuffer: formatSecondsAsMs(diagnostics?.jitterBufferDelay),
    concealedSamples: formatCount(diagnostics?.concealedSamples),
    concealmentEvents: formatCount(diagnostics?.concealmentEvents),
  };
}
