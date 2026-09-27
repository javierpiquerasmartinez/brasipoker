import { describe, it, expect } from "vitest";
import { viewport } from "@/app/layout";
import { AUTH_INPUT_CLASS } from "@/components/auth-shell";
import fs from "fs";
import path from "path";

describe("Mobile UX & Responsive Fixes (Issues 09 & 10)", () => {
  describe("Issue 09: Eliminar zoom automático en inputs móviles", () => {
    it("configura viewport en layout.tsx con maximumScale: 1 y userScalable: false", () => {
      expect(viewport).toBeDefined();
      expect(viewport.maximumScale).toBe(1);
      expect(viewport.userScalable).toBe(false);
    });

    it("contiene reglas CSS en globals.css para forzar font-size de al menos 16px en inputs móviles", () => {
      const globalsCssPath = path.resolve(process.cwd(), "src/app/globals.css");
      const cssContent = fs.readFileSync(globalsCssPath, "utf-8");

      // Verify mobile rule ensures 16px for input, select, textarea
      expect(cssContent).toMatch(/font-size:\s*16px/);
      expect(cssContent).toMatch(/input/);
      expect(cssContent).toMatch(/select/);
      expect(cssContent).toMatch(/textarea/);
    });

    it("AUTH_INPUT_CLASS asegura un tamaño de fuente de al menos 16px en móvil (text-base)", () => {
      expect(AUTH_INPUT_CLASS).toMatch(/text-base/);
    });

    it("public-player-view.tsx asegura tamaños de fuente de al menos 16px en móvil (text-base)", () => {
      const publicViewPath = path.resolve(
        process.cwd(),
        "src/app/p/[slug]/public-player-view.tsx"
      );
      const publicViewContent = fs.readFileSync(publicViewPath, "utf-8");

      expect(publicViewContent).toMatch(/id="lookup-phone"[\s\S]*?text-base/);
      expect(publicViewContent).toMatch(/id="input-nickname"[\s\S]*?text-base/);
      expect(publicViewContent).toMatch(/id="input-phone"[\s\S]*?text-base/);
      expect(publicViewContent).toMatch(/id="input-estimated-time"[\s\S]*?text-base/);
    });

    it("live-roster-view.tsx asegura tamaños de fuente de al menos 16px en móvil (text-base)", () => {
      const liveRosterPath = path.resolve(
        process.cwd(),
        "src/app/panel/eventos/[id]/live-roster-view.tsx"
      );
      const liveRosterContent = fs.readFileSync(liveRosterPath, "utf-8");

      expect(liveRosterContent).toMatch(/id="input-manual-nickname"[\s\S]*?text-base/);
      expect(liveRosterContent).toMatch(/id="input-manual-phone"[\s\S]*?text-base/);
      expect(liveRosterContent).toMatch(/id="input-edit-nickname"[\s\S]*?text-base/);
    });
  });

  describe("Issue 10: Corregir solapamiento de fecha y hora en modales de evento", () => {
    it("los campos de fecha y hora en organizer-dashboard.tsx usan grid-cols-1 sm:grid-cols-2 y min-w-0", () => {
      const dashboardPath = path.resolve(
        process.cwd(),
        "src/app/panel/organizer-dashboard.tsx"
      );
      const dashboardContent = fs.readFileSync(dashboardPath, "utf-8");

      // Neither create modal nor edit modal should use rigid grid-cols-2 without responsive breakdown
      const dateHourGridRegex = /grid\s+grid-cols-1\s+sm:grid-cols-2\s+gap-3/g;
      const matches = dashboardContent.match(dateHourGridRegex);
      // Both Create and Edit modals must use the responsive single-column to two-column grid
      expect(matches).not.toBeNull();
      expect(matches?.length).toBeGreaterThanOrEqual(2);

      // Verify min-w-0 is used to prevent native date picker from overflowing
      expect(dashboardContent).toMatch(/min-w-0/);
    });
  });
});
