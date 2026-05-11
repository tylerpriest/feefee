"use client";

import { RemoteAudioTrack, Room, RoomEvent, Track } from "livekit-client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchLiveRooms } from "@/lib/client-rooms";
import {
  getErrorMessage,
  getLiveKitUrl,
  requestLiveKitToken,
  withTimeout,
} from "@/lib/client-token";
import type { LiveRoomSummary } from "@/lib/room-metadata";
import { titleFromRoomName } from "@/lib/room-metadata";

type GuestStatus =
  | "idle"
  | "connecting"
  | "waiting"
  | "connected"
  | "playing"
  | "stopped"
  | "disconnected"
  | "error";

type GuestRoomProps = {
  roomName: string;
  autoJoin?: boolean;
};

type RoomsState = {
  rooms: LiveRoomSummary[];
  error: string;
  isLoading: boolean;
};

function statusText(status: GuestStatus) {
  switch (status) {
    case "idle":
      return "Ready";
    case "connecting":
      return "Joining";
    case "waiting":
      return "Waiting for music";
    case "connected":
      return "Connected";
    case "playing":
      return "Playing";
    case "stopped":
      return "Host stopped sharing";
    case "disconnected":
      return "Disconnected";
    case "error":
      return "Could not join";
  }
}

function statusDetail(status: GuestStatus) {
  switch (status) {
    case "idle":
      return "Tap Join audio when you are ready.";
    case "connecting":
      return "Joining the room.";
    case "waiting":
      return "You're in. Waiting for the host to share music.";
    case "connected":
      return "Audio is connected.";
    case "playing":
      return "Keep your headphones in.";
    case "stopped":
      return "Stay here if the host starts again.";
    case "disconnected":
      return "You left the room.";
    case "error":
      return "Try joining again.";
  }
}

function listenerLabel(count: number) {
  return `${count} listener${count === 1 ? "" : "s"}`;
}

export function GuestRoom({ roomName, autoJoin = false }: GuestRoomProps) {
  const [activeRoomName, setActiveRoomName] = useState(roomName);
  const [status, setStatus] = useState<GuestStatus>("idle");
  const [error, setError] = useState("");
  const [needsAudioTap, setNeedsAudioTap] = useState(false);
  const [{ rooms, error: roomsError, isLoading }, setRoomsState] =
    useState<RoomsState>({
      rooms: [],
      error: "",
      isLoading: true,
    });

  const hadAudioRef = useRef(false);
  const hasAutoJoinedRef = useRef(false);
  const roomRef = useRef<Room | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const remoteAudioTrackRef = useRef<RemoteAudioTrack | null>(null);
  const connectionRunRef = useRef(0);

  const activeRoom = useMemo(
    () => rooms.find((room) => room.roomName === activeRoomName),
    [activeRoomName, rooms],
  );
  const activeRoomTitle = activeRoom?.hostName ?? titleFromRoomName(activeRoomName);
  const currentRoomIndex = rooms.findIndex(
    (room) => room.roomName === activeRoomName,
  );
  const canCycleRooms = rooms.length > 1;

  const detachAudio = useCallback(() => {
    const audioElement = audioRef.current;
    const remoteAudioTrack = remoteAudioTrackRef.current;

    if (audioElement && remoteAudioTrack) {
      remoteAudioTrack.detach(audioElement);
      audioElement.pause();
      audioElement.removeAttribute("src");
      audioElement.load();
    }

    remoteAudioTrackRef.current = null;
    setNeedsAudioTap(false);
  }, []);

  const startPlayback = useCallback(async () => {
    const room = roomRef.current;
    const audioElement = audioRef.current;

    if (!room || !audioElement) {
      return;
    }

    try {
      await room.startAudio();

      if (remoteAudioTrackRef.current) {
        await audioElement.play();
        hadAudioRef.current = true;
        setStatus("playing");
      } else {
        setStatus("waiting");
      }

      setNeedsAudioTap(false);
      setError("");
    } catch {
      setNeedsAudioTap(true);
      setStatus(remoteAudioTrackRef.current ? "connected" : "waiting");
      setError("Tap Start audio to begin playback.");
    }
  }, []);

  const attachAudio = useCallback(
    (track: unknown) => {
      if (!(track instanceof RemoteAudioTrack) || track.kind !== Track.Kind.Audio) {
        return false;
      }

      const audioElement = audioRef.current;

      if (!audioElement) {
        return false;
      }

      if (remoteAudioTrackRef.current !== track) {
        detachAudio();
        track.attach(audioElement);
        remoteAudioTrackRef.current = track;
      }

      setStatus("connected");
      void startPlayback();
      return true;
    },
    [detachAudio, startPlayback],
  );

  const disconnectCurrentRoom = useCallback(
    async (nextStatus: GuestStatus) => {
      const room = roomRef.current;

      detachAudio();
      roomRef.current = null;
      await room?.disconnect(true).catch(() => undefined);
      setStatus(nextStatus);
    },
    [detachAudio],
  );

  const connectRoom = useCallback(
    async (nextRoomName: string) => {
      if (status === "connecting") {
        return;
      }

      if (roomRef.current && nextRoomName === activeRoomName) {
        return;
      }

      const runId = connectionRunRef.current + 1;
      connectionRunRef.current = runId;
      const isCurrentRun = () => connectionRunRef.current === runId;

      await disconnectCurrentRoom("disconnected");
      setActiveRoomName(nextRoomName);
      window.history.pushState(null, "", `/room/${nextRoomName}?join=1`);
      setStatus("connecting");
      setError("");
      setNeedsAudioTap(false);
      hadAudioRef.current = false;

      const room = new Room({
        adaptiveStream: false,
        dynacast: false,
      });

      roomRef.current = room;

      room
        .on(RoomEvent.TrackSubscribed, (track) => {
          if (!isCurrentRun()) {
            return;
          }

          attachAudio(track);
        })
        .on(RoomEvent.TrackUnsubscribed, (track) => {
          if (!isCurrentRun()) {
            return;
          }

          if (remoteAudioTrackRef.current === track) {
            detachAudio();
            setStatus(hadAudioRef.current ? "stopped" : "waiting");
          }
        })
        .on(RoomEvent.TrackUnpublished, () => {
          if (!isCurrentRun()) {
            return;
          }

          if (!remoteAudioTrackRef.current) {
            setStatus(hadAudioRef.current ? "stopped" : "waiting");
          }
        })
        .on(RoomEvent.Disconnected, () => {
          if (!isCurrentRun()) {
            return;
          }

          detachAudio();
          setStatus("disconnected");
        });

      try {
        await room.startAudio().catch(() => undefined);

        const token = await requestLiveKitToken(nextRoomName, "listener");
        await withTimeout(
          room.connect(getLiveKitUrl(), token),
          "Couldn't connect. Try again.",
        );

        if (!isCurrentRun()) {
          await room.disconnect(true).catch(() => undefined);
          return;
        }

        let foundAudio = false;

        room.remoteParticipants.forEach((participant) => {
          participant.trackPublications.forEach((publication) => {
            if (publication.track) {
              foundAudio = attachAudio(publication.track) || foundAudio;
            }
          });
        });

        if (!foundAudio) {
          setStatus("waiting");
        }
      } catch (joinError) {
        if (!isCurrentRun()) {
          await room.disconnect(true).catch(() => undefined);
          return;
        }

        detachAudio();
        await room.disconnect(true).catch(() => undefined);
        roomRef.current = null;
        setStatus("error");
        setError(getErrorMessage(joinError));
      }
    },
    [
      activeRoomName,
      attachAudio,
      detachAudio,
      disconnectCurrentRoom,
      status,
    ],
  );

  const joinAudio = useCallback(async () => {
    if (status === "connected" && needsAudioTap) {
      await startPlayback();
      return;
    }

    await connectRoom(activeRoomName);
  }, [activeRoomName, connectRoom, needsAudioTap, startPlayback, status]);

  const leave = useCallback(async () => {
    connectionRunRef.current += 1;
    await disconnectCurrentRoom("disconnected");
    setError("");
  }, [disconnectCurrentRoom]);

  useEffect(() => {
    return () => {
      connectionRunRef.current += 1;
      detachAudio();
      void roomRef.current?.disconnect(true);
    };
  }, [detachAudio]);

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

  useEffect(() => {
    if (!autoJoin || hasAutoJoinedRef.current) {
      return;
    }

    hasAutoJoinedRef.current = true;
    void connectRoom(activeRoomName);
  }, [activeRoomName, autoJoin, connectRoom]);

  const switchByOffset = useCallback(
    (offset: number) => {
      if (rooms.length === 0) {
        return;
      }

      const baseIndex = currentRoomIndex >= 0 ? currentRoomIndex : 0;
      const nextIndex = (baseIndex + offset + rooms.length) % rooms.length;

      void connectRoom(rooms[nextIndex].roomName);
    },
    [connectRoom, currentRoomIndex, rooms],
  );

  const switchRandom = useCallback(() => {
    const choices =
      rooms.length > 1
        ? rooms.filter((room) => room.roomName !== activeRoomName)
        : rooms;

    if (choices.length === 0) {
      return;
    }

    const room = choices[Math.floor(Math.random() * choices.length)];

    void connectRoom(room.roomName);
  }, [activeRoomName, connectRoom, rooms]);

  const isConnecting = status === "connecting";
  const canJoin =
    status === "idle" ||
    status === "disconnected" ||
    status === "error" ||
    (status === "connected" && needsAudioTap);
  const isInRoom =
    status === "waiting" ||
    status === "connected" ||
    status === "playing" ||
    status === "stopped";

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-5 py-6">
      <header className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-lime-300">
          Listening
        </p>
        <h1 className="mt-3 break-words text-4xl font-black leading-none text-stone-50">
          {activeRoomTitle}
        </h1>
        <p className="mt-2 break-all text-sm font-semibold text-stone-500">
          {activeRoomName}
        </p>
      </header>

      <p className="mb-5 text-3xl font-black text-stone-50">
        Put in headphones.
      </p>

      <section className="rounded-lg border border-stone-700/80 bg-stone-950/58 p-4">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-stone-400">
          Status
        </p>
        <p className="mt-3 text-3xl font-black text-stone-50">
          {statusText(status)}
        </p>
        <p className="mt-2 text-base font-semibold leading-6 text-stone-300">
          {statusDetail(status)}
        </p>
      </section>

      {error ? (
        <p className="mt-4 rounded-lg border border-red-400/40 bg-red-950/50 p-4 text-sm font-semibold leading-6 text-red-100">
          {error}
        </p>
      ) : null}

      <div className="mt-6 grid gap-3">
        <button
          type="button"
          onClick={joinAudio}
          disabled={!canJoin || isConnecting}
          className="flex h-16 w-full items-center justify-center rounded-lg bg-lime-300 px-6 text-xl font-black text-stone-950 transition hover:bg-lime-200 focus:outline-none focus:ring-4 focus:ring-lime-300/40 disabled:cursor-not-allowed disabled:bg-stone-700 disabled:text-stone-400"
        >
          {isConnecting
            ? "Joining..."
            : needsAudioTap
              ? "Start audio"
              : "Join audio"}
        </button>

        <button
          type="button"
          onClick={leave}
          disabled={!isInRoom}
          className="flex h-14 w-full items-center justify-center rounded-lg border border-stone-600 px-6 text-lg font-black text-stone-100 transition hover:bg-stone-800 focus:outline-none focus:ring-4 focus:ring-stone-400/20 disabled:cursor-not-allowed disabled:border-stone-800 disabled:text-stone-600"
        >
          Leave
        </button>
      </div>

      <details className="mt-6 rounded-lg border border-stone-800 bg-stone-950/42 p-4">
        <summary className="cursor-pointer text-sm font-black uppercase tracking-[0.16em] text-stone-400">
          Switch room
        </summary>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => switchByOffset(-1)}
            disabled={!canCycleRooms || isConnecting}
            className="h-12 rounded-md border border-stone-700 text-sm font-black text-stone-100 disabled:cursor-not-allowed disabled:text-stone-600"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={switchRandom}
            disabled={!canCycleRooms || isConnecting}
            className="h-12 rounded-md bg-stone-100 text-sm font-black text-stone-950 disabled:cursor-not-allowed disabled:bg-stone-700 disabled:text-stone-400"
          >
            Random
          </button>
          <button
            type="button"
            onClick={() => switchByOffset(1)}
            disabled={!canCycleRooms || isConnecting}
            className="h-12 rounded-md border border-stone-700 text-sm font-black text-stone-100 disabled:cursor-not-allowed disabled:text-stone-600"
          >
            Next
          </button>
        </div>

        {roomsError ? (
          <p className="mt-4 rounded-lg border border-red-400/40 bg-red-950/50 p-3 text-sm font-semibold leading-6 text-red-100">
            {roomsError}
          </p>
        ) : null}

        {isLoading ? (
          <p className="mt-4 text-base font-bold text-stone-400">
            Finding rooms...
          </p>
        ) : null}

        {!isLoading && rooms.length === 0 ? (
          <p className="mt-4 text-base font-bold text-stone-400">
            No rooms live right now.
          </p>
        ) : null}

        <div className="mt-4 grid gap-2">
          {rooms.map((room) => {
            const isCurrent = room.roomName === activeRoomName;

            return (
              <button
                key={room.roomName}
                type="button"
                onClick={() => void connectRoom(room.roomName)}
                disabled={isCurrent || isConnecting}
                className="rounded-lg border border-stone-800 bg-stone-900/70 p-3 text-left transition hover:border-lime-300/60 disabled:cursor-default disabled:border-lime-300/60"
              >
                <span className="flex items-start justify-between gap-3">
                  <span>
                    <span className="block text-lg font-black text-stone-50">
                      {room.hostName}
                    </span>
                    <span className="mt-1 block text-xs font-semibold text-stone-500">
                      {listenerLabel(room.listenerCount)}
                    </span>
                  </span>
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-black ${
                      room.isSharing
                        ? "bg-lime-300 text-stone-950"
                        : "bg-stone-800 text-stone-300"
                    }`}
                  >
                    {isCurrent ? "Here" : room.isSharing ? "Live" : "Waiting"}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </details>

      <audio ref={audioRef} autoPlay />
    </main>
  );
}
