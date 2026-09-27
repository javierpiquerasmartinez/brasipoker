import { beforeEach, describe, expect, it } from 'vitest';
import { InMemoryEventRepository } from '../in-memory-event-repository';
import { RegistrationDomain } from '../registration-domain';
import { Event } from '../types';

describe('RegistrationDomain — Organizer Operations', () => {
  let repo: InMemoryEventRepository;
  let domain: RegistrationDomain;

  const baseEvent: Event = {
    id: 'ev-org',
    organizerId: 'org-1',
    slug: 'friday-poker',
    type: 'cash',
    date: '2026-10-02',
    time: '21:00',
    capacity: 3,
    allowWaitlist: true,
    status: 'active',
    createdAt: new Date('2026-09-27T10:00:00Z'),
  };

  beforeEach(async () => {
    repo = new InMemoryEventRepository();
    await repo.saveEvent(baseEvent);
    domain = new RegistrationDomain(repo);
  });

  describe('editEvent', () => {
    it('updates basic fields', async () => {
      await domain.editEvent({
        eventId: 'ev-org',
        note: 'New note',
        allowWaitlist: false,
      });
      const state = await domain.getVisibleEventState('ev-org');
      expect(state.event.note).toBe('New note');
      expect(state.event.allowWaitlist).toBe(false);
    });

    it('reduces capacity and displaces players to the start of the waitlist', async () => {
      await domain.registerPlayer({ eventId: 'ev-org', phone: '611111111', nickname: 'P1', lateArrival: false });
      await domain.registerPlayer({ eventId: 'ev-org', phone: '622222222', nickname: 'P2', lateArrival: false });
      await domain.registerPlayer({ eventId: 'ev-org', phone: '633333333', nickname: 'P3', lateArrival: false });
      
      await domain.registerPlayer({ eventId: 'ev-org', phone: '644444444', nickname: 'W1', lateArrival: false });

      let state = await domain.getVisibleEventState('ev-org');
      expect(state.confirmed).toHaveLength(3);
      expect(state.waitlist).toHaveLength(1);

      await domain.editEvent({ eventId: 'ev-org', capacity: 1 });

      state = await domain.getVisibleEventState('ev-org');
      expect(state.capacity).toBe(1);
      expect(state.confirmed).toHaveLength(1);
      expect(state.confirmed[0].nickname).toBe('P1');
      expect(state.waitlist).toHaveLength(3);
      
      // P2, P3 should go to the start of the waitlist, in relative order
      expect(state.waitlist[0].nickname).toBe('P2');
      expect(state.waitlist[1].nickname).toBe('P3');
      expect(state.waitlist[2].nickname).toBe('W1');
    });

    it('increases capacity and cascade promotes waitlist players', async () => {
      await domain.registerPlayer({ eventId: 'ev-org', phone: '611111111', nickname: 'P1', lateArrival: false });
      await domain.registerPlayer({ eventId: 'ev-org', phone: '622222222', nickname: 'P2', lateArrival: false });
      await domain.registerPlayer({ eventId: 'ev-org', phone: '633333333', nickname: 'P3', lateArrival: false });
      
      await domain.registerPlayer({ eventId: 'ev-org', phone: '644444444', nickname: 'W1', lateArrival: false });
      await domain.registerPlayer({ eventId: 'ev-org', phone: '655555555', nickname: 'W2', lateArrival: false });

      await domain.editEvent({ eventId: 'ev-org', capacity: 5 });

      const state = await domain.getVisibleEventState('ev-org');
      expect(state.capacity).toBe(5);
      expect(state.occupiedSeats).toBe(5);
      expect(state.confirmed).toHaveLength(3);
      expect(state.pendingConfirmation).toHaveLength(2); // W1 and W2 promoted
      expect(state.waitlist).toHaveLength(0);
      expect(state.pendingConfirmation[0].nickname).toBe('W1');
      expect(state.pendingConfirmation[1].nickname).toBe('W2');
    });
  });

  describe('cancelEvent', () => {
    it('cancels event and sets all active registrations to cancelled', async () => {
      await domain.registerPlayer({ eventId: 'ev-org', phone: '611111111', nickname: 'P1', lateArrival: false });
      await domain.registerPlayer({ eventId: 'ev-org', phone: '644444444', nickname: 'W1', lateArrival: false }); // will fill waitlist if cap is 1

      await domain.cancelEvent({ eventId: 'ev-org' });

      const state = await domain.getVisibleEventState('ev-org');
      expect(state.event.status).toBe('cancelled');
      expect(state.cancelled).toHaveLength(2);
      expect(state.confirmed).toHaveLength(0);
      expect(state.waitlist).toHaveLength(0);
      expect(state.cancelled[0].cancelledBy).toBe('organizer');
      expect(state.cancelled[1].cancelledBy).toBe('organizer');
    });
  });

  describe('editRegistration', () => {
    it('updates nickname and late arrival', async () => {
      const reg = await domain.registerPlayer({ eventId: 'ev-org', phone: '611111111', nickname: 'P1', lateArrival: false });
      if (reg.type !== 'confirmed') throw new Error('Expected confirmed');
      
      await domain.editRegistration({
        eventId: 'ev-org',
        registrationId: reg.registration.id,
        nickname: 'P1 Updated',
        lateArrival: true,
        estimatedArrivalTime: '22:00'
      });

      const state = await domain.getVisibleEventState('ev-org');
      expect(state.confirmed[0].nickname).toBe('P1 Updated');
      expect(state.confirmed[0].lateArrival).toBe(true);
      expect(state.confirmed[0].estimatedArrivalTime).toBe('22:00');
    });
  });

  describe('generateWhatsAppText', () => {
    it('returns formatted text for cash', async () => {
      await domain.registerPlayer({ eventId: 'ev-org', phone: '611111111', nickname: 'P1', lateArrival: false });
      const text = await domain.generateWhatsAppText({ eventId: 'ev-org' });
      expect(text).toContain('friday-poker');
      expect(text).toContain('P1');
    });
  });
});
