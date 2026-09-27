"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signInAction, type AuthFormState } from "../actions";
import { AUTH_INPUT_CLASS, AuthShell } from "@/components/auth-shell";
import { SubmitButton } from "@/components/submit-button";

export default function LoginPage() {
  const [state, formAction] = useActionState<AuthFormState, FormData>(
    signInAction,
    {},
  );

  return (
    <AuthShell
      title="Brasipoker"
      subtitle="Partidas privadas de póker, sin caos."
      footer={
        <>
          ¿No tienes cuenta?{" "}
          <Link
            href="/signup"
            className="font-medium text-emerald-300 underline underline-offset-4"
          >
            Crea una
          </Link>
        </>
      }
    >
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
            className={AUTH_INPUT_CLASS}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span>Contraseña</span>
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            required
            className={AUTH_INPUT_CLASS}
          />
        </label>
        <SubmitButton>Entrar</SubmitButton>
      </form>
    </AuthShell>
  );
}
