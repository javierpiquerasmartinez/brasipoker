import { beforeEach, describe, expect, it } from 'vitest';
import { InMemoryEventRepository } from '@/domain/in-memory-event-repository';
import { RegistrationDomain } from '@/domain/registration-domain';
import { Event } from '@/domain/types';
import {
  createPlayerActionsHandler,
} from '../actions-handler';

describe('Player Actions Handler — Server Actions Seam', () => {
  let repo: InMemoryEventRepository;
  let domain: RegistrationDomain;
  let handler: ReturnType<typeof createPlayerActionsHandler>;

  const testEvent: Event = {
    id: 'ev-test',
    organizerId: 'org-1',
    slug: 'viernes-test',
    type: 'cash',
    date: '2026-10-02',
    time: '21:00',
    capacity: 2,
    note: 'Partida de prueba',
    allowWaitlist: true,
    status: 'active',
    createdAt: new Date('2026-09-27T10:00:00Z'),
  };

  beforeEach(async () => {
    repo = new InMemoryEventRepository();
    await repo.saveEvent(testEvent);
    domain = new RegistrationDomain(repo);
    handler = createPlayerActionsHandler(domain);
  });

  describe('getPublicEvent', () => {
    it('returns error when slug does not exist', async () => {
      const res = await handler.getPublicEvent('inexistente');
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBe('Evento no encontrado');
      }
    });

    it('returns public view successfully', async () => {
      const res = await handler.getPublicEvent('viernes-test');
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.slug).toBe('viernes-test');
        expect(res.data.capacity).toBe(2);
      }
    });
  });

  describe('registerPlayer', () => {
    it('validates nickname is required', async () => {
      const res = await handler.registerPlayer('viernes-test', {
        nickname: '',
        phone: '612345678',
        lateArrival: false,
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toContain('apodo');
      }
    });

    it('validates phone format', async () => {
      const res = await handler.registerPlayer('viernes-test', {
        nickname: 'Fish',
        phone: '12345',
        lateArrival: false,
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toContain('teléfono');
      }
    });

    it('requires estimated arrival time if lateArrival is true', async () => {
      const res = await handler.registerPlayer('viernes-test', {
        nickname: 'Fish',
        phone: '612345678',
        lateArrival: true,
        estimatedArrivalTime: '',
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toContain('hora');
      }
    });

    it('successfully confirms player when seats are available', async () => {
      const res = await handler.registerPlayer('viernes-test', {
        nickname: 'Fish',
        phone: '612345678',
        lateArrival: false,
      });

      expect(res.success).toBe(true);
      if (res.success && res.result.type === 'confirmed') {
        expect(res.result.registration?.nickname).toBe('Fish');
        expect(res.result.registration?.status).toBe('confirmed');
      }
    });

    it('places player in waitlist when capacity is reached', async () => {
      // Fill 2 seats
      await handler.registerPlayer('viernes-test', {
        nickname: 'P1',
        phone: '611111111',
        lateArrival: false,
      });
      await handler.registerPlayer('viernes-test', {
        nickname: 'P2',
        phone: '622222222',
        lateArrival: false,
      });

      // 3rd player
      const res = await handler.registerPlayer('viernes-test', {
        nickname: 'P3',
        phone: '633333333',
        lateArrival: false,
      });

      expect(res.success).toBe(true);
      if (res.success && res.result.type === 'waitlisted') {
        expect(res.result.position).toBe(1);
        expect(res.result.registration?.status).toBe('waitlisted');
      }
    });

    it('detects duplicate registration with same phone and reports already_registered', async () => {
      await handler.registerPlayer('viernes-test', {
        nickname: 'Fish',
        phone: '612345678',
        lateArrival: false,
      });

      // Same phone registers again
      const dupRes = await handler.registerPlayer('viernes-test', {
        nickname: 'FishDifferentName',
        phone: '+34 612 34 56 78',
        lateArrival: false,
      });

      expect(dupRes.success).toBe(true);
      if (dupRes.success && dupRes.result.type === 'already_registered') {
        expect(dupRes.result.registration?.nickname).toBe('Fish');
        expect(dupRes.result.registration?.status).toBe('confirmed');
      }
    });
  });

  describe('checkMyRegistration & cancelMyRegistration', () => {
    it('checks active registration by phone', async () => {
      await handler.registerPlayer('viernes-test', {
        nickname: 'PlayerOne',
        phone: '612345678',
        lateArrival: false,
      });

      const found = await handler.checkMyRegistration('viernes-test', '612345678');
      expect(found.success).toBe(true);
      if (found.success) {
        expect(found.found).toBe(true);
        expect(found.registration?.nickname).toBe('PlayerOne');
        expect(found.registration?.status).toBe('confirmed');
      }

      const notFound = await handler.checkMyRegistration('viernes-test', '699999999');
      expect(notFound.success).toBe(true);
      if (notFound.success) {
        expect(notFound.found).toBe(false);
      }
    });

    it('cancels registration and promotes the first in waitlist', async () => {
      // 1. Confirmed P1
      const p1 = await handler.registerPlayer('viernes-test', {
        nickname: 'P1',
        phone: '611111111',
        lateArrival: false,
      });
      // 2. Confirmed P2
      await handler.registerPlayer('viernes-test', {
        nickname: 'P2',
        phone: '622222222',
        lateArrival: false,
      });
      // 3. Waitlist W1
      await handler.registerPlayer('viernes-test', {
        nickname: 'W1',
        phone: '633333333',
        lateArrival: false,
      });

      if (!p1.success || p1.result.type !== 'confirmed' || !p1.result.registration) {
        throw new Error('Expected confirmed with registration');
      }

      // P1 cancels
      const cancelRes = await handler.cancelMyRegistration(
        'viernes-test',
        p1.result.registration.id,
        '611111111'
      );

      expect(cancelRes.success).toBe(true);

      // Verify W1 was promoted to pending_confirmation
      const w1Check = await handler.checkMyRegistration('viernes-test', '633333333');
      expect(w1Check.success).toBe(true);
      if (w1Check.success && w1Check.found) {
        expect(w1Check.registration?.status).toBe('pending_confirmation');
      }
    });
  });
});
