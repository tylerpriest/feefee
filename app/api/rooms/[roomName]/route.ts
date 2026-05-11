import { NextResponse } from "next/server";
import { verifyControlToken } from "@/lib/control-token";
import { ensureFeefeeRoom, getRoomServiceClient } from "@/lib/livekit-server";
import { isValidRoomName } from "@/lib/rooms";
import {
  cleanHostName,
  type FeefeeRoomMetadata,
  makeFeefeeMetadata,
  parseFeefeeMetadata,
  titleFromRoomName,
} from "@/lib/room-metadata";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RoomParams = {
  params: Promise<{
    roomName: string;
  }>;
};

type PatchBody = {
  hostName?: unknown;
  isSharing?: unknown;
  controllerId?: unknown;
};

type LiveKitRoomLike = {
  name: string;
  metadata?: string;
  numParticipants: number;
};

function hasHostControl(request: Request, roomName: string) {
  return verifyControlToken(
    roomName,
    request.headers.get("x-feefee-control-token") ?? "",
  );
}

function publicRoomSummary(
  room: LiveKitRoomLike,
  metadata: FeefeeRoomMetadata,
) {
  return {
    roomName: room.name,
    hostName: metadata.hostName,
    isSharing: metadata.isSharing,
    controllerId: metadata.controllerId,
    participantCount: room.numParticipants,
    listenerCount: Math.max(0, room.numParticipants - 1),
    createdAt: metadata.createdAt,
    updatedAt: metadata.updatedAt,
  };
}

export async function GET(_request: Request, { params }: RoomParams) {
  const { roomName } = await params;

  if (!isValidRoomName(roomName)) {
    return NextResponse.json({ error: "Invalid room name." }, { status: 400 });
  }

  try {
    const [room] = await getRoomServiceClient().listRooms([roomName]);
    const metadata = parseFeefeeMetadata(room?.metadata);

    if (!room || !metadata) {
      return NextResponse.json(
        { error: "Room is not active." },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { room: publicRoomSummary(room, metadata) },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Could not load room.",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request, { params }: RoomParams) {
  const { roomName } = await params;

  if (!isValidRoomName(roomName)) {
    return NextResponse.json({ error: "Invalid room name." }, { status: 400 });
  }

  if (!hasHostControl(request, roomName)) {
    return NextResponse.json(
      { error: "Host control link is missing or invalid." },
      { status: 403 },
    );
  }

  let body: PatchBody;

  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    const roomService = getRoomServiceClient();
    const room = await ensureFeefeeRoom(roomName, { roomService });

    const existing = parseFeefeeMetadata(room.metadata);
    const hostName = cleanHostName(
      typeof body.hostName === "string"
        ? body.hostName
        : existing?.hostName ?? titleFromRoomName(roomName),
      titleFromRoomName(roomName),
    );
    const isSharing =
      typeof body.isSharing === "boolean"
        ? body.isSharing
        : existing?.isSharing ?? false;
    const controllerId =
      typeof body.controllerId === "string"
        ? body.controllerId.trim().slice(0, 80)
        : existing?.controllerId;

    const updated = await roomService.updateRoomMetadata(
      roomName,
      makeFeefeeMetadata({ existing, hostName, isSharing, controllerId }),
    );
    const metadata = parseFeefeeMetadata(updated.metadata);

    return NextResponse.json({
      room: publicRoomSummary(
        updated,
        metadata ?? {
          app: "feefee",
          hostName,
          isSharing,
          controllerId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not update room.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request, { params }: RoomParams) {
  const { roomName } = await params;

  if (!isValidRoomName(roomName)) {
    return NextResponse.json({ error: "Invalid room name." }, { status: 400 });
  }

  if (!hasHostControl(request, roomName)) {
    return NextResponse.json(
      { error: "Host control link is missing or invalid." },
      { status: 403 },
    );
  }

  try {
    await getRoomServiceClient().deleteRoom(roomName);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
