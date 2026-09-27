# 08: Panel III — gestionar Inscripciones y Cupo

**What to build:** Las palancas del Organizador en la UI (ya existentes en el dominio de 02/03): resolver Pendientes de confirmación, alta manual, reordenar la espera, editar/cancelar Inscripciones y jugar con el Cupo, con las reacciones en cadena visibles en el panel en vivo. Es la pieza que completa el MVP.

**Blocked by:** 07

**Status:** ready-for-human

- [x] Confirmar / rechazar Pendientes de confirmación; el rechazo hace que la Promoción continúe con el siguiente según el orden vigente (visible en vivo)
- [x] Alta manual con teléfono obligatorio y misma mecánica que por Enlace (Cupo libre → Confirmado; lleno → final de la espera)
- [x] Reordenar la Lista de espera (arrastrar; afecta la siguiente Promoción)
- [x] Editar datos de Inscripción (apodo, Llegada tardía + hora)
- [x] Cancelar Inscripción individual con atribución (Organizador) y Promoción si procede
- [x] Cambio de Cupo en vivo: reducir → desplazados al PRINCIPIO de la espera; ampliar → Promociones en cascada visibles
- [x] El panel lista los próximos/pasadas con el roster completo de cada Evento

## Comments

**2026-09-27 (agente):** Implementado el Panel III (gestión completa de inscripciones y cupo en vivo) completando el MVP:
- `actions-handler.ts` & `actions.ts`: Añadidas las acciones del organizador (`confirmPendingAction`, `rejectPendingAction`, `manualRegisterAction`, `reorderWaitlistAction`, `editRegistrationAction`, `cancelRegistrationAction`, `updateCapacityAction`) con verificación estricta de propiedad/auth y revalidación de rutas.
- Inclusión del roster completo (`roster`) en los listados de eventos próximos y pasados de `OrganizerEventCardData`.
- `organizer-dashboard.tsx`: Desplegable interactivo de roster completo por evento tanto en pestaña "Próximos Eventos" como en "Pasadas e Historial", con desglose de confirmados, pendientes, cola de espera y cancelados.
- `live-roster-view.tsx`:
  - Resolución de pendientes de confirmación (botones Confirmar y Rechazar con promoción en cascada del siguiente).
  - Modal de alta manual con teléfono obligatorio y validación.
  - Reordenación de lista de espera mediante drag & drop HTML5 y botones accesibles (afecta inmediatamente al orden de promoción).
  - Modal de edición de inscripciones activas (apodo, llegada tardía + hora).
  - Cancelación individual con atribución `organizer` y promoción automática si procede.
  - Control de cupo en vivo (+/- y modal) con advertencia de desplazamiento al principio de la espera al reducir y promociones en cascada al ampliar.
- Suite de tests unitarios ampliada a 81 tests en verde, typecheck y linter 100% limpios y build de Next.js verificado.

