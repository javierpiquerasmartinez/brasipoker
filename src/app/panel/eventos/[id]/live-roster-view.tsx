"use client";

import { useEffect, useState, useTransition, useCallback } from "react";
import Link from "next/link";
import { VisibleEventState } from "@/domain/types";
import { getEventLiveStateAction, getWhatsAppTextAction } from "../../actions";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatSpanishDate, capitalizeFirstLetter } from "@/lib/formatters";
import { getEventVisualCycle } from "@/domain/event-cycle";

interface LiveRosterViewProps {
  initialState: VisibleEventState;
}

export function LiveRosterView({ initialState }: LiveRosterViewProps) {
  const [state, setState] = useState<VisibleEventState>(initialState);
  const [isPending, startTransition] = useTransition();
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // WhatsApp share modal state
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [whatsappText, setWhatsappText] = useState("");
  const [isLoadingWhatsapp, setIsLoadingWhatsapp] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const event = state.event;
  const cycle = getEventVisualCycle(event);

  // Reload live state
  const reloadState = useCallback(() => {
    startTransition(async () => {
      const res = await getEventLiveStateAction(event.id);
      if (res.success) {
        setState(res.state);
        setLastUpdated(new Date());
      }
    });
  }, [event.id]);

  // Subscribe to Realtime changes on both registrations and events for this event
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`live-roster-${event.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "registrations",
          filter: `event_id=eq.${event.id}`,
        },
        () => {
          reloadState();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "events",
          filter: `id=eq.${event.id}`,
        },
        () => {
          reloadState();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [event.id, reloadState]);

  // Handle open WhatsApp diffusion modal
  const handleOpenShare = async () => {
    setShareModalOpen(true);
    setIsLoadingWhatsapp(true);
    setCopiedMessage(false);
    setCopiedLink(false);

    const baseUrl =
      typeof window !== "undefined" ? window.location.origin : "";
    const res = await getWhatsAppTextAction(event.id, baseUrl);
    if (res.success) {
      setWhatsappText(res.text);
    } else {
      setWhatsappText(
        `¡Partida de póker! Apúntate aquí: ${baseUrl}/p/${event.slug}`
      );
    }
    setIsLoadingWhatsapp(false);
  };

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(whatsappText);
      setCopiedMessage(true);
      setTimeout(() => setCopiedMessage(false), 2500);
    } catch {}
  };

  const handleCopyLink = async () => {
    try {
      const origin =
        typeof window !== "undefined" ? window.location.origin : "";
      const url = `${origin}/p/${event.slug}`;
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {}
  };

  // Occupancy metrics
  const occupiedCount = state.occupiedSeats;
  const capacity = state.capacity;
  const freeSeats = state.freeSeats;
  const occupancyPercent = Math.min(
    100,
    Math.round((occupiedCount / capacity) * 100)
  );

  // All players occupying seats (both confirmed and pending confirmation)
  const confirmedPlayers = state.confirmed;
  const pendingPlayers = state.pendingConfirmation;
  const allOccupying = [...confirmedPlayers, ...pendingPlayers];

  return (
    <div className="flex flex-col gap-6 pb-20">
      {/* Top Navigation & Status */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href="/panel"
          className="inline-flex items-center gap-2 text-sm font-semibold text-chip/70 transition-colors hover:text-chip"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
          Volver a mis Eventos
        </Link>

        {/* Live indicator and manual refresh */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-950/60 px-3 py-1 text-xs font-semibold text-emerald-300">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>En vivo</span>
            <span className="text-chip/40 hidden sm:inline">
              · {lastUpdated.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          </div>

          <button
            type="button"
            onClick={reloadState}
            disabled={isPending}
            className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-xs text-chip/70 hover:bg-white/10 hover:text-chip disabled:opacity-50"
            title="Refrescar datos"
          >
            <svg
              className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Event Header Banner */}
      <section className="relative overflow-hidden rounded-3xl border border-white/15 bg-felt-900 p-6 shadow-2xl backdrop-blur-sm sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-bold uppercase tracking-wider ${
                event.type === "cash"
                  ? "border border-emerald-500/40 bg-emerald-500/20 text-emerald-300"
                  : "border border-amber-500/40 bg-amber-500/20 text-amber-300"
              }`}
            >
              {event.type === "cash" ? "💵 Cash Game" : "🏆 Torneo"}
            </span>

            <LiveCycleBadge cycle={cycle} />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleOpenShare}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow transition-colors hover:bg-emerald-500"
            >
              <span>💬</span>
              <span>Difundir (WhatsApp)</span>
            </button>

            <Link
              href={`/p/${event.slug}`}
              target="_blank"
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-chip transition-colors hover:bg-white/10"
            >
              <span>🔗</span>
              <span>Vista Jugador</span>
            </Link>
          </div>
        </div>

        <h1 className="mt-4 text-2xl font-black text-chip sm:text-3xl">
          {capitalizeFirstLetter(formatSpanishDate(event.date))}
        </h1>

        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-chip/80">
          <span className="font-semibold text-emerald-400">
            ⏰ {event.time} h
          </span>
          <span>•</span>
          <span>{capacity} plazas fijas</span>
          <span>•</span>
          <span className="font-mono text-xs text-chip/60">
            Código: {event.slug}
          </span>
        </div>

        {event.note && (
          <p className="mt-4 rounded-xl border border-white/5 bg-felt-950/60 p-3.5 text-sm text-chip/90 leading-relaxed">
            💬 {event.note}
          </p>
        )}

        {/* Prominent Cupo & Occupancy Counter */}
        <div
          id="contador-plazas-destacado"
          className="mt-6 rounded-2xl border border-white/10 bg-felt-950/80 p-5"
        >
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-chip/60">
                Estado de la Mesa
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-3xl font-black text-chip sm:text-4xl">
                  {occupiedCount}
                </span>
                <span className="text-xl font-bold text-chip/50">
                  / {capacity} plazas
                </span>

                {freeSeats > 0 ? (
                  <span className="ml-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-bold text-emerald-300">
                    {freeSeats} {freeSeats === 1 ? "plaza libre" : "plazas libres"}
                  </span>
                ) : (
                  <span className="ml-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-xs font-bold text-amber-300">
                    Mesa Completa
                  </span>
                )}
              </div>
            </div>

            {state.waitlist.length > 0 && (
              <div className="text-right">
                <span className="rounded-full border border-amber-500/30 bg-amber-500/15 px-3 py-1 text-xs font-bold text-amber-300">
                  ⏳ {state.waitlist.length} en espera
                </span>
              </div>
            )}
          </div>

          {/* Large Capacity Bar */}
          <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-felt-900">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                occupancyPercent >= 100
                  ? "bg-amber-400"
                  : occupancyPercent >= 75
                  ? "bg-yellow-400"
                  : "bg-emerald-500"
              }`}
              style={{ width: `${occupancyPercent}%` }}
            />
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* SECCIÓN 1: CONFIRMADOS Y OCUPANDO PLAZA                                */}
      {/* ===================================================================== */}
      <section
        id="seccion-confirmados"
        className="rounded-3xl border border-white/10 bg-felt-900/80 p-6 shadow-xl backdrop-blur-sm"
      >
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-300 text-sm font-bold">
              ✓
            </span>
            <h2 className="text-lg font-bold text-chip sm:text-xl">
              Confirmados ({allOccupying.length} / {capacity})
            </h2>
          </div>
          <span className="text-xs text-chip/60">Ocupando plaza</span>
        </div>

        {allOccupying.length === 0 ? (
          <div className="py-12 text-center text-chip/50">
            <p className="text-sm">Aún no hay ningún jugador apuntado.</p>
            <button
              type="button"
              onClick={handleOpenShare}
              className="mt-3 text-xs font-semibold text-emerald-400 underline underline-offset-4 hover:text-emerald-300"
            >
              Comparte el enlace de WhatsApp para empezar a llenar la mesa
            </button>
          </div>
        ) : (
          <div className="mt-4 divide-y divide-white/5">
            {allOccupying.map((reg, index) => {
              const isPending = reg.status === "pending_confirmation";

              return (
                <div
                  key={reg.id}
                  className={`flex flex-col gap-2 py-3.5 sm:flex-row sm:items-center sm:justify-between transition-colors rounded-xl px-2.5 ${
                    isPending
                      ? "border border-amber-500/40 bg-amber-950/30"
                      : "hover:bg-white/[0.02]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Seat number */}
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        isPending
                          ? "bg-amber-500/30 text-amber-200"
                          : "bg-emerald-500/20 text-emerald-300"
                      }`}
                    >
                      #{index + 1}
                    </span>

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-chip text-base">
                          {reg.nickname}
                        </span>

                        {/* Prominent Pending Confirmation Badge */}
                        {isPending && (
                          <span
                            id={`badge-pending-${reg.id}`}
                            className="inline-flex items-center gap-1 rounded-full border border-amber-400 bg-amber-400/20 px-2.5 py-0.5 text-xs font-extrabold text-amber-200 animate-pulse"
                          >
                            ⚠️ Pendiente de confirmación
                          </span>
                        )}

                        {/* Arrival details */}
                        {reg.lateArrival ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-xs font-medium text-sky-300">
                            ⏰ Llegará tarde: {reg.estimatedArrivalTime}
                          </span>
                        ) : (
                          <span className="text-xs text-chip/50">
                            Desde el inicio
                          </span>
                        )}
                      </div>

                      {/* Visible phone number */}
                      <div className="mt-1 flex items-center gap-3 text-xs text-chip/70">
                        <a
                          href={`tel:${reg.phone}`}
                          className="font-mono hover:text-emerald-400 flex items-center gap-1"
                        >
                          📞 {formatPhoneDisplay(reg.phone)}
                        </a>

                        <a
                          href={`https://wa.me/${reg.phone.replace("+", "")}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-emerald-400 hover:underline"
                        >
                          WhatsApp
                        </a>
                      </div>
                    </div>
                  </div>

                  <span className="text-xs text-chip/40 text-right shrink-0">
                    {new Date(reg.createdAt).toLocaleTimeString("es-ES", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ===================================================================== */}
      {/* SECCIÓN 2: LISTA DE ESPERA                                            */}
      {/* ===================================================================== */}
      <section
        id="seccion-lista-espera"
        className="rounded-3xl border border-white/10 bg-felt-900/80 p-6 shadow-xl backdrop-blur-sm"
      >
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/20 text-amber-300 text-sm font-bold">
              ⏳
            </span>
            <h2 className="text-lg font-bold text-chip sm:text-xl">
              Lista de Espera ({state.waitlist.length})
            </h2>
          </div>
          <span className="text-xs text-chip/60">Orden estricto de llegada</span>
        </div>

        {state.waitlist.length === 0 ? (
          <p className="py-8 text-center text-sm text-chip/50">
            No hay jugadores en lista de espera.
          </p>
        ) : (
          <div className="mt-4 divide-y divide-white/5">
            {state.waitlist.map((reg) => (
              <div
                key={reg.id}
                className="flex flex-col gap-2 py-3.5 sm:flex-row sm:items-center sm:justify-between rounded-xl px-2.5 hover:bg-white/[0.02]"
              >
                <div className="flex items-center gap-3">
                  {/* Waitlist Position */}
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-amber-300 text-xs font-black">
                    #{reg.waitlistPosition}
                  </span>

                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-chip text-base">
                        {reg.nickname}
                      </span>

                      {reg.lateArrival ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-xs font-medium text-sky-300">
                          ⏰ Llegará tarde: {reg.estimatedArrivalTime}
                        </span>
                      ) : (
                        <span className="text-xs text-chip/50">
                          Desde el inicio
                        </span>
                      )}
                    </div>

                    {/* Visible phone number */}
                    <div className="mt-1 flex items-center gap-3 text-xs text-chip/70">
                      <a
                        href={`tel:${reg.phone}`}
                        className="font-mono hover:text-emerald-400 flex items-center gap-1"
                      >
                        📞 {formatPhoneDisplay(reg.phone)}
                      </a>

                      <a
                        href={`https://wa.me/${reg.phone.replace("+", "")}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-emerald-400 hover:underline"
                      >
                        WhatsApp
                      </a>
                    </div>
                  </div>
                </div>

                <span className="text-xs text-chip/40 text-right shrink-0">
                  {new Date(reg.createdAt).toLocaleTimeString("es-ES", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ===================================================================== */}
      {/* SECCIÓN 3: CANCELADOS                                                 */}
      {/* ===================================================================== */}
      <section
        id="seccion-cancelados"
        className="rounded-3xl border border-white/10 bg-felt-900/60 p-6 shadow-xl backdrop-blur-sm"
      >
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-500/20 text-red-300 text-sm font-bold">
              ✕
            </span>
            <h2 className="text-lg font-bold text-chip sm:text-xl">
              Cancelados ({state.cancelled.length})
            </h2>
          </div>
          <span className="text-xs text-chip/60">Historial con atribución</span>
        </div>

        {state.cancelled.length === 0 ? (
          <p className="py-8 text-center text-sm text-chip/50">
            No hay inscripciones canceladas.
          </p>
        ) : (
          <div className="mt-4 divide-y divide-white/5">
            {state.cancelled.map((reg) => {
              const byOrganizer = reg.cancelledBy === "organizer";

              return (
                <div
                  key={reg.id}
                  className="flex flex-col gap-2 py-3.5 sm:flex-row sm:items-center sm:justify-between rounded-xl px-2.5 opacity-75 hover:opacity-100"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-500/10 text-red-400 text-xs font-bold">
                      ✕
                    </span>

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-chip line-through">
                          {reg.nickname}
                        </span>

                        {/* Attribution badge: Jugador vs Organizador */}
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            byOrganizer
                              ? "border border-red-500/30 bg-red-500/15 text-red-300"
                              : "border border-slate-500/30 bg-slate-500/15 text-slate-300"
                          }`}
                        >
                          {byOrganizer
                            ? "🛡️ Cancelado por el Organizador"
                            : "👤 Cancelado por el Jugador"}
                        </span>
                      </div>

                      {/* Visible phone */}
                      <p className="mt-1 font-mono text-xs text-chip/50">
                        📞 {formatPhoneDisplay(reg.phone)}
                      </p>
                    </div>
                  </div>

                  <span className="text-xs text-chip/40 text-right shrink-0">
                    {new Date(reg.updatedAt).toLocaleTimeString("es-ES", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ========================================================================= */}
      {/* MODAL: Difundir Convocatoria                                              */}
      {/* ========================================================================= */}
      {shareModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-white/15 bg-felt-900 p-6 shadow-2xl sm:p-8">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <h2 className="text-xl font-bold text-chip">
                  Difundir Convocatoria
                </h2>
                <p className="text-xs text-chip/60 mt-0.5">
                  Comparte en WhatsApp con el grupo de la partida.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShareModalOpen(false)}
                className="rounded-lg p-1.5 text-chip/60 hover:bg-white/10 hover:text-chip"
              >
                ✕
              </button>
            </div>

            <div className="mt-5 rounded-2xl border border-emerald-500/30 bg-emerald-950/40 p-3.5">
              <span className="block text-xs font-semibold uppercase tracking-wider text-emerald-400">
                Enlace directo
              </span>
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className="truncate text-sm font-mono font-medium text-chip">
                  {typeof window !== "undefined" ? window.location.origin : ""}
                  /p/{event.slug}
                </span>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="shrink-0 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-chip hover:bg-white/20"
                >
                  {copiedLink ? "¡Copiado! ✓" : "Copiar"}
                </button>
              </div>
            </div>

            <div className="mt-5">
              <div className="flex items-center justify-between text-xs font-semibold text-chip/70 mb-1.5">
                <span>Mensaje para WhatsApp (editable)</span>
                <span>Plantilla oficial</span>
              </div>
              {isLoadingWhatsapp ? (
                <div className="h-44 w-full animate-pulse rounded-xl border border-white/10 bg-felt-950/60 p-4 text-xs text-chip/40">
                  Generando mensaje...
                </div>
              ) : (
                <textarea
                  rows={8}
                  value={whatsappText}
                  onChange={(e) => setWhatsappText(e.target.value)}
                  className="w-full rounded-xl border border-white/15 bg-felt-950 p-3.5 text-xs font-mono text-chip/90 leading-relaxed focus:border-emerald-400 focus:outline-none"
                />
              )}
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={handleCopyMessage}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-white/15 px-4 py-3 text-sm font-semibold text-chip transition-all hover:bg-white/20 active:scale-95"
              >
                {copiedMessage ? "¡Copiado! ✓" : "📋 Copiar Mensaje"}
              </button>

              <a
                href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                  whatsappText
                )}`}
                target="_blank"
                rel="noreferrer"
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow transition-all hover:bg-emerald-500 active:scale-95"
              >
                <span>💬</span>
                <span>Abrir WhatsApp</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LiveCycleBadge({ cycle }: { cycle: string }) {
  switch (cycle) {
    case "cancelled":
      return (
        <span className="inline-flex items-center rounded-full border border-red-500/40 bg-red-500/15 px-2.5 py-0.5 text-xs font-semibold text-red-300">
          Cancelado
        </span>
      );
    case "in_progress":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/20 px-2.5 py-0.5 text-xs font-semibold text-emerald-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          En juego
        </span>
      );
    case "past":
      return (
        <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs font-semibold text-chip/60">
          Pasado
        </span>
      );
    case "upcoming":
    default:
      return (
        <span className="inline-flex items-center rounded-full border border-sky-500/30 bg-sky-500/15 px-2.5 py-0.5 text-xs font-semibold text-sky-300">
          Próximo
        </span>
      );
  }
}

function formatPhoneDisplay(phone: string): string {
  if (phone.startsWith("+34") && phone.length === 12) {
    return `+34 ${phone.slice(3, 6)} ${phone.slice(6, 8)} ${phone.slice(
      8,
      10
    )} ${phone.slice(10, 12)}`;
  }
  return phone;
}
