import { redirect } from "next/navigation";
import { createControlToken } from "@/lib/control-token";
import { randomRoomName } from "@/lib/rooms";

export const dynamic = "force-dynamic";

export default function HostPage() {
  const roomName = randomRoomName();
  const controlToken = createControlToken(roomName);

  redirect(`/host/${roomName}?control=${encodeURIComponent(controlToken)}`);
}
