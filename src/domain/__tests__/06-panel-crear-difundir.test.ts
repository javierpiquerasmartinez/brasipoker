import { beforeEach, describe, expect, it } from 'vitest';
import { InMemoryEventRepository } from '../in-memory-event-repository';
import { RegistrationDomain } from '../registration-domain';
import { InvalidRegistrationDataError } from '../types';

describe('RegistrationDomain — Issue 06: Panel Crear, Editar y Difundir', () => {
  let repo: InMemoryEventRepository;
  let domain: RegistrationDomain;

  beforeEach(() => {
    repo = new InMemoryEventRepository();
    domain = new RegistrationDomain(repo);
  });

  describe('createEvent', () => {
    it('creates an event with all PRD parameters and a short random slug', async () => {
      const event = await domain.createEvent({
        organizerId: 'org-123',
        type: 'cash',
        date: '2026-10-15',
        time: '21:30',
        capacity: 8,
        note: 'Ciega 1/2 - Mínimo 50€',
        allowWaitlist: true,
      });

      expect(event.id).toBeDefined();
      expect(event.organizerId).toBe('org-123');
      expect(event.type).toBe('cash');
      expect(event.date).toBe('2026-10-15');
      expect(event.time).toBe('21:30');
      expect(event.capacity).toBe(8);
      expect(event.note).toBe('Ciega 1/2 - Mínimo 50€');
      expect(event.allowWaitlist).toBe(true);
      expect(event.status).toBe('active');
      expect(event.slug).toBeDefined();
      expect(event.slug.length).toBeGreaterThanOrEqual(6);
      expect(event.slug.length).toBeLessThanOrEqual(10);

      // Verify persisted in repo
      const fetched = await repo.findEventById(event.id);
      expect(fetched).toEqual(event);

      const bySlug = await repo.findEventBySlug(event.slug);
      expect(bySlug).toEqual(event);
    });

    it('creates a tournament event with waitlist disabled', async () => {
      const event = await domain.createEvent({
        organizerId: 'org-456',
        type: 'tournament',
        date: '2026-10-20',
        time: '20:00',
        capacity: 18,
        allowWaitlist: false,
      });

      expect(event.type).toBe('tournament');
      expect(event.allowWaitlist).toBe(false);
      expect(event.note).toBeUndefined();
    });

    it('rejects invalid capacity', async () => {
      await expect(
        domain.createEvent({
          organizerId: 'org-123',
          type: 'cash',
          date: '2026-10-15',
          time: '21:30',
          capacity: 0,
          allowWaitlist: true,
        })
      ).rejects.toThrow(InvalidRegistrationDataError);
    });

    it('rejects invalid date or time', async () => {
      await expect(
        domain.createEvent({
          organizerId: 'org-123',
          type: 'cash',
          date: 'invalid-date',
          time: '21:30',
          capacity: 6,
          allowWaitlist: true,
        })
      ).rejects.toThrow(InvalidRegistrationDataError);

      await expect(
        domain.createEvent({
          organizerId: 'org-123',
          type: 'cash',
          date: '2026-10-15',
          time: '99:99',
          capacity: 6,
          allowWaitlist: true,
        })
      ).rejects.toThrow(InvalidRegistrationDataError);
    });
  });

  describe('listEventsByOrganizer', () => {
    it('returns only events belonging to the organizer', async () => {
      await domain.createEvent({
        organizerId: 'org-1',
        type: 'cash',
        date: '2026-10-01',
        time: '20:00',
        capacity: 6,
        allowWaitlist: true,
      });
      await domain.createEvent({
        organizerId: 'org-1',
        type: 'tournament',
        date: '2026-10-02',
        time: '20:00',
        capacity: 10,
        allowWaitlist: true,
      });
      await domain.createEvent({
        organizerId: 'org-2',
        type: 'cash',
        date: '2026-10-03',
        time: '20:00',
        capacity: 8,
        allowWaitlist: true,
      });

      const org1Events = await repo.listEventsByOrganizer('org-1');
      expect(org1Events).toHaveLength(2);
      expect(org1Events.every((e) => e.organizerId === 'org-1')).toBe(true);

      const org2Events = await repo.listEventsByOrganizer('org-2');
      expect(org2Events).toHaveLength(1);
      expect(org2Events[0].organizerId === 'org-2').toBe(true);
    });
  });

  describe('generateWhatsAppText', () => {
    it('generates WhatsApp message with emojis, details and link for cash event', async () => {
      const event = await domain.createEvent({
        organizerId: 'org-1',
        type: 'cash',
        date: '2026-10-15',
        time: '21:30',
        capacity: 6,
        note: 'Ciega 1/2 € - Entrada mín 50€',
        allowWaitlist: true,
      });

      await domain.registerPlayer({
        eventId: event.id,
        phone: '611111111',
        nickname: 'Carlos',
        lateArrival: false,
      });

      const message = await domain.generateWhatsAppText({
        eventId: event.id,
        baseUrl: 'https://brasipoker.es',
      });

      // Contains emojis and cash wording
      expect(message).toContain('♠️');
      expect(message).toContain('📣');
      expect(message).toMatch(/cash/i);
      expect(message).toContain('2026-10-15');
      expect(message).toContain('21:30');
      expect(message).toContain('Ciega 1/2 € - Entrada mín 50€');
      expect(message).toContain('Carlos');
      expect(message).toContain(`https://brasipoker.es/p/${event.slug}`);
      expect(message).toContain(event.slug);
    });

    it('generates WhatsApp message for tournament event', async () => {
      const event = await domain.createEvent({
        organizerId: 'org-1',
        type: 'tournament',
        date: '2026-10-18',
        time: '19:00',
        capacity: 12,
        allowWaitlist: true,
      });

      const message = await domain.generateWhatsAppText({
        eventId: event.id,
      });

      expect(message).toContain('♠️');
      expect(message).toMatch(/torneo|tournament/i);
      expect(message).toContain('2026-10-18');
      expect(message).toContain('19:00');
      expect(message).toContain(`/p/${event.slug}`);
    });
  });
});
