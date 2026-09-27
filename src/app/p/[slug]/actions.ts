"use server";

import { getServerRegistrationDomain } from "@/lib/server-domain";
import {
  createPlayerActionsHandler,
  RegisterPlayerInput,
  PlayerActionResult,
} from "./actions-handler";
import { PublicEventView, RegistrationStatus } from "@/domain/types";

export async function getPublicEventAction(
  slug: string
): Promise<{ success: true; data: PublicEventView } | { success: false; error: string }> {
  const domain = await getServerRegistrationDomain();
  const handler = createPlayerActionsHandler(domain);
  return handler.getPublicEvent(slug);
}

export async function registerPlayerAction(
  slug: string,
  input: RegisterPlayerInput
): Promise<{ success: true; result: PlayerActionResult } | { success: false; error: string }> {
  const domain = await getServerRegistrationDomain();
  const handler = createPlayerActionsHandler(domain);
  return handler.registerPlayer(slug, input);
}

export async function checkMyRegistrationAction(
  slug: string,
  phone: string
): Promise<
  | {
      success: true;
      found: boolean;
      registration?: {
        id: string;
        nickname: string;
        status: RegistrationStatus;
        lateArrival: boolean;
        estimatedArrivalTime?: string;
        waitlistPosition?: number;
      };
    }
  | { success: false; error: string }
> {
  const domain = await getServerRegistrationDomain();
  const handler = createPlayerActionsHandler(domain);
  return handler.checkMyRegistration(slug, phone);
}

export async function cancelMyRegistrationAction(
  slug: string,
  registrationId: string,
  phone: string
): Promise<{ success: true } | { success: false; error: string }> {
  const domain = await getServerRegistrationDomain();
  const handler = createPlayerActionsHandler(domain);
  return handler.cancelMyRegistration(slug, registrationId, phone);
}
