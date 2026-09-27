import { Event } from './types';

export type EventVisualCycle = 'upcoming' | 'in_progress' | 'past' | 'cancelled';

export interface SplitEventsResult {
  upcoming: Event[];
  past: Event[];
}

function formatDateToIsoDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function formatTimeToHhMm(d: Date): string {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/**
 * Computes the purely visual cycle of an event without triggering any automatic transitions.
 * (PRD: "Indicador visual del ciclo sin transiciones automáticas por reloj").
 */
export function getEventVisualCycle(
  event: Pick<Event, 'date' | 'time' | 'status'>,
  referenceDate: Date = new Date()
): EventVisualCycle {
  if (event.status === 'cancelled') {
    return 'cancelled';
  }

  const todayStr = formatDateToIsoDate(referenceDate);
  const nowTimeStr = formatTimeToHhMm(referenceDate);

  if (event.date < todayStr) {
    return 'past';
  }

  if (event.date === todayStr) {
    if (nowTimeStr >= event.time) {
      return 'in_progress';
    }
    return 'upcoming';
  }

  return 'upcoming';
}

/**
 * Splits events into upcoming and past/cancelled categories with chronological ordering.
 * - Upcoming: active events today or future, sorted nearest first (ascending).
 * - Past: past events or cancelled, sorted most recent first (descending).
 */
export function splitAndSortEvents(
  events: Event[],
  referenceDate: Date = new Date()
): SplitEventsResult {
  const todayStr = formatDateToIsoDate(referenceDate);

  const upcoming: Event[] = [];
  const past: Event[] = [];

  for (const ev of events) {
    if (ev.status === 'cancelled' || ev.date < todayStr) {
      past.push(ev);
    } else {
      upcoming.push(ev);
    }
  }

  // Upcoming: nearest first (ascending date + time)
  upcoming.sort((a, b) => {
    const cmpDate = a.date.localeCompare(b.date);
    if (cmpDate !== 0) return cmpDate;
    return a.time.localeCompare(b.time);
  });

  // Past: latest first (descending date + time)
  past.sort((a, b) => {
    const cmpDate = b.date.localeCompare(a.date);
    if (cmpDate !== 0) return cmpDate;
    return b.time.localeCompare(a.time);
  });

  return { upcoming, past };
}
