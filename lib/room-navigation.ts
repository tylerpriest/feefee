import type { LiveRoomSummary } from "@/lib/room-metadata";

export function splitRoomsBySharing(rooms: LiveRoomSummary[]) {
  return rooms.reduce(
    (groups, room) => {
      if (room.isSharing) {
        groups.liveRooms.push(room);
      } else {
        groups.waitingRooms.push(room);
      }

      return groups;
    },
    {
      liveRooms: [] as LiveRoomSummary[],
      waitingRooms: [] as LiveRoomSummary[],
    },
  );
}

export function canSwitchToAnotherLiveRoom(
  liveRooms: LiveRoomSummary[],
  activeRoomName: string,
) {
  return liveRooms.some((room) => room.roomName !== activeRoomName);
}

export function liveRoomByOffset(
  liveRooms: LiveRoomSummary[],
  activeRoomName: string,
  offset: number,
) {
  if (!canSwitchToAnotherLiveRoom(liveRooms, activeRoomName)) {
    return null;
  }

  const currentIndex = liveRooms.findIndex(
    (room) => room.roomName === activeRoomName,
  );
  const baseIndex = currentIndex >= 0 ? currentIndex : offset > 0 ? -1 : 0;
  const nextIndex = (baseIndex + offset + liveRooms.length) % liveRooms.length;

  return liveRooms[nextIndex] ?? null;
}

export function randomLiveRoom(
  liveRooms: LiveRoomSummary[],
  activeRoomName: string,
  random = Math.random,
) {
  const choices = liveRooms.filter((room) => room.roomName !== activeRoomName);

  if (choices.length === 0) {
    return null;
  }

  const index = Math.min(choices.length - 1, Math.floor(random() * choices.length));

  return choices[index] ?? null;
}
