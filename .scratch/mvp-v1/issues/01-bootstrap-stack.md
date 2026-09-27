# 01: Bootstrap del stack

**What to build:** La base técnica sobre la que corre Brasipoker: Next.js + Tailwind como PWA con Supabase conectado y desplegado en Vercel (ADR-0001). Un Organizador puede crear su cuenta y entrar con email+password. Queda demoable: la PWA instalable desde el móvil y un Organizador real logado en la HOME del panel.

**Blocked by:** None (can start immediately)

**Status:** ready-for-human

- [x] App Next.js + Tailwind arrancada con TypeScript estricto y lint operativos
- [x] Configurada como PWA (manifest, iconos, meta móvil) — instalable en pantalla de inicio
- [ ] Proyecto Supabase conectado (env vars, cliente tipado) y despliegue en Vercel en verde
- [x] Login del Organizador con email + contraseña (Supabase Auth) con sesión persistente
- [x] Signup abierto de Organizadores operativo (base del multi-tenant de 04)
- [x] CI verde (build + lint) en cada push

## Comments

**2026-09-27 (agente):** Implementado todo lo que no requiere cuentas del usuario: Next.js 16 (App Router, TS estricto, Tailwind v4, ESLint 9 flat config), PWA completa (`src/app/manifest.ts` + iconos generados con `npm run icons` + service worker transparente en `public/sw.js` + metas iOS), cliente Supabase tipado por los tres accesos (browser/server/proxy — nota: Next.js 16 renombró `middleware.ts` a `proxy.ts`, runtime Node), login/signup con server actions y sesión persistente en cookies, `/panel` protegido con guard en layout + proxy, CI de GitHub Actions con lint+typecheck+build. Verificado localmente: lint, typecheck, build y smoke de rutas (/, /panel → redirect a /login; /login renderiza; manifest/sw/iconos sirven). Con los placeholders de `.env.example` en `.env.local` la app degrada con gracia (rutas y guards funcionan; solo el alta/entrada falla hasta tener proyecto real). Sin `.env.local` la app no arranca — fallo explícito de configuración.

Pendiente de humano (por eso queda abierta la caja de Supabase+Vercel): crear el proyecto en Supabase y rellenar `.env.local` (pasos en README), importar el repo en Vercel con las dos variables de entorno antes del primer deploy, y confirmar el checklist de humo del spec (login real + PWA instalable en el móvil).

Se planteó usar Neon en lugar de Supabase: se mantiene Supabase porque Auth (email+password) + Realtime + RLS-JWT vienen en un solo servicio (Neon es solo Postgres y obligaría a traer auth y realtime por separado); el dominio queda tras un puerto de repositorio, así que migrar más adelante solo cuesta el migrado de datos. ADR-0001 sigue vigente.
