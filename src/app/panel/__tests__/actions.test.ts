import { beforeEach, describe, expect, it } from 'vitest';
import { InMemoryEventRepository } from '@/domain/in-memory-event-repository';
import { RegistrationDomain } from '@/domain/registration-domain';
import { Event } from '@/domain/types';
import { createOrganizerActionsHandler } from '../actions-handler';

describe('Organizer Actions Handler — Panel Actions Seam', () => {
  let repo: InMemoryEventRepository;
  let domain: RegistrationDomain;
  let currentUserId: string | null = 'org-1';
  let handler: ReturnType<typeof createOrganizerActionsHandler>;

  beforeEach(() => {
    repo = new InMemoryEventRepository();
    domain = new RegistrationDomain(repo);
    currentUserId = 'org-1';
    handler = createOrganizerActionsHandler(domain, () => currentUserId);
  });

  describe('createEvent', () => {
    it('returns error when user is not authenticated', async () => {
      currentUserId = null;
      const res = await handler.createEvent({
        type: 'cash',
        date: '2026-10-15',
        time: '21:00',
        capacity: 8,
        allowWaitlist: true,
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toMatch(/iniciar sesión/i);
      }
    });

    it('creates event successfully with valid inputs', async () => {
      const res = await handler.createEvent({
        type: 'cash',
        date: '2026-10-15',
        time: '21:00',
        capacity: 8,
        note: 'Ciega 1/2',
        allowWaitlist: true,
      });

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.event.organizerId).toBe('org-1');
        expect(res.event.capacity).toBe(8);
        expect(res.event.slug).toBeDefined();
        expect(res.event.status).toBe('active');
      }
    });

    it('returns error for invalid input (e.g. capacity <= 0)', async () => {
      const res = await handler.createEvent({
        type: 'cash',
        date: '2026-10-15',
        time: '21:00',
        capacity: 0,
        allowWaitlist: true,
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBeDefined();
      }
    });
  });

  describe('editEvent', () => {
    let createdEvent: Event;

    beforeEach(async () => {
      createdEvent = await domain.createEvent({
        organizerId: 'org-1',
        type: 'cash',
        date: '2026-10-15',
        time: '21:00',
        capacity: 8,
        note: 'Nota inicial',
        allowWaitlist: true,
      });
    });

    it('updates event configuration', async () => {
      const res = await handler.editEvent({
        eventId: createdEvent.id,
        date: '2026-10-16',
        time: '22:00',
        capacity: 6,
        note: 'Nota editada',
        allowWaitlist: false,
      });

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.event.date).toBe('2026-10-16');
        expect(res.event.time).toBe('22:00');
        expect(res.event.capacity).toBe(6);
        expect(res.event.note).toBe('Nota editada');
        expect(res.event.allowWaitlist).toBe(false);
      }
    });

    it('blocks editing an event belonging to another organizer', async () => {
      currentUserId = 'other-org';
      const res = await handler.editEvent({
        eventId: createdEvent.id,
        capacity: 10,
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toMatch(/permiso|no encontrado/i);
      }
    });
  });

  describe('cancelEvent', () => {
    let createdEvent: Event;

    beforeEach(async () => {
      createdEvent = await domain.createEvent({
        organizerId: 'org-1',
        type: 'cash',
        date: '2026-10-15',
        time: '21:00',
        capacity: 8,
        allowWaitlist: true,
      });
      await domain.registerPlayer({
        eventId: createdEvent.id,
        phone: '611111111',
        nickname: 'Pedro',
        lateArrival: false,
      });
    });

    it('cancels event and all its registrations', async () => {
      const res = await handler.cancelEvent(createdEvent.id);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.event.status).toBe('cancelled');
      }

      const state = await domain.getVisibleEventState(createdEvent.id);
      expect(state.event.status).toBe('cancelled');
      expect(state.confirmed).toHaveLength(0);
      expect(state.cancelled).toHaveLength(1);
      expect(state.cancelled[0].cancelledBy).toBe('organizer');
    });

    it('blocks cancelling an event by unauthorized user', async () => {
      currentUserId = 'intruder';
      const res = await handler.cancelEvent(createdEvent.id);
      expect(res.success).toBe(false);
    });
  });

  describe('getOrganizerEvents', () => {
    it('returns separated upcoming and past events with occupancy numbers', async () => {
      const future = await domain.createEvent({
        organizerId: 'org-1',
        type: 'cash',
        date: '2099-10-15',
        time: '21:00',
        capacity: 4,
        allowWaitlist: true,
      });

      await domain.registerPlayer({
        eventId: future.id,
        phone: '611111111',
        nickname: 'Juan',
        lateArrival: false,
      });

      const past = await domain.createEvent({
        organizerId: 'org-1',
        type: 'tournament',
        date: '2020-01-01',
        time: '20:00',
        capacity: 10,
        allowWaitlist: true,
      });

      const res = await handler.getOrganizerEvents();
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.upcoming).toHaveLength(1);
        expect(res.upcoming[0].id).toBe(future.id);
        expect(res.upcoming[0].occupiedSeats).toBe(1);
        expect(res.upcoming[0].visualCycle).toBe('upcoming');

        expect(res.past).toHaveLength(1);
        expect(res.past[0].id).toBe(past.id);
        expect(res.past[0].visualCycle).toBe('past');
      }
    });
  });

  describe('getWhatsAppText', () => {
    it('returns formatted WhatsApp message with custom baseUrl', async () => {
      const ev = await domain.createEvent({
        organizerId: 'org-1',
        type: 'cash',
        date: '2026-10-20',
        time: '21:00',
        capacity: 6,
        allowWaitlist: true,
      });

      const res = await handler.getWhatsAppText(ev.id, 'https://brasipoker.es');
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.text).toContain('♠️');
        expect(res.text).toContain(`https://brasipoker.es/p/${ev.slug}`);
      }
    });
  });

  describe('getEventLiveState', () => {
    it('returns error when user is not authenticated', async () => {
      currentUserId = null;
      const res = await handler.getEventLiveState('some-id');
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toMatch(/iniciar sesión/i);
      }
    });

    it('returns error when event belongs to another organizer', async () => {
      const ev = await domain.createEvent({
        organizerId: 'other-org',
        type: 'cash',
        date: '2026-10-15',
        time: '21:00',
        capacity: 6,
        allowWaitlist: true,
      });

      const res = await handler.getEventLiveState(ev.id);
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toMatch(/permiso|no encontrado/i);
      }
    });

    it('returns full live state including phones, waitlist and cancelled for authorized organizer', async () => {
      const ev = await domain.createEvent({
        organizerId: 'org-1',
        type: 'cash',
        date: '2026-10-15',
        time: '21:00',
        capacity: 1,
        allowWaitlist: true,
      });

      // Register confirmed player with late arrival
      await domain.registerPlayer({
        eventId: ev.id,
        phone: '611111111',
        nickname: 'Carlos',
        lateArrival: true,
        estimatedArrivalTime: '22:00',
      });

      // Register waitlisted player
      await domain.registerPlayer({
        eventId: ev.id,
        phone: '622222222',
        nickname: 'Ana',
        lateArrival: false,
      });

      const res = await handler.getEventLiveState(ev.id);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.state.capacity).toBe(1);
        expect(res.state.occupiedSeats).toBe(1);
        expect(res.state.confirmed).toHaveLength(1);
        expect(res.state.confirmed[0].nickname).toBe('Carlos');
        expect(res.state.confirmed[0].phone).toBe('+34611111111');
        expect(res.state.confirmed[0].lateArrival).toBe(true);
        expect(res.state.confirmed[0].estimatedArrivalTime).toBe('22:00');

        expect(res.state.waitlist).toHaveLength(1);
        expect(res.state.waitlist[0].nickname).toBe('Ana');
        expect(res.state.waitlist[0].phone).toBe('+34622222222');
        expect(res.state.waitlist[0].waitlistPosition).toBe(1);
      }
    });
  });
});
