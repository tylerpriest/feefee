# Feefee

Feefee lets one person share the audio from a browser tab with friends.

```text
Play song. Show QR. People hear it.
```

Open Feefee, start a room, share a music tab, and friends listen from their own
phones in headphones.

Live app: <https://feefee.vercel.app>

## How To Use

1. Open <https://feefee.vercel.app>.
2. Click **Start a room**.
3. Open Spotify, YouTube, SoundCloud, or another audio site in a browser tab.
4. Start playing music in that tab.
5. In Feefee, click **Share music**.
6. Pick the tab playing music and turn on tab audio.
7. Share the QR code or room URL.
8. Friends open the link, put in headphones, and listen.

## What It Is

- A tiny browser-tab audio room.
- A QR-first way for friends to join from phones.
- A LiveKit/WebRTC app with one host sending audio.
- A simple utility for shared listening without accounts.

## What It Is Not

- Not a music streaming service.
- Not a Spotify, YouTube, or SoundCloud replacement.
- Not a downloader, recorder, file host, or media library.
- Not a chat app, social network, or playlist platform.
- Not a private security product. Anyone with a host control link can control
  that room.

## Features

- Start named rooms from `/host`.
- Share one browser tab's audio.
- Show a QR code for guests.
- List live rooms at `/rooms`.
- Let listeners switch rooms with Previous, Random, Next, or the room picker.
- Keep a private host link for returning to the same room.
- Publish high-quality stereo music by default.

## Non-Features

- No accounts.
- No saved profiles.
- No payments.
- No ads.
- No analytics dashboard.
- No in-app chat.
- No uploads.
- No permanent room database.
- No mobile browser hosting as the main path.

## Best Use

Use Feefee for small, casual listening with friends. The host should use desktop
Chrome or Edge, because browser tab-audio capture support varies.

## Privacy Notes

- LiveKit secrets belong in environment variables, not source control.
- `.env.local`, `.vercel`, `.next`, and `node_modules` are ignored by git.
- `NEXT_PUBLIC_LIVEKIT_URL` is public because the browser needs it.
- Host control links are private capability URLs.
- Room names and host names can appear in the public live-room list.

## Local Dev

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

## Environment Variables

```bash
LIVEKIT_API_KEY=your_api_key
LIVEKIT_API_SECRET=your_api_secret
NEXT_PUBLIC_LIVEKIT_URL=wss://your-project.livekit.cloud
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Create a LiveKit Cloud project at <https://cloud.livekit.io>, copy the WebSocket
URL, and create an API key and secret.

## Deploy

Deploy as a Next.js app on Vercel and add:

- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`
- `NEXT_PUBLIC_LIVEKIT_URL`
- `NEXT_PUBLIC_APP_URL`

## Tests

```bash
npm run test
npm run lint
npm run build
```

## Public Repo Note

`package.json` has `"private": true` only to prevent accidental npm publishing.
That does not make the GitHub repo private.

No license has been selected yet, so this is public source rather than an
open-source project until a license is added.
