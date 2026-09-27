export type Database = {
  public: {
    // Se regenerará con el esquema real en el hito de persistencia (ticket 04):
    // supabase gen types typescript --schema public > src/lib/supabase/database.types.ts
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
