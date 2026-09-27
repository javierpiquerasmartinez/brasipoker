import { EventRepository } from './event-repository';
import { normalizePhone } from './phone';
import {
  CancelRegistrationCommand,
  CancelResult,
  ConfirmPendingCommand,
  EventNotFoundError,
  InvalidRegistrationDataError,
  InvalidRegistrationStatusError,
  OperationNotAllowedError,
  RegisterPlayerCommand,
  Registration,
  RegistrationNotFoundError,
  RegistrationResult,
  RejectPendingCommand,
  RejectResult,
  ReorderWaitlistCommand,
  VisibleEventState,
  EditEventCommand,
  CancelEventCommand,
  EditRegistrationCommand,
  GenerateWhatsAppTextCommand,
  Event,
  PublicEventView,
  PublicPlayerItem,
  PublicWaitlistItem,
} from './types';

export class RegistrationDomain {
  constructor(private readonly repo: EventRepository) {}

  /**
   * Registers a player for an event via public link or direct entry.
   * Rules:
   * 1. Validates phone (es-ES format) and nickname (non-empty).
   * 2. If lateArrival is true, estimatedArrivalTime is mandatory.
   * 3. Deduplication: max 1 active registration per (eventId, phone). If existing, returns it.
   * 4. If free seats available -> Confirmed occupying a seat.
   * 5. If capacity reached:
   *    - If waitlist enabled -> enters end of waitlist with consecutive position (#1, #2...).
   *    - If waitlist disabled -> "event_full" (does not enter queue).
   */
  async registerPlayer(
    command: RegisterPlayerCommand
  ): Promise<RegistrationResult> {
    const cleanNickname = command.nickname ? command.nickname.trim() : '';
    if (!cleanNickname) {
      throw new InvalidRegistrationDataError('Nickname or name is required');
    }

    const normalizedPhone = normalizePhone(command.phone);

    if (command.lateArrival) {
      if (
        !command.estimatedArrivalTime ||
        !command.estimatedArrivalTime.trim()
      ) {
        throw new InvalidRegistrationDataError(
          'Estimated arrival time is required when late arrival is indicated'
        );
      }
    }

    const event = await this.repo.findEventById(command.eventId);
    if (!event) {
      throw new EventNotFoundError(command.eventId);
    }

    if (event.status === 'cancelled') {
      throw new OperationNotAllowedError(
        'Registrations are not allowed for a cancelled event'
      );
    }

    const allRegistrations = await this.repo.listRegistrationsByEvent(
      command.eventId
    );

    // Deduplication check: max 1 active registration per phone/event
    const activeRegistration = allRegistrations.find(
      (reg) => reg.phone === normalizedPhone && reg.status !== 'cancelled'
    );

    if (activeRegistration) {
      return {
        type: 'already_registered',
        registration: activeRegistration,
        duplicate: true,
      };
    }

    // Occupied seats: both 'confirmed' and 'pending_confirmation' hold a seat
    const occupied = allRegistrations.filter(
      (reg) =>
        reg.status === 'confirmed' || reg.status === 'pending_confirmation'
    );

    const now = new Date();

    if (occupied.length < event.capacity) {
      const newRegistration: Registration = {
        id: crypto.randomUUID(),
        eventId: event.id,
        phone: normalizedPhone,
        nickname: cleanNickname,
        status: 'confirmed',
        lateArrival: command.lateArrival,
        estimatedArrivalTime: command.lateArrival
          ? command.estimatedArrivalTime?.trim()
          : undefined,
        createdAt: now,
        updatedAt: now,
      };

      await this.repo.saveRegistration(newRegistration);

      return {
        type: 'confirmed',
        registration: newRegistration,
        duplicate: false,
      };
    }

    // Capacity reached
    if (!event.allowWaitlist) {
      return {
        type: 'event_full',
      };
    }

    // Enters end of waitlist
    const inWaitlist = this.getSortedWaitlist(allRegistrations);

    const position = inWaitlist.length + 1;

    const newRegistration: Registration = {
      id: crypto.randomUUID(),
      eventId: event.id,
      phone: normalizedPhone,
      nickname: cleanNickname,
      status: 'waitlisted',
      lateArrival: command.lateArrival,
      estimatedArrivalTime: command.lateArrival
        ? command.estimatedArrivalTime?.trim()
        : undefined,
      waitlistPosition: position,
      createdAt: now,
      updatedAt: now,
    };

    await this.repo.saveRegistration(newRegistration);

    return {
      type: 'waitlisted',
      registration: newRegistration,
      position,
      duplicate: false,
    };
  }

  /**
   * Cancels an existing registration (triggered by Player or Organizer).
   * Rules:
   * 1. Records who caused the cancellation ('player' | 'organizer').
   * 2. If the cancelled registration held a seat ('confirmed' or 'pending_confirmation'),
   *    a seat is freed and Atomic Promotion (ADR-0003) fires:
   *    the first player in the waitlist immediately moves to 'pending_confirmation'
   *    holding that seat. The rest of the waitlist is compacted.
   * 3. If the cancelled registration was 'waitlisted', no seat was held;
   *    no promotion fires, but subsequent waitlist positions shift up by 1.
   */
  async cancelRegistration(
    command: CancelRegistrationCommand
  ): Promise<CancelResult> {
    const event = await this.repo.findEventById(command.eventId);
    if (!event) {
      throw new EventNotFoundError(command.eventId);
    }

    const registration = await this.repo.findRegistrationById(
      command.registrationId
    );
    if (!registration || registration.eventId !== command.eventId) {
      throw new RegistrationNotFoundError(command.registrationId);
    }

    if (registration.status === 'cancelled') {
      return { cancelledRegistration: registration };
    }

    const previousStatus = registration.status;
    const now = new Date();

    const cancelledRegistration: Registration = {
      ...registration,
      status: 'cancelled',
      cancelledBy: command.cancelledBy,
      waitlistPosition: undefined,
      updatedAt: now,
    };

    await this.repo.saveRegistration(cancelledRegistration);

    let promotedRegistration: Registration | undefined;

    const allRegistrations = await this.repo.listRegistrationsByEvent(
      command.eventId
    );
    const currentList = allRegistrations.map((r) =>
      r.id === cancelledRegistration.id ? cancelledRegistration : r
    );

    if (
      previousStatus === 'confirmed' ||
      previousStatus === 'pending_confirmation'
    ) {
      // Seat freed -> Atomic Promotion
      const inWaitlist = this.getSortedWaitlist(currentList);

      if (inWaitlist.length > 0) {
        const first = inWaitlist[0];
        promotedRegistration = {
          ...first,
          status: 'pending_confirmation',
          waitlistPosition: undefined,
          updatedAt: now,
        };

        await this.repo.saveRegistration(promotedRegistration);

        // Compact remaining waitlist
        const remaining = inWaitlist.slice(1).map((reg, idx) => ({
          ...reg,
          waitlistPosition: idx + 1,
          updatedAt: now,
        }));

        if (remaining.length > 0) {
          await this.repo.saveRegistrations(remaining);
        }
      }
    } else if (previousStatus === 'waitlisted') {
      // Compact waitlist
      const inWaitlist = this.getSortedWaitlist(
        currentList.filter((r) => r.id !== command.registrationId)
      );

      const reindexed = inWaitlist.map((reg, idx) => ({
        ...reg,
        waitlistPosition: idx + 1,
        updatedAt: now,
      }));

      if (reindexed.length > 0) {
        await this.repo.saveRegistrations(reindexed);
      }
    }

    return {
      cancelledRegistration,
      promotedRegistration,
    };
  }

  /**
   * Confirms a promoted player who was 'pending_confirmation' (Organizer action).
   * Moves to 'confirmed', retaining the seat already held.
   */
  async confirmPending(
    command: ConfirmPendingCommand
  ): Promise<Registration> {
    const event = await this.repo.findEventById(command.eventId);
    if (!event) {
      throw new EventNotFoundError(command.eventId);
    }

    const registration = await this.repo.findRegistrationById(
      command.registrationId
    );
    if (!registration || registration.eventId !== command.eventId) {
      throw new RegistrationNotFoundError(command.registrationId);
    }

    if (registration.status !== 'pending_confirmation') {
      throw new InvalidRegistrationStatusError(
        `Can only confirm a registration in pending_confirmation status (current status: ${registration.status})`
      );
    }

    const confirmed: Registration = {
      ...registration,
      status: 'confirmed',
      updatedAt: new Date(),
    };

    await this.repo.saveRegistration(confirmed);
    return confirmed;
  }

  /**
   * Rejects a player who was 'pending_confirmation' (Organizer action).
   * Moves to 'cancelled' (caused by Organizer), frees the seat, and atomic promotion
   * continues with the next player in the waitlist.
   */
  async rejectPending(
    command: RejectPendingCommand
  ): Promise<RejectResult> {
    const event = await this.repo.findEventById(command.eventId);
    if (!event) {
      throw new EventNotFoundError(command.eventId);
    }

    const registration = await this.repo.findRegistrationById(
      command.registrationId
    );
    if (!registration || registration.eventId !== command.eventId) {
      throw new RegistrationNotFoundError(command.registrationId);
    }

    if (registration.status !== 'pending_confirmation') {
      throw new InvalidRegistrationStatusError(
        `Can only reject a registration in pending_confirmation status (current status: ${registration.status})`
      );
    }

    // Cancelling with cancelledBy: 'organizer' frees the seat and promotes next
    const cancelResult = await this.cancelRegistration({
      eventId: command.eventId,
      registrationId: command.registrationId,
      cancelledBy: 'organizer',
    });

    return {
      rejectedRegistration: cancelResult.cancelledRegistration,
      promotedRegistration: cancelResult.promotedRegistration,
    };
  }

  /**
   * Reorders the waitlist (Organizer action).
   * The provided list of IDs must match all currently active waitlist registration IDs.
   */
  async reorderWaitlist(
    command: ReorderWaitlistCommand
  ): Promise<Registration[]> {
    const event = await this.repo.findEventById(command.eventId);
    if (!event) {
      throw new EventNotFoundError(command.eventId);
    }

    const all = await this.repo.listRegistrationsByEvent(command.eventId);
    const inWaitlist = all.filter((r) => r.status === 'waitlisted');

    const currentIds = new Set(inWaitlist.map((r) => r.id));
    const newIds = command.newOrderRegistrationIds;

    if (newIds.length !== currentIds.size) {
      throw new OperationNotAllowedError(
        `New order must contain exactly the ${currentIds.size} currently waitlisted players`
      );
    }

    const newSet = new Set(newIds);
    if (newSet.size !== newIds.length) {
      throw new OperationNotAllowedError('New order contains duplicate IDs');
    }

    for (const id of newIds) {
      if (!currentIds.has(id)) {
        throw new OperationNotAllowedError(
          `ID ${id} is not an active waitlist registration`
        );
      }
    }

    const waitlistMap = new Map(inWaitlist.map((r) => [r.id, r]));
    const now = new Date();

    const reordered: Registration[] = newIds.map((id, index) => {
      const reg = waitlistMap.get(id)!;
      return {
        ...reg,
        waitlistPosition: index + 1,
        updatedAt: now,
      };
    });

    await this.repo.saveRegistrations(reordered);
    return reordered;
  }

  /**
   * Returns the observable state of the event and registrations breakdown.
   */
  async getVisibleEventState(eventId: string): Promise<VisibleEventState> {
    const event = await this.repo.findEventById(eventId);
    if (!event) {
      throw new EventNotFoundError(eventId);
    }

    const registrations = await this.repo.listRegistrationsByEvent(eventId);

    const confirmed = registrations.filter((r) => r.status === 'confirmed');
    const pendingConfirmation = registrations.filter(
      (r) => r.status === 'pending_confirmation'
    );
    const waitlist = this.getSortedWaitlist(registrations);
    const cancelled = registrations.filter((r) => r.status === 'cancelled');

    const occupiedSeats = confirmed.length + pendingConfirmation.length;
    const freeSeats = Math.max(0, event.capacity - occupiedSeats);

    return {
      event,
      capacity: event.capacity,
      occupiedSeats,
      freeSeats,
      confirmed,
      pendingConfirmation,
      waitlist,
      cancelled,
    };
  }

  /**
   * Returns a sanitized public projection of an event for players.
   * Strips all phone numbers and raw estimated arrival times to guarantee privacy.
   */
  async getPublicEventView(slug: string): Promise<PublicEventView | null> {
    const event = await this.repo.findEventBySlug(slug);
    if (!event) return null;

    const registrations = await this.repo.listRegistrationsByEvent(event.id);

    const confirmedRegs = registrations.filter((r) => r.status === 'confirmed');
    const pendingConfirmation = registrations.filter(
      (r) => r.status === 'pending_confirmation'
    );
    const waitlistRegs = this.getSortedWaitlist(registrations);

    const occupiedSeats = confirmedRegs.length + pendingConfirmation.length;
    const freeSeats = Math.max(0, event.capacity - occupiedSeats);

    const confirmed: PublicPlayerItem[] = confirmedRegs.map((r) => ({
      id: r.id,
      nickname: r.nickname,
      lateArrival: r.lateArrival,
    }));

    const waitlist: PublicWaitlistItem[] = waitlistRegs.map((r) => ({
      id: r.id,
      nickname: r.nickname,
      lateArrival: r.lateArrival,
      waitlistPosition: r.waitlistPosition ?? 1,
    }));

    return {
      id: event.id,
      slug: event.slug,
      type: event.type,
      date: event.date,
      time: event.time,
      capacity: event.capacity,
      note: event.note,
      allowWaitlist: event.allowWaitlist,
      status: event.status,
      occupiedSeats,
      freeSeats,
      confirmed,
      waitlist,
    };
  }

  /**
   * Finds the active (non-cancelled) registration for a player given their phone number.
   * Returns null if no active registration exists for this event and phone.
   */
  async getActiveRegistrationByPhone(
    eventId: string,
    phone: string
  ): Promise<Registration | null> {
    try {
      const normalizedPhone = normalizePhone(phone);
      const allRegistrations = await this.repo.listRegistrationsByEvent(eventId);
      const active = allRegistrations.find(
        (reg) => reg.phone === normalizedPhone && reg.status !== 'cancelled'
      );
      return active || null;
    } catch {
      return null;
    }
  }

  async editEvent(command: EditEventCommand): Promise<Event> {
    const event = await this.repo.findEventById(command.eventId);
    if (!event) throw new EventNotFoundError(command.eventId);
    if (event.status === 'cancelled') throw new OperationNotAllowedError('Cannot edit a cancelled event');

    const updatedEvent: Event = { ...event };
    if (command.type !== undefined) updatedEvent.type = command.type;
    if (command.date !== undefined) updatedEvent.date = command.date;
    if (command.time !== undefined) updatedEvent.time = command.time;
    if (command.note !== undefined) updatedEvent.note = command.note;
    if (command.allowWaitlist !== undefined) updatedEvent.allowWaitlist = command.allowWaitlist;

    if (command.capacity !== undefined && command.capacity !== event.capacity) {
      updatedEvent.capacity = command.capacity;
      const allRegs = await this.repo.listRegistrationsByEvent(command.eventId);
      
      const occupied = allRegs.filter(r => r.status === 'confirmed' || r.status === 'pending_confirmation')
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      const waitlist = this.getSortedWaitlist(allRegs);
      
      if (command.capacity < event.capacity) {
        // Reduced capacity
        if (occupied.length > command.capacity) {
          const displaced = occupied.slice(command.capacity);
          const now = new Date();
          
          for (let i = 0; i < displaced.length; i++) {
            displaced[i].status = 'waitlisted';
            displaced[i].waitlistPosition = i + 1;
            displaced[i].updatedAt = now;
          }
          
          for (let i = 0; i < waitlist.length; i++) {
            waitlist[i].waitlistPosition = displaced.length + i + 1;
            waitlist[i].updatedAt = now;
          }
          
          await this.repo.saveRegistrations([...displaced, ...waitlist]);
        }
      } else {
        // Increased capacity
        const freeSeats = Math.max(0, command.capacity - occupied.length);
        const toPromoteCount = Math.min(freeSeats, waitlist.length);
        
        if (toPromoteCount > 0) {
          const promoted = waitlist.slice(0, toPromoteCount);
          const remaining = waitlist.slice(toPromoteCount);
          const now = new Date();
          
          for (let i = 0; i < promoted.length; i++) {
            promoted[i].status = 'pending_confirmation';
            promoted[i].waitlistPosition = undefined;
            promoted[i].updatedAt = now;
          }
          
          for (let i = 0; i < remaining.length; i++) {
            remaining[i].waitlistPosition = i + 1;
            remaining[i].updatedAt = now;
          }
          
          await this.repo.saveRegistrations([...promoted, ...remaining]);
        }
      }
    }
    
    await this.repo.saveEvent(updatedEvent);
    return updatedEvent;
  }

  async cancelEvent(command: CancelEventCommand): Promise<Event> {
    const event = await this.repo.findEventById(command.eventId);
    if (!event) throw new EventNotFoundError(command.eventId);
    if (event.status === 'cancelled') return event;

    const allRegs = await this.repo.listRegistrationsByEvent(command.eventId);
    const active = allRegs.filter(r => r.status !== 'cancelled');
    const now = new Date();

    for (const reg of active) {
      reg.status = 'cancelled';
      reg.cancelledBy = 'organizer';
      reg.waitlistPosition = undefined;
      reg.updatedAt = now;
    }
    
    if (active.length > 0) {
      await this.repo.saveRegistrations(active);
    }

    event.status = 'cancelled';
    await this.repo.saveEvent(event);
    return event;
  }

  async editRegistration(command: EditRegistrationCommand): Promise<Registration> {
    const reg = await this.repo.findRegistrationById(command.registrationId);
    if (!reg || reg.eventId !== command.eventId) {
      throw new RegistrationNotFoundError(command.registrationId);
    }
    if (reg.status === 'cancelled') {
      throw new OperationNotAllowedError('Cannot edit a cancelled registration');
    }

    if (command.nickname !== undefined) {
      const clean = command.nickname.trim();
      if (!clean) throw new InvalidRegistrationDataError('Nickname cannot be empty');
      reg.nickname = clean;
    }
    if (command.lateArrival !== undefined) {
      reg.lateArrival = command.lateArrival;
      if (reg.lateArrival) {
        if (!command.estimatedArrivalTime || !command.estimatedArrivalTime.trim()) {
          throw new InvalidRegistrationDataError('Estimated arrival time required for late arrival');
        }
        reg.estimatedArrivalTime = command.estimatedArrivalTime.trim();
      } else {
        reg.estimatedArrivalTime = undefined;
      }
    }

    reg.updatedAt = new Date();
    await this.repo.saveRegistration(reg);
    return reg;
  }

  async generateWhatsAppText(command: GenerateWhatsAppTextCommand): Promise<string> {
    const state = await this.getVisibleEventState(command.eventId);
    
    let text = `*Event: ${state.event.slug}*\n`;
    text += `*Type:* ${state.event.type === 'cash' ? 'Cash Game' : 'Tournament'}\n`;
    text += `*Date:* ${state.event.date} at ${state.event.time}\n\n`;
    
    text += `*Confirmed (${state.confirmed.length}/${state.capacity}):*\n`;
    state.confirmed.forEach((r, idx) => {
      text += `${idx + 1}. ${r.nickname}${r.lateArrival ? ` (Late: ${r.estimatedArrivalTime})` : ''}\n`;
    });
    
    if (state.pendingConfirmation.length > 0) {
      text += `\n*Pending Confirmation:*\n`;
      state.pendingConfirmation.forEach((r, idx) => {
        text += `${idx + 1}. ${r.nickname}\n`;
      });
    }

    if (state.waitlist.length > 0) {
      text += `\n*Waitlist:*\n`;
      state.waitlist.forEach((r) => {
        text += `${r.waitlistPosition}. ${r.nickname}\n`;
      });
    }
    
    return text;
  }

  private getSortedWaitlist(registrations: Registration[]): Registration[] {
    return registrations
      .filter((r) => r.status === 'waitlisted')
      .sort((a, b) => (a.waitlistPosition ?? 0) - (b.waitlistPosition ?? 0));
  }
}
