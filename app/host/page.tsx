import { redirect } from "next/navigation";
import { createControlToken } from "@/lib/control-token";
import { isValidRoomName, randomRoomName, slugifyRoomName } from "@/lib/rooms";

export const dynamic = "force-dynamic";

type HostPageProps = {
  searchParams: Promise<{
    room?: string | string[];
  }>;
};

export default async function HostPage({ searchParams }: HostPageProps) {
  const { room } = await searchParams;
  const requestedRoom = Array.isArray(room) ? room[0] : room;
  const suggestedRoomName = randomRoomName();
  const roomName = requestedRoom ? slugifyRoomName(requestedRoom) : "";

  if (requestedRoom !== undefined && isValidRoomName(roomName)) {
    const controlToken = createControlToken(roomName);

    redirect(`/host/${roomName}?control=${encodeURIComponent(controlToken)}`);
  }

  const hasInvalidRoom = requestedRoom !== undefined && !isValidRoomName(roomName);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center px-6 py-10">
      <p className="mb-4 text-sm font-semibold uppercase tracking-[0.16em] text-lime-300">
        Host
      </p>
      <h1 className="text-5xl font-black leading-none text-stone-50 sm:text-6xl">
        Name your room.
      </h1>
      <form action="/host" className="mt-8 grid gap-4">
        <label className="text-sm font-semibold uppercase tracking-[0.16em] text-stone-400">
          Room name
          <input
            name="room"
            defaultValue={requestedRoom ?? suggestedRoomName}
            maxLength={64}
            autoCapitalize="none"
            autoCorrect="off"
            className="mt-3 h-14 w-full rounded-md border border-stone-700 bg-stone-900 px-4 text-xl font-black text-stone-100 outline-none focus:border-lime-300"
          />
        </label>
        {hasInvalidRoom ? (
          <p className="rounded-lg border border-red-400/40 bg-red-950/50 p-4 text-sm font-semibold leading-6 text-red-100">
            Use at least 3 letters or numbers.
          </p>
        ) : null}
        <button
          type="submit"
          className="flex h-16 w-full items-center justify-center rounded-lg bg-lime-300 px-6 text-xl font-black text-stone-950 transition hover:bg-lime-200 focus:outline-none focus:ring-4 focus:ring-lime-300/40"
        >
          Start room
        </button>
      </form>
      <p className="mt-5 text-base font-semibold leading-6 text-stone-400">
        Type gold pulse and the room will be gold-pulse.
      </p>
    </main>
  );
}
