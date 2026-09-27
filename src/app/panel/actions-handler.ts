import { RegistrationDomain } from "@/domain/registration-domain";
import { EventRepository } from "@/domain/event-repository";
import {
  Event,
  EventType,
  EventStatus,
  VisibleEventState,
  Registration,
  RegistrationResult,
  CancelResult,
  RejectResult,
} from "@/domain/types";
import {
  getEventVisualCycle,
  splitAndSortEvents,
  EventVisualCycle,
} from "@/domain/event-cycle";

export interface CreateEventInput {
  type: EventType;
  date: string;
  time: string;
  capacity: number;
  note?: string;
  allowWaitlist: boolean;
}

export interface EditEventInput {
  eventId: string;
  type?: EventType;
  date?: string;
  time?: string;
  capacity?: number;
  note?: string;
  allowWaitlist?: boolean;
}

export interface ManualRegisterInput {
  phone: string;
  nickname: string;
  lateArrival: boolean;
  estimatedArrivalTime?: string;
}

export interface EditRegistrationInput {
  nickname?: string;
  lateArrival?: boolean;
  estimatedArrivalTime?: string;
}

export interface OrganizerEventCardData {
  id: string;
  organizerId: string;
  slug: string;
  type: EventType;
  date: string;
  time: string;
  capacity: number;
  note?: string;
  allowWaitlist: boolean;
  status: EventStatus;
  occupiedSeats: number;
  confirmedCount: number;
  pendingCount: number;
  waitlistCount: number;
  visualCycle: EventVisualCycle;
  roster: {
    confirmed: Registration[];
    pendingConfirmation: Registration[];
    waitlist: Registration[];
    cancelled: Registration[];
  };
}

export type CreateEventActionResult =
  | { success: true; event: Event }
  | { success: false; error: string };

export type EditEventActionResult =
  | { success: true; event: Event }
  | { success: false; error: string };

export type CancelEventActionResult =
  | { success: true; event: Event }
  | { success: false; error: string };

export type GetOrganizerEventsActionResult =
  | {
      success: true;
      upcoming: OrganizerEventCardData[];
      past: OrganizerEventCardData[];
    }
  | { success: false; error: string };

export type GetWhatsAppTextActionResult =
  | { success: true; text: string }
  | { success: false; error: string };

export type GetEventLiveStateActionResult =
  | { success: true; state: VisibleEventState }
  | { success: false; error: string };

export type ConfirmPendingActionResult =
  | { success: true; registration: Registration }
  | { success: false; error: string };

export type RejectPendingActionResult =
  | { success: true; result: RejectResult }
  | { success: false; error: string };

export type ManualRegisterActionResult =
  | { success: true; result: RegistrationResult }
  | { success: false; error: string };

export type ReorderWaitlistActionResult =
  | { success: true; waitlist: Registration[] }
  | { success: false; error: string };

export type EditRegistrationActionResult =
  | { success: true; registration: Registration }
  | { success: false; error: string };

export type CancelRegistrationActionResult =
  | { success: true; result: CancelResult }
  | { success: false; error: string };

export type UpdateCapacityActionResult =
  | { success: true; event: Event }
  | { success: false; error: string };

export function createOrganizerActionsHandler(
  domain: RegistrationDomain,
  getUserId: () => string | null | Promise<string | null>,
  repo?: EventRepository
) {
  async function checkOwnership(eventId: string) {
    const userId = await getUserId();
    if (!userId) {
      return {
        authorized: false as const,
        error: "Debes iniciar sesión para realizar esta acción",
      };
    }
    try {
      const state = await domain.getVisibleEventState(eventId);
      if (state.event.organizerId !== userId) {
        return {
          authorized: false as const,
          error: "No tienes permiso sobre este evento",
        };
      }
      return { authorized: true as const, state };
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Evento no encontrado";
      return { authorized: false as const, error: msg };
    }
  }

  return {
    async createEvent(input: CreateEventInput): Promise<CreateEventActionResult> {
      const userId = await getUserId();
      if (!userId) {
        return {
          success: false,
          error: "Debes iniciar sesión para crear un evento",
        };
      }
      try {
        const event = await domain.createEvent({
          organizerId: userId,
          type: input.type,
          date: input.date,
          time: input.time,
          capacity: input.capacity,
          note: input.note,
          allowWaitlist: input.allowWaitlist,
        });
        return { success: true, event };
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Error al crear el evento";
        return { success: false, error: msg };
      }
    },

    async editEvent(input: EditEventInput): Promise<EditEventActionResult> {
      const userId = await getUserId();
      if (!userId) {
        return {
          success: false,
          error: "Debes iniciar sesión para editar un evento",
        };
      }
      try {
        const existing = await domain.getVisibleEventState(input.eventId);
        if (existing.event.organizerId !== userId) {
          return {
            success: false,
            error: "No tienes permiso para editar este evento",
          };
        }
        const updated = await domain.editEvent({
          eventId: input.eventId,
          type: input.type,
          date: input.date,
          time: input.time,
          capacity: input.capacity,
          note: input.note,
          allowWaitlist: input.allowWaitlist,
        });
        return { success: true, event: updated };
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Error al editar el evento";
        return { success: false, error: msg };
      }
    },

    async cancelEvent(eventId: string): Promise<CancelEventActionResult> {
      const userId = await getUserId();
      if (!userId) {
        return {
          success: false,
          error: "Debes iniciar sesión para cancelar un evento",
        };
      }
      try {
        const existing = await domain.getVisibleEventState(eventId);
        if (existing.event.organizerId !== userId) {
          return {
            success: false,
            error: "No tienes permiso para cancelar este evento",
          };
        }
        const cancelled = await domain.cancelEvent({ eventId });
        return { success: true, event: cancelled };
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Error al cancelar el evento";
        return { success: false, error: msg };
      }
    },

    async getOrganizerEvents(
      referenceDate: Date = new Date()
    ): Promise<GetOrganizerEventsActionResult> {
      const userId = await getUserId();
      if (!userId) {
        return {
          success: false,
          error: "Debes iniciar sesión para ver tus eventos",
        };
      }
      try {
        const repository =
          repo || (domain as unknown as { repo: EventRepository }).repo;
        const allEvents = await repository.listEventsByOrganizer(userId);

        const { upcoming, past } = splitAndSortEvents(allEvents, referenceDate);

        const enrich = async (
          ev: Event
        ): Promise<OrganizerEventCardData> => {
          const state = await domain.getVisibleEventState(ev.id);
          return {
            id: ev.id,
            organizerId: ev.organizerId,
            slug: ev.slug,
            type: ev.type,
            date: ev.date,
            time: ev.time,
            capacity: ev.capacity,
            note: ev.note,
            allowWaitlist: ev.allowWaitlist,
            status: ev.status,
            occupiedSeats: state.occupiedSeats,
            confirmedCount: state.confirmed.length,
            pendingCount: state.pendingConfirmation.length,
            waitlistCount: state.waitlist.length,
            visualCycle: getEventVisualCycle(ev, referenceDate),
            roster: {
              confirmed: state.confirmed,
              pendingConfirmation: state.pendingConfirmation,
              waitlist: state.waitlist,
              cancelled: state.cancelled,
            },
          };
        };

        const enrichedUpcoming = await Promise.all(upcoming.map(enrich));
        const enrichedPast = await Promise.all(past.map(enrich));

        return {
          success: true,
          upcoming: enrichedUpcoming,
          past: enrichedPast,
        };
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Error al obtener los eventos";
        return { success: false, error: msg };
      }
    },

    async getWhatsAppText(
      eventId: string,
      baseUrl?: string
    ): Promise<GetWhatsAppTextActionResult> {
      try {
        const text = await domain.generateWhatsAppText({ eventId, baseUrl });
        return { success: true, text };
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : "Error al generar texto de WhatsApp";
        return { success: false, error: msg };
      }
    },

    async getEventLiveState(
      eventId: string
    ): Promise<GetEventLiveStateActionResult> {
      const auth = await checkOwnership(eventId);
      if (!auth.authorized) {
        return { success: false, error: auth.error };
      }
      return { success: true, state: auth.state };
    },

    async confirmPending(
      eventId: string,
      registrationId: string
    ): Promise<ConfirmPendingActionResult> {
      const auth = await checkOwnership(eventId);
      if (!auth.authorized) {
        return { success: false, error: auth.error };
      }
      try {
        const registration = await domain.confirmPending({
          eventId,
          registrationId,
        });
        return { success: true, registration };
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Error al confirmar la plaza";
        return { success: false, error: msg };
      }
    },

    async rejectPending(
      eventId: string,
      registrationId: string
    ): Promise<RejectPendingActionResult> {
      const auth = await checkOwnership(eventId);
      if (!auth.authorized) {
        return { success: false, error: auth.error };
      }
      try {
        const result = await domain.rejectPending({
          eventId,
          registrationId,
        });
        return { success: true, result };
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Error al rechazar la plaza";
        return { success: false, error: msg };
      }
    },

    async manualRegister(
      eventId: string,
      input: ManualRegisterInput
    ): Promise<ManualRegisterActionResult> {
      const auth = await checkOwnership(eventId);
      if (!auth.authorized) {
        return { success: false, error: auth.error };
      }
      try {
        const result = await domain.registerPlayer({
          eventId,
          phone: input.phone,
          nickname: input.nickname,
          lateArrival: input.lateArrival,
          estimatedArrivalTime: input.estimatedArrivalTime,
        });
        return { success: true, result };
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Error al inscribir al jugador";
        return { success: false, error: msg };
      }
    },

    async reorderWaitlist(
      eventId: string,
      newOrderRegistrationIds: string[]
    ): Promise<ReorderWaitlistActionResult> {
      const auth = await checkOwnership(eventId);
      if (!auth.authorized) {
        return { success: false, error: auth.error };
      }
      try {
        const waitlist = await domain.reorderWaitlist({
          eventId,
          newOrderRegistrationIds,
        });
        return { success: true, waitlist };
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : "Error al reordenar la lista de espera";
        return { success: false, error: msg };
      }
    },

    async editRegistration(
      eventId: string,
      registrationId: string,
      input: EditRegistrationInput
    ): Promise<EditRegistrationActionResult> {
      const auth = await checkOwnership(eventId);
      if (!auth.authorized) {
        return { success: false, error: auth.error };
      }
      try {
        const registration = await domain.editRegistration({
          eventId,
          registrationId,
          nickname: input.nickname,
          lateArrival: input.lateArrival,
          estimatedArrivalTime: input.estimatedArrivalTime,
        });
        return { success: true, registration };
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Error al editar la inscripción";
        return { success: false, error: msg };
      }
    },

    async cancelRegistration(
      eventId: string,
      registrationId: string
    ): Promise<CancelRegistrationActionResult> {
      const auth = await checkOwnership(eventId);
      if (!auth.authorized) {
        return { success: false, error: auth.error };
      }
      try {
        const result = await domain.cancelRegistration({
          eventId,
          registrationId,
          cancelledBy: "organizer",
        });
        return { success: true, result };
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : "Error al cancelar la inscripción";
        return { success: false, error: msg };
      }
    },

    async updateCapacity(
      eventId: string,
      capacity: number
    ): Promise<UpdateCapacityActionResult> {
      const auth = await checkOwnership(eventId);
      if (!auth.authorized) {
        return { success: false, error: auth.error };
      }
      try {
        const event = await domain.editEvent({
          eventId,
          capacity,
        });
        return { success: true, event };
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Error al actualizar el cupo";
        return { success: false, error: msg };
      }
    },
  };
}
