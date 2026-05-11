import { notFound } from "next/navigation";
import { HostRoom } from "@/components/host-room";
import { isValidRoomName } from "@/lib/rooms";

export const dynamic = "force-dynamic";

type HostRoomPageProps = {
  params: Promise<{
    roomId: string;
  }>;
  searchParams: Promise<{
    control?: string | string[];
  }>;
};

export default async function HostRoomPage({
  params,
  searchParams,
}: HostRoomPageProps) {
  const { roomId } = await params;

  if (!isValidRoomName(roomId)) {
    notFound();
  }

  const { control } = await searchParams;
  const initialControlToken = Array.isArray(control) ? control[0] : control;

  return (
    <HostRoom roomName={roomId} initialControlToken={initialControlToken} />
  );
}
