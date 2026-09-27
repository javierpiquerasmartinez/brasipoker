"use client";

import { useState, useTransition, useEffect, useCallback, useId } from "react";
import Link from "next/link";
import {
  OrganizerEventCardData,
  createOrganizerEventAction,
  editOrganizerEventAction,
  cancelOrganizerEventAction,
  getOrganizerEventsAction,
  getWhatsAppTextAction,
  CreateEventInput,
  EditEventInput,
} from "./actions";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatSpanishDate, capitalizeFirstLetter } from "@/lib/formatters";
import { SpadeLogo } from "@/components/spade-logo";

interface OrganizerDashboardProps {
  initialUpcoming: OrganizerEventCardData[];
  initialPast: OrganizerEventCardData[];
}

export function OrganizerDashboard({
  initialUpcoming,
  initialPast,
}: OrganizerDashboardProps) {
  const [activeTab, setActiveTab] = useState<"upcoming" | "past">("upcoming");
  const [upcomingEvents, setUpcomingEvents] =
    useState<OrganizerEventCardData[]>(initialUpcoming);
  const [pastEvents, setPastEvents] =
    useState<OrganizerEventCardData[]>(initialPast);

  // Modal states
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editEventData, setEditEventData] =
    useState<OrganizerEventCardData | null>(null);
  const [cancelEventData, setCancelEventData] =
    useState<OrganizerEventCardData | null>(null);
  const [shareEventData, setShareEventData] =
    useState<OrganizerEventCardData | null>(null);
  const [expandedRosters, setExpandedRosters] = useState<
    Record<string, boolean>
  >({});

  // WhatsApp share modal state
  const [whatsappText, setWhatsappText] = useState<string>("");
  const [isLoadingWhatsapp, setIsLoadingWhatsapp] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Form states for creation
  const todayStr = new Date().toISOString().split("T")[0];
  const [newType, setNewType] = useState<"cash" | "tournament">("cash");
  const [newDate, setNewDate] = useState<string>(todayStr);
  const [newTime, setNewTime] = useState<string>("21:00");
  const [newCapacity, setNewCapacity] = useState<number>(8);
  const [newNote, setNewNote] = useState<string>("");
  const [newAllowWaitlist, setNewAllowWaitlist] = useState<boolean>(true);
  const [createError, setCreateError] = useState<string | null>(null);

  // Form states for editing
  const [editDate, setEditDate] = useState<string>("");
  const [editTime, setEditTime] = useState<string>("");
  const [editCapacity, setEditCapacity] = useState<number>(8);
  const [editNote, setEditNote] = useState<string>("");
  const [editAllowWaitlist, setEditAllowWaitlist] = useState<boolean>(true);
  const [editError, setEditError] = useState<string | null>(null);

  // Action status feedback
  const [globalFeedback, setGlobalFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const [isPending, startTransition] = useTransition();

  // Accessibility unique IDs
  const createFormId = useId();
  const editFormId = useId();

  // Refresh events list from server
  const refreshEvents = useCallback(() => {
    startTransition(async () => {
      const res = await getOrganizerEventsAction();
      if (res.success) {
        setUpcomingEvents(res.upcoming);
        setPastEvents(res.past);
      }
    });
  }, []);

  // Subscribe to realtime updates for live changes
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel("organizer-dashboard-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "events" },
        () => {
          refreshEvents();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "registrations" },
        () => {
          refreshEvents();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refreshEvents]);

  // Open Difundir / WhatsApp modal for an event
  const handleOpenShare = async (event: OrganizerEventCardData) => {
    setShareEventData(event);
    setIsLoadingWhatsapp(true);
    setCopiedMessage(false);
    setCopiedLink(false);

    const baseUrl =
      typeof window !== "undefined" ? window.location.origin : "";
    const res = await getWhatsAppTextAction(event.id, baseUrl);
    if (res.success) {
      setWhatsappText(res.text);
    } else {
      setWhatsappText(`¡Partida de póker! Apúntate aquí: ${baseUrl}/p/${event.slug}`);
    }
    setIsLoadingWhatsapp(false);
  };

  // Handle Create Event submission
  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    startTransition(async () => {
      const input: CreateEventInput = {
        type: newType,
        date: newDate,
        time: newTime,
        capacity: Number(newCapacity),
        note: newNote.trim() || undefined,
        allowWaitlist: newAllowWaitlist,
      };

      const res = await createOrganizerEventAction(input);
      if (!res.success) {
        setCreateError(res.error);
        return;
      }

      setCreateModalOpen(false);
      setGlobalFeedback({
        type: "success",
        message: "¡Evento creado con éxito! Puedes difundirlo por WhatsApp.",
      });

      // Reset form
      setNewType("cash");
      setNewDate(todayStr);
      setNewTime("21:00");
      setNewCapacity(8);
      setNewNote("");
      setNewAllowWaitlist(true);

      // Refresh list
      refreshEvents();

      // Immediately open WhatsApp difusión modal for the new event
      handleOpenShare({
        id: res.event.id,
        organizerId: res.event.organizerId,
        slug: res.event.slug,
        type: res.event.type,
        date: res.event.date,
        time: res.event.time,
        capacity: res.event.capacity,
        note: res.event.note,
        allowWaitlist: res.event.allowWaitlist,
        status: res.event.status,
        occupiedSeats: 0,
        confirmedCount: 0,
        pendingCount: 0,
        waitlistCount: 0,
        visualCycle: "upcoming",
        roster: {
          confirmed: [],
          pendingConfirmation: [],
          waitlist: [],
          cancelled: [],
        },
      });
    });
  };

  // Open Edit modal
  const handleOpenEdit = (event: OrganizerEventCardData) => {
    setEditEventData(event);
    setEditDate(event.date);
    setEditTime(event.time);
    setEditCapacity(event.capacity);
    setEditNote(event.note || "");
    setEditAllowWaitlist(event.allowWaitlist);
    setEditError(null);
  };

  // Handle Edit submission
  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editEventData) return;
    setEditError(null);

    startTransition(async () => {
      const input: EditEventInput = {
        eventId: editEventData.id,
        date: editDate,
        time: editTime,
        capacity: Number(editCapacity),
        note: editNote.trim() || undefined,
        allowWaitlist: editAllowWaitlist,
      };

      const res = await editOrganizerEventAction(input);
      if (!res.success) {
        setEditError(res.error);
        return;
      }

      setEditEventData(null);
      setGlobalFeedback({
        type: "success",
        message: "Convocatoria actualizada con éxito.",
      });
      refreshEvents();
    });
  };

  // Handle Cancel Event submission
  const handleCancelSubmit = () => {
    if (!cancelEventData) return;

    startTransition(async () => {
      const res = await cancelOrganizerEventAction(cancelEventData.id);
      if (!res.success) {
        setGlobalFeedback({
          type: "error",
          message: res.error,
        });
        setCancelEventData(null);
        return;
      }

      setCancelEventData(null);
      setGlobalFeedback({
        type: "success",
        message:
          "Evento cancelado permanentemente. Las inscripciones han sido dadas de baja.",
      });
      refreshEvents();
    });
  };

  // Copy WhatsApp message to clipboard
  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(whatsappText);
      setCopiedMessage(true);
      setTimeout(() => setCopiedMessage(false), 2500);
    } catch {
      // Fallback
    }
  };

  // Copy short link only
  const handleCopyLink = async (slug: string) => {
    try {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const url = `${origin}/p/${slug}`;
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      // Fallback
    }
  };

  const currentList = activeTab === "upcoming" ? upcomingEvents : pastEvents;

  return (
    <div className="flex flex-col gap-8 pb-16">
      {/* Top Banner & Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center rounded-lg bg-emerald-500/20 p-1.5 text-emerald-400">
              <SpadeLogo className="h-5 w-5" />
            </span>
            <h1 className="text-2xl font-black tracking-tight text-chip sm:text-3xl">
              Panel del Organizador
            </h1>
          </div>
          <p className="mt-1 text-sm text-chip/70">
            Gestiona tus convocatorias, difunde por WhatsApp y monitoriza tus
            partidas en vivo.
          </p>
        </div>

        <button
          id="btn-crear-evento"
          type="button"
          onClick={() => setCreateModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white shadow-lg shadow-emerald-950/40 transition-all hover:bg-emerald-500 hover:shadow-emerald-900/50 active:scale-95"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          Crear Evento
        </button>
      </div>

      {/* Global notifications */}
      {globalFeedback && (
        <aside
          role="alert"
          className={`flex items-center justify-between rounded-xl p-4 text-sm font-medium ${
            globalFeedback.type === "success"
              ? "border border-emerald-500/30 bg-emerald-950/80 text-emerald-200"
              : "border border-red-500/30 bg-red-950/80 text-red-200"
          }`}
        >
          <span>{globalFeedback.message}</span>
          <button
            type="button"
            onClick={() => setGlobalFeedback(null)}
            className="ml-4 text-chip/60 hover:text-chip"
          >
            ✕
          </button>
        </aside>
      )}

      {/* Tabs: Próximos vs Pasadas */}
      <div className="flex border-b border-white/10">
        <button
          id="tab-proximos"
          type="button"
          onClick={() => setActiveTab("upcoming")}
          className={`relative pb-3 text-sm font-semibold transition-colors sm:text-base ${
            activeTab === "upcoming"
              ? "text-emerald-400"
              : "text-chip/60 hover:text-chip"
          }`}
        >
          Próximos Eventos
          <span
            className={`ml-2 rounded-full px-2 py-0.5 text-xs font-bold ${
              activeTab === "upcoming"
                ? "bg-emerald-500/20 text-emerald-300"
                : "bg-white/10 text-chip/60"
            }`}
          >
            {upcomingEvents.length}
          </span>
          {activeTab === "upcoming" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400" />
          )}
        </button>

        <button
          id="tab-pasadas"
          type="button"
          onClick={() => setActiveTab("past")}
          className={`relative ml-8 pb-3 text-sm font-semibold transition-colors sm:text-base ${
            activeTab === "past"
              ? "text-emerald-400"
              : "text-chip/60 hover:text-chip"
          }`}
        >
          Pasadas e Historial
          <span
            className={`ml-2 rounded-full px-2 py-0.5 text-xs font-bold ${
              activeTab === "past"
                ? "bg-emerald-500/20 text-emerald-300"
                : "bg-white/10 text-chip/60"
            }`}
          >
            {pastEvents.length}
          </span>
          {activeTab === "past" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400" />
          )}
        </button>
      </div>

      {/* Events Grid / List */}
      {currentList.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-white/15 bg-felt-900/30 px-6 py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5 text-chip/40">
            <SpadeLogo className="h-8 w-8" />
          </div>
          <h2 className="mt-4 text-lg font-bold text-chip">
            {activeTab === "upcoming"
              ? "No tienes convocatorias próximas"
              : "No tienes eventos pasados"}
          </h2>
          <p className="mt-1 max-w-sm text-sm text-chip/60">
            {activeTab === "upcoming"
              ? "Crea una partida para esta noche o el fin de semana y comparte el enlace por WhatsApp con tu grupo."
              : "Los eventos finalizados o cancelados se archivarán automáticamente en esta sección."}
          </p>
          {activeTab === "upcoming" && (
            <button
              type="button"
              onClick={() => setCreateModalOpen(true)}
              className="mt-6 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-emerald-500"
            >
              + Crear Convocatoria
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2">
          {currentList.map((event) => {
            const isCancelled = event.status === "cancelled";
            const percent = Math.min(
              100,
              Math.round((event.occupiedSeats / event.capacity) * 100)
            );

            return (
              <article
                key={event.id}
                className={`relative flex flex-col justify-between overflow-hidden rounded-3xl border p-6 transition-all duration-300 ${
                  isCancelled
                    ? "border-red-500/20 bg-felt-900/20 opacity-80"
                    : "border-white/10 bg-felt-900/80 shadow-lg shadow-black/20 hover:border-emerald-500/30 hover:bg-felt-900"
                }`}
              >
                <div>
                  {/* Card Header: Badges */}
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${
                        event.type === "cash"
                          ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                          : "border border-amber-500/30 bg-amber-500/10 text-amber-300"
                      }`}
                    >
                      {event.type === "cash" ? "💵 Cash" : "🏆 Torneo"}
                    </span>

                    {/* Cycle Indicator */}
                    <VisualCycleBadge cycle={event.visualCycle} />
                  </div>

                  {/* Date & Time */}
                  <div className="mt-4">
                    <Link
                      href={`/panel/eventos/${event.id}`}
                      className="group inline-block"
                    >
                      <h2 className="text-xl font-bold text-chip transition-colors group-hover:text-emerald-400">
                        {capitalizeFirstLetter(formatSpanishDate(event.date))}
                      </h2>
                    </Link>
                    <p className="mt-1 flex items-center gap-2 text-sm text-chip/70">
                      <span className="font-semibold text-emerald-400">
                        ⏰ {event.time} h
                      </span>
                      <span>•</span>
                      <span>{event.capacity} plazas máx</span>
                    </p>
                  </div>

                  {/* Note snippet */}
                  {event.note && (
                    <p className="mt-3 line-clamp-2 rounded-xl border border-white/5 bg-felt-950/40 p-2.5 text-xs text-chip/80">
                      💬 {event.note}
                    </p>
                  )}

                  {/* Occupancy bar */}
                  <div className="mt-4 border-t border-white/10 pt-4">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-chip/70">Plazas</span>
                      <span className="text-chip">
                        {event.occupiedSeats} / {event.capacity} ocupadas
                        {event.waitlistCount > 0 && (
                          <span className="ml-1 text-amber-400">
                            (+{event.waitlistCount} espera)
                          </span>
                        )}
                      </span>
                    </div>

                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-felt-950">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          percent >= 100
                            ? "bg-amber-400"
                            : percent >= 75
                            ? "bg-yellow-400"
                            : "bg-emerald-500"
                        }`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>

                  {/* Roster expansion toggle */}
                  <div className="mt-4 border-t border-white/5 pt-3">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedRosters((prev) => ({
                          ...prev,
                          [event.id]: !prev[event.id],
                        }))
                      }
                      className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-chip/80 transition-colors hover:bg-white/[0.07] hover:text-chip"
                    >
                      <span className="flex items-center gap-1.5">
                        <span>👥 Roster de Jugadores</span>
                        <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[11px] font-bold text-emerald-300">
                          {(event.roster?.confirmed?.length ?? 0) +
                            (event.roster?.pendingConfirmation?.length ?? 0)}
                          {event.roster?.waitlist?.length
                            ? ` + ${event.roster.waitlist.length} cola`
                            : ""}
                        </span>
                      </span>
                      <span className="text-[11px] text-chip/60">
                        {expandedRosters[event.id] ? "▲ Ocultar" : "▼ Ver completo"}
                      </span>
                    </button>

                    {/* Expanded Roster Details */}
                    {expandedRosters[event.id] && (
                      <div className="mt-3 space-y-3 rounded-2xl border border-white/10 bg-felt-950/80 p-3.5 text-xs animate-in fade-in duration-200">
                        {/* Confirmados & Pendientes */}
                        <div>
                          <p className="font-bold text-emerald-400 uppercase tracking-wider text-[10px]">
                            Confirmados (
                            {(event.roster?.confirmed?.length ?? 0) +
                              (event.roster?.pendingConfirmation?.length ?? 0)}
                            )
                          </p>
                          {(event.roster?.confirmed?.length ?? 0) +
                            (event.roster?.pendingConfirmation?.length ?? 0) ===
                          0 ? (
                            <p className="mt-1 text-chip/40 italic text-[11px]">
                              Sin jugadores confirmados
                            </p>
                          ) : (
                            <ul className="mt-1.5 divide-y divide-white/5">
                              {event.roster?.confirmed?.map((p) => (
                                <li
                                  key={p.id}
                                  className="flex items-center justify-between py-1 text-chip/90"
                                >
                                  <span className="font-medium">
                                    {p.nickname}
                                  </span>
                                  <div className="flex items-center gap-2 text-[11px] text-chip/60 font-mono">
                                    {p.lateArrival && (
                                      <span className="text-sky-300">
                                        ⏰ {p.estimatedArrivalTime}
                                      </span>
                                    )}
                                    <span>📞 {p.phone}</span>
                                  </div>
                                </li>
                              ))}
                              {event.roster?.pendingConfirmation?.map((p) => (
                                <li
                                  key={p.id}
                                  className="flex items-center justify-between py-1 text-amber-300"
                                >
                                  <span className="font-medium">
                                    {p.nickname} (⚠️ Pendiente)
                                  </span>
                                  <div className="flex items-center gap-2 text-[11px] font-mono">
                                    {p.lateArrival && (
                                      <span className="text-sky-300">
                                        ⏰ {p.estimatedArrivalTime}
                                      </span>
                                    )}
                                    <span>📞 {p.phone}</span>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>

                        {/* Waitlist */}
                        {(event.roster?.waitlist?.length ?? 0) > 0 && (
                          <div className="border-t border-white/10 pt-2">
                            <p className="font-bold text-amber-400 uppercase tracking-wider text-[10px]">
                              Lista de Espera ({event.roster?.waitlist?.length})
                            </p>
                            <ul className="mt-1.5 divide-y divide-white/5">
                              {event.roster?.waitlist?.map((p) => (
                                <li
                                  key={p.id}
                                  className="flex items-center justify-between py-1 text-chip/80"
                                >
                                  <span>
                                    <strong className="text-amber-300 mr-1.5">
                                      #{p.waitlistPosition}
                                    </strong>
                                    {p.nickname}
                                  </span>
                                  <span className="text-[11px] text-chip/60 font-mono">
                                    📞 {p.phone}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Cancelled */}
                        {(event.roster?.cancelled?.length ?? 0) > 0 && (
                          <div className="border-t border-white/10 pt-2">
                            <p className="font-bold text-red-400/80 uppercase tracking-wider text-[10px]">
                              Cancelados ({event.roster?.cancelled?.length})
                            </p>
                            <ul className="mt-1.5 divide-y divide-white/5 text-[11px]">
                              {event.roster?.cancelled?.map((p) => (
                                <li
                                  key={p.id}
                                  className="flex items-center justify-between py-1 text-chip/50"
                                >
                                  <span className="line-through">
                                    {p.nickname}
                                  </span>
                                  <span>
                                    {p.cancelledBy === "organizer"
                                      ? "🛡️ Org"
                                      : "👤 Jugador"}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        <div className="pt-1 text-right">
                          <Link
                            href={`/panel/eventos/${event.id}`}
                            className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 hover:underline"
                          >
                            Gestionar en vivo ➔
                          </Link>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Footer: Actions */}
                <div className="mt-6 flex flex-col gap-2.5 border-t border-white/10 pt-4">
                  {/* Primary Action: Monitor Live */}
                  <Link
                    href={`/panel/eventos/${event.id}`}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-500/40 bg-felt-950/90 px-4 py-2.5 text-xs font-bold text-emerald-300 shadow transition-all hover:border-emerald-400 hover:bg-emerald-950/60"
                  >
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Monitorizar en vivo (Roster)</span>
                  </Link>

                  {/* Share & Copy Link button */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenShare(event)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600/90 px-3.5 py-2 text-xs font-semibold text-white shadow transition-colors hover:bg-emerald-500"
                    >
                      <span>💬</span>
                      <span>Difundir (WhatsApp)</span>
                    </button>

                    <Link
                      href={`/p/${event.slug}`}
                      target="_blank"
                      className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-chip hover:bg-white/10"
                      title="Ver enlace público"
                    >
                      🔗
                    </Link>
                  </div>

                  {/* Edit and Cancel buttons for active events */}
                  {!isCancelled && (
                    <div className="flex items-center justify-between gap-2 pt-1 text-xs">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(event)}
                        className="rounded-lg px-2.5 py-1.5 font-medium text-chip/70 hover:bg-white/5 hover:text-chip"
                      >
                        ✏️ Editar
                      </button>

                      <button
                        type="button"
                        onClick={() => setCancelEventData(event)}
                        className="rounded-lg px-2.5 py-1.5 font-medium text-red-400/80 hover:bg-red-950/40 hover:text-red-300"
                      >
                        🚫 Cancelar
                      </button>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: Crear Evento                                                       */}
      {/* ========================================================================= */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-white/15 bg-felt-900 p-6 shadow-2xl sm:p-8">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <h2 className="text-xl font-bold text-chip">Nueva Convocatoria</h2>
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="rounded-lg p-1.5 text-chip/60 hover:bg-white/10 hover:text-chip"
              >
                ✕
              </button>
            </div>

            {createError && (
              <aside
                role="alert"
                className="mt-4 rounded-xl border border-red-500/30 bg-red-950/60 p-3 text-xs text-red-200"
              >
                {createError}
              </aside>
            )}

            <form
              id={createFormId}
              onSubmit={handleCreateSubmit}
              className="mt-6 flex flex-col gap-4 text-sm"
            >
              {/* Tipo de evento */}
              <div>
                <label className="block text-xs font-semibold text-chip/70 mb-2">
                  Tipo de Partida
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setNewType("cash")}
                    className={`flex items-center justify-center gap-2 rounded-xl border p-3 font-semibold transition-all ${
                      newType === "cash"
                        ? "border-emerald-500 bg-emerald-500/20 text-emerald-300"
                        : "border-white/10 bg-white/5 text-chip/70 hover:bg-white/10"
                    }`}
                  >
                    💵 Cash Game
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewType("tournament")}
                    className={`flex items-center justify-center gap-2 rounded-xl border p-3 font-semibold transition-all ${
                      newType === "tournament"
                        ? "border-amber-500 bg-amber-500/20 text-amber-300"
                        : "border-white/10 bg-white/5 text-chip/70 hover:bg-white/10"
                    }`}
                  >
                    🏆 Torneo
                  </button>
                </div>
              </div>

              {/* Fecha y Hora */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="create-date"
                    className="block text-xs font-semibold text-chip/70"
                  >
                    Fecha
                  </label>
                  <input
                    id="create-date"
                    type="date"
                    required
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-white/15 bg-felt-950 px-3 py-2.5 text-chip focus:border-emerald-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label
                    htmlFor="create-time"
                    className="block text-xs font-semibold text-chip/70"
                  >
                    Hora de inicio
                  </label>
                  <input
                    id="create-time"
                    type="time"
                    required
                    value={newTime}
                    onChange={(e) => setNewTime(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-white/15 bg-felt-950 px-3 py-2.5 text-chip focus:border-emerald-400 focus:outline-none"
                  />
                </div>
              </div>

              {/* Cupo */}
              <div>
                <label
                  htmlFor="create-capacity"
                  className="block text-xs font-semibold text-chip/70"
                >
                  Cupo (Plazas fijas)
                </label>
                <input
                  id="create-capacity"
                  type="number"
                  required
                  min={1}
                  max={200}
                  value={newCapacity}
                  onChange={(e) => setNewCapacity(Math.max(1, Number(e.target.value)))}
                  className="mt-1.5 w-full rounded-xl border border-white/15 bg-felt-950 px-3 py-2.5 text-chip focus:border-emerald-400 focus:outline-none"
                />
              </div>

              {/* Nota / Detalles */}
              <div>
                <label
                  htmlFor="create-note"
                  className="block text-xs font-semibold text-chip/70"
                >
                  Nota descriptiva (opcional)
                </label>
                <input
                  id="create-note"
                  type="text"
                  placeholder="ej. Ciega 1/2 € - Entrada mín 50€"
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-white/15 bg-felt-950 px-3 py-2.5 text-chip placeholder-chip/30 focus:border-emerald-400 focus:outline-none"
                />
              </div>

              {/* Toggle Lista de Espera */}
              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3.5">
                <div>
                  <span className="block font-semibold text-chip">
                    Lista de espera
                  </span>
                  <span className="block text-xs text-chip/60">
                    Permitir que los jugadores se anoten en cola al agotarse el cupo.
                  </span>
                </div>
                <input
                  id="create-waitlist-toggle"
                  type="checkbox"
                  checked={newAllowWaitlist}
                  onChange={(e) => setNewAllowWaitlist(e.target.checked)}
                  className="h-5 w-5 rounded border-white/20 bg-felt-950 text-emerald-500 accent-emerald-500"
                />
              </div>

              {/* Buttons */}
              <div className="mt-4 flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="rounded-xl px-4 py-2.5 text-sm font-semibold text-chip/70 hover:bg-white/5"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 font-semibold text-white shadow-md hover:bg-emerald-500 disabled:opacity-50"
                >
                  {isPending ? "Creando..." : "Crear Convocatoria"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: Difundir por WhatsApp                                              */}
      {/* ========================================================================= */}
      {shareEventData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-white/15 bg-felt-900 p-6 shadow-2xl sm:p-8">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <h2 className="text-xl font-bold text-chip">
                  Difundir Convocatoria
                </h2>
                <p className="text-xs text-chip/60 mt-0.5">
                  Comparte en WhatsApp para que los jugadores se apunten desde su móvil.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShareEventData(null)}
                className="rounded-lg p-1.5 text-chip/60 hover:bg-white/10 hover:text-chip"
              >
                ✕
              </button>
            </div>

            {/* Short link box */}
            <div className="mt-5 rounded-2xl border border-emerald-500/30 bg-emerald-950/40 p-3.5">
              <span className="block text-xs font-semibold uppercase tracking-wider text-emerald-400">
                Enlace público directo
              </span>
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className="truncate text-sm font-mono font-medium text-chip">
                  {typeof window !== "undefined" ? window.location.origin : ""}
                  /p/{shareEventData.slug}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopyLink(shareEventData.slug)}
                  className="shrink-0 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-chip transition-colors hover:bg-white/20"
                >
                  {copiedLink ? "¡Copiado! ✓" : "Copiar"}
                </button>
              </div>
            </div>

            {/* WhatsApp Textarea */}
            <div className="mt-5">
              <div className="flex items-center justify-between text-xs font-semibold text-chip/70 mb-1.5">
                <span>Mensaje para WhatsApp (editable)</span>
                <span>Listo para copiar</span>
              </div>
              {isLoadingWhatsapp ? (
                <div className="h-44 w-full animate-pulse rounded-xl border border-white/10 bg-felt-950/60 p-4 text-xs text-chip/40">
                  Generando plantilla con formato del dominio...
                </div>
              ) : (
                <textarea
                  id="whatsapp-text-area"
                  rows={8}
                  value={whatsappText}
                  onChange={(e) => setWhatsappText(e.target.value)}
                  className="w-full rounded-xl border border-white/15 bg-felt-950 p-3.5 text-xs font-mono text-chip/90 leading-relaxed focus:border-emerald-400 focus:outline-none"
                />
              )}
            </div>

            {/* Actions: Copiar + Abrir en WhatsApp */}
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                id="btn-copiar-mensaje"
                type="button"
                onClick={handleCopyMessage}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-white/15 px-4 py-3 text-sm font-semibold text-chip transition-all hover:bg-white/20 active:scale-95"
              >
                {copiedMessage ? "¡Mensaje copiado! ✓" : "📋 Copiar Mensaje"}
              </button>

              <a
                id="btn-abrir-whatsapp"
                href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                  whatsappText
                )}`}
                target="_blank"
                rel="noreferrer"
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-md transition-all hover:bg-emerald-500 active:scale-95"
              >
                <span>💬</span>
                <span>Abrir WhatsApp</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: Editar Convocatoria                                                */}
      {/* ========================================================================= */}
      {editEventData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-white/15 bg-felt-900 p-6 shadow-2xl sm:p-8">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <h2 className="text-xl font-bold text-chip">
                  Editar Convocatoria
                </h2>
                <p className="text-xs text-chip/60 mt-0.5">
                  Los cambios se reflejarán inmediatamente en el enlace ya difundido.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditEventData(null)}
                className="rounded-lg p-1.5 text-chip/60 hover:bg-white/10 hover:text-chip"
              >
                ✕
              </button>
            </div>

            {editError && (
              <aside
                role="alert"
                className="mt-4 rounded-xl border border-red-500/30 bg-red-950/60 p-3 text-xs text-red-200"
              >
                {editError}
              </aside>
            )}

            <form
              id={editFormId}
              onSubmit={handleEditSubmit}
              className="mt-6 flex flex-col gap-4 text-sm"
            >
              {/* Fecha y Hora */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="edit-date"
                    className="block text-xs font-semibold text-chip/70"
                  >
                    Fecha
                  </label>
                  <input
                    id="edit-date"
                    type="date"
                    required
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-white/15 bg-felt-950 px-3 py-2.5 text-chip focus:border-emerald-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label
                    htmlFor="edit-time"
                    className="block text-xs font-semibold text-chip/70"
                  >
                    Hora de inicio
                  </label>
                  <input
                    id="edit-time"
                    type="time"
                    required
                    value={editTime}
                    onChange={(e) => setEditTime(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-white/15 bg-felt-950 px-3 py-2.5 text-chip focus:border-emerald-400 focus:outline-none"
                  />
                </div>
              </div>

              {/* Cupo */}
              <div>
                <label
                  htmlFor="edit-capacity"
                  className="block text-xs font-semibold text-chip/70"
                >
                  Cupo (Plazas)
                </label>
                <input
                  id="edit-capacity"
                  type="number"
                  required
                  min={1}
                  max={200}
                  value={editCapacity}
                  onChange={(e) => setEditCapacity(Math.max(1, Number(e.target.value)))}
                  className="mt-1.5 w-full rounded-xl border border-white/15 bg-felt-950 px-3 py-2.5 text-chip focus:border-emerald-400 focus:outline-none"
                />
                <span className="mt-1 block text-xs text-chip/50">
                  Si reduces el cupo, los últimos confirmados pasarán a la cabeza de
                  la lista de espera. Si lo amplías, se promocionarán en cascada.
                </span>
              </div>

              {/* Nota */}
              <div>
                <label
                  htmlFor="edit-note"
                  className="block text-xs font-semibold text-chip/70"
                >
                  Nota descriptiva
                </label>
                <input
                  id="edit-note"
                  type="text"
                  placeholder="ej. Ciega 1/2 € - Entrada mín 50€"
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-white/15 bg-felt-950 px-3 py-2.5 text-chip focus:border-emerald-400 focus:outline-none"
                />
              </div>

              {/* Toggle Lista de Espera */}
              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3.5">
                <div>
                  <span className="block font-semibold text-chip">
                    Lista de espera
                  </span>
                  <span className="block text-xs text-chip/60">
                    Permitir que los jugadores entren en lista de espera al agotarse el cupo.
                  </span>
                </div>
                <input
                  id="edit-waitlist-toggle"
                  type="checkbox"
                  checked={editAllowWaitlist}
                  onChange={(e) => setEditAllowWaitlist(e.target.checked)}
                  className="h-5 w-5 rounded border-white/20 bg-felt-950 text-emerald-500 accent-emerald-500"
                />
              </div>

              {/* Buttons */}
              <div className="mt-4 flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditEventData(null)}
                  className="rounded-xl px-4 py-2.5 text-sm font-semibold text-chip/70 hover:bg-white/5"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 font-semibold text-white shadow-md hover:bg-emerald-500 disabled:opacity-50"
                >
                  {isPending ? "Guardando..." : "Guardar Cambios"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: Cancelar Convocatoria                                              */}
      {/* ========================================================================= */}
      {cancelEventData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-red-500/30 bg-felt-900 p-6 shadow-2xl sm:p-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/20 text-red-400">
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>

            <h2 className="mt-4 text-xl font-bold text-chip">
              ¿Cancelar esta convocatoria?
            </h2>

            <p className="mt-2 text-sm text-chip/70 leading-relaxed">
              Esta acción es permanente: el evento quedará cancelado, todas las
              inscripciones activas pasarán a canceladas y el enlace público
              mostrará un banner permanente advirtiendo de la cancelación.
            </p>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setCancelEventData(null)}
                className="rounded-xl px-4 py-2.5 text-sm font-semibold text-chip/70 hover:bg-white/5"
              >
                Volver
              </button>
              <button
                id="btn-confirm-cancel-event"
                type="button"
                disabled={isPending}
                onClick={handleCancelSubmit}
                className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-red-500 disabled:opacity-50"
              >
                {isPending ? "Cancelando..." : "Sí, Cancelar Evento"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function VisualCycleBadge({ cycle }: { cycle: string }) {
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
