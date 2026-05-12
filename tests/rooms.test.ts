import assert from "node:assert/strict";
import test from "node:test";
import { isValidRoomName, slugifyRoomName } from "@/lib/rooms";

test("room names accept shareable lowercase slugs", () => {
  assert.equal(isValidRoomName("gold-pulse-123"), true);
});

test("invalid guest route params are rejected before the guest flow mounts", () => {
  assert.equal(isValidRoomName("Bad%20Room"), false);
  assert.equal(isValidRoomName("bad room"), false);
  assert.equal(isValidRoomName("ab"), false);
});

test("typed room names slugify into valid route params", () => {
  const roomName = slugifyRoomName("Gold Pulse!!");

  assert.equal(roomName, "gold-pulse");
  assert.equal(isValidRoomName(roomName), true);
});
