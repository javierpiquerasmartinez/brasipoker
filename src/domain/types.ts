export type EventType = 'cash' | 'tournament';

export type EventStatus = 'active' | 'cancelled';

export interface Event {
  id: string;
  organizerId: string;
  slug: string;
  type: EventType;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  capacity: number;
  note?: string;
  allowWaitlist: boolean;
  status: EventStatus;
  createdAt: Date;
}

export type RegistrationStatus =
  | 'confirmed'
  | 'pending_confirmation'
  | 'waitlisted'
  | 'cancelled';

export type CancellationReason = 'player' | 'organizer';

export interface Registration {
  id: string;
  eventId: string;
  phone: string; // Standard format (+34XXXXXXXXX)
  nickname: string;
  status: RegistrationStatus;
  lateArrival: boolean;
  estimatedArrivalTime?: string; // Required when lateArrival is true
  cancelledBy?: CancellationReason;
  waitlistPosition?: number; // Only defined when status === 'waitlisted'
  createdAt: Date;
  updatedAt: Date;
}

export interface RegisterPlayerCommand {
  eventId: string;
  phone: string;
  nickname: string;
  lateArrival: boolean;
  estimatedArrivalTime?: string;
}

export type RegistrationResult =
  | { type: 'confirmed'; registration: Registration; duplicate: false }
  | {
      type: 'waitlisted';
      registration: Registration;
      position: number;
      duplicate: false;
    }
  | { type: 'event_full' }
  | { type: 'already_registered'; registration: Registration; duplicate: true };

export interface CancelRegistrationCommand {
  eventId: string;
  registrationId: string;
  cancelledBy: CancellationReason;
}

export interface CancelResult {
  cancelledRegistration: Registration;
  promotedRegistration?: Registration;
}

export interface ConfirmPendingCommand {
  eventId: string;
  registrationId: string;
}

export interface RejectPendingCommand {
  eventId: string;
  registrationId: string;
}

export interface RejectResult {
  rejectedRegistration: Registration;
  promotedRegistration?: Registration;
}

export interface ReorderWaitlistCommand {
  eventId: string;
  newOrderRegistrationIds: string[];
}

export interface EditEventCommand {
  eventId: string;
  type?: EventType;
  date?: string;
  time?: string;
  capacity?: number;
  note?: string;
  allowWaitlist?: boolean;
}

export interface CancelEventCommand {
  eventId: string;
}

export interface EditRegistrationCommand {
  eventId: string;
  registrationId: string;
  nickname?: string;
  lateArrival?: boolean;
  estimatedArrivalTime?: string;
}

export interface GenerateWhatsAppTextCommand {
  eventId: string;
}


export interface VisibleEventState {
  event: Event;
  capacity: number;
  occupiedSeats: number;
  freeSeats: number;
  confirmed: Registration[];
  pendingConfirmation: Registration[];
  waitlist: Registration[];
  cancelled: Registration[];
}

export class EventNotFoundError extends Error {
  constructor(id: string) {
    super(`Event not found: ${id}`);
    this.name = 'EventNotFoundError';
  }
}

export class RegistrationNotFoundError extends Error {
  constructor(id: string) {
    super(`Registration not found: ${id}`);
    this.name = 'RegistrationNotFoundError';
  }
}

export class InvalidRegistrationDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidRegistrationDataError';
  }
}

export class InvalidRegistrationStatusError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidRegistrationStatusError';
  }
}

export class OperationNotAllowedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OperationNotAllowedError';
  }
}
