# 02: Dominio — máquina de Inscripciones y Promoción

**What to build:** El corazón del producto: el módulo de dominio puro (sin Supabase ni React) con el estado del Evento y el ciclo de vida completo de la Inscripción, diferenciando alta directa (con Cupo → Confirmado) de Promoción (Pendiente de confirmación). Demoable vía tests: verde una suite que documenta cada regla del grilling contra el repositorio en memoria.

**Blocked by:** 01

**Status:** resolved

- [x] Interfaz pública del dominio con las operaciones de ambos actores, y puerto de repositorio con adaptador en memoria
- [x] Alta directa: con Plaza libre → Confirmado ocupando Plaza; Llegada tardía (hora obligatoria) registrada sin alterar el efecto sobre el Cupo
- [x] Con Cupo agotado → entra al final de la Lista de espera con posición
- [x] Con espera desactivada y Cupo lleno → "Evento completo" (no entra en cola)
- [x] Deduplicación: máx. una Inscripción activa por teléfono/Evento; duplicado devuelve la existente
- [x] Cancelación de Jugador u Organizador con atribución "quién la provocó"
- [x] Reinscripción tras cancelar: nueva Inscripción, al final de la espera si está lleno
- [x] Promoción atómica (ADR-0003): al liberarse Plaza el primero pasa a Pendiente de confirmación ocupando su Plaza en el mismo instante
- [x] Confirmar pendiente → Confirmado; rechazar → Cancelado (Organizador) y la Promoción continúa con el siguiente según el orden vigente
- [x] Reordenación de la Lista de espera solo por el Organizador; Confirmados es conjunto sin orden
- [x] Tests de comportamiento en el seam de dominio (estados visibles y conteo de Plazas, nunca detalle interno)

## Comments

**2026-09-27 (agente):** Implementado el módulo puro de dominio (`src/domain/`) con el ciclo de vida completo de la Inscripción y el estado del Evento, sin acoplamiento a React ni Supabase:
- `tipos.ts`: Tipado estricto de entidades (`Evento`, `Inscripcion`), comandos, resultados (uniones discriminadas) y errores de dominio.
- `telefono.ts`: Normalizador puro a formato estándar es-ES (`+34XXXXXXXXX`) con validación estricta de números españoles (móvil y fijo).
- `puerto-repositorio.ts`: Contrato del puerto de persistencia (`RepositorioEvento`).
- `adaptador-memoria.ts`: Implementación en memoria (`RepositorioEnMemoria`) con clonado inmutable para testing.
- `dominio-inscripciones.ts`: Orquestador de operaciones de ambos actores (`apuntarJugador`, `cancelarInscripcion`, `confirmarPendiente`, `rechazarPendiente`, `reordenarListaEspera`, `obtenerEstadoEvento`) garantizando la invariante de deduplicación y la Promoción atómica según ADR-0003.
- Suite de tests de comportamiento con Vitest (24 tests en verde) cubriendo el 100% de las reglas del grilling en el seam público sin detalles de almacenamiento ni UI.
- Integrado `vitest` en scripts de `package.json` y en el pipeline de GitHub Actions CI. Build, lint y typecheck verificados en verde.
