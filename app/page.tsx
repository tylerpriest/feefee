import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center px-6 py-10">
      <p className="mb-4 text-sm font-semibold uppercase tracking-[0.16em] text-[#c2ad78]">
        Feefee
      </p>
      <h1 className="text-5xl font-black leading-none text-stone-50 sm:text-6xl">
        Play song.
        <br />
        Show QR.
        <br />
        People hear it.
      </h1>
      <p className="mt-6 max-w-md text-lg leading-7 text-stone-300">
        Broadcast whatever is playing in one browser tab. Friends scan the QR
        and listen in headphones.
      </p>
      <div className="mt-10 grid gap-3">
        <Link
          href="/host"
          className="flex h-16 w-full items-center justify-center rounded-lg bg-[#c2ad78] px-6 text-xl font-black text-stone-950 transition hover:bg-[#d2c18f] focus:outline-none focus:ring-4 focus:ring-[#c2ad78]/25"
        >
          Start a room
        </Link>
        <Link
          href="/rooms"
          className="flex h-14 w-full items-center justify-center rounded-lg border border-stone-600 px-6 text-lg font-black text-stone-100 transition hover:bg-stone-800 focus:outline-none focus:ring-4 focus:ring-stone-400/20"
        >
          Join a live room
        </Link>
      </div>
    </main>
  );
}
