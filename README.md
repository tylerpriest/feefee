# Feefee

Feefee is a small web app for broadcasting one browser tab's audio to friends.

Core goal:

```text
Play song. Show QR. People hear it.
```

The host shares one browser tab's audio into a LiveKit room. Feefee shows a QR
code and lists active DJs at `/rooms`. Guests scan or pick a room, Feefee tries
to join immediately, and they listen in headphones. While listening, guests can
switch with Previous, Random, Next, or the room picker. Hosts can copy a private
host link to reuse the same room.

## LiveKit Cloud Setup

1. Create a LiveKit Cloud project at https://cloud.livekit.io.
2. Copy the project WebSocket URL. It looks like `wss://...livekit.cloud`.
3. Create an API key and API secret for the project.
4. Add the values to your local `.env.local` file and to Vercel.

## Environment Variables

```bash
LIVEKIT_API_KEY=your_api_key
LIVEKIT_API_SECRET=your_api_secret
NEXT_PUBLIC_LIVEKIT_URL=wss://your-project.livekit.cloud
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

`NEXT_PUBLIC_APP_URL` is optional in the browser. Feefee falls back to
`window.location.origin` when it is not set.

`LIVEKIT_URL` can also be used for the project URL locally. The app exposes it
to the browser as `NEXT_PUBLIC_LIVEKIT_URL` during the Next.js build/dev server.

## Local Dev

```bash
npm install
npm run dev
```

Open http://localhost:3000.

- `/host` lets the host type a room name and starts that exact slug.
- `/host/[roomId]` controls an existing host room when the browser has its private control token.
- `/rooms` lists active Feefee rooms.
- `/room/[roomId]` opens a room manually.
- `/room/[roomId]?join=1` auto-starts the listener join flow and lets listeners switch rooms without going back to `/rooms`.

## Vercel Deployment

1. Push the project to GitHub.
2. Import it in Vercel as a Next.js app.
3. Add `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, and `NEXT_PUBLIC_LIVEKIT_URL`.
4. Add `NEXT_PUBLIC_APP_URL` with your deployed app URL.
5. Deploy.

## Test With 3 Friends

1. Open `/host` in desktop Chrome or Edge.
2. Type a room name, for example `gold pulse`, and start the room.
3. Set a short DJ name or keep the generated name.
4. Copy the host control link if you want to keep this room for later.
5. Open YouTube, Spotify Web, SoundCloud, or another audio tab and start a song.
6. In Feefee, click Share music.
7. Pick the tab playing music and turn on tab audio.
8. Show the QR code or send friends to `/rooms`.
9. Friends scan the QR or choose the live room and put in headphones. Feefee tries to join immediately.
10. Friends can use Previous, Random, Next, or the inline room picker to switch rooms.
11. Stop sharing to confirm guests see that the host stopped sharing.
12. End room when done.

## Known Technical Limitations

- Hosting works best in desktop Chrome or Edge because browser tab-audio capture support varies.
- Firefox can join as a guest, but it may not provide tab audio when hosting.
- The host must pick the music tab and turn on tab audio.
- QR and live-room links auto-start the listener join flow with `?join=1`, but some mobile browsers may still require one extra tap before audio playback.
- The host control link is private. Anyone with that link can control that room.
- Typed room names are exact slugs. If a typed name is already active, only its existing host control link can control it.
