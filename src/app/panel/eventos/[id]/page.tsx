import { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getEventLiveStateAction } from "../../actions";
import { LiveRosterView } from "./live-roster-view";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const res = await getEventLiveStateAction(id);
  if (!res.success) {
    return { title: "Evento no encontrado · Brasipoker" };
  }
  return {
    title: `En vivo: Partida ${
      res.state.event.type === "cash" ? "Cash" : "Torneo"
    } · ${res.state.event.date}`,
    description: `Monitoreo en vivo de la partida de póker: ${res.state.occupiedSeats}/${res.state.capacity} plazas.`,
  };
}

export default async function LiveEventPage({ params }: PageProps) {
  const { id } = await params;
  const res = await getEventLiveStateAction(id);

  if (!res.success) {
    if (res.error.toLowerCase().includes("iniciar sesión")) {
      redirect("/login");
    }
    notFound();
  }

  return <LiveRosterView initialState={res.state} />;
}
