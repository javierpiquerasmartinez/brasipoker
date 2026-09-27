# 09: Eliminar zoom automático al hacer focus en inputs móviles

**What to build:** Al interactuar y enfocar cualquier campo de texto en dispositivos móviles (login/registro, inscripción pública de jugador, búsqueda de plazas y formularios de gestión del panel), la pantalla ya no hace zoom involuntario hacia el input, preservando la escala y la sensación fluida de aplicación nativa (PWA).

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] Todos los elementos interactivos de formulario (`input`, `select`, `textarea`) tienen un tamaño de fuente de al menos 16px en dispositivos móviles para que WebKit/Safari no dispare el auto-zoom de accesibilidad.
- [x] La configuración del `viewport` en el layout raíz (`src/app/layout.tsx`) fija la escala máxima a 1 y desactiva el reescalado involuntario en modo app/PWA.
- [x] Verificado visualmente y sin regresiones en las tres superficies clave: autenticación, vista pública de inscripción/localización del jugador y paneles del organizador.
- [x] La suite de tests existente y el typecheck siguen ejecutándose 100% en verde.
