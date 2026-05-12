import { NextResponse } from "next/server";
import { verifyControlToken } from "@/lib/control-token";
import { getLiveRoomSummary } from "@/lib/livekit-room-state";
import {
  assertRoomControl,
  ensureFeefeeRoom,
  getRoomServiceClient,
} from "@/lib/livekit-server";
import { isValidRoomName } from "@/lib/rooms";
import {
  cleanHostName,
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

function getHostControlToken(request: Request, roomName: string) {
  const controlToken = request.headers.get("x-feefee-control-token") ?? "";

  return verifyControlToken(roomName, controlToken) ? controlToken : null;
}

export async function GET(_request: Request, { params }: RoomParams) {
  const { roomName } = await params;

  if (!isValidRoomName(roomName)) {
    return NextResponse.json({ error: "Invalid room name." }, { status: 400 });
  }

  try {
    const roomService = getRoomServiceClient();
    const [room] = await roomService.listRooms([roomName]);
    const metadata = parseFeefeeMetadata(room?.metadata);

    if (!room || !metadata) {
      return NextResponse.json(
        { error: "Room is not active." },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { room: await getLiveRoomSummary(roomService, room, metadata) },
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

  const controlToken = getHostControlToken(request, roomName);

  if (!controlToken) {
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
    const room = await ensureFeefeeRoom(roomName, {
      controlToken,
      roomService,
    });

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
      room: await getLiveRoomSummary(
        roomService,
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
    if (
      error instanceof Error &&
      error.message === "This room name is already being hosted."
    ) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

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

  const controlToken = getHostControlToken(request, roomName);

  if (!controlToken) {
    return NextResponse.json(
      { error: "Host control link is missing or invalid." },
      { status: 403 },
    );
  }

  try {
    const roomService = getRoomServiceClient();
    const [room] = await roomService.listRooms([roomName]);

    if (room) {
      assertRoomControl(parseFeefeeMetadata(room.metadata), controlToken);
      await roomService.deleteRoom(roomName);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "This room name is already being hosted."
    ) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not end room." },
      { status: 500 },
    );
  }
}
