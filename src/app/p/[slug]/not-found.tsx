import Link from "next/link";
import { SpadeLogo } from "@/components/spade-logo";

export default function EventNotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-felt-950 px-4 text-center text-chip">
      <SpadeLogo className="h-12 w-12 text-chip/30 mb-4" />
      <h1 className="text-2xl font-bold">Convocatoria no encontrada</h1>
      <p className="mt-2 text-sm text-chip/60 max-w-sm">
        El enlace que has abierto no corresponde a ninguna partida activa. Comprueba que la dirección sea correcta o pide un nuevo enlace al organizador.
      </p>
      <Link
        href="/login"
        className="mt-6 rounded-xl border border-white/20 bg-felt-900 px-4 py-2 text-sm font-semibold text-chip hover:bg-felt-800 transition-colors"
      >
        Ir a Brasipoker
      </Link>
    </div>
  );
}
