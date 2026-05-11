"use client";

import {
  ConnectionState,
  DisconnectReason,
  Room,
  RoomEvent,
  Track,
} from "livekit-client";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  getErrorMessage,
  getLiveKitUrl,
  requestLiveKitToken,
  withTimeout,
} from "@/lib/client-token";
import { deleteLiveRoom, fetchLiveRoom, updateLiveRoom } from "@/lib/client-rooms";
import {
  cleanHostName,
  parseFeefeeMetadata,
  titleFromRoomName,
} from "@/lib/room-metadata";

const NO_AUDIO_MESSAGE =
  "Choose the music tab and turn on tab audio.";
const UNSUPPORTED_CAPTURE_MESSAGE =
  "Use desktop Chrome or Edge to share tab audio.";
const MISSING_CONTROL_MESSAGE =
  "This host link cannot control the room. Start a new room.";

type DisplayMediaOptionsWithAudioHints = DisplayMediaStreamOptions & {
  preferCurrentTab?: boolean;
  selfBrowserSurface?: "include" | "exclude";
  surfaceSwitching?: "include" | "exclude";
  systemAudio?: "include" | "exclude";
  windowAudio?: "exclude" | "window" | "system";
};

type HostStatus =
  | "creating"
  | "connected"
  | "sharing"
  | "disconnected"
  | "taken-over"
  | "error";

type HostRoomProps = {
  roomName: string;
  initialControlToken?: string;
};

function getConfiguredOrigin() {
  return process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") ?? "";
}

function getClientOrigin() {
  return getConfiguredOrigin() || window.location.origin.replace(/\/$/, "");
}

function subscribeToOriginChange() {
  return () => undefined;
}

function stopTracks(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

function statusText(status: HostStatus, isSharing: boolean) {
  if (isSharing) {
    return "Music is live";
  }

  switch (status) {
    case "creating":
      return "Getting room ready";
    case "connected":
      return "Ready to share";
    case "sharing":
      return "Music is live";
    case "disconnected":
      return "Room ended";
    case "taken-over":
      return "Opened somewhere else";
    case "error":
      return "Needs attention";
  }
}

function listenerLabel(count: number) {
  return `${count} listener${count === 1 ? "" : "s"}`;
}

function getControlStorageKey(roomName: string) {
  return `feefee.control.${roomName}`;
}

function getControllerStorageKey(roomName: string) {
  return `feefee.controller.${roomName}`;
}

function getControllerChannelName(roomName: string) {
  return `feefee-controller-${roomName}`;
}

function isTakeoverDisconnect(reason?: DisconnectReason) {
  return (
    reason === DisconnectReason.DUPLICATE_IDENTITY ||
    reason === DisconnectReason.PARTICIPANT_REMOVED
  );
}

function makeControllerId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function getDisplayMediaOptions(): DisplayMediaOptionsWithAudioHints {
  return {
    audio: true,
    video: true,
    preferCurrentTab: false,
    selfBrowserSurface: "exclude",
    surfaceSwitching: "include",
    systemAudio: "include",
    windowAudio: "system",
  };
}

function getNoAudioMessage() {
  if (navigator.userAgent.includes("Firefox")) {
    return "Firefox did not share tab audio. Try Chrome or Edge on desktop.";
  }

  return NO_AUDIO_MESSAGE;
}

export function HostRoom({ roomName, initialControlToken }: HostRoomProps) {
  const defaultHostName = useMemo(() => titleFromRoomName(roomName), [roomName]);
  const appOrigin = useSyncExternalStore(
    subscribeToOriginChange,
    getClientOrigin,
    getConfiguredOrigin,
  );
  const [hostName, setHostName] = useState(defaultHostName);
  const [status, setStatus] = useState<HostStatus>("creating");
  const [listenerCount, setListenerCount] = useState(0);
  const [error, setError] = useState("");
  const [isSharing, setIsSharing] = useState(false);
  const [isShareBusy, setIsShareBusy] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedHost, setCopiedHost] = useState(false);
  const [controlToken, setControlToken] = useState<string | null>();
  const [hasLoadedRoom, setHasLoadedRoom] = useState(false);

  const roomRef = useRef<Room | null>(null);
  const captureStreamRef = useRef<MediaStream | null>(null);
  const sharedAudioTrackRef = useRef<MediaStreamTrack | null>(null);
  const hostNameRef = useRef(defaultHostName);
  const wasTakenOverRef = useRef(false);
  const controllerIdRef = useRef(makeControllerId());

  const roomLink = useMemo(() => {
    if (!appOrigin) {
      return "";
    }

    return `${appOrigin}/room/${roomName}?join=1`;
  }, [appOrigin, roomName]);

  const hostControlLink = useMemo(() => {
    if (!appOrigin || !controlToken) {
      return "";
    }

    return `${appOrigin}/host/${roomName}?control=${encodeURIComponent(
      controlToken,
    )}`;
  }, [appOrigin, controlToken, roomName]);

  useEffect(() => {
    const storageKey = getControlStorageKey(roomName);
    const tokenFromUrl = initialControlToken?.trim();
    const storedToken = window.localStorage.getItem(storageKey)?.trim();
    const nextToken = tokenFromUrl || storedToken || null;

    if (tokenFromUrl) {
      const url = new URL(window.location.href);
      url.searchParams.delete("control");
      window.history.replaceState(
        null,
        "",
        `${url.pathname}${url.search}${url.hash}`,
      );
    }

    const timeoutId = window.setTimeout(() => {
      setControlToken(nextToken);

      if (!nextToken) {
        setStatus("error");
        setError(MISSING_CONTROL_MESSAGE);
        setHasLoadedRoom(true);
      }
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [initialControlToken, roomName]);

  useEffect(() => {
    if (!controlToken) {
      return;
    }

    let isActive = true;

    async function loadRoom() {
      setHasLoadedRoom(false);

      try {
        const room = await fetchLiveRoom(roomName);

        if (isActive) {
          hostNameRef.current = room.hostName;
          setHostName(room.hostName);
        }
      } catch {
        // A saved host link can recreate the room when the host reconnects.
      } finally {
        if (isActive) {
          setHasLoadedRoom(true);
        }
      }
    }

    void loadRoom();

    return () => {
      isActive = false;
    };
  }, [controlToken, roomName]);

  useEffect(() => {
    hostNameRef.current = cleanHostName(hostName, defaultHostName);
  }, [defaultHostName, hostName]);

  const markTakenOver = useCallback(
    (room?: Room | null) => {
      wasTakenOverRef.current = true;
      stopTracks(captureStreamRef.current);
      captureStreamRef.current = null;
      sharedAudioTrackRef.current = null;
      setStatus("taken-over");
      setListenerCount(0);
      setIsSharing(false);
      setError("Host opened somewhere else.");
      void room?.disconnect(true);
    },
    [],
  );

  useEffect(() => {
    if (!controlToken) {
      return;
    }

    const storageKey = getControllerStorageKey(roomName);
    const channel =
      "BroadcastChannel" in window
        ? new BroadcastChannel(getControllerChannelName(roomName))
        : null;

    function handleStorage(event: StorageEvent) {
      if (
        event.key === storageKey &&
        event.newValue &&
        event.newValue !== controllerIdRef.current
      ) {
        markTakenOver(roomRef.current);
      }
    }

    function handleChannelMessage(event: MessageEvent<string>) {
      if (event.data && event.data !== controllerIdRef.current) {
        markTakenOver(roomRef.current);
      }
    }

    window.addEventListener("storage", handleStorage);
    channel?.addEventListener("message", handleChannelMessage);

    return () => {
      window.removeEventListener("storage", handleStorage);
      channel?.removeEventListener("message", handleChannelMessage);
      channel?.close();
    };
  }, [controlToken, markTakenOver, roomName]);

  const publishRoomState = useCallback(
    (nextSharing: boolean) => {
      if (!controlToken || wasTakenOverRef.current) {
        return Promise.resolve();
      }

      return updateLiveRoom(roomName, {
        hostName: hostNameRef.current,
        isSharing: nextSharing,
        controllerId: controllerIdRef.current,
      }, controlToken).catch(() => undefined);
    },
    [controlToken, roomName],
  );

  const stopSharing = useCallback(async () => {
    const room = roomRef.current;
    const audioTrack = sharedAudioTrackRef.current;

    if (room && audioTrack) {
      await room.localParticipant
        .unpublishTrack(audioTrack, false)
        .catch(() => undefined);
    }

    stopTracks(captureStreamRef.current);
    captureStreamRef.current = null;
    sharedAudioTrackRef.current = null;
    setIsSharing(false);
    await publishRoomState(false);

    if (room?.state === ConnectionState.Connected) {
      setStatus("connected");
    }
  }, [publishRoomState]);

  useEffect(() => {
    if (controlToken === undefined || !hasLoadedRoom) {
      return;
    }

    if (!controlToken) {
      return;
    }

    const hostControlToken = controlToken;
    let isActive = true;
    wasTakenOverRef.current = false;

    const room = new Room({
      adaptiveStream: false,
      dynacast: false,
    });

    const syncListenerCount = () => {
      if (isActive) {
        setListenerCount(room.remoteParticipants.size);
      }
    };

    room
      .on(RoomEvent.Connected, () => {
        if (isActive) {
          setStatus("connected");
          syncListenerCount();
        }
      })
      .on(RoomEvent.ParticipantConnected, syncListenerCount)
      .on(RoomEvent.ParticipantDisconnected, syncListenerCount)
      .on(RoomEvent.Reconnecting, () => {
        if (isActive) {
          setStatus("creating");
        }
      })
      .on(RoomEvent.Reconnected, () => {
        if (isActive) {
          setStatus(sharedAudioTrackRef.current ? "sharing" : "connected");
          syncListenerCount();
        }
      })
      .on(RoomEvent.RoomMetadataChanged, (metadataString) => {
        const metadata = parseFeefeeMetadata(metadataString);

        if (
          isActive &&
          metadata?.controllerId &&
          metadata.controllerId !== controllerIdRef.current
        ) {
          markTakenOver(room);
        }
      })
      .on(RoomEvent.Disconnected, (reason) => {
        if (isActive) {
          const wasTakenOver =
            wasTakenOverRef.current || isTakeoverDisconnect(reason);

          if (wasTakenOver) {
            wasTakenOverRef.current = true;
          }

          stopTracks(captureStreamRef.current);
          captureStreamRef.current = null;
          sharedAudioTrackRef.current = null;
          setStatus(wasTakenOver ? "taken-over" : "disconnected");
          setListenerCount(0);
          setIsSharing(false);
          setError(wasTakenOver ? "Host opened somewhere else." : "");
        }
      });

    async function connectHost() {
      setStatus("creating");
      setError("");

      try {
        const token = await requestLiveKitToken(
          roomName,
          "host",
          hostControlToken,
        );
        await withTimeout(
          room.connect(getLiveKitUrl(), token),
          "Couldn't connect. Try again.",
        );

        if (!isActive) {
          await room.disconnect(true);
          return;
        }

        roomRef.current = room;
        window.localStorage.setItem(
          getControlStorageKey(roomName),
          hostControlToken,
        );
        setStatus("connected");
        syncListenerCount();
        void publishRoomState(false);
      } catch (connectError) {
        if (isActive) {
          setStatus("error");
          setError(getErrorMessage(connectError));
        }
      }
    }

    void connectHost();

    return () => {
      isActive = false;
      stopTracks(captureStreamRef.current);
      captureStreamRef.current = null;
      sharedAudioTrackRef.current = null;
      if (!wasTakenOverRef.current) {
        void publishRoomState(false);
      }
      void room.disconnect(true);
    };
  }, [controlToken, hasLoadedRoom, markTakenOver, publishRoomState, roomName]);

  useEffect(() => {
    if (
      !controlToken ||
      wasTakenOverRef.current ||
      (status !== "connected" && status !== "sharing")
    ) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void fetchLiveRoom(roomName)
        .then((room) => {
          if (
            room.controllerId &&
            room.controllerId !== controllerIdRef.current
          ) {
            markTakenOver(roomRef.current);
          }
        })
        .catch(() => undefined);
    }, 2500);

    return () => window.clearInterval(intervalId);
  }, [controlToken, markTakenOver, roomName, status]);

  useEffect(() => {
    if (status !== "connected" && status !== "sharing") {
      return;
    }

    window.localStorage.setItem(
      getControllerStorageKey(roomName),
      controllerIdRef.current,
    );

    if ("BroadcastChannel" in window) {
      const channel = new BroadcastChannel(getControllerChannelName(roomName));
      channel.postMessage(controllerIdRef.current);
      channel.close();
    }

    const timeoutId = window.setTimeout(() => {
      void publishRoomState(isSharing);
    }, 500);

    return () => window.clearTimeout(timeoutId);
  }, [hostName, isSharing, publishRoomState, roomName, status]);

  const shareMusic = useCallback(async () => {
    const room = roomRef.current;

    if (!room || room.state !== ConnectionState.Connected) {
      setError("The room is not connected yet.");
      return;
    }

    setIsShareBusy(true);
    setError("");

    try {
      if (!navigator.mediaDevices?.getDisplayMedia) {
        setError(UNSUPPORTED_CAPTURE_MESSAGE);
        return;
      }

      if (sharedAudioTrackRef.current) {
        await stopSharing();
      }

      const stream = await navigator.mediaDevices.getDisplayMedia(
        getDisplayMediaOptions(),
      );
      const [audioTrack] = stream.getAudioTracks();

      if (!audioTrack) {
        stopTracks(stream);
        setError(getNoAudioMessage());
        return;
      }

      audioTrack.contentHint = "music";
      audioTrack.addEventListener(
        "ended",
        () => {
          if (sharedAudioTrackRef.current === audioTrack) {
            void stopSharing();
          }
        },
        { once: true },
      );

      captureStreamRef.current = stream;
      sharedAudioTrackRef.current = audioTrack;

      await room.localParticipant.publishTrack(audioTrack, {
        name: "feefee-tab-audio",
        source: Track.Source.ScreenShareAudio,
      });

      stream.getVideoTracks().forEach((videoTrack) => {
        videoTrack.enabled = false;
      });

      setIsSharing(true);
      setStatus("sharing");
      await publishRoomState(true);
    } catch (shareError) {
      stopTracks(captureStreamRef.current);
      captureStreamRef.current = null;
      sharedAudioTrackRef.current = null;
      setIsSharing(false);
      await publishRoomState(false);

      if (shareError instanceof DOMException && shareError.name === "NotAllowedError") {
        setError("Sharing was cancelled.");
      } else {
        setError(getErrorMessage(shareError));
      }
    } finally {
      setIsShareBusy(false);
    }
  }, [publishRoomState, stopSharing]);

  const endRoom = useCallback(async () => {
    if (!controlToken) {
      setError(MISSING_CONTROL_MESSAGE);
      return;
    }

    setIsLeaving(true);
    setError("");
    wasTakenOverRef.current = false;

    try {
      await stopSharing();
      await deleteLiveRoom(roomName, controlToken);
      await roomRef.current?.disconnect(true).catch(() => undefined);
      setStatus("disconnected");
      setListenerCount(0);
    } catch (leaveError) {
      setError(getErrorMessage(leaveError));
    } finally {
      setIsLeaving(false);
    }
  }, [controlToken, roomName, stopSharing]);

  const copyLink = useCallback(async () => {
    if (!roomLink) {
      return;
    }

    try {
      await navigator.clipboard.writeText(roomLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setError("Could not copy the link. Select it from the box instead.");
    }
  }, [roomLink]);

  const copyHostLink = useCallback(async () => {
    if (!hostControlLink) {
      return;
    }

    try {
      await navigator.clipboard.writeText(hostControlLink);
      setCopiedHost(true);
      window.setTimeout(() => setCopiedHost(false), 1600);
    } catch {
      setError("Could not copy the host link. Select it from the box instead.");
    }
  }, [hostControlLink]);

  const isConnected = status === "connected" || status === "sharing";
  const showLocalHelper =
    process.env.NODE_ENV === "development" && roomLink.includes("192.168.");

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-5 py-6">
      <nav className="mb-8">
        <Link
          href="/"
          className="text-sm font-black uppercase tracking-[0.16em] text-[#c2ad78]"
        >
          Feefee
        </Link>
      </nav>

      <header className="mb-5">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-stone-500">
          Host control
        </p>
        <h1 className="mt-3 text-4xl font-black leading-none text-stone-50">
          {defaultHostName}
        </h1>
      </header>

      <section className="rounded-lg border border-stone-700/80 bg-stone-950/58 p-4">
        <label className="text-sm font-semibold uppercase tracking-[0.16em] text-stone-400">
          Room title
          <input
            value={hostName}
            onChange={(event) => setHostName(event.target.value)}
            maxLength={32}
            className="mt-3 h-12 w-full rounded-md border border-stone-700 bg-stone-900 px-3 text-base font-black text-stone-100 outline-none focus:border-[#c2ad78]"
          />
        </label>
      </section>

      <section className="mt-4 rounded-lg border border-stone-700/80 bg-stone-950/58 p-4">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-stone-400">
          Status
        </p>
        <p className="mt-3 text-3xl font-black text-stone-50">
          {statusText(status, isSharing)}
        </p>
        <p className="mt-2 text-base font-semibold text-stone-300">
          {listenerLabel(listenerCount)}
        </p>
      </section>

      {error ? (
        <p className="mt-4 rounded-lg border border-red-400/40 bg-red-950/50 p-4 text-sm font-semibold leading-6 text-red-100">
          {error}
        </p>
      ) : null}

      <section className="mt-5 grid gap-3">
        <div className="rounded-lg border border-stone-800 bg-stone-950/42 p-4">
          <ol className="grid gap-3 text-base font-bold leading-6 text-stone-200">
            <li>1. Play music in another tab.</li>
            <li>2. Click Share music.</li>
            <li>3. Pick that tab and turn on tab audio.</li>
          </ol>
        </div>

        <button
          type="button"
          onClick={shareMusic}
          disabled={!isConnected || isSharing || isShareBusy || isLeaving}
          className="flex h-16 w-full items-center justify-center rounded-lg bg-[#c2ad78] px-6 text-xl font-black text-stone-950 transition hover:bg-[#d2c18f] focus:outline-none focus:ring-4 focus:ring-[#c2ad78]/25 disabled:cursor-not-allowed disabled:bg-stone-700 disabled:text-stone-400"
        >
          {isShareBusy ? "Sharing..." : isSharing ? "Music is live" : "Share music"}
        </button>

        <button
          type="button"
          onClick={stopSharing}
          disabled={!isSharing || isShareBusy || isLeaving}
          className="flex h-14 w-full items-center justify-center rounded-lg border border-stone-600 px-6 text-lg font-black text-stone-100 transition hover:bg-stone-800 focus:outline-none focus:ring-4 focus:ring-stone-400/20 disabled:cursor-not-allowed disabled:border-stone-800 disabled:text-stone-600"
        >
          Stop sharing
        </button>
      </section>

      <section className="mt-6 rounded-lg border border-stone-700/80 bg-stone-950/58 p-4">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-stone-400">
          Show this QR
        </p>
        <div className="mt-4 flex justify-center rounded-lg bg-stone-50 p-4">
          {roomLink ? (
            <QRCodeSVG
              value={roomLink}
              size={240}
              level="M"
              title={`Join ${hostName || roomName} on Feefee`}
              bgColor="#fafaf9"
              fgColor="#11130f"
            />
          ) : (
            <div className="flex h-[240px] w-[240px] items-center justify-center text-sm font-bold text-stone-600">
              Preparing QR
            </div>
          )}
        </div>
        <div className="mt-4 flex gap-2">
          <input
            readOnly
            value={roomLink || "Preparing link..."}
            className="h-12 min-w-0 flex-1 rounded-md border border-stone-700 bg-stone-900 px-3 text-sm font-semibold text-stone-100"
          />
          <button
            type="button"
            onClick={copyLink}
            disabled={!roomLink}
            className="h-12 rounded-md bg-stone-100 px-4 text-sm font-black text-stone-950 transition hover:bg-white disabled:cursor-not-allowed disabled:bg-stone-700 disabled:text-stone-400"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        {showLocalHelper ? (
          <p className="mt-3 text-sm font-semibold leading-5 text-stone-400">
            Phones should scan this QR, not localhost.
          </p>
        ) : null}
      </section>

      <details className="mt-4 rounded-lg border border-stone-800 bg-stone-950/42 p-4">
        <summary className="cursor-pointer text-sm font-black uppercase tracking-[0.16em] text-stone-400">
          Keep this room
        </summary>
        <p className="mt-3 text-sm font-semibold leading-5 text-stone-400">
          Copy this private link to run the same room again.
        </p>
        <div className="mt-3 flex gap-2">
          <input
            readOnly
            value={hostControlLink || "Preparing host link..."}
            className="h-11 min-w-0 flex-1 rounded-md border border-stone-800 bg-stone-900 px-3 text-xs font-semibold text-stone-300"
          />
          <button
            type="button"
            onClick={copyHostLink}
            disabled={!hostControlLink}
            className="h-11 rounded-md border border-stone-600 px-3 text-sm font-black text-stone-100 transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:border-stone-800 disabled:text-stone-600"
          >
            {copiedHost ? "Copied" : "Copy"}
          </button>
        </div>
      </details>

      <button
        type="button"
        onClick={endRoom}
        disabled={
          !controlToken ||
          status === "disconnected" ||
          status === "taken-over" ||
          isLeaving
        }
        className="mt-5 flex h-14 w-full items-center justify-center rounded-lg border border-red-300/40 px-6 text-lg font-black text-red-100 transition hover:bg-red-950/50 focus:outline-none focus:ring-4 focus:ring-red-300/20 disabled:cursor-not-allowed disabled:border-stone-800 disabled:text-stone-600"
      >
        {isLeaving ? "Ending..." : "End room"}
      </button>
    </main>
  );
}
