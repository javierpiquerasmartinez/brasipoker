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
        expect(res.upcoming[0].roster).toBeDefined();
        expect(res.upcoming[0].roster.confirmed).toHaveLength(1);
        expect(res.upcoming[0].roster.confirmed[0].nickname).toBe('Juan');

        expect(res.past).toHaveLength(1);
        expect(res.past[0].id).toBe(past.id);
        expect(res.past[0].visualCycle).toBe('past');
        expect(res.past[0].roster).toBeDefined();
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

  describe('confirmPending', () => {
    it('confirms a player in pending_confirmation status', async () => {
      const ev = await domain.createEvent({
        organizerId: 'org-1',
        type: 'cash',
        date: '2026-10-15',
        time: '21:00',
        capacity: 1,
        allowWaitlist: true,
      });

      const p1 = await domain.registerPlayer({
        eventId: ev.id,
        phone: '611111111',
        nickname: 'Pedro',
        lateArrival: false,
      });
      const p2 = await domain.registerPlayer({
        eventId: ev.id,
        phone: '622222222',
        nickname: 'Ana',
        lateArrival: false,
      });

      if (p1.type !== 'confirmed' || p2.type !== 'waitlisted') {
        throw new Error('Unexpected test setup');
      }

      // Cancel p1 -> p2 becomes pending_confirmation
      await domain.cancelRegistration({
        eventId: ev.id,
        registrationId: p1.registration.id,
        cancelledBy: 'player',
      });

      const res = await handler.confirmPending(ev.id, p2.registration.id);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.registration.status).toBe('confirmed');
      }

      const state = await domain.getVisibleEventState(ev.id);
      expect(state.confirmed).toHaveLength(1);
      expect(state.confirmed[0].nickname).toBe('Ana');
      expect(state.pendingConfirmation).toHaveLength(0);
    });

    it('rejects confirming if user is not authorized', async () => {
      const ev = await domain.createEvent({
        organizerId: 'org-1',
        type: 'cash',
        date: '2026-10-15',
        time: '21:00',
        capacity: 1,
        allowWaitlist: true,
      });

      currentUserId = 'other';
      const res = await handler.confirmPending(ev.id, 'some-id');
      expect(res.success).toBe(false);
    });
  });

  describe('rejectPending', () => {
    it('rejects pending player, marks as cancelled by organizer, and promotes next in waitlist', async () => {
      const ev = await domain.createEvent({
        organizerId: 'org-1',
        type: 'cash',
        date: '2026-10-15',
        time: '21:00',
        capacity: 1,
        allowWaitlist: true,
      });

      const p1 = await domain.registerPlayer({
        eventId: ev.id,
        phone: '611111111',
        nickname: 'P1',
        lateArrival: false,
      });
      const w1 = await domain.registerPlayer({
        eventId: ev.id,
        phone: '622222222',
        nickname: 'W1',
        lateArrival: false,
      });
      const w2 = await domain.registerPlayer({
        eventId: ev.id,
        phone: '633333333',
        nickname: 'W2',
        lateArrival: false,
      });

      if (p1.type !== 'confirmed' || w1.type !== 'waitlisted' || w2.type !== 'waitlisted') {
        throw new Error('Unexpected test setup');
      }

      // Free seat: W1 becomes pending_confirmation
      await domain.cancelRegistration({
        eventId: ev.id,
        registrationId: p1.registration.id,
        cancelledBy: 'player',
      });

      // Organizer rejects W1
      const res = await handler.rejectPending(ev.id, w1.registration.id);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.result.rejectedRegistration.status).toBe('cancelled');
        expect(res.result.rejectedRegistration.cancelledBy).toBe('organizer');
        expect(res.result.promotedRegistration?.nickname).toBe('W2');
        expect(res.result.promotedRegistration?.status).toBe('pending_confirmation');
      }

      const state = await domain.getVisibleEventState(ev.id);
      expect(state.pendingConfirmation).toHaveLength(1);
      expect(state.pendingConfirmation[0].nickname).toBe('W2');
      expect(state.waitlist).toHaveLength(0);
      expect(state.cancelled).toHaveLength(2); // P1 and W1
    });
  });

  describe('manualRegister', () => {
    it('adds player directly as confirmed when seats available', async () => {
      const ev = await domain.createEvent({
        organizerId: 'org-1',
        type: 'cash',
        date: '2026-10-15',
        time: '21:00',
        capacity: 2,
        allowWaitlist: true,
      });

      const res = await handler.manualRegister(ev.id, {
        phone: '611223344',
        nickname: 'Jugador Manual',
        lateArrival: true,
        estimatedArrivalTime: '21:30',
      });

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.result.type).toBe('confirmed');
        if (res.result.type === 'confirmed') {
          expect(res.result.registration.phone).toBe('+34611223344');
          expect(res.result.registration.nickname).toBe('Jugador Manual');
          expect(res.result.registration.lateArrival).toBe(true);
          expect(res.result.registration.estimatedArrivalTime).toBe('21:30');
        }
      }
    });

    it('adds player to waitlist when capacity is full', async () => {
      const ev = await domain.createEvent({
        organizerId: 'org-1',
        type: 'cash',
        date: '2026-10-15',
        time: '21:00',
        capacity: 1,
        allowWaitlist: true,
      });

      await domain.registerPlayer({
        eventId: ev.id,
        phone: '600000000',
        nickname: 'First',
        lateArrival: false,
      });

      const res = await handler.manualRegister(ev.id, {
        phone: '611223344',
        nickname: 'Second',
        lateArrival: false,
      });

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.result.type).toBe('waitlisted');
        if (res.result.type === 'waitlisted') {
          expect(res.result.position).toBe(1);
        }
      }
    });
  });

  describe('reorderWaitlist', () => {
    it('reorders waitlist positions and affects next promotion', async () => {
      const ev = await domain.createEvent({
        organizerId: 'org-1',
        type: 'cash',
        date: '2026-10-15',
        time: '21:00',
        capacity: 1,
        allowWaitlist: true,
      });

      const p1 = await domain.registerPlayer({
        eventId: ev.id,
        phone: '600000000',
        nickname: 'Active',
        lateArrival: false,
      });
      const w1 = await domain.registerPlayer({
        eventId: ev.id,
        phone: '611111111',
        nickname: 'W1',
        lateArrival: false,
      });
      const w2 = await domain.registerPlayer({
        eventId: ev.id,
        phone: '622222222',
        nickname: 'W2',
        lateArrival: false,
      });

      if (w1.type !== 'waitlisted' || w2.type !== 'waitlisted' || p1.type !== 'confirmed') {
        throw new Error('Test setup failed');
      }

      // Reorder so W2 is first and W1 is second
      const res = await handler.reorderWaitlist(ev.id, [
        w2.registration.id,
        w1.registration.id,
      ]);

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.waitlist[0].id).toBe(w2.registration.id);
        expect(res.waitlist[0].waitlistPosition).toBe(1);
        expect(res.waitlist[1].id).toBe(w1.registration.id);
        expect(res.waitlist[1].waitlistPosition).toBe(2);
      }

      // Cancelling active player should promote W2 first
      await domain.cancelRegistration({
        eventId: ev.id,
        registrationId: p1.registration.id,
        cancelledBy: 'player',
      });

      const state = await domain.getVisibleEventState(ev.id);
      expect(state.pendingConfirmation[0].nickname).toBe('W2');
    });
  });

  describe('editRegistration', () => {
    it('updates registration nickname and late arrival', async () => {
      const ev = await domain.createEvent({
        organizerId: 'org-1',
        type: 'cash',
        date: '2026-10-15',
        time: '21:00',
        capacity: 2,
        allowWaitlist: true,
      });

      const p1 = await domain.registerPlayer({
        eventId: ev.id,
        phone: '611111111',
        nickname: 'Initial Nick',
        lateArrival: false,
      });
      if (p1.type !== 'confirmed') throw new Error('Setup failed');

      const res = await handler.editRegistration(ev.id, p1.registration.id, {
        nickname: 'Edited Nick',
        lateArrival: true,
        estimatedArrivalTime: '22:15',
      });

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.registration.nickname).toBe('Edited Nick');
        expect(res.registration.lateArrival).toBe(true);
        expect(res.registration.estimatedArrivalTime).toBe('22:15');
      }
    });
  });

  describe('cancelRegistration', () => {
    it('cancels registration with organizer attribution and promotes waitlist', async () => {
      const ev = await domain.createEvent({
        organizerId: 'org-1',
        type: 'cash',
        date: '2026-10-15',
        time: '21:00',
        capacity: 1,
        allowWaitlist: true,
      });

      const p1 = await domain.registerPlayer({
        eventId: ev.id,
        phone: '611111111',
        nickname: 'Confirmed Player',
        lateArrival: false,
      });
      const w1 = await domain.registerPlayer({
        eventId: ev.id,
        phone: '622222222',
        nickname: 'Waitlisted Player',
        lateArrival: false,
      });
      if (p1.type !== 'confirmed' || w1.type !== 'waitlisted') throw new Error('Setup failed');

      const res = await handler.cancelRegistration(ev.id, p1.registration.id);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.result.cancelledRegistration.status).toBe('cancelled');
        expect(res.result.cancelledRegistration.cancelledBy).toBe('organizer');
        expect(res.result.promotedRegistration?.nickname).toBe('Waitlisted Player');
        expect(res.result.promotedRegistration?.status).toBe('pending_confirmation');
      }
    });
  });

  describe('updateCapacity', () => {
    it('reduces capacity and moves displaced players to front of waitlist', async () => {
      const ev = await domain.createEvent({
        organizerId: 'org-1',
        type: 'cash',
        date: '2026-10-15',
        time: '21:00',
        capacity: 3,
        allowWaitlist: true,
      });

      await domain.registerPlayer({ eventId: ev.id, phone: '611111111', nickname: 'P1', lateArrival: false });
      await domain.registerPlayer({ eventId: ev.id, phone: '622222222', nickname: 'P2', lateArrival: false });
      await domain.registerPlayer({ eventId: ev.id, phone: '633333333', nickname: 'P3', lateArrival: false });
      await domain.registerPlayer({ eventId: ev.id, phone: '644444444', nickname: 'W1', lateArrival: false });

      const res = await handler.updateCapacity(ev.id, 1);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.event.capacity).toBe(1);
      }

      const state = await domain.getVisibleEventState(ev.id);
      expect(state.capacity).toBe(1);
      expect(state.confirmed).toHaveLength(1);
      expect(state.confirmed[0].nickname).toBe('P1');
      expect(state.waitlist[0].nickname).toBe('P2');
      expect(state.waitlist[1].nickname).toBe('P3');
      expect(state.waitlist[2].nickname).toBe('W1');
    });

    it('expands capacity and cascade promotes waitlist to pending_confirmation', async () => {
      const ev = await domain.createEvent({
        organizerId: 'org-1',
        type: 'cash',
        date: '2026-10-15',
        time: '21:00',
        capacity: 1,
        allowWaitlist: true,
      });

      await domain.registerPlayer({ eventId: ev.id, phone: '611111111', nickname: 'P1', lateArrival: false });
      await domain.registerPlayer({ eventId: ev.id, phone: '622222222', nickname: 'W1', lateArrival: false });
      await domain.registerPlayer({ eventId: ev.id, phone: '633333333', nickname: 'W2', lateArrival: false });

      const res = await handler.updateCapacity(ev.id, 3);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.event.capacity).toBe(3);
      }

      const state = await domain.getVisibleEventState(ev.id);
      expect(state.capacity).toBe(3);
      expect(state.confirmed).toHaveLength(1);
      expect(state.pendingConfirmation).toHaveLength(2);
      expect(state.pendingConfirmation[0].nickname).toBe('W1');
      expect(state.pendingConfirmation[1].nickname).toBe('W2');
      expect(state.waitlist).toHaveLength(0);
    });
  });
});

