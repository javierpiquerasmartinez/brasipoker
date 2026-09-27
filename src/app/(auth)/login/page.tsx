"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signInAction, type AuthFormState } from "../actions";
import { SpadeLogo } from "@/components/spade-logo";
import { SubmitButton } from "@/components/submit-button";

const INPUT_CLASS =
  "rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-chip placeholder:text-white/40 focus:border-felt-700 focus:outline-none focus:ring-2 focus:ring-felt-700";

export default function LoginPage() {
  const [state, formAction] = useActionState<AuthFormState, FormData>(
    signInAction,
    {},
  );

  return (
    <main className="grid min-h-dvh place-items-center bg-felt-950 px-4 py-10">
      <section className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <SpadeLogo className="h-14 w-14 text-chip" />
          <h1 className="text-2xl font-bold">Brasipoker</h1>
          <p className="text-sm text-chip/70">
            Partidas privadas de póker, sin caos.
          </p>
        </div>
        <form
          action={formAction}
          className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-felt-900 p-6 shadow-xl"
        >
          {state.error ? (
            <p
              role="alert"
              className="rounded-lg bg-red-950/60 px-3 py-2 text-sm text-red-200"
            >
              {state.error}
            </p>
          ) : null}
          <label className="flex flex-col gap-1.5 text-sm">
            <span>Correo electrónico</span>
            <input
              type="email"
              name="email"
              autoComplete="email"
              required
              className={INPUT_CLASS}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span>Contraseña</span>
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              required
              className={INPUT_CLASS}
            />
          </label>
          <SubmitButton>Entrar</SubmitButton>
        </form>
        <p className="mt-4 text-center text-sm text-chip/70">
          ¿No tienes cuenta?{" "}
          <Link
            href="/signup"
            className="font-medium text-emerald-300 underline underline-offset-4"
          >
            Crea una
          </Link>
        </p>
      </section>
    </main>
  );
}
