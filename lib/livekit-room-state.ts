import {
  TrackSource,
  TrackType,
  type ParticipantInfo,
  type Room,
  type RoomServiceClient,
} from "livekit-server-sdk";
import type { FeefeeRoomMetadata, LiveRoomSummary } from "@/lib/room-metadata";

export function hostIdentityForRoom(roomName: string) {
  return `host-${roomName}`;
}

export function participantHasHostAudio(participant?: ParticipantInfo | null) {
  return Boolean(
    participant?.tracks.some(
      (track) =>
        track.type === TrackType.AUDIO &&
        track.source === TrackSource.SCREEN_SHARE_AUDIO &&
        !track.muted,
    ),
  );
}

export function roomRuntimeStateFromParticipants(
  roomName: string,
  participants: ParticipantInfo[],
) {
  const hostIdentity = hostIdentityForRoom(roomName);
  const host = participants.find(
    (participant) => participant.identity === hostIdentity,
  );

  return {
    participantCount: participants.length,
    listenerCount: participants.filter(
      (participant) => participant.identity !== hostIdentity,
    ).length,
    isSharing: participantHasHostAudio(host),
  };
}

function fallbackRoomRuntimeState(room: Room) {
  return {
    participantCount: room.numParticipants,
    listenerCount: Math.max(0, room.numParticipants - 1),
    isSharing: false,
  };
}

export async function getLiveRoomSummary(
  roomService: RoomServiceClient,
  room: Room,
  metadata: FeefeeRoomMetadata,
): Promise<LiveRoomSummary> {
  const runtimeState = await roomService
    .listParticipants(room.name)
    .then((participants) =>
      roomRuntimeStateFromParticipants(room.name, participants),
    )
    .catch(() => fallbackRoomRuntimeState(room));

  return {
    roomName: room.name,
    hostName: metadata.hostName,
    isSharing: runtimeState.isSharing,
    controllerId: metadata.controllerId,
    participantCount: runtimeState.participantCount,
    listenerCount: runtimeState.listenerCount,
    createdAt: metadata.createdAt,
    updatedAt: metadata.updatedAt,
  };
}
