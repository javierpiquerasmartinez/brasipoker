"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-2 rounded-lg bg-felt-700 px-4 py-2.5 font-semibold text-white transition-colors hover:bg-felt-800 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Un momento…" : children}
    </button>
  );
}
