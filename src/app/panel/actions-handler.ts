import { RegistrationDomain } from "@/domain/registration-domain";
import { EventRepository } from "@/domain/event-repository";
import { Event, EventType, EventStatus } from "@/domain/types";
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

export function createOrganizerActionsHandler(
  domain: RegistrationDomain,
  getUserId: () => string | null | Promise<string | null>,
  repo?: EventRepository
) {
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
  };
}
