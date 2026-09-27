-- Create tables
CREATE TABLE events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id uuid NOT NULL REFERENCES auth.users(id),
  slug text NOT NULL UNIQUE,
  type text NOT NULL CHECK (type IN ('cash', 'tournament')),
  date date NOT NULL,
  time time NOT NULL,
  capacity int NOT NULL,
  note text,
  allow_waitlist boolean NOT NULL,
  status text NOT NULL CHECK (status IN ('active', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES players(id),
  nickname text NOT NULL,
  status text NOT NULL CHECK (status IN ('confirmed', 'pending_confirmation', 'waitlisted', 'cancelled')),
  late_arrival boolean NOT NULL DEFAULT false,
  estimated_arrival_time text,
  cancelled_by text CHECK (cancelled_by IN ('player', 'organizer')),
  waitlist_position int,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Partial unique index reinforces one active registration per (Event, Player)
CREATE UNIQUE INDEX active_registration_idx ON registrations (event_id, player_id) WHERE status != 'cancelled';

-- RLS setup
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE registrations ENABLE ROW LEVEL SECURITY;

-- events policies
CREATE POLICY "Public read access to events" ON events FOR SELECT USING (true);
CREATE POLICY "Organizer full access to events" ON events FOR ALL USING (auth.uid() = organizer_id);

-- players policies
CREATE POLICY "Public read access to players" ON players FOR SELECT USING (true);
CREATE POLICY "Public insert access to players" ON players FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update access to players" ON players FOR UPDATE USING (true);

-- registrations policies
CREATE POLICY "Public read access to registrations" ON registrations FOR SELECT USING (true);
CREATE POLICY "Public insert access to registrations" ON registrations FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update access to registrations" ON registrations FOR UPDATE USING (true);
CREATE POLICY "Organizer full access to registrations" ON registrations FOR ALL USING (
  EXISTS (
    SELECT 1 FROM events WHERE events.id = registrations.event_id AND events.organizer_id = auth.uid()
  )
);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE events;
ALTER PUBLICATION supabase_realtime ADD TABLE registrations;

