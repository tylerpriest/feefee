# Feefee

Feefee is a small web app for broadcasting one browser tab's audio to friends.

Core goal:

```text
Play song. Show QR. People hear it.
```

The host shares audio from a browser tab into a LiveKit room. Feefee shows a QR
code and also lists live rooms at `/rooms`. Guests scan the QR or choose a live
room, tap Join audio, and hear the host's audio. Hosts can copy a private host
control link to run the same room again later.

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

- `/host` starts a room.
- `/host/[roomId]` controls an existing host room when the browser has its private control token.
- `/rooms` lists active Feefee rooms.
- `/room/[roomId]` joins a room directly.

## Vercel Deployment

1. Push the project to GitHub.
2. Import it in Vercel as a Next.js app.
3. Add `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, and `NEXT_PUBLIC_LIVEKIT_URL`.
4. Add `NEXT_PUBLIC_APP_URL` with your deployed app URL.
5. Deploy.

## Test With 3 Friends

1. Open `/host` in desktop Chrome.
2. Set a short DJ name or keep the generated name.
3. Copy the host control link if you want to keep this room for later.
4. Open YouTube, Spotify Web, SoundCloud, or another audio tab and start a song.
5. In Feefee, click Share music.
6. Choose the tab playing music and enable Share tab audio.
7. Show the QR code or send friends to `/rooms`.
8. Friends scan the QR or choose the live room, put in headphones, and tap Join audio.
9. Stop sharing to confirm guests see that the host stopped sharing.
10. End room when done.

## Known Technical Limitations

- Hosting is desktop Chrome-first because browser tab-audio capture support varies.
- The host must choose the music tab and enable Share tab audio.
- Guests must tap Join audio because mobile browsers require a user gesture before audio playback.
- The host control link is private. Anyone with that link can control that room.
