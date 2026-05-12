import type { Room } from "livekit-server-sdk";
import { RoomServiceClient } from "livekit-server-sdk";
import {
  STABLE_AUDIO_MAX_PLAYOUT_DELAY_MS,
  STABLE_AUDIO_MIN_PLAYOUT_DELAY_MS,
} from "@/lib/audio-reliability";
import {
  controlTokenMatchesHash,
  hashControlToken,
} from "@/lib/control-token";
import {
  cleanHostName,
  type FeefeeRoomMetadata,
  makeFeefeeMetadata,
  parseFeefeeMetadata,
  titleFromRoomName,
} from "@/lib/room-metadata";

function getLiveKitHttpUrl() {
  const rawUrl =
    process.env.LIVEKIT_API_URL ??
    process.env.LIVEKIT_URL ??
    process.env.NEXT_PUBLIC_LIVEKIT_URL;

  if (!rawUrl) {
    throw new Error("LiveKit URL is missing.");
  }

  const url = new URL(rawUrl);

  if (url.protocol === "wss:") {
    url.protocol = "https:";
  } else if (url.protocol === "ws:") {
    url.protocol = "http:";
  }

  return url.toString().replace(/\/$/, "");
}

export function getRoomServiceClient() {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  if (!apiKey || !apiSecret) {
    throw new Error("LiveKit server environment variables are missing.");
  }

  return new RoomServiceClient(getLiveKitHttpUrl(), apiKey, apiSecret, {
    requestTimeout: 8000,
  });
}

export function assertRoomControl(
  metadata: FeefeeRoomMetadata | null,
  controlToken: string,
) {
  if (!controlTokenMatchesHash(controlToken, metadata?.controlTokenHash)) {
    throw new Error("This room name is already being hosted.");
  }
}

export async function ensureFeefeeRoom(
  roomName: string,
  {
    controlToken,
    hostName,
    isSharing = false,
    roomService = getRoomServiceClient(),
  }: {
    controlToken?: string;
    hostName?: string;
    isSharing?: boolean;
    roomService?: RoomServiceClient;
  } = {},
): Promise<Room> {
  const fallbackName = titleFromRoomName(roomName);
  const safeHostName = cleanHostName(hostName ?? fallbackName, fallbackName);
  const controlTokenHash = controlToken
    ? hashControlToken(controlToken)
    : undefined;
  const [existingRoom] = await roomService.listRooms([roomName]);

  if (existingRoom) {
    const existing = parseFeefeeMetadata(existingRoom.metadata);

    if (existing) {
      if (controlToken) {
        assertRoomControl(existing, controlToken);
      }

      if (!existing.controlTokenHash && controlTokenHash) {
        return roomService.updateRoomMetadata(
          roomName,
          makeFeefeeMetadata({
            existing,
            hostName: existing.hostName,
            isSharing: existing.isSharing,
            controlTokenHash,
          }),
        );
      }

      return existingRoom;
    }

    return roomService.updateRoomMetadata(
      roomName,
      makeFeefeeMetadata({
        hostName: safeHostName,
        isSharing,
        controlTokenHash,
      }),
    );
  }

  try {
    return await roomService.createRoom({
      name: roomName,
      emptyTimeout: 60,
      departureTimeout: 300,
      maxParticipants: 8,
      minPlayoutDelay: STABLE_AUDIO_MIN_PLAYOUT_DELAY_MS,
      maxPlayoutDelay: STABLE_AUDIO_MAX_PLAYOUT_DELAY_MS,
      metadata: makeFeefeeMetadata({
        hostName: safeHostName,
        isSharing,
        controlTokenHash,
      }),
    });
  } catch (error) {
    const [createdByAnotherRequest] = await roomService.listRooms([roomName]);

    if (createdByAnotherRequest) {
      const metadata = parseFeefeeMetadata(createdByAnotherRequest.metadata);

      if (controlToken) {
        assertRoomControl(metadata, controlToken);
      }

      return createdByAnotherRequest;
    }

    throw error;
  }
}
