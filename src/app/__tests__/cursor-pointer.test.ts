import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("Clickable Elements Cursor Pointer UX", () => {
  it("globals.css sets cursor: pointer for buttons, inputs, selects, and checkbox/radio labels", () => {
    const globalsCssPath = path.resolve(process.cwd(), "src/app/globals.css");
    const cssContent = fs.readFileSync(globalsCssPath, "utf-8");

    // Base rules for clickable elements
    expect(cssContent).toMatch(/button:not\(:disabled\)/);
    expect(cssContent).toMatch(/\[role="button"\]/);
    expect(cssContent).toMatch(/\[type="submit"\]/);
    expect(cssContent).toMatch(/\[type="checkbox"\]/);
    expect(cssContent).toMatch(/select:not\(:disabled\)/);
    expect(cssContent).toMatch(/cursor:\s*pointer;/);

    // Disabled state
    expect(cssContent).toMatch(/cursor:\s*not-allowed;/);

    // Checkbox and radio label hover UX
    expect(cssContent).toMatch(/label:has\(input\[type="checkbox"\]/);
  });

  it("organizer-dashboard.tsx waitlist toggle containers are clickable labels with cursor-pointer", () => {
    const dashboardPath = path.resolve(
      process.cwd(),
      "src/app/panel/organizer-dashboard.tsx"
    );
    const content = fs.readFileSync(dashboardPath, "utf-8");

    expect(content).toMatch(/htmlFor="create-waitlist-toggle"[\s\S]*?cursor-pointer/);
    expect(content).toMatch(/htmlFor="edit-waitlist-toggle"[\s\S]*?cursor-pointer/);
  });

  it("key interactive buttons contain cursor-pointer class", () => {
    const dashboardPath = path.resolve(
      process.cwd(),
      "src/app/panel/organizer-dashboard.tsx"
    );
    const dashboardContent = fs.readFileSync(dashboardPath, "utf-8");
    expect(dashboardContent).toMatch(/id="btn-crear-evento"[\s\S]*?cursor-pointer/);
    expect(dashboardContent).toMatch(/id="tab-proximos"[\s\S]*?cursor-pointer/);

    const publicViewPath = path.resolve(
      process.cwd(),
      "src/app/p/[slug]/public-player-view.tsx"
    );
    const publicContent = fs.readFileSync(publicViewPath, "utf-8");
    expect(publicContent).toMatch(/id="btn-submit-register"[\s\S]*?cursor-pointer/);

    const liveRosterPath = path.resolve(
      process.cwd(),
      "src/app/panel/eventos/[id]/live-roster-view.tsx"
    );
    const liveContent = fs.readFileSync(liveRosterPath, "utf-8");
    expect(liveContent).toMatch(/id="btn-alta-manual"[\s\S]*?cursor-pointer/);
    expect(liveContent).toMatch(/id="btn-reducir-cupo"[\s\S]*?cursor-pointer/);
  });
});
