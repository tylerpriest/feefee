import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { HostStartForm } from "@/components/host-start-form";
import { createControlToken } from "@/lib/control-token";
import { isValidRoomName, randomRoomName, slugifyRoomName } from "@/lib/rooms";

export const dynamic = "force-dynamic";

type HostPageProps = {
  searchParams: Promise<{
    room?: string | string[];
  }>;
};

async function getRequestOrigin() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol =
    requestHeaders.get("x-forwarded-proto")?.split(",")[0]?.trim() ?? "http";

  return host ? `${protocol}://${host}` : "";
}

export default async function HostPage({ searchParams }: HostPageProps) {
  const [{ room }, requestOrigin] = await Promise.all([
    searchParams,
    getRequestOrigin(),
  ]);
  const requestedRoom = Array.isArray(room) ? room[0] : room;
  const suggestedRoomName = randomRoomName();
  const roomName = requestedRoom ? slugifyRoomName(requestedRoom) : "";

  if (requestedRoom !== undefined && isValidRoomName(roomName)) {
    const controlToken = createControlToken(roomName);

    redirect(`/host/${roomName}?control=${encodeURIComponent(controlToken)}`);
  }

  const hasInvalidRoom = requestedRoom !== undefined && !isValidRoomName(roomName);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center px-5 py-8">
      <p className="mb-4 text-sm font-semibold uppercase tracking-[0.16em] text-[#c2ad78]">
        Feefee host
      </p>
      <h1 className="text-5xl font-black leading-none text-stone-50 sm:text-6xl">
        Start a room.
      </h1>
      <p className="mt-5 text-lg font-semibold leading-7 text-stone-300">
        Type a name. Play music. Show the QR.
      </p>
      {hasInvalidRoom ? (
        <p className="mt-5 rounded-lg border border-red-400/40 bg-red-950/50 p-4 text-sm font-semibold leading-6 text-red-100">
          Use at least 3 letters or numbers.
        </p>
      ) : null}
      <HostStartForm
        suggestedRoomName={suggestedRoomName}
        initialRoomName={requestedRoom}
        requestOrigin={requestOrigin}
      />
    </main>
  );
}
