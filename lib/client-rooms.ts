import type { LiveRoomSummary } from "@/lib/room-metadata";

type RoomsResponse = {
  rooms?: LiveRoomSummary[];
  error?: string;
};

type RoomResponse = {
  room?: LiveRoomSummary;
  error?: string;
};

type RoomPatch = {
  hostName?: string;
  isSharing?: boolean;
  controllerId?: string;
};

function controlHeaders(controlToken: string) {
  return {
    "x-feefee-control-token": controlToken,
  };
}

export async function fetchLiveRooms() {
  const response = await fetch("/api/rooms", {
    cache: "no-store",
  });
  const data = (await response.json().catch(() => ({}))) as RoomsResponse;

  if (!response.ok || !data.rooms) {
    throw new Error(data.error ?? "Could not load live rooms.");
  }

  return data.rooms;
}

export async function fetchLiveRoom(roomName: string) {
  const response = await fetch(`/api/rooms/${roomName}`, {
    cache: "no-store",
  });
  const data = (await response.json().catch(() => ({}))) as RoomResponse;

  if (!response.ok || !data.room) {
    throw new Error(data.error ?? "Could not load room.");
  }

  return data.room;
}

export async function updateLiveRoom(
  roomName: string,
  patch: RoomPatch,
  controlToken: string,
) {
  const response = await fetch(`/api/rooms/${roomName}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...controlHeaders(controlToken),
    },
    body: JSON.stringify(patch),
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as RoomResponse;
    throw new Error(data.error ?? "Could not update room.");
  }
}

export async function deleteLiveRoom(roomName: string, controlToken: string) {
  const response = await fetch(`/api/rooms/${roomName}`, {
    method: "DELETE",
    headers: controlHeaders(controlToken),
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as RoomResponse;
    throw new Error(data.error ?? "Could not end room.");
  }
}
