"use client";

import { useState, useTransition } from "react";
import { seedTestEventAction, SeedEventResult } from "./actions";

export function SeedEventCard() {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<SeedEventResult | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSeed = () => {
    startTransition(async () => {
      const res = await seedTestEventAction();
      setResult(res);
      setCopied(false);
    });
  };

  const copyUrl = (url: string) => {
    const fullUrl = `${window.location.origin}${url}`;
    navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="rounded-2xl border border-emerald-500/30 bg-felt-900 p-6 shadow-lg">
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="inline-block rounded-md bg-emerald-500/20 px-2 py-0.5 text-xs font-medium text-emerald-300">
            Vía temporal de pruebas (Issue #05)
          </span>
          <h2 className="mt-2 text-lg font-bold text-chip">
            Sembrar Evento de ensayo
          </h2>
          <p className="mt-1 text-sm text-chip/70">
            Crea un evento Cash de 6 plazas con lista de espera activada para probar el flujo de jugador desde el móvil o navegador.
          </p>
        </div>
      </div>

      <div className="mt-5">
        <button
          type="button"
          onClick={handleSeed}
          disabled={isPending}
          className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:bg-emerald-500 active:scale-[0.98] disabled:opacity-50 cursor-pointer"
        >
          {isPending ? "Sembrando evento..." : "♠️ Crear Evento de ensayo ahora"}
        </button>
      </div>

      {result && (
        <div className="mt-5 rounded-xl border border-white/10 bg-felt-950/80 p-4">
          {result.success ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
                <span>✓</span> Evento sembrado con éxito (slug: <code className="text-chip font-mono">{result.slug}</code>)
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <a
                  href={result.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/20 px-3.5 py-1.5 text-sm font-medium text-emerald-300 hover:bg-emerald-500/30 transition-colors cursor-pointer"
                >
                  Abrir enlace público de jugador ↗
                </a>
                <button
                  type="button"
                  onClick={() => copyUrl(result.url)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-felt-900 px-3.5 py-1.5 text-sm font-medium text-chip hover:bg-felt-800 transition-colors cursor-pointer"
                >
                  {copied ? "✓ ¡Enlace copiado!" : "Copiar enlace"}
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-red-400">Error: {result.error}</p>
          )}
        </div>
      )}
    </section>
  );
}
