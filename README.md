# Brasipoker

Convocatorias de partidas privadas de póker: quién va, quién espera, en vivo.
PWA para el Organizador (crea el Evento, difunde el Enlace por WhatsApp y
monitoriza la noche) y para el Jugador (se apunta desde el móvil en segundos,
sin cuentas ni descargas).

## Stack

[ADR-0001](docs/adr/0001-stack-supabase-nextjs-vercel.md): Next.js
(App Router, TypeScript estricto) + Tailwind CSS como PWA, Supabase
(Auth ahora; Postgres, Realtime y RLS en los siguientes hitos) y Vercel
como hosting.

## Requisitos

- Node.js 24+
- npm 11+

## Puesta en marcha local

```bash
npm install
cp .env.example .env.local
# Rellena .env.local con los valores de tu proyecto de Supabase
npm run dev
```

Sin proyecto de Supabase todavía: con los placeholders de `.env.local`
la app arranca, el login redirige correctamente y `/panel` queda
protegido; el registro/entrada dará error hasta rellenar valores
reales. Sin `.env.local` la app no arranca (fallo explícito de
configuración).

## Crear el proyecto de Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com/dashboard)
   (plan gratuito). Elige una región cercana a España y guarda la
   contraseña de la base de datos.
2. En **Project Settings → Data API**, copia la **Project URL**.
3. En **Project Settings → API keys**, copia la clave **anon public**.
4. Pega ambos valores en `.env.local`:

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   ```

5. En **Authentication → Sign In / Up → Providers → Email**, deja el
   provider de Email activo. Para el MVP se recomienda desactivar
   **Confirm email** (grupos de confianza, sin fricción); si lo dejas
   activo, el alta pedirá confirmar el correo antes de entrar.

Con esto ya puedes registrarte como Organizador (`/signup`), entrar
(`/login`) y quedar logado en el panel (`/panel`).

## Despliegue en Vercel

1. Importa el repositorio en Vercel (framework: **Next.js**, detectado
   automáticamente).
2. **Antes del primer deploy**, añade en **Settings → Environment
   Variables** las dos variables del punto anterior
   (`NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
   Las variables `NEXT_PUBLIC_*` se incrustan en el bundle en el
   momento del build, así que si ya desplegaste sin ellas, lanza un
   **Redeploy** tras configurarlas.
3. Despliega y verifica que `/login` carga y el login funciona.

## PWA

La app es instalable en pantalla de inicio (manifest + service worker
+ iconos). En el móvil: abrir la URL → "Añadir a pantalla de inicio".
Para regenerar los iconos (p. ej. tras cambiar diseño o colores):

```bash
npm run icons
```

## Scripts

| Comando              | Descripción                                    |
| -------------------- | ---------------------------------------------- |
| `npm run dev`        | Servidor de desarrollo                         |
| `npm run build`      | Build de producción                            |
| `npm run start`      | Sirve el build de producción                   |
| `npm run lint`       | ESLint                                         |
| `npm run typecheck`  | Genera tipos de rutas y ejecuta `tsc --noEmit` |
| `npm run icons`      | Regenera los iconos PWA                        |

## CI

GitHub Actions (`.github/workflows/ci.yml`) ejecuta lint, typecheck y
build en cada push a `main` y en cada pull request.

## Documentación

- Spec y tickets del MVP v1: `.scratch/mvp-v1/`
- Decisiones de arquitectura: `docs/adr/`
- Flujo de trabajo de agentes: `AGENTS.md` y `docs/agents/`
