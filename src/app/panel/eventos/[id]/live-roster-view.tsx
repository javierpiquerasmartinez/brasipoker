"use client";

import { useEffect, useState, useTransition, useCallback } from "react";
import Link from "next/link";
import { VisibleEventState, Registration } from "@/domain/types";
import {
  getEventLiveStateAction,
  getWhatsAppTextAction,
  confirmPendingAction,
  rejectPendingAction,
  manualRegisterAction,
  reorderWaitlistAction,
  editRegistrationAction,
  cancelRegistrationAction,
  updateCapacityAction,
} from "../../actions";
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

  // Global feedback toast
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // WhatsApp share modal state
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [whatsappText, setWhatsappText] = useState("");
  const [isLoadingWhatsapp, setIsLoadingWhatsapp] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Manual Register Modal
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [manualNickname, setManualNickname] = useState("");
  const [manualPhone, setManualPhone] = useState("");
  const [manualLateArrival, setManualLateArrival] = useState(false);
  const [manualEstimatedArrivalTime, setManualEstimatedArrivalTime] = useState("21:30");
  const [manualError, setManualError] = useState<string | null>(null);

  // Edit Registration Modal
  const [editingRegistration, setEditingRegistration] = useState<Registration | null>(null);
  const [editNickname, setEditNickname] = useState("");
  const [editLateArrival, setEditLateArrival] = useState(false);
  const [editEstimatedArrivalTime, setEditEstimatedArrivalTime] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  // Cancel Confirmation Modal
  const [cancellingRegistration, setCancellingRegistration] = useState<Registration | null>(null);

  // Reject Pending Confirmation Modal
  const [rejectingRegistration, setRejectingRegistration] = useState<Registration | null>(null);

  // Capacity Adjustment Modal
  const [capacityModalOpen, setCapacityModalOpen] = useState(false);
  const [newCapacityInput, setNewCapacityInput] = useState<number>(state.capacity);
  const [capacityError, setCapacityError] = useState<string | null>(null);

  // Drag and drop state for waitlist reordering
  const [draggedWaitlistIndex, setDraggedWaitlistIndex] = useState<number | null>(null);
  const [dragOverWaitlistIndex, setDragOverWaitlistIndex] = useState<number | null>(null);

  const event = state.event;
  const isCancelled = event.status === "cancelled";
  const cycle = getEventVisualCycle(event);

  // Reload live state
  const reloadState = useCallback(() => {
    startTransition(async () => {
      const res = await getEventLiveStateAction(event.id);
      if (res.success) {
        setState(res.state);
        setNewCapacityInput(res.state.capacity);
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

  // Action: Confirm Pending Registration
  const handleConfirmPending = (regId: string) => {
    startTransition(async () => {
      const res = await confirmPendingAction(event.id, regId);
      if (res.success) {
        setFeedback({
          type: "success",
          message: `✓ Plaza confirmada para ${res.registration.nickname}.`,
        });
        reloadState();
      } else {
        setFeedback({ type: "error", message: res.error });
      }
    });
  };

  // Action: Reject Pending Registration
  const handleRejectPendingConfirm = () => {
    if (!rejectingRegistration) return;
    const target = rejectingRegistration;

    startTransition(async () => {
      const res = await rejectPendingAction(event.id, target.id);
      setRejectingRegistration(null);

      if (res.success) {
        let msg = `Plaza de ${target.nickname} rechazada.`;
        if (res.result.promotedRegistration) {
          msg += ` ¡${res.result.promotedRegistration.nickname} pasa a estar pendiente de confirmación!`;
        }
        setFeedback({ type: "success", message: msg });
        reloadState();
      } else {
        setFeedback({ type: "error", message: res.error });
      }
    });
  };

  // Action: Manual Register Submission
  const handleManualRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setManualError(null);

    const nickname = manualNickname.trim();
    if (!nickname) {
      setManualError("El nombre o apodo es obligatorio");
      return;
    }

    if (!manualPhone.trim()) {
      setManualError("El teléfono móvil es obligatorio");
      return;
    }

    startTransition(async () => {
      const res = await manualRegisterAction(event.id, {
        phone: manualPhone.trim(),
        nickname,
        lateArrival: manualLateArrival,
        estimatedArrivalTime: manualLateArrival
          ? manualEstimatedArrivalTime.trim()
          : undefined,
      });

      if (!res.success) {
        setManualError(res.error);
        return;
      }

      setManualModalOpen(false);
      setManualNickname("");
      setManualPhone("");
      setManualLateArrival(false);
      setManualEstimatedArrivalTime("21:30");

      if (res.result.type === "confirmed") {
        setFeedback({
          type: "success",
          message: `¡${nickname} ha sido inscrito directamente en la mesa!`,
        });
      } else if (res.result.type === "waitlisted") {
        setFeedback({
          type: "success",
          message: `Mesa completa. ${nickname} ha entrado en lista de espera (Posición #${res.result.position}).`,
        });
      } else if (res.result.type === "already_registered") {
        setFeedback({
          type: "error",
          message: `El número de teléfono ya está registrado en este evento.`,
        });
      } else {
        setFeedback({
          type: "error",
          message: "La mesa está completa y la lista de espera no está habilitada.",
        });
      }

      reloadState();
    });
  };

  // Action: Open Edit Registration Modal
  const handleOpenEdit = (reg: Registration) => {
    setEditingRegistration(reg);
    setEditNickname(reg.nickname);
    setEditLateArrival(reg.lateArrival);
    setEditEstimatedArrivalTime(reg.estimatedArrivalTime || "21:30");
    setEditError(null);
  };

  // Action: Submit Edit Registration
  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRegistration) return;
    setEditError(null);

    const clean = editNickname.trim();
    if (!clean) {
      setEditError("El nombre o apodo no puede estar vacío");
      return;
    }

    startTransition(async () => {
      const res = await editRegistrationAction(
        event.id,
        editingRegistration.id,
        {
          nickname: clean,
          lateArrival: editLateArrival,
          estimatedArrivalTime: editLateArrival
            ? editEstimatedArrivalTime.trim()
            : undefined,
        }
      );

      if (!res.success) {
        setEditError(res.error);
        return;
      }

      setEditingRegistration(null);
      setFeedback({
        type: "success",
        message: `Inscripción de ${clean} actualizada con éxito.`,
      });
      reloadState();
    });
  };

  // Action: Submit Cancel Registration
  const handleCancelRegistrationConfirm = () => {
    if (!cancellingRegistration) return;
    const target = cancellingRegistration;

    startTransition(async () => {
      const res = await cancelRegistrationAction(event.id, target.id);
      setCancellingRegistration(null);

      if (res.success) {
        let msg = `Inscripción de ${target.nickname} cancelada por el organizador.`;
        if (res.result.promotedRegistration) {
          msg += ` ¡${res.result.promotedRegistration.nickname} pasa a estar pendiente de confirmación!`;
        }
        setFeedback({ type: "success", message: msg });
        reloadState();
      } else {
        setFeedback({ type: "error", message: res.error });
      }
    });
  };

  // Action: Move waitlist item (accessible up/down)
  const handleMoveWaitlist = (index: number, direction: "up" | "down") => {
    const list = [...state.waitlist];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= list.length) return;

    const [moved] = list.splice(index, 1);
    list.splice(targetIndex, 0, moved);

    const newOrderIds = list.map((r) => r.id);

    startTransition(async () => {
      const res = await reorderWaitlistAction(event.id, newOrderIds);
      if (res.success) {
        setFeedback({
          type: "success",
          message: "Orden de la lista de espera actualizado.",
        });
        reloadState();
      } else {
        setFeedback({ type: "error", message: res.error });
      }
    });
  };

  // Action: Drag and Drop waitlist
  const handleDropWaitlist = (targetIndex: number) => {
    if (draggedWaitlistIndex === null || draggedWaitlistIndex === targetIndex) {
      setDraggedWaitlistIndex(null);
      setDragOverWaitlistIndex(null);
      return;
    }

    const list = [...state.waitlist];
    const [moved] = list.splice(draggedWaitlistIndex, 1);
    list.splice(targetIndex, 0, moved);

    const newOrderIds = list.map((r) => r.id);
    setDraggedWaitlistIndex(null);
    setDragOverWaitlistIndex(null);

    startTransition(async () => {
      const res = await reorderWaitlistAction(event.id, newOrderIds);
      if (res.success) {
        setFeedback({
          type: "success",
          message: "Lista de espera reordenada. Afectará a la siguiente promoción.",
        });
        reloadState();
      } else {
        setFeedback({ type: "error", message: res.error });
      }
    });
  };

  // Action: Submit Capacity Update
  const handleUpdateCapacitySubmit = (newCap: number) => {
    if (newCap < 1) {
      setCapacityError("El cupo mínimo es de 1 plaza");
      return;
    }

    setCapacityError(null);
    startTransition(async () => {
      const res = await updateCapacityAction(event.id, newCap);
      if (!res.success) {
        setCapacityError(res.error);
        return;
      }

      setCapacityModalOpen(false);
      let msg = `Cupo actualizado a ${newCap} plazas.`;
      if (newCap < state.capacity) {
        msg += " Los jugadores desplazados han pasado al principio de la lista de espera.";
      } else if (newCap > state.capacity && state.waitlist.length > 0) {
        msg += " Se han promocionado jugadores en cascada.";
      }
      setFeedback({ type: "success", message: msg });
      reloadState();
    });
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
    <div className="flex flex-col gap-6 pb-24">
      {/* Toast Feedback Banner */}
      {feedback && (
        <div
          className={`flex items-center justify-between rounded-2xl border p-4 shadow-lg transition-all animate-in fade-in duration-300 ${
            feedback.type === "success"
              ? "border-emerald-500/40 bg-emerald-950/80 text-emerald-200"
              : "border-red-500/40 bg-red-950/80 text-red-200"
          }`}
        >
          <div className="flex items-center gap-2.5">
            <span className="text-lg">
              {feedback.type === "success" ? "✓" : "⚠️"}
            </span>
            <p className="text-sm font-medium">{feedback.message}</p>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-xs opacity-70 hover:opacity-100 p-1 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Top Navigation & Status */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href="/panel"
          className="inline-flex items-center gap-2 text-sm font-semibold text-chip/70 transition-colors hover:text-chip cursor-pointer"
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
              ·{" "}
              {lastUpdated.toLocaleTimeString("es-ES", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </span>
          </div>

          <button
            type="button"
            onClick={reloadState}
            disabled={isPending}
            className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-xs text-chip/70 hover:bg-white/10 hover:text-chip disabled:opacity-50 cursor-pointer"
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

          {/* Organizer Quick Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {!isCancelled && (
              <button
                id="btn-alta-manual"
                type="button"
                onClick={() => setManualModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/50 bg-emerald-500/20 px-3.5 py-2 text-xs font-bold text-emerald-300 shadow transition-all hover:bg-emerald-500/30 cursor-pointer"
              >
                <span>➕</span>
                <span>Alta manual</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleOpenShare}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow transition-colors hover:bg-emerald-500 cursor-pointer"
            >
              <span>💬</span>
              <span>Difundir (WhatsApp)</span>
            </button>

            <Link
              href={`/p/${event.slug}`}
              target="_blank"
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-chip transition-colors hover:bg-white/10 cursor-pointer"
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

        {/* Prominent Cupo & Occupancy Counter + Live Capacity Adjustment */}
        <div
          id="contador-plazas-destacado"
          className="mt-6 rounded-2xl border border-white/10 bg-felt-950/80 p-5 shadow-inner"
        >
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-chip/60">
                Estado de la Mesa y Cupo
              </span>
              <div className="mt-1 flex flex-wrap items-baseline gap-2">
                <span className="text-3xl font-black text-chip sm:text-4xl">
                  {occupiedCount}
                </span>
                <span className="text-xl font-bold text-chip/50">
                  / {capacity} plazas
                </span>

                {freeSeats > 0 ? (
                  <span className="ml-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-bold text-emerald-300">
                    {freeSeats}{" "}
                    {freeSeats === 1 ? "plaza libre" : "plazas libres"}
                  </span>
                ) : (
                  <span className="ml-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-xs font-bold text-amber-300">
                    Mesa Completa
                  </span>
                )}
              </div>
            </div>

            {/* Live Capacity Controls */}
            {!isCancelled && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-chip/60 hidden sm:inline">
                  Cupo en vivo:
                </span>
                <div className="flex items-center rounded-xl border border-white/15 bg-white/5 p-1">
                  <button
                    id="btn-reducir-cupo"
                    type="button"
                    onClick={() => {
                      if (capacity > 1) {
                        if (capacity <= occupiedCount) {
                          setNewCapacityInput(capacity - 1);
                          setCapacityModalOpen(true);
                        } else {
                          handleUpdateCapacitySubmit(capacity - 1);
                        }
                      }
                    }}
                    disabled={capacity <= 1 || isPending}
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-sm font-bold text-chip hover:bg-white/15 disabled:opacity-30 cursor-pointer"
                    title="Reducir cupo"
                  >
                    −
                  </button>
                  <span className="px-3 font-mono text-sm font-bold text-chip">
                    {capacity}
                  </span>
                  <button
                    id="btn-ampliar-cupo"
                    type="button"
                    onClick={() => handleUpdateCapacitySubmit(capacity + 1)}
                    disabled={isPending}
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-sm font-bold text-chip hover:bg-white/15 disabled:opacity-30 cursor-pointer"
                    title="Ampliar cupo"
                  >
                    +
                  </button>
                </div>

                <button
                  id="btn-ajustar-cupo"
                  type="button"
                  onClick={() => {
                    setNewCapacityInput(capacity);
                    setCapacityModalOpen(true);
                  }}
                  className="rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-chip hover:bg-white/10 cursor-pointer"
                >
                  ⚙️ Ajustar
                </button>
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
            <div className="mt-3 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setManualModalOpen(true)}
                className="text-xs font-semibold text-emerald-400 underline underline-offset-4 hover:text-emerald-300 cursor-pointer"
              >
                + Dar de alta manualmente a un jugador
              </button>
              <span>•</span>
              <button
                type="button"
                onClick={handleOpenShare}
                className="text-xs font-semibold text-chip/70 underline underline-offset-4 hover:text-chip cursor-pointer"
              >
                Compartir por WhatsApp
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4 divide-y divide-white/5">
            {allOccupying.map((reg, index) => {
              const isPendingConfirm = reg.status === "pending_confirmation";

              return (
                <div
                  key={reg.id}
                  className={`flex flex-col gap-3 py-3.5 sm:flex-row sm:items-center sm:justify-between transition-colors rounded-xl px-3 ${
                    isPendingConfirm
                      ? "border border-amber-500/50 bg-amber-950/40 shadow-sm"
                      : "hover:bg-white/[0.02]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Seat number */}
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        isPendingConfirm
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
                        {isPendingConfirm && (
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

                        <span className="text-chip/40 text-[11px]">
                          {new Date(reg.createdAt).toLocaleTimeString("es-ES", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Player Actions in Live View */}
                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    {/* Confirm / Reject buttons for Pending confirmation */}
                    {isPendingConfirm && !isCancelled && (
                      <div className="flex items-center gap-1.5">
                        <button
                          id={`btn-confirm-${reg.id}`}
                          type="button"
                          onClick={() => handleConfirmPending(reg.id)}
                          disabled={isPending}
                          className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/50 bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow hover:bg-emerald-500 active:scale-95 disabled:opacity-50 cursor-pointer"
                        >
                          <span>✓ Confirmar</span>
                        </button>

                        <button
                          id={`btn-reject-${reg.id}`}
                          type="button"
                          onClick={() => setRejectingRegistration(reg)}
                          disabled={isPending}
                          className="inline-flex items-center gap-1 rounded-lg border border-red-500/50 bg-red-950/80 px-2.5 py-1.5 text-xs font-bold text-red-300 hover:bg-red-900 active:scale-95 disabled:opacity-50 cursor-pointer"
                        >
                          <span>✕ Rechazar</span>
                        </button>
                      </div>
                    )}

                    {!isCancelled && (
                      <div className="flex items-center gap-1">
                        <button
                          id={`btn-edit-${reg.id}`}
                          type="button"
                          onClick={() => handleOpenEdit(reg)}
                          className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-chip/80 hover:bg-white/10 hover:text-chip cursor-pointer"
                          title="Editar inscripción"
                        >
                          ✏️ Editar
                        </button>

                        <button
                          id={`btn-cancel-${reg.id}`}
                          type="button"
                          onClick={() => setCancellingRegistration(reg)}
                          className="rounded-lg border border-red-500/20 bg-red-950/40 px-2.5 py-1.5 text-xs font-medium text-red-300/90 hover:bg-red-900/60 hover:text-red-200 cursor-pointer"
                          title="Dar de baja / Cancelar"
                        >
                          🚫 Baja
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ===================================================================== */}
      {/* SECCIÓN 2: LISTA DE ESPERA (REORDENABLE POR DRAG & DROP Y BOTONES)     */}
      {/* ===================================================================== */}
      <section
        id="seccion-lista-espera"
        className="rounded-3xl border border-white/10 bg-felt-900/80 p-6 shadow-xl backdrop-blur-sm"
      >
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/20 text-amber-300 text-sm font-bold">
              ⏳
            </span>
            <h2 className="text-lg font-bold text-chip sm:text-xl">
              Lista de Espera ({state.waitlist.length})
            </h2>
          </div>
          <span className="text-xs text-chip/60">
            Arrastra o usa las flechas para reordenar (afecta a la próxima promoción)
          </span>
        </div>

        {state.waitlist.length === 0 ? (
          <p className="py-8 text-center text-sm text-chip/50">
            No hay jugadores en lista de espera.
          </p>
        ) : (
          <div className="mt-4 divide-y divide-white/5">
            {state.waitlist.map((reg, index) => {
              const isFirst = index === 0;
              const isLast = index === state.waitlist.length - 1;
              const isBeingDragged = draggedWaitlistIndex === index;
              const isDragTarget = dragOverWaitlistIndex === index;

              return (
                <div
                  key={reg.id}
                  draggable={!isCancelled}
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", index.toString());
                    setDraggedWaitlistIndex(index);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOverWaitlistIndex(index);
                  }}
                  onDragLeave={() => {
                    if (dragOverWaitlistIndex === index) {
                      setDragOverWaitlistIndex(null);
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    handleDropWaitlist(index);
                  }}
                  className={`flex flex-col gap-3 py-3.5 sm:flex-row sm:items-center sm:justify-between rounded-xl px-3 transition-all ${
                    isBeingDragged
                      ? "opacity-30 border border-dashed border-amber-400"
                      : isDragTarget
                      ? "border border-amber-400 bg-amber-950/40"
                      : "hover:bg-white/[0.02]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Drag Handle icon */}
                    {!isCancelled && (
                      <div
                        className="cursor-grab text-chip/40 hover:text-chip text-lg px-1 select-none"
                        title="Arrastra para reordenar"
                      >
                        ⠿
                      </div>
                    )}

                    {/* Waitlist Position */}
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-amber-300 text-xs font-black">
                      #{reg.waitlistPosition}
                    </span>

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-chip text-base">
                          {reg.nickname}
                        </span>

                        {index === 0 && (
                          <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-bold text-amber-300">
                            Próximo en promocionar ➔
                          </span>
                        )}

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

                  {/* Waitlist controls */}
                  <div className="flex items-center gap-2 sm:justify-end">
                    {/* Reorder Buttons (accessible & touch devices) */}
                    {!isCancelled && state.waitlist.length > 1 && (
                      <div className="flex items-center rounded-lg border border-white/10 bg-white/5 p-0.5">
                        <button
                          id={`btn-move-up-${reg.id}`}
                          type="button"
                          onClick={() => handleMoveWaitlist(index, "up")}
                          disabled={isFirst || isPending}
                          className="px-2 py-1 text-xs text-chip/70 hover:text-chip disabled:opacity-20 cursor-pointer"
                          title="Subir posición"
                        >
                          ▲
                        </button>
                        <button
                          id={`btn-move-down-${reg.id}`}
                          type="button"
                          onClick={() => handleMoveWaitlist(index, "down")}
                          disabled={isLast || isPending}
                          className="px-2 py-1 text-xs text-chip/70 hover:text-chip disabled:opacity-20 cursor-pointer"
                          title="Bajar posición"
                        >
                          ▼
                        </button>
                      </div>
                    )}

                    {!isCancelled && (
                      <>
                        <button
                          id={`btn-edit-waitlist-${reg.id}`}
                          type="button"
                          onClick={() => handleOpenEdit(reg)}
                          className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-chip/80 hover:bg-white/10 hover:text-chip cursor-pointer"
                          title="Editar inscripción"
                        >
                          ✏️
                        </button>

                        <button
                          id={`btn-cancel-waitlist-${reg.id}`}
                          type="button"
                          onClick={() => setCancellingRegistration(reg)}
                          className="rounded-lg border border-red-500/20 bg-red-950/40 px-2.5 py-1.5 text-xs font-medium text-red-300/90 hover:bg-red-900/60 hover:text-red-200 cursor-pointer"
                          title="Dar de baja de la lista de espera"
                        >
                          🚫
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ===================================================================== */}
      {/* SECCIÓN 3: CANCELADOS CON ATRIBUCIÓN                                  */}
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
      {/* MODAL: Alta Manual de Jugador                                             */}
      {/* ========================================================================= */}
      {manualModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/15 bg-felt-900 p-6 shadow-2xl sm:p-8 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <h2 className="text-xl font-bold text-chip">
                  Alta Manual de Jugador
                </h2>
                <p className="text-xs text-chip/60 mt-0.5">
                  Misma mecánica que por enlace: si hay cupo entra a la mesa, si
                  no, a la espera.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setManualModalOpen(false)}
                className="text-chip/60 hover:text-chip p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {manualError && (
              <div className="mt-4 rounded-xl border border-red-500/30 bg-red-950/60 p-3 text-xs text-red-200">
                {manualError}
              </div>
            )}

            <form onSubmit={handleManualRegisterSubmit} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-chip/80">
                  Nombre o apodo <span className="text-red-400">*</span>
                </label>
                <input
                  id="input-manual-nickname"
                  type="text"
                  required
                  placeholder="Ej: David, El Tigre, etc."
                  value={manualNickname}
                  onChange={(e) => setManualNickname(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-white/15 bg-felt-950 px-3.5 py-2.5 text-base sm:text-sm text-chip placeholder:text-chip/30 focus:border-emerald-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-chip/80">
                  Teléfono móvil (identidad del jugador) <span className="text-red-400">*</span>
                </label>
                <input
                  id="input-manual-phone"
                  type="tel"
                  required
                  placeholder="Ej: 612 34 56 78 o +34..."
                  value={manualPhone}
                  onChange={(e) => setManualPhone(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-white/15 bg-felt-950 px-3.5 py-2.5 text-base sm:text-sm font-mono text-chip placeholder:text-chip/30 focus:border-emerald-400 focus:outline-none"
                />
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 p-3.5 space-y-3">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    id="checkbox-manual-late"
                    type="checkbox"
                    checked={manualLateArrival}
                    onChange={(e) => setManualLateArrival(e.target.checked)}
                    className="h-4 w-4 rounded border-white/20 bg-felt-950 text-emerald-500 focus:ring-emerald-400 cursor-pointer"
                  />
                  <span className="text-xs font-medium text-chip">
                    ⏰ Llegará tarde a la partida
                  </span>
                </label>

                {manualLateArrival && (
                  <div>
                    <label className="block text-[11px] font-semibold text-chip/70">
                      Hora estimada de llegada <span className="text-red-400">*</span>
                    </label>
                    <input
                      id="input-manual-late-time"
                      type="time"
                      required
                      value={manualEstimatedArrivalTime}
                      onChange={(e) =>
                        setManualEstimatedArrivalTime(e.target.value)
                      }
                      className="mt-1 w-full rounded-lg border border-white/15 bg-felt-950 px-3 py-2 text-base sm:text-xs font-mono text-chip focus:border-emerald-400 focus:outline-none"
                    />
                  </div>
                )}
              </div>

              <div className="mt-6 flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setManualModalOpen(false)}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-chip/70 hover:text-chip cursor-pointer"
                >
                  Cancelar
                </button>

                <button
                  id="btn-submit-manual-register"
                  type="submit"
                  disabled={isPending}
                  className="rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow hover:bg-emerald-500 disabled:opacity-50 active:scale-95 transition-all cursor-pointer"
                >
                  {isPending ? "Añadiendo..." : "Inscribir Jugador"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: Editar Inscripción                                                 */}
      {/* ========================================================================= */}
      {editingRegistration && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/15 bg-felt-900 p-6 shadow-2xl sm:p-8 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <h2 className="text-xl font-bold text-chip">
                  Editar Inscripción
                </h2>
                <p className="text-xs text-chip/60 font-mono mt-0.5">
                  Teléfono: {editingRegistration.phone}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingRegistration(null)}
                className="text-chip/60 hover:text-chip p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {editError && (
              <div className="mt-4 rounded-xl border border-red-500/30 bg-red-950/60 p-3 text-xs text-red-200">
                {editError}
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-chip/80">
                  Nombre o apodo <span className="text-red-400">*</span>
                </label>
                <input
                  id="input-edit-nickname"
                  type="text"
                  required
                  value={editNickname}
                  onChange={(e) => setEditNickname(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-white/15 bg-felt-950 px-3.5 py-2.5 text-base sm:text-sm text-chip focus:border-emerald-400 focus:outline-none"
                />
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 p-3.5 space-y-3">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    id="checkbox-edit-late"
                    type="checkbox"
                    checked={editLateArrival}
                    onChange={(e) => setEditLateArrival(e.target.checked)}
                    className="h-4 w-4 rounded border-white/20 bg-felt-950 text-emerald-500 focus:ring-emerald-400 cursor-pointer"
                  />
                  <span className="text-xs font-medium text-chip">
                    ⏰ Llegada tardía
                  </span>
                </label>

                {editLateArrival && (
                  <div>
                    <label className="block text-[11px] font-semibold text-chip/70">
                      Hora estimada de llegada <span className="text-red-400">*</span>
                    </label>
                    <input
                      id="input-edit-late-time"
                      type="time"
                      required
                      value={editEstimatedArrivalTime}
                      onChange={(e) =>
                        setEditEstimatedArrivalTime(e.target.value)
                      }
                      className="mt-1 w-full rounded-lg border border-white/15 bg-felt-950 px-3 py-2 text-base sm:text-xs font-mono text-chip focus:border-emerald-400 focus:outline-none"
                    />
                  </div>
                )}
              </div>

              <div className="mt-6 flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingRegistration(null)}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-chip/70 hover:text-chip cursor-pointer"
                >
                  Cancelar
                </button>

                <button
                  id="btn-submit-edit-registration"
                  type="submit"
                  disabled={isPending}
                  className="rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow hover:bg-emerald-500 disabled:opacity-50 cursor-pointer"
                >
                  {isPending ? "Guardando..." : "Guardar Cambios"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: Confirmar Baja Individual                                          */}
      {/* ========================================================================= */}
      {cancellingRegistration && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-red-500/30 bg-felt-900 p-6 shadow-2xl sm:p-8 animate-in zoom-in-95 duration-200">
            <h2 className="text-xl font-bold text-red-300">
              ¿Dar de baja a {cancellingRegistration.nickname}?
            </h2>
            <p className="mt-2 text-xs text-chip/80 leading-relaxed">
              Esta acción marcará la inscripción como cancelada por el{" "}
              <strong>Organizador</strong>.
              {cancellingRegistration.status === "confirmed" ||
              cancellingRegistration.status === "pending_confirmation" ? (
                <span className="block mt-2 font-semibold text-amber-300">
                  ⚠️ Al liberar una plaza ocupada, el primer jugador de la lista
                  de espera pasará automáticamente a Pendiente de confirmación.
                </span>
              ) : null}
            </p>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setCancellingRegistration(null)}
                className="rounded-xl px-4 py-2 text-xs font-semibold text-chip/70 hover:text-chip cursor-pointer"
              >
                Volver
              </button>
              <button
                id="btn-confirm-cancel-registration"
                type="button"
                onClick={handleCancelRegistrationConfirm}
                disabled={isPending}
                className="rounded-xl bg-red-600 px-5 py-2.5 text-xs font-bold text-white shadow hover:bg-red-500 disabled:opacity-50 cursor-pointer"
              >
                {isPending ? "Cancelando..." : "Confirmar Baja"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: Confirmar Rechazo de Pendiente                                     */}
      {/* ========================================================================= */}
      {rejectingRegistration && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-amber-500/30 bg-felt-900 p-6 shadow-2xl sm:p-8 animate-in zoom-in-95 duration-200">
            <h2 className="text-xl font-bold text-amber-300">
              ¿Rechazar plaza de {rejectingRegistration.nickname}?
            </h2>
            <p className="mt-2 text-xs text-chip/80 leading-relaxed">
              La inscripción quedará cancelada (Organizador) y la promoción
              continuará de inmediato con el siguiente jugador de la lista de
              espera según el orden vigente.
            </p>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setRejectingRegistration(null)}
                className="rounded-xl px-4 py-2 text-xs font-semibold text-chip/70 hover:text-chip cursor-pointer"
              >
                Volver
              </button>
              <button
                id="btn-confirm-reject-pending"
                type="button"
                onClick={handleRejectPendingConfirm}
                disabled={isPending}
                className="rounded-xl bg-red-600 px-5 py-2.5 text-xs font-bold text-white shadow hover:bg-red-500 disabled:opacity-50 cursor-pointer"
              >
                {isPending ? "Rechazando..." : "Rechazar y Promocionar Siguiente"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: Ajustar Cupo en Vivo                                               */}
      {/* ========================================================================= */}
      {capacityModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/15 bg-felt-900 p-6 shadow-2xl sm:p-8 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <h2 className="text-xl font-bold text-chip">
                  Ajustar Cupo en Vivo
                </h2>
                <p className="text-xs text-chip/60 mt-0.5">
                  Actualmente hay {occupiedCount} jugadores ocupando plaza.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCapacityModalOpen(false)}
                className="text-chip/60 hover:text-chip p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {capacityError && (
              <div className="mt-4 rounded-xl border border-red-500/30 bg-red-950/60 p-3 text-xs text-red-200">
                {capacityError}
              </div>
            )}

            <div className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-chip/80">
                  Nuevo número de plazas fijas
                </label>
                <div className="mt-2 flex items-center gap-3">
                  <input
                    id="input-ajustar-cupo"
                    type="number"
                    min="1"
                    max="100"
                    value={newCapacityInput}
                    onChange={(e) =>
                      setNewCapacityInput(parseInt(e.target.value, 10) || 1)
                    }
                    className="w-28 rounded-xl border border-white/15 bg-felt-950 px-3.5 py-2.5 text-center text-lg font-black text-chip focus:border-emerald-400 focus:outline-none"
                  />
                  <span className="text-xs text-chip/60">plazas fijas</span>
                </div>
              </div>

              {/* Dynamic rule explainers */}
              {newCapacityInput < occupiedCount && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-950/40 p-3.5 text-xs text-amber-200 leading-relaxed">
                  ⚠️ <strong>Reducción de cupo:</strong> Al reducir a{" "}
                  {newCapacityInput} plazas, los{" "}
                  <strong>{occupiedCount - newCapacityInput}</strong> últimos
                  jugadores confirmados serán desplazados al{" "}
                  <strong>PRINCIPIO de la lista de espera</strong> conservando su
                  orden relativo.
                </div>
              )}

              {newCapacityInput > state.capacity && state.waitlist.length > 0 && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/40 p-3.5 text-xs text-emerald-200 leading-relaxed">
                  ✨ <strong>Ampliación de cupo:</strong> Se promocionarán en
                  cascada hasta{" "}
                  <strong>
                    {Math.min(
                      newCapacityInput - occupiedCount,
                      state.waitlist.length
                    )}
                  </strong>{" "}
                  jugadores de la lista de espera directamente a{" "}
                  <strong>Pendientes de confirmación</strong>.
                </div>
              )}

              <div className="mt-6 flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setCapacityModalOpen(false)}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-chip/70 hover:text-chip cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  id="btn-confirm-ajustar-cupo"
                  type="button"
                  onClick={() => handleUpdateCapacitySubmit(newCapacityInput)}
                  disabled={isPending}
                  className="rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow hover:bg-emerald-500 disabled:opacity-50 cursor-pointer"
                >
                  {isPending ? "Actualizando..." : "Guardar Cupo"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
                className="text-chip/60 hover:text-chip p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-felt-950 p-4">
              <div className="truncate">
                <p className="text-xs font-medium text-chip/60">
                  Enlace público de la partida
                </p>
                <p className="mt-0.5 truncate font-mono text-sm font-semibold text-emerald-400">
                  {typeof window !== "undefined" ? window.location.origin : ""}
                  /p/{event.slug}
                </p>
              </div>
              <button
                type="button"
                onClick={handleCopyLink}
                className="shrink-0 rounded-xl bg-white/10 px-3.5 py-2 text-xs font-semibold text-chip transition-colors hover:bg-white/20 active:scale-95 cursor-pointer"
              >
                {copiedLink ? "¡Copiado! ✓" : "Copiar"}
              </button>
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between pb-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-chip/60">
                  Texto redactado para WhatsApp
                </span>
                <span className="text-[11px] text-chip/50">
                  Puedes editarlo antes de copiar
                </span>
              </div>

              {isLoadingWhatsapp ? (
                <div className="flex h-40 items-center justify-center rounded-xl border border-white/10 bg-felt-950 text-xs text-chip/50">
                  Generando plantilla de texto...
                </div>
              ) : (
                <textarea
                  rows={8}
                  value={whatsappText}
                  onChange={(e) => setWhatsappText(e.target.value)}
                  className="w-full rounded-xl border border-white/15 bg-felt-950 p-3.5 text-base sm:text-xs font-mono text-chip/90 leading-relaxed focus:border-emerald-400 focus:outline-none"
                />
              )}
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={handleCopyMessage}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-white/15 px-4 py-3 text-sm font-semibold text-chip transition-all hover:bg-white/20 active:scale-95 cursor-pointer"
              >
                {copiedMessage ? "¡Copiado! ✓" : "📋 Copiar Mensaje"}
              </button>

              <a
                href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                  whatsappText
                )}`}
                target="_blank"
                rel="noreferrer"
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow transition-all hover:bg-emerald-500 active:scale-95 cursor-pointer"
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
