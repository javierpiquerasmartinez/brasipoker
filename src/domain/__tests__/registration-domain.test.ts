import { beforeEach, describe, expect, it } from 'vitest';
import { InMemoryEventRepository } from '../in-memory-event-repository';
import { RegistrationDomain } from '../registration-domain';
import { Event, InvalidRegistrationDataError } from '../types';

describe('RegistrationDomain — Domain Seam', () => {
  let repo: InMemoryEventRepository;
  let domain: RegistrationDomain;

  const baseEvent: Event = {
    id: 'ev-1',
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

  describe('Direct Registration (with free seats)', () => {
    it('registers a player as Confirmed holding a seat when capacity is available', async () => {
      const result = await domain.registerPlayer({
        eventId: 'ev-1',
        phone: '612345678',
        nickname: 'FishPro',
        lateArrival: false,
      });

      expect(result.type).toBe('confirmed');
      if (result.type === 'confirmed') {
        expect(result.registration.status).toBe('confirmed');
        expect(result.registration.phone).toBe('+34612345678');
        expect(result.registration.nickname).toBe('FishPro');
        expect(result.registration.lateArrival).toBe(false);
        expect(result.duplicate).toBe(false);
      }

      const state = await domain.getVisibleEventState('ev-1');
      expect(state.occupiedSeats).toBe(1);
      expect(state.freeSeats).toBe(2);
      expect(state.confirmed).toHaveLength(1);
      expect(state.confirmed[0].nickname).toBe('FishPro');
    });

    it('records Late Arrival with mandatory arrival time without affecting capacity', async () => {
      const result = await domain.registerPlayer({
        eventId: 'ev-1',
        phone: '622222222',
        nickname: 'LateGuy',
        lateArrival: true,
        estimatedArrivalTime: '22:30',
      });

      expect(result.type).toBe('confirmed');
      if (result.type === 'confirmed') {
        expect(result.registration.lateArrival).toBe(true);
        expect(result.registration.estimatedArrivalTime).toBe('22:30');
      }

      const state = await domain.getVisibleEventState('ev-1');
      expect(state.occupiedSeats).toBe(1);
      expect(state.freeSeats).toBe(2);
    });

    it('fails if lateArrival is true but no estimatedArrivalTime is provided', async () => {
      await expect(
        domain.registerPlayer({
          eventId: 'ev-1',
          phone: '622222222',
          nickname: 'LateWithoutTime',
          lateArrival: true,
        })
      ).rejects.toThrow(InvalidRegistrationDataError);
    });

    it('fails if nickname is empty or whitespace only', async () => {
      await expect(
        domain.registerPlayer({
          eventId: 'ev-1',
          phone: '622222222',
          nickname: '   ',
          lateArrival: false,
        })
      ).rejects.toThrow(InvalidRegistrationDataError);
    });
  });

  describe('Waitlist and Event Full', () => {
    it('enters end of waitlist with consecutive position when capacity is exhausted', async () => {
      // Capacity is 3: fill all 3 seats
      await domain.registerPlayer({
        eventId: 'ev-1',
        phone: '611111111',
        nickname: 'Player 1',
        lateArrival: false,
      });
      await domain.registerPlayer({
        eventId: 'ev-1',
        phone: '622222222',
        nickname: 'Player 2',
        lateArrival: false,
      });
      await domain.registerPlayer({
        eventId: 'ev-1',
        phone: '633333333',
        nickname: 'Player 3',
        lateArrival: false,
      });

      // 4th and 5th should enter the waitlist
      const res4 = await domain.registerPlayer({
        eventId: 'ev-1',
        phone: '644444444',
        nickname: 'Waitlist 1',
        lateArrival: false,
      });

      expect(res4.type).toBe('waitlisted');
      if (res4.type === 'waitlisted') {
        expect(res4.position).toBe(1);
        expect(res4.registration.status).toBe('waitlisted');
        expect(res4.registration.waitlistPosition).toBe(1);
      }

      const res5 = await domain.registerPlayer({
        eventId: 'ev-1',
        phone: '655555555',
        nickname: 'Waitlist 2',
        lateArrival: false,
      });

      expect(res5.type).toBe('waitlisted');
      if (res5.type === 'waitlisted') {
        expect(res5.position).toBe(2);
        expect(res5.registration.waitlistPosition).toBe(2);
      }

      const state = await domain.getVisibleEventState('ev-1');
      expect(state.occupiedSeats).toBe(3);
      expect(state.freeSeats).toBe(0);
      expect(state.confirmed).toHaveLength(3);
      expect(state.waitlist).toHaveLength(2);
      expect(state.waitlist[0].nickname).toBe('Waitlist 1');
      expect(state.waitlist[1].nickname).toBe('Waitlist 2');
    });

    it('returns "event_full" and does not enter queue when waitlist is disabled and event is full', async () => {
      const noWaitlistEvent: Event = {
        ...baseEvent,
        id: 'ev-no-waitlist',
        capacity: 1,
        allowWaitlist: false,
      };
      await repo.saveEvent(noWaitlistEvent);

      await domain.registerPlayer({
        eventId: 'ev-no-waitlist',
        phone: '611111111',
        nickname: 'OnlyOne',
        lateArrival: false,
      });

      const resSecond = await domain.registerPlayer({
        eventId: 'ev-no-waitlist',
        phone: '622222222',
        nickname: 'LeftOut',
        lateArrival: false,
      });

      expect(resSecond.type).toBe('event_full');

      const state = await domain.getVisibleEventState('ev-no-waitlist');
      expect(state.occupiedSeats).toBe(1);
      expect(state.freeSeats).toBe(0);
      expect(state.confirmed).toHaveLength(1);
      expect(state.waitlist).toHaveLength(0);
    });
  });

  describe('Phone Deduplication', () => {
    it('allows max 1 active registration per phone/event and returns existing registration on duplicate', async () => {
      const first = await domain.registerPlayer({
        eventId: 'ev-1',
        phone: '612345678',
        nickname: 'Original',
        lateArrival: false,
      });
      expect(first.type).toBe('confirmed');

      // Attempt to register again with same phone
      const second = await domain.registerPlayer({
        eventId: 'ev-1',
        phone: '+34 612 34 56 78',
        nickname: 'DuplicateAttempt',
        lateArrival: true,
        estimatedArrivalTime: '23:00',
      });

      expect(second.type).toBe('already_registered');
      if (second.type === 'already_registered') {
        expect(second.duplicate).toBe(true);
        expect(second.registration.id).toBe(
          first.type === 'confirmed' ? first.registration.id : ''
        );
        expect(second.registration.nickname).toBe('Original');
      }

      const state = await domain.getVisibleEventState('ev-1');
      expect(state.occupiedSeats).toBe(1);
      expect(state.confirmed).toHaveLength(1);
    });

    it('returns existing registration without modifying position when player is already waitlisted', async () => {
      // Fill capacity
      await domain.registerPlayer({
        eventId: 'ev-1',
        phone: '611111111',
        nickname: 'P1',
        lateArrival: false,
      });
      await domain.registerPlayer({
        eventId: 'ev-1',
        phone: '622222222',
        nickname: 'P2',
        lateArrival: false,
      });
      await domain.registerPlayer({
        eventId: 'ev-1',
        phone: '633333333',
        nickname: 'P3',
        lateArrival: false,
      });

      const waitlist = await domain.registerPlayer({
        eventId: 'ev-1',
        phone: '644444444',
        nickname: 'WaitlistedPlayer',
        lateArrival: false,
      });
      expect(waitlist.type).toBe('waitlisted');

      const retry = await domain.registerPlayer({
        eventId: 'ev-1',
        phone: '644444444',
        nickname: 'OtherNickname',
        lateArrival: false,
      });

      expect(retry.type).toBe('already_registered');
      if (retry.type === 'already_registered') {
        expect(retry.duplicate).toBe(true);
        expect(retry.registration.waitlistPosition).toBe(1);
        expect(retry.registration.nickname).toBe('WaitlistedPlayer');
      }

      const state = await domain.getVisibleEventState('ev-1');
      expect(state.waitlist).toHaveLength(1);
      expect(state.waitlist[0].waitlistPosition).toBe(1);
    });

    it('rejects registration when event is cancelled', async () => {
      const cancelledEvent: Event = {
        ...baseEvent,
        id: 'ev-cancelled',
        status: 'cancelled',
      };
      await repo.saveEvent(cancelledEvent);

      await expect(
        domain.registerPlayer({
          eventId: 'ev-cancelled',
          phone: '612345678',
          nickname: 'Hopeful',
          lateArrival: false,
        })
      ).rejects.toThrow();
    });
  });

  describe('Cancellation and Re-registration', () => {
    it('records cancellation attributed to Player', async () => {
      const reg = await domain.registerPlayer({
        eventId: 'ev-1',
        phone: '612345678',
        nickname: 'Player1',
        lateArrival: false,
      });

      if (reg.type !== 'confirmed') throw new Error('Expected confirmed');

      const cancelRes = await domain.cancelRegistration({
        eventId: 'ev-1',
        registrationId: reg.registration.id,
        cancelledBy: 'player',
      });

      expect(cancelRes.cancelledRegistration.status).toBe('cancelled');
      expect(cancelRes.cancelledRegistration.cancelledBy).toBe('player');

      const state = await domain.getVisibleEventState('ev-1');
      expect(state.occupiedSeats).toBe(0);
      expect(state.freeSeats).toBe(3);
      expect(state.confirmed).toHaveLength(0);
      expect(state.cancelled).toHaveLength(1);
      expect(state.cancelled[0].cancelledBy).toBe('player');
    });

    it('records cancellation attributed to Organizer', async () => {
      const reg = await domain.registerPlayer({
        eventId: 'ev-1',
        phone: '612345678',
        nickname: 'Player1',
        lateArrival: false,
      });

      if (reg.type !== 'confirmed') throw new Error('Expected confirmed');

      const cancelRes = await domain.cancelRegistration({
        eventId: 'ev-1',
        registrationId: reg.registration.id,
        cancelledBy: 'organizer',
      });

      expect(cancelRes.cancelledRegistration.status).toBe('cancelled');
      expect(cancelRes.cancelledRegistration.cancelledBy).toBe('organizer');

      const state = await domain.getVisibleEventState('ev-1');
      expect(state.cancelled[0].cancelledBy).toBe('organizer');
    });

    it('allows re-registration after cancelling: creates new registration without recovering previous standing', async () => {
      // Fill capacity (3 seats)
      const p1 = await domain.registerPlayer({
        eventId: 'ev-1',
        phone: '611111111',
        nickname: 'P1',
        lateArrival: false,
      });
      await domain.registerPlayer({
        eventId: 'ev-1',
        phone: '622222222',
        nickname: 'P2',
        lateArrival: false,
      });
      await domain.registerPlayer({
        eventId: 'ev-1',
        phone: '633333333',
        nickname: 'P3',
        lateArrival: false,
      });

      if (p1.type !== 'confirmed') throw new Error('Expected confirmed');

      // P1 cancels
      await domain.cancelRegistration({
        eventId: 'ev-1',
        registrationId: p1.registration.id,
        cancelledBy: 'player',
      });

      // 2 occupied seats, 1 free. P1 re-registers with same phone
      const reRegistration = await domain.registerPlayer({
        eventId: 'ev-1',
        phone: '611111111',
        nickname: 'P1 Again',
        lateArrival: false,
      });

      expect(reRegistration.type).toBe('confirmed');
      if (reRegistration.type === 'confirmed') {
        expect(reRegistration.duplicate).toBe(false);
        expect(reRegistration.registration.id).not.toBe(p1.registration.id);
        expect(reRegistration.registration.status).toBe('confirmed');
      }

      const state = await domain.getVisibleEventState('ev-1');
      expect(state.confirmed).toHaveLength(3);
      expect(state.cancelled).toHaveLength(1);
    });

    it('when event is full, re-registration enters at end of waitlist', async () => {
      // 3 occupied seats
      await domain.registerPlayer({
        eventId: 'ev-1',
        phone: '611111111',
        nickname: 'P1',
        lateArrival: false,
      });
      await domain.registerPlayer({
        eventId: 'ev-1',
        phone: '622222222',
        nickname: 'P2',
        lateArrival: false,
      });
      await domain.registerPlayer({
        eventId: 'ev-1',
        phone: '633333333',
        nickname: 'P3',
        lateArrival: false,
      });

      // P4 waitlisted (#1)
      const p4 = await domain.registerPlayer({
        eventId: 'ev-1',
        phone: '644444444',
        nickname: 'P4',
        lateArrival: false,
      });
      // P5 waitlisted (#2)
      await domain.registerPlayer({
        eventId: 'ev-1',
        phone: '655555555',
        nickname: 'P5',
        lateArrival: false,
      });

      if (p4.type !== 'waitlisted') throw new Error('Expected waitlisted');

      // P4 cancels while in waitlist
      await domain.cancelRegistration({
        eventId: 'ev-1',
        registrationId: p4.registration.id,
        cancelledBy: 'player',
      });

      // P5 shifts up to position 1
      let state = await domain.getVisibleEventState('ev-1');
      expect(state.waitlist).toHaveLength(1);
      expect(state.waitlist[0].nickname).toBe('P5');
      expect(state.waitlist[0].waitlistPosition).toBe(1);

      // P4 registers again: enters end of waitlist (#2)
      const reRegistered = await domain.registerPlayer({
        eventId: 'ev-1',
        phone: '644444444',
        nickname: 'P4 Returns',
        lateArrival: false,
      });

      expect(reRegistered.type).toBe('waitlisted');
      if (reRegistered.type === 'waitlisted') {
        expect(reRegistered.position).toBe(2);
      }

      state = await domain.getVisibleEventState('ev-1');
      expect(state.waitlist).toHaveLength(2);
      expect(state.waitlist[0].nickname).toBe('P5');
      expect(state.waitlist[1].nickname).toBe('P4 Returns');
    });
  });

  describe('Atomic Promotion (ADR-0003)', () => {
    it('when a seat is freed by cancellation, first waitlisted player moves to pending_confirmation holding the seat immediately', async () => {
      // 3 confirmed
      const c1 = await domain.registerPlayer({
        eventId: 'ev-1',
        phone: '611111111',
        nickname: 'C1',
        lateArrival: false,
      });
      await domain.registerPlayer({
        eventId: 'ev-1',
        phone: '622222222',
        nickname: 'C2',
        lateArrival: false,
      });
      await domain.registerPlayer({
        eventId: 'ev-1',
        phone: '633333333',
        nickname: 'C3',
        lateArrival: false,
      });

      // 2 waitlisted
      const e1 = await domain.registerPlayer({
        eventId: 'ev-1',
        phone: '644444444',
        nickname: 'E1',
        lateArrival: false,
      });
      await domain.registerPlayer({
        eventId: 'ev-1',
        phone: '655555555',
        nickname: 'E2',
        lateArrival: false,
      });

      if (c1.type !== 'confirmed' || e1.type !== 'waitlisted') {
        throw new Error('Unexpected initial state');
      }

      // C1 cancels -> frees seat
      const cancelRes = await domain.cancelRegistration({
        eventId: 'ev-1',
        registrationId: c1.registration.id,
        cancelledBy: 'player',
      });

      // E1 promoted atomically to pending_confirmation
      expect(cancelRes.promotedRegistration).toBeDefined();
      expect(cancelRes.promotedRegistration?.id).toBe(e1.registration.id);
      expect(cancelRes.promotedRegistration?.status).toBe('pending_confirmation');
      expect(cancelRes.promotedRegistration?.waitlistPosition).toBeUndefined();

      // Observable state check: occupiedSeats remains 3 (2 confirmed + 1 pending_confirmation)
      const state = await domain.getVisibleEventState('ev-1');
      expect(state.occupiedSeats).toBe(3);
      expect(state.freeSeats).toBe(0);
      expect(state.confirmed).toHaveLength(2);
      expect(state.pendingConfirmation).toHaveLength(1);
      expect(state.pendingConfirmation[0].id).toBe(e1.registration.id);

      // E2 is now #1 in waitlist
      expect(state.waitlist).toHaveLength(1);
      expect(state.waitlist[0].nickname).toBe('E2');
      expect(state.waitlist[0].waitlistPosition).toBe(1);
    });

    it('if a player in pending_confirmation cancels, frees seat and promotes next waitlisted player', async () => {
      // Capacity 1: 1 confirmed, 2 waitlisted
      const ev1: Event = { ...baseEvent, id: 'ev-promo-pending-cancel', capacity: 1 };
      await repo.saveEvent(ev1);

      const c1 = await domain.registerPlayer({
        eventId: 'ev-promo-pending-cancel',
        phone: '611111111',
        nickname: 'C1',
        lateArrival: false,
      });
      const e1 = await domain.registerPlayer({
        eventId: 'ev-promo-pending-cancel',
        phone: '622222222',
        nickname: 'E1',
        lateArrival: false,
      });
      const e2 = await domain.registerPlayer({
        eventId: 'ev-promo-pending-cancel',
        phone: '633333333',
        nickname: 'E2',
        lateArrival: false,
      });

      if (c1.type !== 'confirmed' || e1.type !== 'waitlisted' || e2.type !== 'waitlisted') {
        throw new Error('Unexpected initial state');
      }

      // C1 cancels -> E1 becomes pending_confirmation
      await domain.cancelRegistration({
        eventId: 'ev-promo-pending-cancel',
        registrationId: c1.registration.id,
        cancelledBy: 'player',
      });

      // E1 cancels on his own
      const cancelPendingRes = await domain.cancelRegistration({
        eventId: 'ev-promo-pending-cancel',
        registrationId: e1.registration.id,
        cancelledBy: 'player',
      });

      expect(cancelPendingRes.cancelledRegistration.status).toBe('cancelled');
      expect(cancelPendingRes.cancelledRegistration.cancelledBy).toBe('player');

      // E2 is promoted to pending_confirmation
      expect(cancelPendingRes.promotedRegistration).toBeDefined();
      expect(cancelPendingRes.promotedRegistration?.nickname).toBe('E2');
      expect(cancelPendingRes.promotedRegistration?.id).toBe(e2.registration.id);
      expect(cancelPendingRes.promotedRegistration?.status).toBe('pending_confirmation');

      const state = await domain.getVisibleEventState('ev-promo-pending-cancel');
      expect(state.occupiedSeats).toBe(1);
      expect(state.pendingConfirmation).toHaveLength(1);
      expect(state.pendingConfirmation[0].nickname).toBe('E2');
      expect(state.waitlist).toHaveLength(0);
    });
  });

  describe('Resolution of Pending Confirmation (Organizer)', () => {
    it('confirming pending moves to Confirmed without altering seats or promoting anyone else', async () => {
      const ev1Capacity: Event = { ...baseEvent, id: 'ev-1-cap', capacity: 1 };
      await repo.saveEvent(ev1Capacity);

      const c1 = await domain.registerPlayer({
        eventId: 'ev-1-cap',
        phone: '611111111',
        nickname: 'C1',
        lateArrival: false,
      });
      const e1 = await domain.registerPlayer({
        eventId: 'ev-1-cap',
        phone: '622222222',
        nickname: 'E1',
        lateArrival: false,
      });

      if (c1.type !== 'confirmed' || e1.type !== 'waitlisted') {
        throw new Error('Unexpected initial state');
      }

      // C1 cancels -> E1 pending
      await domain.cancelRegistration({
        eventId: 'ev-1-cap',
        registrationId: c1.registration.id,
        cancelledBy: 'player',
      });

      let state = await domain.getVisibleEventState('ev-1-cap');
      expect(state.pendingConfirmation).toHaveLength(1);
      expect(state.confirmed).toHaveLength(0);
      expect(state.occupiedSeats).toBe(1);

      // Organizer confirms promoted player
      const confirmedReg = await domain.confirmPending({
        eventId: 'ev-1-cap',
        registrationId: e1.registration.id,
      });

      expect(confirmedReg.status).toBe('confirmed');

      state = await domain.getVisibleEventState('ev-1-cap');
      expect(state.confirmed).toHaveLength(1);
      expect(state.confirmed[0].id).toBe(e1.registration.id);
      expect(state.pendingConfirmation).toHaveLength(0);
      expect(state.occupiedSeats).toBe(1);
      expect(state.freeSeats).toBe(0);
    });

    it('rejecting pending moves to Cancelled by Organizer and promotes next player in waitlist', async () => {
      const ev1Capacity: Event = { ...baseEvent, id: 'ev-reject', capacity: 1 };
      await repo.saveEvent(ev1Capacity);

      const c1 = await domain.registerPlayer({
        eventId: 'ev-reject',
        phone: '611111111',
        nickname: 'C1',
        lateArrival: false,
      });
      const e1 = await domain.registerPlayer({
        eventId: 'ev-reject',
        phone: '622222222',
        nickname: 'E1',
        lateArrival: false,
      });
      const e2 = await domain.registerPlayer({
        eventId: 'ev-reject',
        phone: '633333333',
        nickname: 'E2',
        lateArrival: false,
      });

      if (c1.type !== 'confirmed' || e1.type !== 'waitlisted' || e2.type !== 'waitlisted') {
        throw new Error('Unexpected initial state');
      }

      // C1 cancels -> E1 pending
      await domain.cancelRegistration({
        eventId: 'ev-reject',
        registrationId: c1.registration.id,
        cancelledBy: 'player',
      });

      // Organizer rejects E1
      const rejectRes = await domain.rejectPending({
        eventId: 'ev-reject',
        registrationId: e1.registration.id,
      });

      expect(rejectRes.rejectedRegistration.status).toBe('cancelled');
      expect(rejectRes.rejectedRegistration.cancelledBy).toBe('organizer');

      // E2 promoted atomically to pending_confirmation
      expect(rejectRes.promotedRegistration).toBeDefined();
      expect(rejectRes.promotedRegistration?.id).toBe(e2.registration.id);
      expect(rejectRes.promotedRegistration?.status).toBe('pending_confirmation');

      const state = await domain.getVisibleEventState('ev-reject');
      expect(state.occupiedSeats).toBe(1);
      expect(state.pendingConfirmation).toHaveLength(1);
      expect(state.pendingConfirmation[0].nickname).toBe('E2');
      expect(state.waitlist).toHaveLength(0);
      expect(state.cancelled).toHaveLength(2);
    });

    it('fails when attempting to confirm or reject a registration not in pending_confirmation status', async () => {
      const c1 = await domain.registerPlayer({
        eventId: 'ev-1',
        phone: '611111111',
        nickname: 'C1',
        lateArrival: false,
      });

      if (c1.type !== 'confirmed') throw new Error('Expected confirmed');

      await expect(
        domain.confirmPending({
          eventId: 'ev-1',
          registrationId: c1.registration.id,
        })
      ).rejects.toThrow();

      await expect(
        domain.rejectPending({
          eventId: 'ev-1',
          registrationId: c1.registration.id,
        })
      ).rejects.toThrow();
    });
  });

  describe('Waitlist Reordering (Organizer)', () => {
    it('allows reordering the waitlist updating positions', async () => {
      const evReorder: Event = { ...baseEvent, id: 'ev-reorder', capacity: 1 };
      await repo.saveEvent(evReorder);

      await domain.registerPlayer({
        eventId: 'ev-reorder',
        phone: '600000000',
        nickname: 'Confirmed',
        lateArrival: false,
      });
      const insA = await domain.registerPlayer({
        eventId: 'ev-reorder',
        phone: '611111111',
        nickname: 'Waitlist A',
        lateArrival: false,
      });
      const insB = await domain.registerPlayer({
        eventId: 'ev-reorder',
        phone: '622222222',
        nickname: 'Waitlist B',
        lateArrival: false,
      });
      const insC = await domain.registerPlayer({
        eventId: 'ev-reorder',
        phone: '633333333',
        nickname: 'Waitlist C',
        lateArrival: false,
      });

      if (
        insA.type !== 'waitlisted' ||
        insB.type !== 'waitlisted' ||
        insC.type !== 'waitlisted'
      ) {
        throw new Error('Expected waitlisted');
      }

      // Reorder to [C(#1), A(#2), B(#3)]
      const newOrder = [
        insC.registration.id,
        insA.registration.id,
        insB.registration.id,
      ];

      const reorderedList = await domain.reorderWaitlist({
        eventId: 'ev-reorder',
        newOrderRegistrationIds: newOrder,
      });

      expect(reorderedList[0].id).toBe(insC.registration.id);
      expect(reorderedList[0].waitlistPosition).toBe(1);
      expect(reorderedList[1].id).toBe(insA.registration.id);
      expect(reorderedList[1].waitlistPosition).toBe(2);
      expect(reorderedList[2].id).toBe(insB.registration.id);
      expect(reorderedList[2].waitlistPosition).toBe(3);

      // Verify that freeing a seat promotes C (the new #1)
      const allRegs = await repo.listRegistrationsByEvent('ev-reorder');
      const confirmed = allRegs.find((r) => r.status === 'confirmed');
      if (!confirmed) throw new Error('Missing confirmed');

      const promoRes = await domain.cancelRegistration({
        eventId: 'ev-reorder',
        registrationId: confirmed.id,
        cancelledBy: 'organizer',
      });

      expect(promoRes.promotedRegistration?.id).toBe(insC.registration.id);
      expect(promoRes.promotedRegistration?.nickname).toBe('Waitlist C');
    });

    it('rejects reordering if ID list does not match currently active waitlist registrations', async () => {
      const evReorderVal: Event = { ...baseEvent, id: 'ev-reorder-val', capacity: 1 };
      await repo.saveEvent(evReorderVal);

      await domain.registerPlayer({
        eventId: 'ev-reorder-val',
        phone: '600000000',
        nickname: 'Confirmed',
        lateArrival: false,
      });
      const insA = await domain.registerPlayer({
        eventId: 'ev-reorder-val',
        phone: '611111111',
        nickname: 'A',
        lateArrival: false,
      });

      if (insA.type !== 'waitlisted') throw new Error('Expected waitlisted');

      await expect(
        domain.reorderWaitlist({
          eventId: 'ev-reorder-val',
          newOrderRegistrationIds: ['non-existent-id'],
        })
      ).rejects.toThrow();

      await expect(
        domain.reorderWaitlist({
          eventId: 'ev-reorder-val',
          newOrderRegistrationIds: [],
        })
      ).rejects.toThrow();
    });
  });
});
