import { Event, Registration } from './types';

export interface EventRepository {
  findEventById(id: string): Promise<Event | null>;
  findEventBySlug(slug: string): Promise<Event | null>;
  listEventsByOrganizer(organizerId: string): Promise<Event[]>;
  saveEvent(event: Event): Promise<void>;

  listRegistrationsByEvent(eventId: string): Promise<Registration[]>;
  findRegistrationById(id: string): Promise<Registration | null>;
  saveRegistration(registration: Registration): Promise<void>;
  saveRegistrations(registrations: Registration[]): Promise<void>;
}
