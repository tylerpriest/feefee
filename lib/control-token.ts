import { createHmac, randomBytes, timingSafeEqual } from "crypto";

type ControlTokenPayload = {
  v: 1;
  roomName: string;
  nonce: string;
  iat: number;
};

const CONTROL_TOKEN_PREFIX = "ff1";

function getControlSecret() {
  const secret = process.env.LIVEKIT_API_SECRET;

  if (!secret) {
    throw new Error("LIVEKIT_API_SECRET is missing.");
  }

  return secret;
}

function encodePayload(payload: ControlTokenPayload) {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function signPayload(encodedPayload: string) {
  return createHmac("sha256", getControlSecret())
    .update(encodedPayload)
    .digest("base64url");
}

function signaturesMatch(actual: string, expected: string) {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);

  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

export function createControlToken(roomName: string) {
  const payload = encodePayload({
    v: 1,
    roomName,
    nonce: randomBytes(18).toString("base64url"),
    iat: Date.now(),
  });

  return `${CONTROL_TOKEN_PREFIX}.${payload}.${signPayload(payload)}`;
}

export function verifyControlToken(roomName: string, token: string) {
  const [prefix, payload, signature] = token.split(".");

  if (prefix !== CONTROL_TOKEN_PREFIX || !payload || !signature) {
    return false;
  }

  if (!signaturesMatch(signature, signPayload(payload))) {
    return false;
  }

  try {
    const data = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as Partial<ControlTokenPayload>;

    return data.v === 1 && data.roomName === roomName;
  } catch {
    return false;
  }
}
