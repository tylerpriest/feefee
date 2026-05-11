"use client";

import { RemoteAudioTrack, Room, RoomEvent, Track } from "livekit-client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  getErrorMessage,
  getLiveKitUrl,
  requestLiveKitToken,
  withTimeout,
} from "@/lib/client-token";

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

export function GuestRoom({ roomName, autoJoin = false }: GuestRoomProps) {
  const [status, setStatus] = useState<GuestStatus>("idle");
  const [error, setError] = useState("");
  const [needsAudioTap, setNeedsAudioTap] = useState(false);
  const hadAudioRef = useRef(false);
  const hasAutoJoinedRef = useRef(false);

  const roomRef = useRef<Room | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const remoteAudioTrackRef = useRef<RemoteAudioTrack | null>(null);

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

  const leave = useCallback(async () => {
    const room = roomRef.current;

    detachAudio();
    roomRef.current = null;
    await room?.disconnect(true).catch(() => undefined);
    setStatus("disconnected");
    setError("");
  }, [detachAudio]);

  useEffect(() => {
    return () => {
      detachAudio();
      void roomRef.current?.disconnect(true);
    };
  }, [detachAudio]);

  const joinAudio = useCallback(async () => {
    if (status === "connected" && needsAudioTap) {
      await startPlayback();
      return;
    }

    if (roomRef.current || status === "connecting") {
      return;
    }

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
        attachAudio(track);
      })
      .on(RoomEvent.TrackUnsubscribed, (track) => {
        if (remoteAudioTrackRef.current === track) {
          detachAudio();
          setStatus(hadAudioRef.current ? "stopped" : "waiting");
        }
      })
      .on(RoomEvent.TrackUnpublished, () => {
        if (!remoteAudioTrackRef.current) {
          setStatus(hadAudioRef.current ? "stopped" : "waiting");
        }
      })
      .on(RoomEvent.Disconnected, () => {
        detachAudio();
        setStatus("disconnected");
      });

    try {
      await room.startAudio().catch(() => undefined);

      const token = await requestLiveKitToken(roomName, "listener");
      await withTimeout(
        room.connect(getLiveKitUrl(), token),
        "Couldn't connect. Try again.",
      );

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
      detachAudio();
      await room.disconnect(true).catch(() => undefined);
      roomRef.current = null;
      setStatus("error");
      setError(getErrorMessage(joinError));
    }
  }, [attachAudio, detachAudio, needsAudioTap, roomName, startPlayback, status]);

  useEffect(() => {
    if (!autoJoin || hasAutoJoinedRef.current) {
      return;
    }

    hasAutoJoinedRef.current = true;
    void joinAudio();
  }, [autoJoin, joinAudio]);

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
      <header className="mb-7 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-lime-300">
            Feefee
          </p>
          <h1 className="mt-3 break-words text-4xl font-black leading-none text-stone-50">
            {roomName}
          </h1>
        </div>
        <Link
          href="/rooms"
          className="rounded-md border border-stone-700 px-3 py-2 text-sm font-black text-stone-200"
        >
          Change room
        </Link>
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

      <audio ref={audioRef} autoPlay />
    </main>
  );
}
