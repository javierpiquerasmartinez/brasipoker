import Link from "next/link";
import { redirect } from "next/navigation";
import { signOutAction } from "@/app/(auth)/actions";
import { SpadeLogo } from "@/components/spade-logo";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Panel del Organizador",
};

export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-dvh flex-col bg-felt-950">
      <header className="border-b border-white/10 bg-felt-900/60 backdrop-blur">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/panel" className="flex items-center gap-2 font-bold">
            <SpadeLogo className="h-6 w-6 text-chip" />
            Brasipoker
          </Link>
          <div className="flex items-center gap-3 text-sm">
            {user.email ? (
              <span className="hidden text-chip/70 sm:inline">{user.email}</span>
            ) : null}
            <form action={signOutAction}>
              <button
                type="submit"
                className="rounded-lg border border-white/15 px-3 py-1.5 text-chip/80 transition-colors hover:bg-white/10"
              >
                Salir
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
        {children}
      </main>
    </div>
  );
}
