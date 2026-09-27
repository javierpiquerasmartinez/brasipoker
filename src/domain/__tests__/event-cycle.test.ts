import { describe, expect, it } from 'vitest';
import {
  getEventVisualCycle,
  splitAndSortEvents,
  EventVisualCycle,
} from '../event-cycle';
import { Event } from '../types';

describe('Event Visual Cycle & Sorting', () => {
  const makeEvent = (
    id: string,
    date: string,
    time: string,
    status: 'active' | 'cancelled' = 'active'
  ): Event => ({
    id,
    organizerId: 'org-1',
    slug: `ev-${id}`,
    type: 'cash',
    date,
    time,
    capacity: 8,
    allowWaitlist: true,
    status,
    createdAt: new Date(),
  });

  const refDate = new Date('2026-10-15T18:00:00'); // Thursday 18:00

  describe('getEventVisualCycle', () => {
    it('returns cancelled when event.status is cancelled regardless of date', () => {
      const future = makeEvent('1', '2026-10-20', '21:00', 'cancelled');
      expect(getEventVisualCycle(future, refDate)).toBe<EventVisualCycle>('cancelled');

      const past = makeEvent('2', '2026-10-10', '21:00', 'cancelled');
      expect(getEventVisualCycle(past, refDate)).toBe<EventVisualCycle>('cancelled');
    });

    it('returns upcoming when date is strictly in the future', () => {
      const ev = makeEvent('1', '2026-10-16', '21:00');
      expect(getEventVisualCycle(ev, refDate)).toBe<EventVisualCycle>('upcoming');
    });

    it('returns upcoming when date is today and time is after reference time', () => {
      const ev = makeEvent('1', '2026-10-15', '21:00');
      expect(getEventVisualCycle(ev, refDate)).toBe<EventVisualCycle>('upcoming');
    });

    it('returns in_progress when date is today and time is equal or before reference time', () => {
      const ev = makeEvent('1', '2026-10-15', '17:30');
      expect(getEventVisualCycle(ev, refDate)).toBe<EventVisualCycle>('in_progress');

      const evExact = makeEvent('2', '2026-10-15', '18:00');
      expect(getEventVisualCycle(evExact, refDate)).toBe<EventVisualCycle>('in_progress');
    });

    it('returns past when date is in the past', () => {
      const ev = makeEvent('1', '2026-10-14', '21:00');
      expect(getEventVisualCycle(ev, refDate)).toBe<EventVisualCycle>('past');
    });
  });

  describe('splitAndSortEvents', () => {
    it('separates upcoming and past events with correct chronological ordering', () => {
      const evTodayLater = makeEvent('today-later', '2026-10-15', '22:00');
      const evTodayEarlier = makeEvent('today-earlier', '2026-10-15', '16:00');
      const evTomorrow = makeEvent('tomorrow', '2026-10-16', '20:00');
      const evNextWeek = makeEvent('next-week', '2026-10-22', '21:00');
      const evYesterday = makeEvent('yesterday', '2026-10-14', '21:00');
      const evLastWeek = makeEvent('last-week', '2026-10-07', '21:00');
      const evCancelledFuture = makeEvent('cancelled-fut', '2026-10-25', '21:00', 'cancelled');

      const all = [
        evNextWeek,
        evYesterday,
        evTodayLater,
        evLastWeek,
        evTomorrow,
        evCancelledFuture,
        evTodayEarlier,
      ];

      const { upcoming, past } = splitAndSortEvents(all, refDate);

      // Upcoming: active events today or future, sorted nearest first
      expect(upcoming.map((e) => e.id)).toEqual([
        'today-earlier',
        'today-later',
        'tomorrow',
        'next-week',
      ]);

      // Past: past dates or cancelled, sorted most recent first
      expect(past.map((e) => e.id)).toEqual([
        'cancelled-fut',
        'yesterday',
        'last-week',
      ]);
    });
  });
});
