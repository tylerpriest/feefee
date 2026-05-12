type GuestHistoryWindow = Pick<Window, "history" | "location">;

export function guestRoomPath(roomName: string) {
  return `/room/${roomName}?join=1`;
}

export function shouldPushGuestRoomPath(
  currentPath: string,
  nextRoomName: string,
) {
  return currentPath !== guestRoomPath(nextRoomName);
}

export function pushGuestRoomPathIfChanged(
  windowLike: GuestHistoryWindow,
  nextRoomName: string,
) {
  const currentPath = `${windowLike.location.pathname}${windowLike.location.search}`;
  const nextPath = guestRoomPath(nextRoomName);

  if (shouldPushGuestRoomPath(currentPath, nextRoomName)) {
    windowLike.history.pushState(null, "", nextPath);
  }
}
