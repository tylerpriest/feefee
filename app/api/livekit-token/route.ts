import { randomUUID } from "crypto";
import { AccessToken, TrackSource } from "livekit-server-sdk";
import { NextResponse } from "next/server";
import { verifyControlToken } from "@/lib/control-token";
import { ensureFeefeeRoom, getRoomServiceClient } from "@/lib/livekit-server";
import { isValidRoomName } from "@/lib/rooms";

export const runtime = "nodejs";

type TokenRequest = {
  roomName?: unknown;
  role?: unknown;
  controlToken?: unknown;
};

export async function POST(request: Request) {
  let body: TokenRequest;

  try {
    body = (await request.json()) as TokenRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const roomName = typeof body.roomName === "string" ? body.roomName : "";
  const role = body.role;

  if (!isValidRoomName(roomName)) {
    return NextResponse.json(
      { error: "Room name must be 3-64 lowercase letters, numbers, or dashes." },
      { status: 400 },
    );
  }

  if (role !== "host" && role !== "listener") {
    return NextResponse.json(
      { error: "Role must be host or listener." },
      { status: 400 },
    );
  }

  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  if (!apiKey || !apiSecret) {
    return NextResponse.json(
      { error: "LiveKit server environment variables are missing." },
      { status: 500 },
    );
  }

  if (role === "host") {
    const controlToken =
      typeof body.controlToken === "string" ? body.controlToken : "";

    if (!verifyControlToken(roomName, controlToken)) {
      return NextResponse.json(
        { error: "Host control link is missing or invalid." },
        { status: 403 },
      );
    }

    try {
      const roomService = getRoomServiceClient();

      await ensureFeefeeRoom(roomName, { roomService });
      await roomService
        .removeParticipant(roomName, `host-${roomName}`)
        .catch(() => undefined);
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error ? error.message : "Could not prepare room.",
        },
        { status: 500 },
      );
    }
  }

  const identity =
    role === "host" ? `host-${roomName}` : `listener-${randomUUID()}`;

  const token = new AccessToken(apiKey, apiSecret, {
    identity,
    name: role === "host" ? "Feefee host" : "Feefee listener",
    ttl: "2h",
  });

  token.addGrant({
    room: roomName,
    roomJoin: true,
    canPublish: role === "host",
    canPublishData: false,
    canSubscribe: true,
    canPublishSources:
      role === "host" ? [TrackSource.SCREEN_SHARE_AUDIO] : undefined,
  });

  return NextResponse.json({ token: await token.toJwt() });
}
