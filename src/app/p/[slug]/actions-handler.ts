import { RegistrationDomain } from '@/domain/registration-domain';
import { PublicEventView, RegistrationStatus } from '@/domain/types';

export interface RegisterPlayerInput {
  nickname: string;
  phone: string;
  lateArrival: boolean;
  estimatedArrivalTime?: string;
}

export interface PlayerActionResult {
  type: 'confirmed' | 'waitlisted' | 'event_full' | 'already_registered';
  position?: number;
  duplicate?: boolean;
  registration?: {
    id: string;
    nickname: string;
    status: RegistrationStatus;
    lateArrival: boolean;
    estimatedArrivalTime?: string;
    waitlistPosition?: number;
  };
}

export function createPlayerActionsHandler(domain: RegistrationDomain) {
  return {
    async getPublicEvent(slug: string): Promise<
      { success: true; data: PublicEventView } | { success: false; error: string }
    > {
      const event = await domain.getPublicEventView(slug);
      if (!event) {
        return { success: false, error: 'Evento no encontrado' };
      }
      return { success: true, data: event };
    },

    async registerPlayer(
      slug: string,
      input: RegisterPlayerInput
    ): Promise<
      { success: true; result: PlayerActionResult } | { success: false; error: string }
    > {
      const publicView = await domain.getPublicEventView(slug);
      if (!publicView) {
        return { success: false, error: 'Evento no encontrado' };
      }
      if (publicView.status === 'cancelled') {
        return { success: false, error: 'Este evento ha sido cancelado y no acepta inscripciones' };
      }

      const nickname = (input.nickname || '').trim();
      if (!nickname) {
        return { success: false, error: 'El apodo o nombre es obligatorio' };
      }

      const phone = (input.phone || '').trim();
      if (!phone) {
        return { success: false, error: 'El número de teléfono es obligatorio' };
      }

      if (input.lateArrival && (!input.estimatedArrivalTime || !input.estimatedArrivalTime.trim())) {
        return { success: false, error: 'Indica la hora estimada si vas a llegar tarde' };
      }

      try {
        const result = await domain.registerPlayer({
          eventId: publicView.id,
          phone,
          nickname,
          lateArrival: input.lateArrival,
          estimatedArrivalTime: input.lateArrival ? input.estimatedArrivalTime?.trim() : undefined,
        });

        if (result.type === 'event_full') {
          return {
            success: true,
            result: { type: 'event_full' },
          };
        }

        if (result.type === 'already_registered') {
          return {
            success: true,
            result: {
              type: 'already_registered',
              duplicate: true,
              registration: {
                id: result.registration.id,
                nickname: result.registration.nickname,
                status: result.registration.status,
                lateArrival: result.registration.lateArrival,
                estimatedArrivalTime: result.registration.estimatedArrivalTime,
                waitlistPosition: result.registration.waitlistPosition,
              },
            },
          };
        }

        if (result.type === 'waitlisted') {
          return {
            success: true,
            result: {
              type: 'waitlisted',
              position: result.position,
              duplicate: false,
              registration: {
                id: result.registration.id,
                nickname: result.registration.nickname,
                status: result.registration.status,
                lateArrival: result.registration.lateArrival,
                estimatedArrivalTime: result.registration.estimatedArrivalTime,
                waitlistPosition: result.position,
              },
            },
          };
        }

        return {
          success: true,
          result: {
            type: 'confirmed',
            duplicate: false,
            registration: {
              id: result.registration.id,
              nickname: result.registration.nickname,
              status: result.registration.status,
              lateArrival: result.registration.lateArrival,
              estimatedArrivalTime: result.registration.estimatedArrivalTime,
            },
          },
        };
      } catch (err: unknown) {
        let msg = err instanceof Error ? err.message : 'Error al registrar jugador';
        if (msg.includes('is not valid') || msg.includes('Spanish number')) {
          msg = 'El número de teléfono no es válido (debe tener 9 dígitos españoles).';
        }
        return { success: false, error: msg };
      }
    },

    async checkMyRegistration(
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
      const publicView = await domain.getPublicEventView(slug);
      if (!publicView) {
        return { success: false, error: 'Evento no encontrado' };
      }

      const active = await domain.getActiveRegistrationByPhone(publicView.id, phone);
      if (!active) {
        return { success: true, found: false };
      }

      return {
        success: true,
        found: true,
        registration: {
          id: active.id,
          nickname: active.nickname,
          status: active.status,
          lateArrival: active.lateArrival,
          estimatedArrivalTime: active.estimatedArrivalTime,
          waitlistPosition: active.waitlistPosition,
        },
      };
    },

    async cancelMyRegistration(
      slug: string,
      registrationId: string,
      phone: string
    ): Promise<{ success: true } | { success: false; error: string }> {
      const publicView = await domain.getPublicEventView(slug);
      if (!publicView) {
        return { success: false, error: 'Evento no encontrado' };
      }

      // Verify that this registration belongs to this event and phone
      const active = await domain.getActiveRegistrationByPhone(publicView.id, phone);
      if (!active || active.id !== registrationId) {
        return { success: false, error: 'Inscripción no encontrada para este teléfono' };
      }

      try {
        await domain.cancelRegistration({
          eventId: publicView.id,
          registrationId,
          cancelledBy: 'player',
        });
        return { success: true };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Error al cancelar inscripción';
        return { success: false, error: msg };
      }
    },
  };
}
