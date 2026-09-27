"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SupabaseEventRepository } from "@/domain/supabase-event-repository";
import { RegistrationDomain } from "@/domain/registration-domain";
import {
  createOrganizerActionsHandler,
  CreateEventInput,
  EditEventInput,
  CreateEventActionResult,
  EditEventActionResult,
  CancelEventActionResult,
  GetOrganizerEventsActionResult,
  GetWhatsAppTextActionResult,
  GetEventLiveStateActionResult,
  OrganizerEventCardData,
} from "./actions-handler";

export type {
  CreateEventInput,
  EditEventInput,
  OrganizerEventCardData,
  CreateEventActionResult,
  EditEventActionResult,
  CancelEventActionResult,
  GetOrganizerEventsActionResult,
  GetWhatsAppTextActionResult,
  GetEventLiveStateActionResult,
};

export type SeedEventResult =
  | { success: true; slug: string; url: string }
  | { success: false; error: string };

async function getHandler() {
  const supabase = await createSupabaseServerClient();
  const repo = new SupabaseEventRepository(supabase);
  const domain = new RegistrationDomain(repo);

  const getUserId = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user ? user.id : null;
  };

  return createOrganizerActionsHandler(domain, getUserId, repo);
}

export async function createOrganizerEventAction(
  input: CreateEventInput
): Promise<CreateEventActionResult> {
  const handler = await getHandler();
  const res = await handler.createEvent(input);
  if (res.success) {
    revalidatePath("/panel");
  }
  return res;
}

export async function editOrganizerEventAction(
  input: EditEventInput
): Promise<EditEventActionResult> {
  const handler = await getHandler();
  const res = await handler.editEvent(input);
  if (res.success) {
    revalidatePath("/panel");
    revalidatePath(`/p/${res.event.slug}`);
  }
  return res;
}

export async function cancelOrganizerEventAction(
  eventId: string
): Promise<CancelEventActionResult> {
  const handler = await getHandler();
  const res = await handler.cancelEvent(eventId);
  if (res.success) {
    revalidatePath("/panel");
    revalidatePath(`/p/${res.event.slug}`);
  }
  return res;
}

export async function getOrganizerEventsAction(): Promise<GetOrganizerEventsActionResult> {
  const handler = await getHandler();
  return handler.getOrganizerEvents();
}

export async function getWhatsAppTextAction(
  eventId: string,
  baseUrl?: string
): Promise<GetWhatsAppTextActionResult> {
  const handler = await getHandler();
  return handler.getWhatsAppText(eventId, baseUrl);
}

export async function getEventLiveStateAction(
  eventId: string
): Promise<GetEventLiveStateActionResult> {
  const handler = await getHandler();
  return handler.getEventLiveState(eventId);
}

export async function seedTestEventAction(): Promise<SeedEventResult> {
  const handler = await getHandler();
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");

  const res = await handler.createEvent({
    type: "cash",
    date: `${yyyy}-${mm}-${dd}`,
    time: "21:00",
    capacity: 6,
    note: "Partida de ensayo para probar el flujo de jugador de punta a punta",
    allowWaitlist: true,
  });

  if (res.success) {
    revalidatePath("/panel");
    return {
      success: true,
      slug: res.event.slug,
      url: `/p/${res.event.slug}`,
    };
  }

  return { success: false, error: res.error };
}
