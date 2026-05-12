import { AudioPresets, type TrackPublishOptions } from "livekit-client";

export type AudioQualityMode = "high" | "ultra";

export type AudioDiagnostics = {
  mode: AudioQualityMode;
  targetBitrate: number;
  outboundBitrate?: number;
  sampleRate?: number;
  channelCount?: number;
  echoCancellation?: boolean;
  noiseSuppression?: boolean;
  autoGainControl?: boolean;
  packetsLost?: number;
  roundTripTime?: number;
};

type AudioQualityPublishOptions = Pick<
  TrackPublishOptions,
  "audioPreset" | "dtx" | "forceStereo" | "red"
>;

type AudioQualityPreset = {
  mode: AudioQualityMode;
  label: string;
  targetBitrate: number;
  publishOptions: AudioQualityPublishOptions;
};

export type FormattedAudioDiagnostics = {
  mode: string;
  targetBitrate: string;
  outboundBitrate: string;
  capture: string;
  processing: string;
  packetLoss: string;
  roundTripTime: string;
  warnings: string[];
};

export const DEFAULT_AUDIO_QUALITY_MODE: AudioQualityMode = "high";
export const AUDIO_QUALITY_MODE_ORDER = ["high", "ultra"] as const;

export const AUDIO_QUALITY_PRESETS = {
  high: {
    mode: "high",
    label: "High",
    targetBitrate: AudioPresets.musicHighQualityStereo.maxBitrate,
    publishOptions: {
      audioPreset: AudioPresets.musicHighQualityStereo,
      dtx: false,
      forceStereo: true,
      red: true,
    },
  },
  ultra: {
    mode: "ultra",
    label: "Ultra",
    targetBitrate: 192_000,
    publishOptions: {
      audioPreset: {
        maxBitrate: 192_000,
      },
      dtx: false,
      forceStereo: true,
      red: true,
    },
  },
} satisfies Record<AudioQualityMode, AudioQualityPreset>;

function isPositiveFiniteNumber(value: number | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function joinLabels(labels: string[]) {
  if (labels.length <= 1) {
    return labels[0] ?? "";
  }

  if (labels.length === 2) {
    return `${labels[0]} and ${labels[1]}`;
  }

  return `${labels.slice(0, -1).join(", ")}, and ${labels.at(-1)}`;
}

function formatSampleRate(sampleRate?: number) {
  if (!isPositiveFiniteNumber(sampleRate)) {
    return "Unknown";
  }

  if (sampleRate % 1000 === 0) {
    return `${sampleRate / 1000} kHz`;
  }

  return `${Math.round(sampleRate / 100) / 10} kHz`;
}

function formatChannelCount(channelCount?: number) {
  if (!isPositiveFiniteNumber(channelCount)) {
    return "channels unknown";
  }

  if (channelCount === 1) {
    return "mono";
  }

  if (channelCount === 2) {
    return "stereo";
  }

  return `${channelCount} ch`;
}

function enabledProcessingLabels(diagnostics: AudioDiagnostics) {
  return [
    ["echo cancellation", diagnostics.echoCancellation],
    ["noise suppression", diagnostics.noiseSuppression],
    ["auto gain", diagnostics.autoGainControl],
  ]
    .filter(([, enabled]) => enabled === true)
    .map(([label]) => label as string);
}

export function getAudioQualityPreset(mode: AudioQualityMode) {
  return AUDIO_QUALITY_PRESETS[mode];
}

export function formatAudioBitrate(
  bitsPerSecond: number | undefined,
  fallback = "Unknown",
) {
  if (!isPositiveFiniteNumber(bitsPerSecond)) {
    return fallback;
  }

  return `${Math.round(bitsPerSecond / 1000)} kbps`;
}

export function formatAudioDiagnostics(
  diagnostics: AudioDiagnostics,
): FormattedAudioDiagnostics {
  const processingLabels = enabledProcessingLabels(diagnostics);
  const hasProcessingReport =
    diagnostics.echoCancellation !== undefined ||
    diagnostics.noiseSuppression !== undefined ||
    diagnostics.autoGainControl !== undefined;
  const warnings: string[] = [];

  if (
    diagnostics.channelCount !== undefined &&
    diagnostics.channelCount > 0 &&
    diagnostics.channelCount < 2
  ) {
    warnings.push("Browser captured mono audio.");
  }

  if (
    diagnostics.sampleRate !== undefined &&
    diagnostics.sampleRate > 0 &&
    diagnostics.sampleRate !== 48_000
  ) {
    warnings.push(
      `Browser reported ${formatSampleRate(diagnostics.sampleRate)} instead of 48 kHz.`,
    );
  }

  if (processingLabels.length > 0) {
    warnings.push(`Browser kept ${joinLabels(processingLabels)} on.`);
  }

  return {
    mode: getAudioQualityPreset(diagnostics.mode).label,
    targetBitrate: formatAudioBitrate(diagnostics.targetBitrate),
    outboundBitrate: formatAudioBitrate(
      diagnostics.outboundBitrate,
      "Measuring",
    ),
    capture: `${formatSampleRate(diagnostics.sampleRate)}, ${formatChannelCount(
      diagnostics.channelCount,
    )}`,
    processing: hasProcessingReport
      ? processingLabels.length > 0
        ? `On: ${joinLabels(processingLabels)}`
        : "Off"
      : "Unknown",
    packetLoss:
      diagnostics.packetsLost === undefined
        ? "Unknown"
        : `${diagnostics.packetsLost} packets`,
    roundTripTime:
      diagnostics.roundTripTime === undefined
        ? "Unknown"
        : `${Math.round(diagnostics.roundTripTime * 1000)} ms`,
    warnings,
  };
}
