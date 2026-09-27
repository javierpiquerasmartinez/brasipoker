import { SeedEventCard } from "./seed-event-card";

export default function PanelHomePage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Panel del Organizador</h1>
        <p className="mt-1 text-chip/70">
          Aquí gestionarás tus Eventos: crear, difundir y monitorizar en vivo.
        </p>
      </div>

      <SeedEventCard />

      <section className="rounded-2xl border border-white/10 bg-felt-900 p-6">
        <h2 className="font-semibold">Próximo Hito: Gestión Completa</h2>
        <p className="mt-2 text-sm text-chip/70">
          El panel completo para crear, editar y difundir convocatorias llegará en el Issue #06. Usa la tarjeta superior para sembrar un Evento de ensayo y probar el flujo de jugador en tiempo real.
        </p>
      </section>
    </div>
  );
}
