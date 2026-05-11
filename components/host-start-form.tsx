"use client";

import { useMemo, useState } from "react";
import { isValidRoomName, slugifyRoomName } from "@/lib/rooms";

type HostStartFormProps = {
  suggestedRoomName: string;
  initialRoomName?: string;
};

export function HostStartForm({
  suggestedRoomName,
  initialRoomName,
}: HostStartFormProps) {
  const [roomName, setRoomName] = useState(initialRoomName ?? suggestedRoomName);
  const roomSlug = useMemo(() => slugifyRoomName(roomName), [roomName]);
  const isReady = isValidRoomName(roomSlug);

  return (
    <form action="/host" className="mt-8 grid gap-4">
      <label className="text-sm font-semibold uppercase tracking-[0.16em] text-stone-400">
        Room name
        <input
          name="room"
          value={roomName}
          onChange={(event) => setRoomName(event.target.value)}
          maxLength={64}
          autoCapitalize="none"
          autoCorrect="off"
          className="mt-3 h-16 w-full rounded-md border border-stone-700 bg-stone-900 px-4 text-2xl font-black text-stone-100 outline-none focus:border-[#c2ad78]"
        />
      </label>

      <div className="rounded-lg border border-stone-800 bg-stone-950/50 p-4">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-stone-500">
          Guest link
        </p>
        <p className="mt-2 break-all text-lg font-black text-stone-100">
          /room/{roomSlug || "your-room"}?join=1
        </p>
      </div>

      <button
        type="submit"
        disabled={!isReady}
        className="flex h-16 w-full items-center justify-center rounded-lg bg-[#c2ad78] px-6 text-xl font-black text-stone-950 transition hover:bg-[#d2c18f] focus:outline-none focus:ring-4 focus:ring-[#c2ad78]/25 disabled:cursor-not-allowed disabled:bg-stone-700 disabled:text-stone-400"
      >
        Start room
      </button>

      {!isReady ? (
        <p className="text-sm font-semibold leading-5 text-stone-500">
          Use at least 3 letters or numbers.
        </p>
      ) : null}
    </form>
  );
}
