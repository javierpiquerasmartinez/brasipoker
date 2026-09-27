# Spec: MVP v1 — Brasipoker

Status: ready-for-agent

Espec derivada de la sesión de grilling completa (4 rondas, frontera vacía confirmada por el usuario). Vocabulario normativo: `CONTEXT.md`. Decisiones registradas: ADR-0001 (stack), ADR-0002 (teléfono como identidad), ADR-0003 (Promoción con Pendiente de confirmación).

## Problem Statement

Un Organizador de partidas privadas de póker gestiona hoy las convocatorias a mano: listas en WhatsApp, mensajes sueltos, gente que se apunta y se borra, y el caos de "¿cómo van las plazas?" a las 20:50. Nunca sabe realmente quién va, quién está en espera, a qué hora llega cada uno, y se pasa la noche reutilizando mensajes contando plazas. Los Jugadores, además, se niegan a descargar una app solo para apuntarse a un cash de su grupo.

## Solution

Una web app (PWA, sin descarga en tiendas) donde el Organizador crea un Evento (Cash o Torneo), recibe un mensaje listo para pegar en WhatsApp con su Enlace, y ve en vivo — en tres secciones — quién está Confirmado, quién aguarda en la Lista de espera y quién lo Cancelado, con los teléfonos a mano. Los Jugadores abren el Enlace, se apuntan con solo apodo y teléfono (identidad por teléfono, sin cuentas), eligen si entran desde el inicio o con Llegada tardía (con hora estimada), ven su estado y su posición en la Lista de espera, y se cancelan solos cuando no van. La Promoción ocupa la Plaza al instante y deja al promovido Pendiente de confirmación del Organizador, que decide quién entra de verdad y prioriza a los que llegan de inicio.

## User Stories

### Cuenta y acceso del Organizador

1. As an Organizador, I want to create my account with email and password, so that I can manage my Eventos.
2. As an Organizador, I want to log in and stay logged in, so that I can operate quickly the night of the game.
3. As an Organizador, I want my Eventos isolated from other Organizadores' Eventos, so that no other club can see or touch my games.

### Crear y difundir un Evento

4. As an Organizador, I want to create an Evento choosing tipo Cash or Torneo, so that the Jugador knows what he is signing up for.
5. As an Organizador, I want to define date, start time, Cupo and a descriptive note (e.g. "Ciega 1/2 - Mínimo 50€"), so that the Enlace carries all essential info.
6. As an Organizador, I want the option to disable the Lista de espera for a concrete Evento, so that I can run closed-roster games without a queue.
7. As an Organizador, I want the system to generate a WhatsApp-ready message (with Emojis, summary and the Enlace), so that I can share it in seconds without writing anything.
8. As an Organizador, I want to edit the generated message before copying, so that I can tweak the wording per group.
9. As an Organizador, I want the Enlace page to always show the live Evento state, so that a WhatsApp snapshot text never misleads anyone.
10. As an Organizador, I want a short random Enlace (with no incremental IDs), so that it is easy to paste and names are not guessable.

### Monitor the Evento live

11. As an Organizador, I want to see the roster in three sections — Confirmados / Lista de espera / Cancelados — updating in real time, so that I manage the night without manual lists.
12. As an Organizador, I want to see the occupied/total count of Plazas at a glance, so that I know how full the game is.
13. As an Organizador, I want a clear visual indicator of whether an Evento is upcoming, in progress, or past, so that I don't misread the list of games.
14. As an Organizador, I want to see the phone number of every registered Jugador, so that I can reach them (e.g. people who call me).
15. As an Organizador, I want the Cancelados section to show who triggered each cancelación (Jugador himself vs. me), so that I know why someone came off.
16. As an Organizador, I want promoted players in Pendiente de confirmación highlighted as such, so that I don't forget to resolve them.
17. As an Organizador, I want to see the promised "hora estimada de llegada" per Llegada tardía, so that I can seat players as they show up.

### Manage players and Inscripciones

18. As an Organizador, I want to add a Jugador manually with apodo and phone obligatorio, so that someone who calls by phone can join.
19. As an Organizador, I want manual altas to obey the same rules as the Enlace (with free Cupo → Confirmado; with full Cupo → end of the Lista de espera), so that the state machine stays coherent.
20. As an Organizador, I want to reorder the Lista de espera, so that I can set the Promoción order.
21. As an Organizador, I want to fix any Inscripción data (apodo, Llegada tardía flag and hour), so that mistakes don't force a cancelación + reinscripción.
22. As an Organizador, I want to cancel any Inscripción, so that dead entries don't block Plazas.
23. As an Organizador, I want to confirm a Pendiente de confirmación, so that the promoted Jugador is definitively in.
24. As an Organizador, I want to reject a Pendiente de confirmación, so that I can prioritise early-arrival players and the Promoción continues with the next in the Lista de espera.
25. As an Organizador, I want the Promoción to obtain its Plaza in the same instant it fires, so that no two promoted players and no overlapping slots ever collide.

### Reducir / ampliar Cupo

26. As an Organizador, I want to reduce the Cupo below the current Confirmados and see the displaced ones moved to the (a)front of the Lista de espera (preserving their relative order), so that nobody loses their standing unfairly.
27. As an Organizador, I want to increase the Cupo and see as many Promociones in cascade as freed Plazas, so that the game refills automatically.

### Edit / cancel the Evento

28. As an Organizador, I want to edit an Evento's date, time, Cupo or note after sharing the Enlace, so that changes reach everybody without re-sending anything.
29. As an Organizador, I want to cancel a whole Evento, so that every active Inscripción closes as Cancelado (provoked by the Organizador) and its Enlace page shows a permanent banner.
30. As an Organizador, I want my upcoming Eventos listed in chronological order (próximos / pasadas split), so that I can find the game of tonight in one glance.

### Jugador: view and register

31. As a Jugador, I want to open the Enlace on my phone and see tipo, date, time, the note and how many Plazas are taken, so that I can decide on the spot without installing anything.
32. As a Jugador, I want to register with just my apodo and phone number, so that it takes 10 seconds and I never create accounts.
33. As a Jugador, I want to choose "desde el inicio" or "Llegaré más tarde" (with hora obligatoria in the latter), so that the Organizador knows when I come.
34. As a Jugador, I want an immediate confirmation screen with my resulting state, so that I know I am in.
35. As a Jugador, I want to see my position in the Lista de espera when the Cupo is full, so that I know my chances ("Estás en el puesto #2").
36. As a Jugador, I want to see the registered players by apodo (and a "llegará tarde" indicator without the hour), so that I know who is coming.
37. As a Jugador, I want to access my own Inscripción by entering the phone I registered with, so that I can see and manage my own state.
38. As a Jugador, I want to cancel my Inscripción from the Enlace page, so that I free the Plaza when I can't come.
39. As a Jugador, I want to register again after canceling, so that I can change my mind; in a full Evento I go to the end of the Lista de espera.
40. As a Jugador, I want the system to tell me "ya estás apuntado" (and show my Inscripción) if I register twice with the same phone, so that no duplicates are created.
41. As a Jugador, I want the phone to never be publicly visible, so that my number is not exposed to everyone with the Enlace.

### System-level domain behaviors

42. As an Organizador, I want the Promoción to fire automatically when a Plaza frees up (cancelación, rechazo or aumento de Cupo), so that I don't run the queue by hand.
43. As an Organizador, I want promoted players to stay Pendiente de confirmación indefinitely (no timeout) until I decide, so that the MVP doesn't need notifications.
44. As an Organizador, I want a cancelación to be attributed (by the Jugador himself or by me), so that the history is honest.
45. As an Organizador, I want no clock-based automatic transitions after the start time, so that the game stays manageable all night long.
46. As an Organizador, I want each Jugador to hold at most one active Inscripción per Evento, so that the roster is always one-slot-one-player.

## Implementation Decisions

- **Stack (ADR-0001):** Next.js + Tailwind como PWA; Supabase (Postgres + Auth + Realtime); hosting en Vercel. Auth del Organizador: email + password (magic link fuera de v1).
- **Multi-tenant:** signup abierto de Organizadores; aislamiento estricto por RLS en Supabase: cada Organizador solo accede a sus propios Eventos.
- **Identidad (ADR-0002):** el teléfono normalizado (sin espacios ni prefijos ambiguos; formato es-ES) es la clave del Jugador; el Jugador persiste entre Eventos. El apodo es dato declarado de la Inscripción (editable por el Organizador). Sin OTP, sin verificación: riesgo de suplantación aceptado para grupos de confianza.
- **Un único módulo de dominio profundo:** toda la lógica del producto (Evento, Inscripciones, Plazas, Lista de espera, Promoción, texto de WhatsApp) vive en UN módulo puro, sin dependencias de Supabase ni React. Su interfaz pública es las operaciones de los dos actores: crear/editar/cancelar Evento, apuntar (vía Enlace o manual), cancelar Inscripción, confirmar/rechazar Pendiente de confirmación, reordenar Lista de espera, editar Inscripción, cambiar Cupo, generar texto de WhatsApp. Ninguna regla de negocio puede vivir fuera de este módulo.
- **Persistencia por puerto:** el dominio define un repositorio (puerto); dos adaptadores: en memoria (tests) y Supabase Postgres (producción). La UI es pegamento: pinta estados y llama al dominio.
- **Máquina de estados de la Inscripción:** `Confirmado` (ocupa Plaza, alta directa con Cupo disponible), `Pendiente de confirmación` (ocupa Plaza, solo procede de Promoción; solo se resuelve con el Organizador: confirmar → Confirmado; rechazar → Cancelado provocada por el Organizador y la Promoción continúa con el siguiente), `Cancelado` (terminal; registra quién la provocó: Jugador u Organizador). No hay edición por parte del Jugador: solo apuntarse, ver su estado y cancelarse.
- **Promoción (ADR-0003):** al liberarse una Plaza (cancelación, rechazo de un pendiente, reducción/contracción no — solo cancelación/rechazo/aumento), el primero de la Lista de espera pasa a Pendiente de confirmación ocupando su Plaza atómicamente. Sin timeout ni auto-expiración. La cola nunca re-promueve sola tras rechazar: la siguiente Promoción usa el orden vigente de la Lista de espera.
- **Cupo:** reducir por debajo de los Confirmados desplaza a los últimos Confirmados al *principio* de la Lista de espera conservando su orden relativo; ampliar dispara N Promociones en cascada hasta rellenar o agotar la lista. Cambiar Cupo es una operación explícita del Organizador.
- **Deduplicación:** como máximo una Inscripción activa por (Evento, teléfono). Segundo intento → se muestra la Inscripción existente, no se crea duplicado. Tras cancelar, la Reinscripción crea una Inscripción nueva (al final de la Lista de espera si está lleno). En Supabase se refuerza con índice único parcial sobre Inscripciones activas; la invariante también la guarda el dominio.
- **Listas:** Confirmados es un conjunto (sin orden interno, sin asientos); la Lista de espera es una lista ordenada explícita, reordenable solo por el Organizador (drag); el resto del orden es llegada.
- **Lista de espera desactivable:** si el Organizador la desactiva en la creación, al agotarse el Cupo el enlazado ve "Evento completo" y no entra en cola. Toma del PRD que no se griló explícitamente: primer punto a revisar si choca con algo.
- **Cancelación del Evento:** estado terminal del Evento (Activo → Cancelado, solo por el Organizador); todas las Inscripciones activas pasan a Cancelado (provocada por el Organizador); la página del Enlace muestra aviso permanente y no acepta altas. No se puede reactivar (se crea otro Evento).
- **Sin transiciones por reloj:** nada cambia solo al pasar la hora de inicio; solo indicador visual "en curso / pasado" en el panel. El Evento activo acepta altas y cancelaciones hasta que el Organizador lo cierre.
- **Enlace y difusión:** slug corto aleatorio no-guessable (p. ej. `/p/Xk29fDq`), sin IDs incrementales ni slug editable. El mensaje de WhatsApp es una función pura del dominio (plantilla inicial con Emojis: ♠️📣 fecha, hora, Mesa/nota, Plazas, Enlace) — el Organizador la edita antes de copiar; el Enlace nunca cambia. El mensaje difundido es instantánea; la autoridad es la página del Enlace.
- **Privacidad pública:** la página del Enlace muestra solo apodos (más indicador "llegará tarde" sin hora) y posiciones de la Lista de espera; nunca teléfonos. Panel del Organizador: teléfonos visibles.
- **UI:** dos superficies — panel del Organizador (con Realtime de Supabase) y la página pública del Enlace (también en vivo). Sin landing pública ni páginas de marketing: rutas públicas = Enlace + login del Organizador. Sin i18n: solo español, formato es-ES, horas locales de España (sin maquinaria de zonas horarias).
- **Esquema (alto nivel):** tablas de Jugador (teléfono normalizado clave única), Evento (slug, tipo Cash/Torneo, fecha/hora, Cupo, nota, flag Lista de espera, estado) e Inscripción (evento, Jugador, apodo, estado, marca/hora de Llegada tardía, atribución de cancelación, posición en Lista de espera). Historial: los Cancelados se conservan; no se borra nada.

## Testing Decisions

- **Un único seam de tests:** el módulo de dominio, ejecutado como módulo puro contra el repositorio en memoria (fake del puerto). Nada de React ni Supabase dentro de los tests de dominio. Cada regla del grilling es un test de comportamiento en ese nivel: máquina de estados de la Inscripción, Promoción atómica, desplazados al frente al reducir Cupo, Promociones en cascada al ampliarlo, Reinscripción al final, deduplicación por teléfono, alta manual == alta por Enlace, Evento cancelado en masa, y orden vigente de la Lista de espera tras reordenar.
- **Qué es un buen test aquí:** comportamiento externo observable — dado un Evento en un estado, cuando un actor ejecuta una operación pública del dominio, entonces los estados visibles de Inscripciones y el conteo de Plazas son X. Nunca: nombres de tablas, detalles de orden interno, ni llamadas a Supabase.
- **La plantilla de WhatsApp** se testea en el mismo seam (es función pura del dominio): formato correcto para Cash y Torneo.
- **Prior art:** no existe — repo greenfield. Estos tests establecen el patrón: un solo fichero (o pocos) de suites de dominio con fixtures de Evento apuntado/lleno/con espera.
- **Protección del resto (sin tests):** TypeScript estricto y el contrato del puerto obligan a que la UI y el adaptador de Supabase encajen (no compila si el dominio cambia). Verificación por **checklist manual de humo** antes de cada release: (1) crear Evento y generar/copy el mensaje; (2) abrir el Enlace en el móvil, apuntarse desde el inicio; (3) llenar el Cupo, apuntar uno más → Lista de espera con puesto visible; (4) cancelar uno → el primero de espera pasa a Pendiente de confirmación; (5) rechazarlo → el siguiente entra; (6) reducir Cupo → desplazados al frente; (7) ampliar → cascada; (8) cancelar el Evento → banner y masacra; (9) panel actualizándose en vivo sin refresh (Realtime). Opcional, post-MVP: smoke de Playwright solo sobre el flujo del Enlace.

## Out of Scope

- **Fase 2:** check-in/check-out con QR, motor de puntuación por horas jugadas, leaderboard.
- **Fase 3:** bot de WhatsApp / Business API (notificaciones push, recordatorios, aviso de promoción al promovido).
- **Fase 4:** rebuys/add-ons, banca/rake, perfil del Jugador con estadísticas.
- Magic link y cualquier segunda vía de autenticación del Organizador.
- Notificaciones de cualquier tipo (el estado Pendiente de confirmación no avisa a nadie: el panel es el canal).
- Múltiples mesas por Evento, alta de invitados/slots extra por Jugador, edición autogestionada de datos por el Jugador, límite de tamaño de la Lista de espera, verificación del teléfono por OTP, i18n y zonas horarias, landing pública.
- Herramientas anti-suplantación (el riesgo lo cubre ADR-0002 como decisión consciente).

## Further Notes

- El toggle "Lista de espera Activado/Desactivado" del PRD no se griló explícitamente: primera cosa a revalidar si entra en conflicto al implementar.
- El único flujo público crítico es la página del Enlace; todo lo demás tras login. El Realtime (panel y página pública en vivo) usa canales de Supabase sobre la misma base de datos del dominio — el dominio no conoce Realtime, es un detalle del adaptador de presentación.
- La spec es la primera pieza en `.scratch/mvp-v1/`; el despiece en tickets (`/to-tickets`) debería empezar por el módulo de dominio (seam único) + esquema Supabase, y después la UI del Enlace (público, crítico) y el panel.
