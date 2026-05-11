export type LiveKitRole = "host" | "listener";

type TokenResponse = {
  token?: string;
  error?: string;
};

export async function requestLiveKitToken(
  roomName: string,
  role: LiveKitRole,
  controlToken?: string,
) {
  const response = await fetch("/api/livekit-token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ roomName, role, controlToken }),
  });

  const data = (await response.json().catch(() => ({}))) as TokenResponse;

  if (!response.ok || !data.token) {
    throw new Error(data.error ?? "Could not create a LiveKit token.");
  }

  return data.token;
}

export function getLiveKitUrl() {
  const liveKitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL?.trim();

  if (!liveKitUrl) {
    throw new Error("NEXT_PUBLIC_LIVEKIT_URL is missing.");
  }

  return liveKitUrl;
}

export function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}

export async function withTimeout<T>(
  promise: Promise<T>,
  message: string,
  timeoutMs = 12000,
) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}
