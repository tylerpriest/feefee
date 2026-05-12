import assert from "node:assert/strict";
import test from "node:test";
import { TrackSource, TrackType, type ParticipantInfo } from "livekit-server-sdk";
import {
  hostIdentityForRoom,
  participantHasHostAudio,
  roomRuntimeStateFromParticipants,
} from "@/lib/livekit-room-state";

function participant(
  identity: string,
  tracks: Array<{
    type: TrackType;
    source: TrackSource;
    muted?: boolean;
  }> = [],
) {
  return {
    identity,
    tracks: tracks.map((track) => ({
      ...track,
      muted: Boolean(track.muted),
    })),
  } as ParticipantInfo;
}

test("host room identity is stable", () => {
  assert.equal(hostIdentityForRoom("gold-pulse"), "host-gold-pulse");
});

test("published screen-share audio makes a room live", () => {
  const state = roomRuntimeStateFromParticipants("gold-pulse", [
    participant("host-gold-pulse", [
      {
        type: TrackType.AUDIO,
        source: TrackSource.SCREEN_SHARE_AUDIO,
      },
    ]),
    participant("listener-1"),
  ]);

  assert.deepEqual(state, {
    participantCount: 2,
    listenerCount: 1,
    isSharing: true,
  });
});

test("stale room metadata does not make a room live without host audio", () => {
  const state = roomRuntimeStateFromParticipants("gold-pulse", [
    participant("listener-1"),
    participant("listener-2"),
  ]);

  assert.deepEqual(state, {
    participantCount: 2,
    listenerCount: 2,
    isSharing: false,
  });
});

test("muted host audio is not treated as live", () => {
  assert.equal(
    participantHasHostAudio(
      participant("host-gold-pulse", [
        {
          type: TrackType.AUDIO,
          source: TrackSource.SCREEN_SHARE_AUDIO,
          muted: true,
        },
      ]),
    ),
    false,
  );
});
