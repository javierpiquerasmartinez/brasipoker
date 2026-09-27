export type Database = {
  public: {
    Tables: {
      events: {
        Row: {
          id: string;
          organizer_id: string;
          slug: string;
          type: 'cash' | 'tournament';
          date: string;
          time: string;
          capacity: number;
          note: string | null;
          allow_waitlist: boolean;
          status: 'active' | 'cancelled';
          created_at: string;
        };
        Insert: {
          id?: string;
          organizer_id: string;
          slug: string;
          type: 'cash' | 'tournament';
          date: string;
          time: string;
          capacity: number;
          note?: string | null;
          allow_waitlist: boolean;
          status?: 'active' | 'cancelled';
          created_at?: string;
        };
        Update: {
          id?: string;
          organizer_id?: string;
          slug?: string;
          type?: 'cash' | 'tournament';
          date?: string;
          time?: string;
          capacity?: number;
          note?: string | null;
          allow_waitlist?: boolean;
          status?: 'active' | 'cancelled';
          created_at?: string;
        };
        Relationships: [];
      };
      players: {
        Row: {
          id: string;
          phone: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          phone: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          phone?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      registrations: {
        Row: {
          id: string;
          event_id: string;
          player_id: string;
          nickname: string;
          status: 'confirmed' | 'pending_confirmation' | 'waitlisted' | 'cancelled';
          late_arrival: boolean;
          estimated_arrival_time: string | null;
          cancelled_by: 'player' | 'organizer' | null;
          waitlist_position: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          player_id: string;
          nickname: string;
          status?: 'confirmed' | 'pending_confirmation' | 'waitlisted' | 'cancelled';
          late_arrival?: boolean;
          estimated_arrival_time?: string | null;
          cancelled_by?: 'player' | 'organizer' | null;
          waitlist_position?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          player_id?: string;
          nickname?: string;
          status?: 'confirmed' | 'pending_confirmation' | 'waitlisted' | 'cancelled';
          late_arrival?: boolean;
          estimated_arrival_time?: string | null;
          cancelled_by?: 'player' | 'organizer' | null;
          waitlist_position?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "registrations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registrations_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          }
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
