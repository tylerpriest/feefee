type Env = Record<string, string | undefined>;

export function missingHostSetupVariables(env: Env = process.env) {
  const missing: string[] = [];

  if (!env.LIVEKIT_API_KEY) {
    missing.push("LIVEKIT_API_KEY");
  }

  if (!env.LIVEKIT_API_SECRET) {
    missing.push("LIVEKIT_API_SECRET");
  }

  if (!env.LIVEKIT_API_URL && !env.LIVEKIT_URL && !env.NEXT_PUBLIC_LIVEKIT_URL) {
    missing.push("NEXT_PUBLIC_LIVEKIT_URL");
  }

  return missing;
}

export function hostSetupError(env: Env = process.env) {
  const missing = missingHostSetupVariables(env);

  if (missing.length === 0) {
    return "";
  }

  return `Cannot start a room yet. Add ${missing.join(
    ", ",
  )} to your environment variables and restart the app.`;
}
