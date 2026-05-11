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

const tags = [
  "amber",
  "blue",
  "daily",
  "glow",
  "luna",
  "night",
  "nova",
  "radio",
  "ruby",
  "studio",
];

export function randomRoomName() {
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const tag = tags[Math.floor(Math.random() * tags.length)];

  return `${adjective}-${noun}-${tag}`;
}

export function isValidRoomName(roomName: string) {
  return ROOM_NAME_PATTERN.test(roomName);
}

export function slugifyRoomName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)
    .replace(/-+$/g, "");
}
