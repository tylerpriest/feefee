import type { Room } from "livekit-server-sdk";
import { RoomServiceClient } from "livekit-server-sdk";
import {
  cleanHostName,
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

export async function ensureFeefeeRoom(
  roomName: string,
  {
    hostName,
    isSharing = false,
    roomService = getRoomServiceClient(),
  }: {
    hostName?: string;
    isSharing?: boolean;
    roomService?: RoomServiceClient;
  } = {},
): Promise<Room> {
  const fallbackName = titleFromRoomName(roomName);
  const safeHostName = cleanHostName(hostName ?? fallbackName, fallbackName);
  const [existingRoom] = await roomService.listRooms([roomName]);

  if (existingRoom) {
    if (parseFeefeeMetadata(existingRoom.metadata)) {
      return existingRoom;
    }

    return roomService.updateRoomMetadata(
      roomName,
      makeFeefeeMetadata({
        hostName: safeHostName,
        isSharing,
      }),
    );
  }

  try {
    return await roomService.createRoom({
      name: roomName,
      emptyTimeout: 60,
      departureTimeout: 300,
      maxParticipants: 8,
      metadata: makeFeefeeMetadata({
        hostName: safeHostName,
        isSharing,
      }),
    });
  } catch (error) {
    const [createdByAnotherRequest] = await roomService.listRooms([roomName]);

    if (createdByAnotherRequest) {
      return createdByAnotherRequest;
    }

    throw error;
  }
}
