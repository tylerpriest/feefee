import assert from "node:assert/strict";
import test from "node:test";
import {
  guestRoomPath,
  pushGuestRoomPathIfChanged,
  shouldPushGuestRoomPath,
} from "@/lib/guest-history";

test("guest room paths always auto-join", () => {
  assert.equal(guestRoomPath("gold-pulse"), "/room/gold-pulse?join=1");
});

test("initial auto-join does not duplicate the current history entry", () => {
  assert.equal(
    shouldPushGuestRoomPath("/room/gold-pulse?join=1", "gold-pulse"),
    false,
  );
});

test("switching rooms pushes the next room path", () => {
  const pushedPaths: string[] = [];
  const windowLike = {
    location: {
      pathname: "/room/gold-pulse",
      search: "?join=1",
    },
    history: {
      pushState: (_state: unknown, _unused: string, path?: string | URL | null) => {
        pushedPaths.push(String(path));
      },
    },
  } as Pick<Window, "history" | "location">;

  pushGuestRoomPathIfChanged(windowLike, "blue-wave");

  assert.deepEqual(pushedPaths, ["/room/blue-wave?join=1"]);
});
