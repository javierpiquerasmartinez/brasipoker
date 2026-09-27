import { SupabaseClient } from '@supabase/supabase-js';
import { EventRepository } from './event-repository';
import { Event, Registration } from './types';
import { Database } from '../lib/supabase/database.types';

type DbEvent = Database['public']['Tables']['events']['Row'];
type DbRegistration = Database['public']['Tables']['registrations']['Row'];
type DbPlayer = Database['public']['Tables']['players']['Row'];

export class SupabaseEventRepository implements EventRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  private mapEvent(row: DbEvent): Event {
    return {
      id: row.id,
      organizerId: row.organizer_id,
      slug: row.slug,
      type: row.type,
      date: row.date,
      time: row.time.slice(0, 5), // 'HH:mm:ss' to 'HH:mm'
      capacity: row.capacity,
      note: row.note || undefined,
      allowWaitlist: row.allow_waitlist,
      status: row.status,
      createdAt: new Date(row.created_at),
    };
  }

  private mapRegistration(
    row: DbRegistration,
    playerPhone: string
  ): Registration {
    return {
      id: row.id,
      eventId: row.event_id,
      phone: playerPhone,
      nickname: row.nickname,
      status: row.status,
      lateArrival: row.late_arrival,
      estimatedArrivalTime: row.estimated_arrival_time || undefined,
      cancelledBy: row.cancelled_by || undefined,
      waitlistPosition: row.waitlist_position || undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  async findEventById(id: string): Promise<Event | null> {
    const { data, error } = await this.supabase
      .from('events')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return this.mapEvent(data);
  }

  async findEventBySlug(slug: string): Promise<Event | null> {
    const { data, error } = await this.supabase
      .from('events')
      .select('*')
      .eq('slug', slug)
      .single();

    if (error || !data) return null;
    return this.mapEvent(data);
  }

  async saveEvent(event: Event): Promise<void> {
    const { error } = await this.supabase
      .from('events')
      .upsert({
        id: event.id,
        organizer_id: event.organizerId,
        slug: event.slug,
        type: event.type,
        date: event.date,
        time: `${event.time}:00`, // 'HH:mm' to 'HH:mm:ss'
        capacity: event.capacity,
        note: event.note || null,
        allow_waitlist: event.allowWaitlist,
        status: event.status,
        created_at: event.createdAt.toISOString(),
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to save event: ${error.message}`);
  }

  async listRegistrationsByEvent(eventId: string): Promise<Registration[]> {
    const { data, error } = await this.supabase
      .from('registrations')
      .select(`
        *,
        players (
          phone
        )
      `)
      .eq('event_id', eventId);

    if (error) throw new Error(`Failed to list registrations: ${error.message}`);
    
    return (data || []).map((row) => 
      this.mapRegistration(row, (row.players as any).phone)
    );
  }

  async findRegistrationById(id: string): Promise<Registration | null> {
    const { data, error } = await this.supabase
      .from('registrations')
      .select(`
        *,
        players (
          phone
        )
      `)
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return this.mapRegistration(data, (data.players as any).phone);
  }

  async saveRegistration(registration: Registration): Promise<void> {
    // 1. Ensure player exists
    const { data: player, error: playerError } = await this.supabase
      .from('players')
      .select('id')
      .eq('phone', registration.phone)
      .maybeSingle();

    let playerId = player?.id;

    if (!playerId) {
      const { data: newPlayer, error: newPlayerError } = await this.supabase
        .from('players')
        .insert({ phone: registration.phone })
        .select('id')
        .single();

      if (newPlayerError) {
        throw new Error(`Failed to create player: ${newPlayerError.message}`);
      }
      playerId = newPlayer.id;
    }

    // 2. Upsert registration
    const { error } = await this.supabase
      .from('registrations')
      .upsert({
        id: registration.id,
        event_id: registration.eventId,
        player_id: playerId,
        nickname: registration.nickname,
        status: registration.status,
        late_arrival: registration.lateArrival,
        estimated_arrival_time: registration.estimatedArrivalTime || null,
        cancelled_by: registration.cancelledBy || null,
        waitlist_position: registration.waitlistPosition || null,
        created_at: registration.createdAt.toISOString(),
        updated_at: registration.updatedAt.toISOString(),
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to save registration: ${error.message}`);
  }

  async saveRegistrations(registrations: Registration[]): Promise<void> {
    if (registrations.length === 0) return;

    // Fast path: map all players first
    const phones = [...new Set(registrations.map(r => r.phone))];
    const { data: existingPlayers, error: playersError } = await this.supabase
      .from('players')
      .select('id, phone')
      .in('phone', phones);

    if (playersError) throw new Error(`Failed to fetch players: ${playersError.message}`);

    const playerMap = new Map<string, string>();
    existingPlayers?.forEach(p => playerMap.set(p.phone, p.id));

    const missingPhones = phones.filter(p => !playerMap.has(p));
    if (missingPhones.length > 0) {
      const { data: newPlayers, error: insertError } = await this.supabase
        .from('players')
        .insert(missingPhones.map(phone => ({ phone })))
        .select('id, phone');
      
      if (insertError) throw new Error(`Failed to insert players: ${insertError.message}`);
      newPlayers?.forEach(p => playerMap.set(p.phone, p.id));
    }

    const payload = registrations.map(reg => ({
      id: reg.id,
      event_id: reg.eventId,
      player_id: playerMap.get(reg.phone)!,
      nickname: reg.nickname,
      status: reg.status,
      late_arrival: reg.lateArrival,
      estimated_arrival_time: reg.estimatedArrivalTime || null,
      cancelled_by: reg.cancelledBy || null,
      waitlist_position: reg.waitlistPosition || null,
      created_at: reg.createdAt.toISOString(),
      updated_at: reg.updatedAt.toISOString(),
    }));

    const { error } = await this.supabase
      .from('registrations')
      .upsert(payload);

    if (error) throw new Error(`Failed to save registrations: ${error.message}`);
  }
}
