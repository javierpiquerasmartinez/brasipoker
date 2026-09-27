import { EventRepository } from './event-repository';
import { Event, Registration } from './types';

export class InMemoryEventRepository implements EventRepository {
  private events = new Map<string, Event>();
  private registrations = new Map<string, Registration>();

  async findEventById(id: string): Promise<Event | null> {
    const ev = this.events.get(id);
    return ev ? { ...ev } : null;
  }

  async findEventBySlug(slug: string): Promise<Event | null> {
    for (const ev of this.events.values()) {
      if (ev.slug === slug) {
        return { ...ev };
      }
    }
    return null;
  }

  async saveEvent(event: Event): Promise<void> {
    this.events.set(event.id, { ...event });
  }

  async listRegistrationsByEvent(eventId: string): Promise<Registration[]> {
    const list: Registration[] = [];
    for (const reg of this.registrations.values()) {
      if (reg.eventId === eventId) {
        list.push({ ...reg });
      }
    }
    return list;
  }

  async findRegistrationById(id: string): Promise<Registration | null> {
    const reg = this.registrations.get(id);
    return reg ? { ...reg } : null;
  }

  async saveRegistration(registration: Registration): Promise<void> {
    this.registrations.set(registration.id, { ...registration });
  }

  async saveRegistrations(registrations: Registration[]): Promise<void> {
    for (const reg of registrations) {
      this.registrations.set(reg.id, { ...reg });
    }
  }

  // Testing helper
  clear(): void {
    this.events.clear();
    this.registrations.clear();
  }
}
