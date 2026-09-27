# 05: Flujo del Jugador end-to-end (Enlace público)

**What to build:** Primera demo real de punta a punta: un Jugador abre el Enlace de un Evento en su móvil y se apunta en segundos, ve el roster público y su estado, y se cancela/reapunta. Página pública con Realtime. Incluye una vía mínima interna (solo para pruebas) de crear el Evento de ensayo antes de que exista el panel.

**Blocked by:** 04

**Status:** ready-for-agent

- [x] Página pública por slug: detalle del Evento (tipo, fecha, hora, nota, Plazas ocupadas/total) y roster por apodos con indicador "llegará tarde" sin hora y puestos de la Lista de espera
- [x] Alta: apodo + teléfono, eligiendo "desde el inicio" o "Llegaré más tarde" (hora obligatoria)
- [x] Confirmación inmediata del resultado con el estado resultante (Confirmado / puesto #N en espera / Evento completo)
- [x] Duplicado con el mismo teléfono muestra la Inscripción existente ("ya estás apuntado")
- [x] Acceso a la propia Inscripción con el teléfono de registro; cancelarse autogestionado y Reinscripción funcionando
- [x] Página y altas en vivo vía Realtime (sin refrescar)
- [x] Privacidad pública garantizada: nunca aparecen teléfonos
- [x] Vía interna mínima para sembrar un Evento de prueba (temporal hasta el panel de 06)
