import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicEventAction } from "./actions";
import { PublicPlayerView } from "./public-player-view";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const res = await getPublicEventAction(slug);
  if (!res.success) {
    return {
      title: "Evento no encontrado",
    };
  }
  return {
    title: `Partida ${res.data.type === "cash" ? "Cash" : "Torneo"} · ${res.data.date}`,
    description: `Convocatoria de póker en Brasipoker: ${res.data.occupiedSeats}/${res.data.capacity} plazas ocupadas.`,
  };
}

export default async function PublicEventPage({ params }: PageProps) {
  const { slug } = await params;
  const res = await getPublicEventAction(slug);

  if (!res.success) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-felt-950 text-chip">
      <PublicPlayerView initialData={res.data} />
    </main>
  );
}
