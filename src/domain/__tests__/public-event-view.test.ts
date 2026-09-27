import { beforeEach, describe, expect, it } from 'vitest';
import { InMemoryEventRepository } from '../in-memory-event-repository';
import { RegistrationDomain } from '../registration-domain';
import { Event } from '../types';

describe('Public Event View — Domain Seam', () => {
  let repo: InMemoryEventRepository;
  let domain: RegistrationDomain;

  const baseEvent: Event = {
    id: 'ev-1',
    organizerId: 'org-1',
    slug: 'viernes-cash',
    type: 'cash',
    date: '2026-10-02',
    time: '21:00',
    capacity: 2,
    note: 'Entrada 20€ con rebuys',
    allowWaitlist: true,
    status: 'active',
    createdAt: new Date('2026-09-27T10:00:00Z'),
  };

  beforeEach(async () => {
    repo = new InMemoryEventRepository();
    await repo.saveEvent(baseEvent);
    domain = new RegistrationDomain(repo);
  });

  it('returns null when event slug does not exist', async () => {
    const view = await domain.getPublicEventView('non-existent-slug');
    expect(view).toBeNull();
  });

  it('returns public event details and sanitized roster without exposing phones or arrival hours', async () => {
    // 1 confirmed on time
    await domain.registerPlayer({
      eventId: 'ev-1',
      phone: '611111111',
      nickname: 'JugadorUno',
      lateArrival: false,
    });

    // 1 confirmed late
    await domain.registerPlayer({
      eventId: 'ev-1',
      phone: '622222222',
      nickname: 'JugadorTarde',
      lateArrival: true,
      estimatedArrivalTime: '22:15',
    });

    // 1 in waitlist (since capacity is 2)
    await domain.registerPlayer({
      eventId: 'ev-1',
      phone: '633333333',
      nickname: 'JugadorEspera',
      lateArrival: true,
      estimatedArrivalTime: '23:00',
    });

    const publicView = await domain.getPublicEventView('viernes-cash');

    expect(publicView).not.toBeNull();
    if (!publicView) return;

    expect(publicView.id).toBe('ev-1');
    expect(publicView.slug).toBe('viernes-cash');
    expect(publicView.type).toBe('cash');
    expect(publicView.date).toBe('2026-10-02');
    expect(publicView.time).toBe('21:00');
    expect(publicView.note).toBe('Entrada 20€ con rebuys');
    expect(publicView.capacity).toBe(2);
    expect(publicView.occupiedSeats).toBe(2);
    expect(publicView.freeSeats).toBe(0);
    expect(publicView.allowWaitlist).toBe(true);
    expect(publicView.status).toBe('active');

    // Confirmed list privacy check
    expect(publicView.confirmed).toHaveLength(2);
    expect(publicView.confirmed[0]).toEqual({
      id: expect.any(String),
      nickname: 'JugadorUno',
      lateArrival: false,
    });
    expect(publicView.confirmed[1]).toEqual({
      id: expect.any(String),
      nickname: 'JugadorTarde',
      lateArrival: true,
    });

    // Waitlist privacy check: has position, but NO phone and NO estimatedArrivalTime
    expect(publicView.waitlist).toHaveLength(1);
    expect(publicView.waitlist[0]).toEqual({
      id: expect.any(String),
      nickname: 'JugadorEspera',
      lateArrival: true,
      waitlistPosition: 1,
    });

    // Explicit check: none of the public objects contain phone numbers or raw arrival times
    const fullJson = JSON.stringify(publicView);
    expect(fullJson).not.toContain('611111111');
    expect(fullJson).not.toContain('622222222');
    expect(fullJson).not.toContain('633333333');
    expect(fullJson).not.toContain('+34');
    expect(fullJson).not.toContain('22:15');
    expect(fullJson).not.toContain('23:00');
  });

  it('reflects cancelled event status in public view', async () => {
    await domain.cancelEvent({ eventId: 'ev-1' });

    const publicView = await domain.getPublicEventView('viernes-cash');
    expect(publicView).not.toBeNull();
    expect(publicView?.status).toBe('cancelled');
    expect(publicView?.confirmed).toHaveLength(0);
    expect(publicView?.occupiedSeats).toBe(0);
  });

  describe('Player Self-Management: getActiveRegistrationByPhone', () => {
    it('returns null if player has never registered or event does not exist', async () => {
      const reg = await domain.getActiveRegistrationByPhone('ev-1', '699999999');
      expect(reg).toBeNull();

      const nonExistent = await domain.getActiveRegistrationByPhone('non-existent', '699999999');
      expect(nonExistent).toBeNull();
    });

    it('returns the active registration normalizing the phone input', async () => {
      await domain.registerPlayer({
        eventId: 'ev-1',
        phone: '612345678',
        nickname: 'PokerAce',
        lateArrival: true,
        estimatedArrivalTime: '21:45',
      });

      // Query with spaces and international prefix
      const found = await domain.getActiveRegistrationByPhone('ev-1', '+34 612 34 56 78');
      expect(found).not.toBeNull();
      expect(found?.phone).toBe('+34612345678');
      expect(found?.nickname).toBe('PokerAce');
      expect(found?.status).toBe('confirmed');
      expect(found?.lateArrival).toBe(true);
      expect(found?.estimatedArrivalTime).toBe('21:45');
    });

    it('returns null once a player cancels their registration, and finds new one upon re-registration', async () => {
      const regResult = await domain.registerPlayer({
        eventId: 'ev-1',
        phone: '612345678',
        nickname: 'PokerAce',
        lateArrival: false,
      });

      if (regResult.type !== 'confirmed') throw new Error('Expected confirmed');

      // Player cancels self
      await domain.cancelRegistration({
        eventId: 'ev-1',
        registrationId: regResult.registration.id,
        cancelledBy: 'player',
      });

      const afterCancel = await domain.getActiveRegistrationByPhone('ev-1', '612345678');
      expect(afterCancel).toBeNull();

      // Re-registers
      const reResult = await domain.registerPlayer({
        eventId: 'ev-1',
        phone: '612345678',
        nickname: 'PokerAceReborn',
        lateArrival: false,
      });

      if (reResult.type !== 'confirmed') throw new Error('Expected confirmed on re-register');

      const afterReRegister = await domain.getActiveRegistrationByPhone('ev-1', '612345678');
      expect(afterReRegister).not.toBeNull();
      expect(afterReRegister?.id).toBe(reResult.registration.id);
      expect(afterReRegister?.nickname).toBe('PokerAceReborn');
    });
  });
});

