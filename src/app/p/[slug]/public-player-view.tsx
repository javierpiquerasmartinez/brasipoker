"use client";

import { useEffect, useState, useTransition, useCallback } from "react";
import { PublicEventView } from "@/domain/types";
import {
  getPublicEventAction,
  registerPlayerAction,
  checkMyRegistrationAction,
  cancelMyRegistrationAction,
} from "./actions";
import { PlayerActionResult } from "./actions-handler";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatSpanishDate, capitalizeFirstLetter } from "@/lib/formatters";
import { SpadeLogo } from "@/components/spade-logo";

interface PublicPlayerViewProps {
  initialData: PublicEventView;
}

interface MyRegistrationInfo {
  id: string;
  nickname: string;
  status: string;
  lateArrival: boolean;
  estimatedArrivalTime?: string;
  waitlistPosition?: number;
}

export function PublicPlayerView({ initialData }: PublicPlayerViewProps) {
  const [eventData, setEventData] = useState<PublicEventView>(initialData);
  const [activePhone, setActivePhone] = useState<string>(() => {
    if (typeof window !== "undefined") {
      try {
        return localStorage.getItem(`brasipoker_phone_${initialData.slug}`) || "";
      } catch {
        return "";
      }
    }
    return "";
  });
  const [myRegistration, setMyRegistration] = useState<MyRegistrationInfo | null>(null);
  const [myPhoneInput, setMyPhoneInput] = useState<string>(activePhone);

  // Form state
  const [nickname, setNickname] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [lateArrival, setLateArrival] = useState<boolean>(false);
  const [estimatedArrivalTime, setEstimatedArrivalTime] = useState<string>("");

  // Feedback states
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [showManagePhoneModal, setShowManagePhoneModal] = useState<boolean>(false);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState<boolean>(false);

  const [isSubmitting, startSubmitting] = useTransition();
  const [isCheckingMyReg, startCheckingMyReg] = useTransition();
  const [isCancelling, startCancelling] = useTransition();

  // Check active registration helper for callbacks
  const checkActiveRegistration = useCallback(
    async (phoneToCheck: string) => {
      if (!phoneToCheck) return;
      const res = await checkMyRegistrationAction(initialData.slug, phoneToCheck);
      if (res.success && res.found && res.registration) {
        setMyRegistration(res.registration);
      } else {
        setMyRegistration(null);
      }
    },
    [initialData.slug]
  );

  useEffect(() => {
    if (!activePhone) return;
    let cancelled = false;
    checkMyRegistrationAction(initialData.slug, activePhone).then((res) => {
      if (!cancelled) {
        if (res.success && res.found && res.registration) {
          setMyRegistration(res.registration);
        } else {
          setMyRegistration(null);
        }
      }
    });
    return () => {
      cancelled = true;
    };
  }, [activePhone, initialData.slug]);

  // Realtime updates subscription
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`public-event-${initialData.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "registrations",
          filter: `event_id=eq.${initialData.id}`,
        },
        async () => {
          // Re-fetch public event projection
          const res = await getPublicEventAction(initialData.slug);
          if (res.success) {
            setEventData(res.data);
          }
          // If player has active registration, re-check their status
          if (activePhone) {
            checkActiveRegistration(activePhone);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "events",
          filter: `id=eq.${initialData.id}`,
        },
        async () => {
          const res = await getPublicEventAction(initialData.slug);
          if (res.success) {
            setEventData(res.data);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [initialData.id, initialData.slug, activePhone, checkActiveRegistration]);

  // Handle registration submission
  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    setActionSuccess(null);

    startSubmitting(async () => {
      const res = await registerPlayerAction(initialData.slug, {
        nickname,
        phone,
        lateArrival,
        estimatedArrivalTime: lateArrival ? estimatedArrivalTime : undefined,
      });

      if (!res.success) {
        setActionError(res.error);
        return;
      }

      const result: PlayerActionResult = res.result;

      if (result.type === "event_full") {
        setActionError("El evento está completo y no admite lista de espera.");
        return;
      }

      if (result.type === "already_registered" && result.registration) {
        setActionSuccess("Ya estás apuntado a este evento con este teléfono.");
        setActivePhone(phone);
        setMyRegistration(result.registration);
        try {
          localStorage.setItem(`brasipoker_phone_${initialData.slug}`, phone);
        } catch {}
        return;
      }

      if (result.type === "confirmed" && result.registration) {
        setActionSuccess("¡Confirmado! Tienes plaza asegurada en la partida.");
        setActivePhone(phone);
        setMyRegistration(result.registration);
        try {
          localStorage.setItem(`brasipoker_phone_${initialData.slug}`, phone);
        } catch {}
        // Refresh event data
        const updated = await getPublicEventAction(initialData.slug);
        if (updated.success) setEventData(updated.data);
        return;
      }

      if (result.type === "waitlisted" && result.registration) {
        setActionSuccess(`Estás en la lista de espera (Puesto #${result.position}).`);
        setActivePhone(phone);
        setMyRegistration(result.registration);
        try {
          localStorage.setItem(`brasipoker_phone_${initialData.slug}`, phone);
        } catch {}
        // Refresh event data
        const updated = await getPublicEventAction(initialData.slug);
        if (updated.success) setEventData(updated.data);
      }
    });
  };

  // Handle manual lookup of registration by phone
  const handleLookupPhone = (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    setActionSuccess(null);

    startCheckingMyReg(async () => {
      const res = await checkMyRegistrationAction(initialData.slug, myPhoneInput);
      if (!res.success) {
        setActionError(res.error);
        return;
      }

      if (res.found && res.registration) {
        setActivePhone(myPhoneInput);
        setMyRegistration(res.registration);
        try {
          localStorage.setItem(`brasipoker_phone_${initialData.slug}`, myPhoneInput);
        } catch {}
        setShowManagePhoneModal(false);
        setActionSuccess("Inscripción localizada.");
      } else {
        setActionError("No hay ninguna inscripción activa con ese número de teléfono.");
      }
    });
  };

  // Handle player cancellation
  const handleCancelRegistration = () => {
    if (!myRegistration || !activePhone) return;

    startCancelling(async () => {
      const res = await cancelMyRegistrationAction(
        initialData.slug,
        myRegistration.id,
        activePhone
      );

      setConfirmCancelOpen(false);

      if (!res.success) {
        setActionError(res.error);
        return;
      }

      setMyRegistration(null);
      setActionSuccess("Tu inscripción ha sido cancelada. Tu plaza ha quedado liberada.");

      // Refresh public event state
      const updated = await getPublicEventAction(initialData.slug);
      if (updated.success) setEventData(updated.data);
    });
  };

  const isCancelled = eventData.status === "cancelled";
  const capacityPercent = Math.min(
    100,
    Math.round((eventData.occupiedSeats / eventData.capacity) * 100)
  );

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-8 sm:px-6">
      {/* Brand Header */}
      <header className="flex items-center justify-between border-b border-white/10 pb-4">
        <div className="flex items-center gap-2">
          <SpadeLogo className="h-7 w-7 text-emerald-400" />
          <span className="text-xl font-bold tracking-tight text-chip">Brasipoker</span>
        </div>
        <span className="rounded-full border border-white/10 bg-felt-900 px-3 py-1 text-xs font-semibold text-chip/80">
          Enlace de Jugador
        </span>
      </header>

      {/* Permanent Event Cancelled Banner */}
      {isCancelled && (
        <aside
          role="alert"
          className="rounded-2xl border border-red-500/40 bg-red-950/70 p-5 text-red-200 shadow-lg"
        >
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <h2 className="font-bold text-red-100">Evento Cancelado</h2>
              <p className="mt-1 text-sm text-red-200/90">
                Esta convocatoria ha sido cancelada por el organizador. Ya no se admiten nuevas inscripciones ni modificaciones.
              </p>
            </div>
          </div>
        </aside>
      )}

      {/* Event Details Card */}
      <section className="rounded-3xl border border-white/10 bg-felt-900/90 p-6 shadow-2xl backdrop-blur-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/20 px-3 py-1 text-xs font-bold uppercase tracking-wider text-emerald-300">
            {eventData.type === "cash" ? "♠️ Cash Game" : "🏆 Torneo"}
          </span>
          <span className="text-xs text-chip/60">
            Código: <span className="font-mono text-chip/90">{eventData.slug}</span>
          </span>
        </div>

        <h1 className="mt-4 text-2xl font-black text-chip sm:text-3xl">
          {capitalizeFirstLetter(formatSpanishDate(eventData.date))}
        </h1>

        <div className="mt-2 flex items-center gap-3 text-sm text-chip/80">
          <span className="inline-flex items-center gap-1 font-semibold text-emerald-400">
            ⏰ {eventData.time} h
          </span>
          <span>•</span>
          <span>{eventData.capacity} plazas máx</span>
        </div>

        {eventData.note && (
          <p className="mt-4 rounded-xl border border-white/5 bg-felt-950/60 p-3.5 text-sm text-chip/90 leading-relaxed">
            💬 {eventData.note}
          </p>
        )}

        {/* Capacity Bar */}
        <div className="mt-6 border-t border-white/10 pt-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-chip/80">Plazas</span>
            <span className="font-bold text-chip">
              {eventData.occupiedSeats} de {eventData.capacity} ocupadas
              {eventData.freeSeats > 0 ? (
                <span className="ml-1.5 text-emerald-400">({eventData.freeSeats} libres)</span>
              ) : (
                <span className="ml-1.5 text-amber-400">(Completo)</span>
              )}
            </span>
          </div>

          <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-felt-950">
            <div
              className={`h-full transition-all duration-500 rounded-full ${
                capacityPercent >= 100
                  ? "bg-amber-500"
                  : capacityPercent >= 75
                  ? "bg-yellow-400"
                  : "bg-emerald-500"
              }`}
              style={{ width: `${capacityPercent}%` }}
            />
          </div>

          {eventData.waitlist.length > 0 && (
            <p className="mt-2 text-xs text-amber-300 font-medium">
              ⏳ {eventData.waitlist.length} en lista de espera
            </p>
          )}
        </div>
      </section>

      {/* Global Notifications */}
      {actionError && (
        <aside
          role="alert"
          className="rounded-xl border border-red-500/30 bg-red-950/60 p-4 text-sm text-red-200"
        >
          {actionError}
        </aside>
      )}

      {actionSuccess && (
        <aside
          role="status"
          className="rounded-xl border border-emerald-500/30 bg-emerald-950/60 p-4 text-sm text-emerald-200"
        >
          {actionSuccess}
        </aside>
      )}

      {/* My Registration Card (Self-Management) */}
      {myRegistration ? (
        <section
          id="mi-plaza-section"
          className="rounded-3xl border border-emerald-500/40 bg-felt-900/90 p-6 shadow-xl"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">🎟️</span>
              <h2 className="text-lg font-bold text-chip">Tu Inscripción</h2>
            </div>
            <button
              type="button"
              onClick={() => {
                setActivePhone("");
                setMyRegistration(null);
                try {
                  localStorage.removeItem(`brasipoker_phone_${initialData.slug}`);
                } catch {}
              }}
              className="text-xs text-chip/60 hover:text-chip underline underline-offset-2"
            >
              Cambiar teléfono
            </button>
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-felt-950/70 p-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs text-chip/60">Apodo</span>
                <p className="text-lg font-black text-chip">{myRegistration.nickname}</p>
              </div>
              <div className="text-right">
                <span className="text-xs text-chip/60">Estado</span>
                <div>
                  {myRegistration.status === "confirmed" && (
                    <span className="inline-block rounded-md bg-emerald-500/20 px-2.5 py-1 text-xs font-bold text-emerald-300">
                      ✓ Confirmado
                    </span>
                  )}
                  {myRegistration.status === "pending_confirmation" && (
                    <span className="inline-block rounded-md bg-sky-500/20 px-2.5 py-1 text-xs font-bold text-sky-300">
                      ⏳ Pendiente de confirmar
                    </span>
                  )}
                  {myRegistration.status === "waitlisted" && (
                    <span className="inline-block rounded-md bg-amber-500/20 px-2.5 py-1 text-xs font-bold text-amber-300">
                      ⏳ Lista de espera (#{myRegistration.waitlistPosition})
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-3 border-t border-white/5 pt-2 text-xs text-chip/70">
              {myRegistration.lateArrival ? (
                <span className="text-amber-300 font-medium">
                  ⏰ Llegarás más tarde ({myRegistration.estimatedArrivalTime})
                </span>
              ) : (
                <span>⏰ Asistes desde el inicio</span>
              )}
            </div>
          </div>

          {/* Cancel button */}
          {!isCancelled && (
            <div className="mt-5">
              {!confirmCancelOpen ? (
                <button
                  type="button"
                  id="btn-cancel-my-slot"
                  onClick={() => setConfirmCancelOpen(true)}
                  className="w-full rounded-xl border border-red-500/30 bg-red-950/40 py-2.5 text-sm font-semibold text-red-300 hover:bg-red-900/40 transition-colors"
                >
                  Liberar / Cancelar mi plaza
                </button>
              ) : (
                <div className="rounded-xl border border-red-500/40 bg-red-950/70 p-4 text-center">
                  <p className="text-sm font-semibold text-red-200">
                    ¿Seguro que quieres cancelar tu inscripción?
                  </p>
                  <p className="mt-1 text-xs text-red-300/80">
                    Si te das de baja, liberarás tu plaza y otro jugador podrá ocuparla.
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      disabled={isCancelling}
                      onClick={handleCancelRegistration}
                      className="flex-1 rounded-lg bg-red-600 py-2 text-xs font-bold text-white hover:bg-red-500 disabled:opacity-50"
                    >
                      {isCancelling ? "Cancelando..." : "Sí, cancelar mi plaza"}
                    </button>
                    <button
                      type="button"
                      disabled={isCancelling}
                      onClick={() => setConfirmCancelOpen(false)}
                      className="flex-1 rounded-lg border border-white/20 bg-felt-800 py-2 text-xs font-semibold text-chip hover:bg-felt-700"
                    >
                      No, mantener
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      ) : (
        /* Registration Form (Visible when no active registration loaded and event not cancelled) */
        !isCancelled && (
          <section className="rounded-3xl border border-white/10 bg-felt-900/90 p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-chip">Apuntarse a la partida</h2>
              <button
                type="button"
                id="btn-toggle-lookup"
                onClick={() => setShowManagePhoneModal(!showManagePhoneModal)}
                className="text-xs text-emerald-400 hover:underline"
              >
                {showManagePhoneModal ? "Volver al formulario" : "¿Ya te apuntaste? Gestionar plaza"}
              </button>
            </div>

            {showManagePhoneModal ? (
              /* Lookup Form */
              <form onSubmit={handleLookupPhone} className="mt-4 flex flex-col gap-4">
                <p className="text-xs text-chip/70">
                  Introduce el teléfono con el que te apuntaste para ver tu estado o cancelar tu plaza.
                </p>
                <div>
                  <label htmlFor="lookup-phone" className="block text-xs font-semibold text-chip/80 mb-1">
                    Tu teléfono móvil
                  </label>
                  <input
                    id="lookup-phone"
                    type="tel"
                    required
                    value={myPhoneInput}
                    onChange={(e) => setMyPhoneInput(e.target.value)}
                    placeholder="612 34 56 78"
                    className="w-full rounded-xl border border-white/15 bg-felt-950 px-4 py-2.5 text-base sm:text-sm text-chip placeholder-chip/30 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isCheckingMyReg}
                  className="rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors"
                >
                  {isCheckingMyReg ? "Buscando..." : "Localizar mi inscripción"}
                </button>
              </form>
            ) : (
              /* New Registration Form */
              <form onSubmit={handleRegister} className="mt-5 flex flex-col gap-4">
                <div>
                  <label htmlFor="input-nickname" className="block text-xs font-semibold text-chip/80 mb-1">
                    Apodo o Nombre <span className="text-emerald-400">*</span>
                  </label>
                  <input
                    id="input-nickname"
                    type="text"
                    required
                    maxLength={30}
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder="Ej: FishPro, Dani..."
                    className="w-full rounded-xl border border-white/15 bg-felt-950 px-4 py-2.5 text-base sm:text-sm text-chip placeholder-chip/30 focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="input-phone" className="block text-xs font-semibold text-chip/80">
                      Teléfono móvil <span className="text-emerald-400">*</span>
                    </label>
                    <span className="text-[10px] text-chip/50">Solo visible para el organizador</span>
                  </div>
                  <input
                    id="input-phone"
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="612 34 56 78"
                    className="w-full rounded-xl border border-white/15 bg-felt-950 px-4 py-2.5 text-base sm:text-sm text-chip placeholder-chip/30 focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                {/* Arrival choice */}
                <fieldset className="rounded-xl border border-white/10 bg-felt-950/60 p-3.5">
                  <legend className="text-xs font-semibold text-chip/80 px-1">Horario de llegada</legend>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      id="btn-arrival-start"
                      onClick={() => setLateArrival(false)}
                      className={`rounded-lg py-2 text-xs font-semibold transition-all ${
                        !lateArrival
                          ? "bg-emerald-600 text-white shadow"
                          : "bg-felt-900 text-chip/70 hover:bg-felt-800"
                      }`}
                    >
                      Desde el inicio ({eventData.time})
                    </button>
                    <button
                      type="button"
                      id="btn-arrival-late"
                      onClick={() => setLateArrival(true)}
                      className={`rounded-lg py-2 text-xs font-semibold transition-all ${
                        lateArrival
                          ? "bg-emerald-600 text-white shadow"
                          : "bg-felt-900 text-chip/70 hover:bg-felt-800"
                      }`}
                    >
                      Llegaré más tarde
                    </button>
                  </div>

                  {lateArrival && (
                    <div className="mt-3 border-t border-white/10 pt-3">
                      <label htmlFor="input-estimated-time" className="block text-xs font-medium text-chip/80 mb-1">
                        Hora estimada de llegada <span className="text-emerald-400">*</span>
                      </label>
                      <input
                        id="input-estimated-time"
                        type="time"
                        required
                        value={estimatedArrivalTime}
                        onChange={(e) => setEstimatedArrivalTime(e.target.value)}
                        className="w-full rounded-lg border border-white/15 bg-felt-900 px-3 py-2 text-base sm:text-sm text-chip focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                  )}
                </fieldset>

                <button
                  type="submit"
                  id="btn-submit-register"
                  disabled={isSubmitting}
                  className="mt-1 w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white shadow-lg transition-all hover:bg-emerald-500 active:scale-[0.99] disabled:opacity-50"
                >
                  {isSubmitting ? (
                    "Apuntando..."
                  ) : eventData.freeSeats > 0 ? (
                    "♠️ Apuntarme a la partida"
                  ) : eventData.allowWaitlist ? (
                    `⏳ Entrar en lista de espera (Puesto #${eventData.waitlist.length + 1})`
                  ) : (
                    "⛔ Evento completo"
                  )}
                </button>
              </form>
            )}
          </section>
        )
      )}

      {/* Public Roster */}
      <section className="rounded-3xl border border-white/10 bg-felt-900/90 p-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <h2 className="text-lg font-bold text-chip">
            Jugadores Confirmados ({eventData.confirmed.length}/{eventData.capacity})
          </h2>
          <span className="text-xs text-chip/60">
            {eventData.freeSeats > 0 ? `${eventData.freeSeats} plazas libres` : "Mesa completa"}
          </span>
        </div>

        {eventData.confirmed.length === 0 ? (
          <p className="mt-4 text-center py-6 text-sm text-chip/50">
            Aún no hay jugadores confirmados. ¡Sé el primero en apuntarte!
          </p>
        ) : (
          <ol className="mt-3 divide-y divide-white/5">
            {eventData.confirmed.map((player, idx) => (
              <li key={player.id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-felt-950 text-xs font-bold text-chip/60">
                    {idx + 1}
                  </span>
                  <span className="font-semibold text-chip">{player.nickname}</span>
                </div>
                {player.lateArrival && (
                  <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-300">
                    Llegará tarde
                  </span>
                )}
              </li>
            ))}
          </ol>
        )}

        {/* Waitlist section */}
        {eventData.allowWaitlist && (
          <div className="mt-6 border-t border-white/10 pt-4">
            <h3 className="text-sm font-bold text-amber-300">
              Lista de espera ({eventData.waitlist.length})
            </h3>

            {eventData.waitlist.length === 0 ? (
              <p className="mt-2 text-xs text-chip/40">No hay nadie en espera.</p>
            ) : (
              <ol className="mt-3 divide-y divide-white/5">
                {eventData.waitlist.map((waiter) => (
                  <li key={waiter.id} className="flex items-center justify-between py-2.5">
                    <div className="flex items-center gap-3">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-950/80 text-xs font-bold text-amber-300">
                        #{waiter.waitlistPosition}
                      </span>
                      <span className="font-medium text-chip/90">{waiter.nickname}</span>
                    </div>
                    {waiter.lateArrival && (
                      <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-300">
                        Llegará tarde
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}
      </section>

      {/* Footer / Privacy note */}
      <footer className="text-center text-xs text-chip/40 py-4">
        Brasipoker · Privacidad garantizada: los teléfonos nunca se muestran públicamente.
      </footer>
    </div>
  );
}
