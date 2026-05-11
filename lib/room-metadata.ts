export const FEEFEE_APP_ID = "feefee";

export type FeefeeRoomMetadata = {
  app: typeof FEEFEE_APP_ID;
  hostName: string;
  isSharing: boolean;
  controllerId?: string;
  createdAt: string;
  updatedAt: string;
};

export type LiveRoomSummary = {
  roomName: string;
  hostName: string;
  isSharing: boolean;
  controllerId?: string;
  listenerCount: number;
  participantCount: number;
  createdAt: string;
  updatedAt: string;
};

export function cleanHostName(value: string, fallback: string) {
  const hostName = value.trim().replace(/\s+/g, " ").slice(0, 32);

  return hostName || fallback;
}

export function titleFromRoomName(roomName: string) {
  return roomName
    .split("-")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function parseFeefeeMetadata(
  value: string | undefined,
): FeefeeRoomMetadata | null {
  if (!value) {
    return null;
  }

  try {
    const data = JSON.parse(value) as Partial<FeefeeRoomMetadata>;

    if (data.app !== FEEFEE_APP_ID || typeof data.hostName !== "string") {
      return null;
    }

    return {
      app: FEEFEE_APP_ID,
      hostName: data.hostName,
      isSharing: Boolean(data.isSharing),
      controllerId:
        typeof data.controllerId === "string" ? data.controllerId : undefined,
      createdAt:
        typeof data.createdAt === "string" ? data.createdAt : new Date().toISOString(),
      updatedAt:
        typeof data.updatedAt === "string" ? data.updatedAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function makeFeefeeMetadata({
  existing,
  hostName,
  isSharing,
  controllerId,
}: {
  existing?: FeefeeRoomMetadata | null;
  hostName: string;
  isSharing: boolean;
  controllerId?: string;
}) {
  const now = new Date().toISOString();

  return JSON.stringify({
    app: FEEFEE_APP_ID,
    hostName,
    isSharing,
    controllerId: controllerId ?? existing?.controllerId,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  } satisfies FeefeeRoomMetadata);
}
