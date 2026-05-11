"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { fetchLiveRooms } from "@/lib/client-rooms";
import { splitRoomsBySharing } from "@/lib/room-navigation";
import type { LiveRoomSummary } from "@/lib/room-metadata";
import { slugifyRoomName } from "@/lib/rooms";

type RoomsState = {
  rooms: LiveRoomSummary[];
  error: string;
  isLoading: boolean;
};

function listenerLabel(count: number) {
  return `${count} listener${count === 1 ? "" : "s"}`;
}

function RoomLink({ room }: { room: LiveRoomSummary }) {
  const shouldShowRoomName = slugifyRoomName(room.hostName) !== room.roomName;

  return (
    <Link
      href={`/room/${room.roomName}?join=1`}
      className={`rounded-lg border p-5 transition hover:border-[#c2ad78]/40 ${
        room.isSharing
          ? "border-stone-700/80 bg-stone-950/58"
          : "border-stone-800 bg-stone-900/70"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-2xl font-black text-stone-50">{room.hostName}</p>
          {shouldShowRoomName ? (
            <p className="mt-1 text-sm font-semibold text-stone-400">
              {room.roomName}
            </p>
          ) : null}
        </div>
        <span
          className={`rounded-full px-3 py-1 text-sm font-black ${
            room.isSharing
              ? "bg-[#c2ad78] text-stone-950"
              : "bg-stone-800 text-stone-300"
          }`}
        >
          {room.isSharing ? "Live" : "Waiting"}
        </span>
      </div>
      <p className="mt-4 text-base font-bold text-stone-300">
        {listenerLabel(room.listenerCount)}
      </p>
      <p className="mt-3 text-sm font-black text-[#c2ad78]">
        {room.isSharing ? "Join audio" : "Open room"}
      </p>
    </Link>
  );
}

export function LiveRooms() {
  const [{ rooms, error, isLoading }, setRoomsState] = useState<RoomsState>({
    rooms: [],
    error: "",
    isLoading: true,
  });
  const { liveRooms, waitingRooms } = useMemo(
    () => splitRoomsBySharing(rooms),
    [rooms],
  );

  useEffect(() => {
    let isActive = true;

    async function loadRooms() {
      try {
        const nextRooms = await fetchLiveRooms();

        if (isActive) {
          setRoomsState({
            rooms: nextRooms,
            error: "",
            isLoading: false,
          });
        }
      } catch (loadError) {
        if (isActive) {
          setRoomsState((current) => ({
            ...current,
            error:
              loadError instanceof Error
                ? loadError.message
                : "Could not load live rooms.",
            isLoading: false,
          }));
        }
      }
    }

    void loadRooms();
    const intervalId = window.setInterval(loadRooms, 5000);

    return () => {
      isActive = false;
      window.clearInterval(intervalId);
    };
  }, []);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-5 py-6">
      <header className="mb-7 flex items-start justify-between gap-4">
        <div>
          <Link
            href="/"
            className="text-sm font-semibold uppercase tracking-[0.16em] text-[#c2ad78]"
          >
            Feefee
          </Link>
          <h1 className="mt-3 text-4xl font-black leading-none text-stone-50">
            Live rooms
          </h1>
          <p className="mt-2 text-base font-semibold leading-6 text-stone-400">
            Pick a room and listen.
          </p>
        </div>
        <Link
          href="/host"
          className="rounded-md bg-[#c2ad78] px-3 py-2 text-sm font-black text-stone-950"
        >
          Host
        </Link>
      </header>

      {error ? (
        <p className="mb-4 rounded-lg border border-red-400/40 bg-red-950/50 p-4 text-sm font-semibold leading-6 text-red-100">
          {error}
        </p>
      ) : null}

      {isLoading ? (
        <section className="rounded-lg border border-stone-700/80 bg-stone-950/58 p-5">
          <p className="text-xl font-black text-stone-50">Finding rooms...</p>
        </section>
      ) : null}

      {!isLoading && rooms.length === 0 ? (
        <section className="rounded-lg border border-stone-700/80 bg-stone-950/58 p-5">
          <p className="text-2xl font-black text-stone-50">No one is live.</p>
          <p className="mt-2 text-base font-semibold leading-6 text-stone-300">
            Start a room or check back in a moment.
          </p>
          <Link
            href="/host"
            className="mt-5 flex h-14 w-full items-center justify-center rounded-lg bg-[#c2ad78] px-5 text-lg font-black text-stone-950"
          >
            Start a room
          </Link>
        </section>
      ) : null}

      <div className="grid gap-5">
        {rooms.length > 0 ? (
          <section className="rounded-lg border border-[#c2ad78]/30 bg-[#c2ad78]/5 p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-sm font-black uppercase tracking-[0.16em] text-[#c2ad78]">
                Playing now
              </h2>
              <span className="text-xs font-black text-stone-500">
                {liveRooms.length}
              </span>
            </div>
            {liveRooms.length > 0 ? (
              <div className="grid gap-3">
                {liveRooms.map((room) => (
                  <RoomLink key={room.roomName} room={room} />
                ))}
              </div>
            ) : (
              <p className="rounded-lg border border-stone-800 bg-stone-950/58 p-4 text-base font-bold text-stone-400">
                No rooms are playing right now.
              </p>
            )}
          </section>
        ) : null}

        {waitingRooms.length > 0 ? (
          <section className="rounded-lg border border-stone-800 bg-stone-950/40 p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-sm font-black uppercase tracking-[0.16em] text-stone-500">
                Not playing yet
              </h2>
              <span className="text-xs font-black text-stone-600">
                {waitingRooms.length}
              </span>
            </div>
            <div className="grid gap-3">
              {waitingRooms.map((room) => (
                <RoomLink key={room.roomName} room={room} />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
