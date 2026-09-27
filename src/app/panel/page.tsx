export default function PanelHomePage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Panel del Organizador</h1>
        <p className="mt-1 text-chip/70">
          Aquí gestionarás tus Eventos: crear, difundir y monitorizar en vivo.
        </p>
      </div>
      <section className="rounded-2xl border border-white/10 bg-felt-900 p-6">
        <h2 className="font-semibold">Todavía no hay Eventos</h2>
        <p className="mt-2 text-sm text-chip/70">
          La creación de Eventos llega con el siguiente hito. Ahora mismo ya
          funcionan el registro y el login de Organizador con sesión
          persistente, y la app es instalable como PWA desde el móvil.
        </p>
      </section>
    </div>
  );
}
