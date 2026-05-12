import { notFound } from "next/navigation";
import { GuestRoom } from "@/components/guest-room";
import { isValidRoomName } from "@/lib/rooms";

type RoomPageProps = {
  params: Promise<{
    roomId: string;
  }>;
  searchParams: Promise<{
    join?: string;
  }>;
};

export default async function RoomPage({ params, searchParams }: RoomPageProps) {
  const { roomId } = await params;

  if (!isValidRoomName(roomId)) {
    notFound();
  }

  const { join } = await searchParams;

  return <GuestRoom roomName={roomId} autoJoin={join === "1"} />;
}
