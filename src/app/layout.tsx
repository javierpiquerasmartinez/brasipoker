import type { Metadata, Viewport } from "next";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Brasipoker",
    template: "%s · Brasipoker",
  },
  description:
    "Convocatorias de partidas privadas de póker: quién va, quién espera, en vivo.",
  applicationName: "Brasipoker",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Brasipoker",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0A3826",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
