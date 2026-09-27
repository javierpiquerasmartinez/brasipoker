# 04: Persistencia Supabase + RLS multi-tenant

**What to build:** El dominio de 02/03 deja de vivir en memoria: esquema en Supabase, adaptador de producción del puerto e isolamento por RLS, de modo que cada Organizador solo acceda a sus propios Eventos (ADR-0001). Todo lo demás ya es fungible encima: los tests del dominio siguen en memoria; producción persiste de verdad.

**Blocked by:** 03

**Status:** ready-for-agent

- [ ] Esquema Postgres con tablas de Jugador (teléfono normalizado, clave única), Evento (slug, tipo, fecha/hora, Cupo, nota, flag de espera, estado) e Inscripción (Evento, Jugador, apodo, estado, Llegada tardía+hora, atribución de cancelación, posición de espera)
- [ ] Índice único parcial refuerza la invariante de una Inscripción activa por (Evento, teléfono)
- [ ] Cancelados se conservan (nada se borra)
- [ ] Adaptador Supabase del puerto — dominio intacto; la lámpara transaccional de Promoción / cambio de Cupo queda garantizada sin carreras
- [ ] RLS: Organizador solo accede a SUS Eventos; la página pública del Enlace accede de lectura al Evento por slug sin autenticación
- [ ] Migraciones versionadas y aplicables en despliegue
