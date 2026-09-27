# 02: Dominio — máquina de Inscripciones y Promoción

**What to build:** El corazón del producto: el módulo de dominio puro (sin Supabase ni React) con el estado del Evento y el ciclo de vida completo de la Inscripción, diferenciando alta directa (con Cupo → Confirmado) de Promoción (Pendiente de confirmación). Demoable vía tests: verde una suite que documenta cada regla del grilling contra el repositorio en memoria.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Interfaz pública del dominio con las operaciones de ambos actores, y puerto de repositorio con adaptador en memoria
- [ ] Alta directa: con Plaza libre → Confirmado ocupando Plaza; Llegada tardía (hora obligatoria) registrada sin alterar el efecto sobre el Cupo
- [ ] Con Cupo agotado → entra al final de la Lista de espera con posición
- [ ] Con espera desactivada y Cupo lleno → "Evento completo" (no entra en cola)
- [ ] Deduplicación: máx. una Inscripción activa por teléfono/Evento; duplicado devuelve la existente
- [ ] Cancelación de Jugador u Organizador con atribución "quién la provocó"
- [ ] Reinscripción tras cancelar: nueva Inscripción, al final de la espera si está lleno
- [ ] Promoción atómica (ADR-0003): al liberarse Plaza el primero pasa a Pendiente de confirmación ocupando su Plaza en el mismo instante
- [ ] Confirmar pendiente → Confirmado; rechazar → Cancelado (Organizador) y la Promoción continúa con el siguiente según el orden vigente
- [ ] Reordenación de la Lista de espera solo por el Organizador; Confirmados es conjunto sin orden
- [ ] Tests de comportamiento en el seam de dominio (estados visibles y conteo de Plazas, nunca detalle interno)
