export const env = {
  get supabaseUrl(): string {
    const value = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!value) {
      throw new Error(
        "Falta la variable de entorno NEXT_PUBLIC_SUPABASE_URL. Copia .env.example a .env.local y rellena los valores de tu proyecto de Supabase.",
      );
    }
    return value;
  },
  get supabaseAnonKey(): string {
    const value =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!value) {
      throw new Error(
        "Falta la clave pública de Supabase (NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY o NEXT_PUBLIC_SUPABASE_ANON_KEY). Copia .env.example a .env.local y rellena los valores de tu proyecto de Supabase.",
      );
    }
    return value;
  },
} as const;

