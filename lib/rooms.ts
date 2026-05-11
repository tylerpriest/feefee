export const ROOM_NAME_PATTERN = /^[a-z0-9-]{3,64}$/;

const adjectives = [
  "bright",
  "clear",
  "fresh",
  "gold",
  "green",
  "happy",
  "loud",
  "mellow",
  "quick",
  "sunny",
];

const nouns = [
  "beat",
  "booth",
  "chorus",
  "groove",
  "hook",
  "jam",
  "loop",
  "mix",
  "pulse",
  "wave",
];

export function randomRoomName() {
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const suffix = Math.random().toString(36).slice(2, 6);

  return `${adjective}-${noun}-${suffix}`;
}

export function isValidRoomName(roomName: string) {
  return ROOM_NAME_PATTERN.test(roomName);
}
