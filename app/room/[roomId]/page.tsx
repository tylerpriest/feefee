import { GuestRoom } from "@/components/guest-room";

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
  const { join } = await searchParams;

  return <GuestRoom roomName={roomId} autoJoin={join === "1"} />;
}
