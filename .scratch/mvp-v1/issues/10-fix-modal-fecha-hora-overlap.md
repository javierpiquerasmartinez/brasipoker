# 10: Corregir solapamiento de fecha y hora en modales de evento

**What to build:** En dispositivos móviles, los campos de Fecha y Hora de inicio en los modales de Crear Convocatoria y Editar Convocatoria se adaptan de forma responsive (apilados en 1 columna en pantallas móviles estrechas y en 2 columnas en pantallas medianas/grandes), evitando que el input nativo de fecha desborde su contenedor e invada o se solape sobre el campo de hora.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] Los campos de Fecha y Hora en el modal de Crear Convocatoria se adaptan responsive (`grid-cols-1 sm:grid-cols-2`) con `min-w-0` sin desbordamiento ni solapamiento en anchos móviles.
- [x] Los campos de Fecha y Hora en el modal de Editar Convocatoria se adaptan responsive (`grid-cols-1 sm:grid-cols-2`) con `min-w-0` sin desbordamiento ni solapamiento en anchos móviles.
- [x] Verificado visualmente en anchos de pantalla estrechos (~375px–430px) y escritorio (`sm:` en adelante).
- [x] La suite de tests y typecheck siguen ejecutándose 100% en verde.
