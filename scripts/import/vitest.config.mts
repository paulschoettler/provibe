import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Tests der Importskripte (Parser, Mapping, Pfandrechnung). Eigene Konfiguration, weil die
 * Hauptkonfiguration nur src/** einsammelt. Aufruf: pnpm test:import
 */
export default defineConfig({
  test: {
    root: path.resolve(import.meta.dirname, "../.."),
    include: ["scripts/import/**/*.test.ts"],
    environment: "node",
  },
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "../../src") } },
});
