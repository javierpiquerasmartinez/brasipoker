"use client";

import { SpadeLogo } from "@/components/spade-logo";

export const AUTH_INPUT_CLASS =
  "rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-base sm:text-sm text-chip placeholder:text-white/40 focus:border-felt-700 focus:outline-none focus:ring-2 focus:ring-felt-700";

export function AuthShell({
  title,
  subtitle,
  footer,
  children,
}: {
  title: string;
  subtitle: string;
  footer: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <main className="grid min-h-dvh place-items-center bg-felt-950 px-4 py-10">
      <section className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <SpadeLogo className="h-14 w-14 text-chip" />
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="text-sm text-chip/70">{subtitle}</p>
        </div>
        {children}
        <p className="mt-4 text-center text-sm text-chip/70">{footer}</p>
      </section>
    </main>
  );
}
