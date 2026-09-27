# 03: Dominio — operaciones del Organizador + texto WhatsApp

**What to build:** Las palancas del Organizador como operaciones del dominio, con sus reglas de reacción más finas, y la plantilla de WhatsApp. Verde con tests que prueban cada reacción en cadena (desplazados, cascada, baja en masa). Demoable vía tests: reducir/ ampliar Cupo y cancelar Evento producen exactamente los estados acordados.

**Blocked by:** 02

**Status:** ready-for-agent

- [x] Crear/editar Evento: tipo Cash/Torneo, fecha/hora, Cupo, nota, toggle de Lista de espera
- [x] Reducir Cupo por debajo de los Confirmados: los desplazados van al PRINCIPIO de la Lista de espera conservando su orden relativo (y entran como lo hagan según reglas de 02)
- [x] Ampliar Cupo: N Promociones en cascada hasta rellenar las Plazas liberadas o vaciar la cola
- [x] Cancelar Evento: baja en masa — todas las Inscripciones activas → Cancelado (provocada por el Organizador); el Evento queda en estado terminal, no reactivable
- [x] Alta manual por el Organizador (teléfono obligatorio, misma mecánica que por Enlace)
- [x] Edición de datos de la Inscripción (apodo, Llegada tardía + hora) solo por el Organizador
- [x] Cancelación de Inscripción individual por el Organizador
- [x] Texto de WhatsApp como función pura del dominio, con formato para Cash y Torneo, probado en el mismo seam
- [x] Tests de comportamiento vía el mismo seam de 02 (sin mencionar almacenamiento ni UI)

