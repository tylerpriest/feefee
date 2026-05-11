import { NextResponse } from "next/server";
import { getRoomServiceClient } from "@/lib/livekit-server";
import {
  type LiveRoomSummary,
  parseFeefeeMetadata,
} from "@/lib/room-metadata";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const roomService = getRoomServiceClient();
    const rooms = await roomService.listRooms();

    const summaries = rooms
      .map((room): LiveRoomSummary | null => {
        const metadata = parseFeefeeMetadata(room.metadata);

        if (!metadata) {
          return null;
        }

        return {
          roomName: room.name,
          hostName: metadata.hostName,
          isSharing: metadata.isSharing,
          participantCount: room.numParticipants,
          listenerCount: Math.max(0, room.numParticipants - 1),
          createdAt: metadata.createdAt,
          updatedAt: metadata.updatedAt,
        };
      })
      .filter((room): room is LiveRoomSummary => Boolean(room))
      .sort((a, b) => {
        if (a.isSharing !== b.isSharing) {
          return a.isSharing ? -1 : 1;
        }

        return b.updatedAt.localeCompare(a.updatedAt);
      });

    return NextResponse.json(
      { rooms: summaries },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not load live rooms.",
      },
      { status: 500 },
    );
  }
}
