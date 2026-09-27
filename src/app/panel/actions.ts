"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SupabaseEventRepository } from "@/domain/supabase-event-repository";
import { Event } from "@/domain/types";

export type SeedEventResult =
  | { success: true; slug: string; url: string }
  | { success: false; error: string };

export async function seedTestEventAction(): Promise<SeedEventResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Debes iniciar sesión como organizador para sembrar un evento" };
  }

  const randomSuffix = Math.random().toString(36).substring(2, 7);
  const slug = `ensayo-${randomSuffix}`;

  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");

  const event: Event = {
    id: crypto.randomUUID(),
    organizerId: user.id,
    slug,
    type: "cash",
    date: `${yyyy}-${mm}-${dd}`,
    time: "21:00",
    capacity: 6,
    note: "Partida de ensayo para probar el flujo de jugador de punta a punta",
    allowWaitlist: true,
    status: "active",
    createdAt: new Date(),
  };

  try {
    const repo = new SupabaseEventRepository(supabase);
    await repo.saveEvent(event);
    return { success: true, slug, url: `/p/${slug}` };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error al sembrar evento";
    return { success: false, error: message };
  }
}
